import { enigmaState } from "./enigmaState.js";

// Global toggle for Visualization
export let isVizEnabled = false;

// 🌟 NEW: Global state for the Flowing Energy
export let isFlowEnabled = false;


// 🌟 NEW: Function to toggle the continuous energy flow
export function toggleFlow() {
    isFlowEnabled = !isFlowEnabled;
    
    // Instantly hide or reveal all existing energy streams on the board
    document.querySelectorAll(".signal-flow-group").forEach(group => {
        group.style.display = isFlowEnabled ? "block" : "none";
    });
    
    return isFlowEnabled;
}



export function toggleVisualization() {
    isVizEnabled = !isVizEnabled;
    
    // If turned off, instantly wipe any existing glowing lines and rings
    if (!isVizEnabled) {
        const linesLayer = document.getElementById("signal-lines-layer");
        const dotsLayer = document.getElementById("signal-dots-layer");
        if (linesLayer) linesLayer.innerHTML = "";
        if (dotsLayer) dotsLayer.innerHTML = "";
        
        document.querySelectorAll(".rotor-active").forEach(r => r.classList.remove("rotor-active"));
        document.querySelectorAll(".signal-active").forEach(l => l.classList.remove("signal-active"));
    }
    return isVizEnabled;
}

let selectedPlug = null;

const BASE_X = 70;
const ROTOR_GAP = 170;
const ROTOR_Y = 285;

// 🌟 UPDATED RAILS (Spaced out so wires don't overlap each other)
const RIGHT_RAIL_X = 720;
const RETURN_RAIL_X = 710; 
const FORWARD_LEFT_RAIL = 20;
const LEFT_RAIL_X = 50;
const RETURN_LEFT_RAIL = 40;

let isReturnPath = false;

export async function animateSignal(signalPath, inputLetter, outputLetter, rotorPositions) {
  if (!isVizEnabled) return; 

  window._finalOutputLetter = outputLetter;
  window._inputLetter = inputLetter; // 🌟 NEW: Track input to know if we hit the plugboard

  // Light keyboard key
  const keyText = [...document.querySelectorAll("#keyboard text")]
    .find(t => t.textContent === inputLetter);

  if (keyText) {
    const keyCircle = keyText.previousSibling;
    if (keyCircle) {
      keyCircle.classList.add("key-active");
    }

    window._lastSignalPoint = {
      x: parseFloat(keyText.getAttribute("x")),
      y: parseFloat(keyText.getAttribute("y")) - 5
    };
  }

  clearHighlights();

  // Run animation
  for (const step of signalPath) {
    await highlightStep(step, rotorPositions);
  }

  // Remove key highlight AFTER animation finishes
  document.querySelectorAll("#keyboard .key-active")
    .forEach(k => k.classList.remove("key-active"));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function clearHighlights() {
  document.querySelectorAll(".signal-active").forEach(el => el.classList.remove("signal-active"));
  document.querySelectorAll(".signal-dot").forEach(dot => dot.remove());
  document.querySelectorAll(".signal-line").forEach(line => line.remove());

  // 🌟 FIX: Ensure keyboard keys un-light when the circuit breaks!
  document.querySelectorAll(".key-active").forEach(key => key.classList.remove("key-active"));

  isReturnPath = false;
}

// Uses Pythagorean theorem to shrink the wire from BOTH the start and the end!
async function drawSmartLine(x1, y1, x2, y2, shrinkStart, shrinkEnd) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  
  let sStart = shrinkStart ? 12 : 0;
  let sEnd = shrinkEnd ? 12 : 0;

  if (len > 0 && len <= (sStart + sEnd)) {
    const scale = (len - 1.5) / (sStart + sEnd);
    sStart *= scale;
    sEnd *= scale;
  }

  let startX = x1;
  let startY = y1;
  let endX = x2;
  let endY = y2;

  if (len > 0) {
    startX = x1 + (dx / len) * sStart;
    startY = y1 + (dy / len) * sStart;
    endX = x2 - (dx / len) * sEnd;
    endY = y2 - (dy / len) * sEnd;
  }

  await drawSignalLine(startX, startY, endX, endY);
}

async function highlightStep(step, rotorPositions) {
  if (!window._lastSignalPoint) {
    window._lastSignalPoint = { x: RIGHT_RAIL_X, y: 470 };
  }

  document.querySelectorAll(".rotor-active").forEach(r => r.classList.remove("rotor-active"));

  if (step.stage.includes("rotor-left")) highlightRotor("rotor-left");
  if (step.stage.includes("rotor-middle")) highlightRotor("rotor-middle");
  if (step.stage.includes("rotor-right")) highlightRotor("rotor-right");

  if (step.stage === "reflector") {
    highlightRotor("reflector-unit"); 
    isReturnPath = true;
  }

  // 🌟 NEW: THE RETURN PLUGBOARD INTERCEPT
  if (step.stage === "plugboard-out" && step.letter) {
    const lamp = document.getElementById(`lamp-${step.letter}`);
    if (lamp) {
      const lampX = parseFloat(lamp.getAttribute("cx"));
      const lampY = parseFloat(lamp.getAttribute("cy"));

      const finalChar = step.letter;
      const rotorExitChar = enigmaState.plugboard[finalChar] || finalChar;

      // If the letter leaving the rotors is part of a plug pair, route it down!
      if (rotorExitChar !== finalChar) {
        const plugIn = document.getElementById(`plug-${rotorExitChar}`);
        const pInX = parseFloat(plugIn.getAttribute("cx"));
        const pInY = parseFloat(plugIn.getAttribute("cy"));

        const plugOut = document.getElementById(`plug-${finalChar}`);
        const pOutX = parseFloat(plugOut.getAttribute("cx"));
        const pOutY = parseFloat(plugOut.getAttribute("cy"));

        await routeFromRotorToPlug(window._lastSignalPoint.x, window._lastSignalPoint.y, pInX, pInY);
        drawSignalDot(pInX, pInY, rotorExitChar);
        
        await routePlugToPlug(pInX, pInY, pOutX, pOutY);
        drawSignalDot(pOutX, pOutY, finalChar);

        await routeFromPlugToLamp(pOutX, pOutY, lampX, lampY);
      } else {
        // Direct route to lamp if un-plugged
        await routeFromRotorToLamp(window._lastSignalPoint.x, window._lastSignalPoint.y, lampX, lampY);
      }
      
      drawSignalDot(lampX, lampY, step.letter); 
      lamp.classList.add("signal-active");
    }
  }

  if (step.stage.includes("rotor") && typeof step.index === "number") {
    let rotorId = null;
    if (step.stage.includes("rotor-left")) rotorId = "rotor-left";
    if (step.stage.includes("rotor-middle")) rotorId = "rotor-middle";
    if (step.stage.includes("rotor-right")) rotorId = "rotor-right";

    if (rotorId) {
      let rotorArrIndex = 0;
      if (rotorId === "rotor-middle") rotorArrIndex = 1;
      if (rotorId === "rotor-right") rotorArrIndex = 2;
      const pos = enigmaState.positions[rotorArrIndex];

      let workingIndex = step.index;
      if (step.stage === "rotor-right-back" && window._finalOutputLetter) {
        // 🌟 THE FIX: We must reverse-engineer the plugboard swap BEFORE calculating the rotor exit!
        const trueRotorExitChar = enigmaState.plugboard[window._finalOutputLetter] || window._finalOutputLetter;
        const targetCharIndex = trueRotorExitChar.charCodeAt(0) - 65;
        workingIndex = (targetCharIndex + pos) % 26;
      }

      const visibleLetterIndex = (workingIndex - pos + 26) % 26;
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const currentLetter = letters[visibleLetterIndex];

      const angle = (workingIndex * 360) / 26;
      let radius = 66; 
      const rad = (angle * Math.PI) / 180;

      const parentRotor = document.getElementById(rotorId);
      const localX = Math.sin(rad) * radius;
      const localY = -Math.cos(rad) * radius;

      const point = parentRotor.ownerSVGElement.createSVGPoint();
      point.x = localX;
      point.y = localY;
      const globalPoint = point.matrixTransform(parentRotor.getCTM());

      const x = globalPoint.x;
      const y = globalPoint.y;

      // 🌟 NEW: THE FORWARD PLUGBOARD INTERCEPT
      if (step.stage === "rotor-right" && !isReturnPath) {
        const inChar = window._inputLetter;
        const plugChar = enigmaState.plugboard[inChar] || inChar;

        // If the key pressed has a plug pair, route the visual signal down to it!
        if (plugChar !== inChar) {
          const plugIn = document.getElementById(`plug-${inChar}`);
          const pInX = parseFloat(plugIn.getAttribute("cx"));
          const pInY = parseFloat(plugIn.getAttribute("cy"));

          const plugOut = document.getElementById(`plug-${plugChar}`);
          const pOutX = parseFloat(plugOut.getAttribute("cx"));
          const pOutY = parseFloat(plugOut.getAttribute("cy"));

          await routeFromKeyToPlug(window._lastSignalPoint.x, window._lastSignalPoint.y, pInX, pInY);
          drawSignalDot(pInX, pInY, inChar);
          
          await routePlugToPlug(pInX, pInY, pOutX, pOutY);
          drawSignalDot(pOutX, pOutY, plugChar);
          
          await routeFromPlugToRotor(pOutX, pOutY, x, y);
        } else {
          // Direct route if un-plugged
          await routeFromKeyToRotor(window._lastSignalPoint.x, window._lastSignalPoint.y, x, y);
        }
      } else {
        await drawSmartLine(window._lastSignalPoint.x, window._lastSignalPoint.y, x, y, true, true);
      }

      drawSignalDot(x, y, currentLetter); 
      window._lastSignalPoint = { x, y };
    }
  }

  if (step.stage === "reflector" && typeof step.index === "number") {
    const centerX = BASE_X;  
    const centerY = ROTOR_Y;
    const angle = (step.index * 360) / 26;
    const rad = (angle * Math.PI) / 180;
    const radius = 60;

    const x = centerX + Math.sin(rad) * radius;
    const y = centerY - Math.cos(rad) * radius;

    await drawSmartLine(window._lastSignalPoint.x, window._lastSignalPoint.y, x, y, true, true); 
    drawSignalDot(x, y, ""); 
    window._lastSignalPoint = { x, y };
  }
}

function highlightRotor(id) {
  const rotor = document.getElementById(id);
  if (rotor) rotor.classList.add("rotor-active");
}

function getLinesLayer() {
  const wires = document.getElementById("wires");
  let layer = document.getElementById("signal-lines-layer");
  if (!layer) {
    layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.setAttribute("id", "signal-lines-layer");
    wires.insertBefore(layer, wires.firstChild); 
  }
  return layer;
}

function getDotsLayer() {
  const wires = document.getElementById("wires");
  let layer = document.getElementById("signal-dots-layer");
  if (!layer) {
    layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.setAttribute("id", "signal-dots-layer");
    wires.appendChild(layer); 
  }
  return layer;
}

function drawSignalDot(x, y, letterStr = "") {
  const layer = getDotsLayer();
  
  const dotGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  dotGroup.setAttribute("class", "signal-dot"); 

  const ringRadius = 8;

  const maskCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  maskCircle.setAttribute("cx", x);
  maskCircle.setAttribute("cy", y);
  maskCircle.setAttribute("r", ringRadius);
  maskCircle.setAttribute("fill", "#1a1a1a"); 
  dotGroup.appendChild(maskCircle);

  const glassCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  glassCircle.setAttribute("cx", x);
  glassCircle.setAttribute("cy", y);
  glassCircle.setAttribute("r", ringRadius);
  glassCircle.setAttribute("fill", isReturnPath ? "rgba(255, 213, 128, 0.2)" : "rgba(255, 165, 0, 0.2)");
  glassCircle.setAttribute("stroke", isReturnPath ? "#ffd580" : "orange");
  glassCircle.setAttribute("stroke-width", "2");
  dotGroup.appendChild(glassCircle);

  if (letterStr) {
     const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
     text.setAttribute("x", x);
     text.setAttribute("y", y + 4.5); 
     text.setAttribute("text-anchor", "middle");
     text.setAttribute("font-family", "monospace");
     text.setAttribute("font-weight", "bold");
     text.setAttribute("font-size", "14"); 
     text.setAttribute("fill", isReturnPath ? "#ffd580" : "yellow");
     text.textContent = letterStr;
     dotGroup.appendChild(text);
  }

  layer.appendChild(dotGroup);
  return dotGroup;
}

function drawSignalLine(x1, y1, x2, y2) {
  return new Promise(resolve => {
    const layer = getLinesLayer(); 
    
    // 1. Draw the Base Glowing Wire (Thinner and Elegant)
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    
    const pathColor = isReturnPath ? "#fcd34d" : "#f59e0b";
    line.setAttribute("stroke", pathColor);
    line.setAttribute("stroke-width", "2.5"); 
    line.setAttribute("stroke-linecap", "round");
    line.style.filter = `drop-shadow(0px 0px 6px ${pathColor})`; 
    line.setAttribute("class", "signal-line");

    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length < 1) {
      resolve();
      return;
    }

    line.style.strokeDasharray = length;
    line.style.strokeDashoffset = length;
    layer.appendChild(line);

    line.getBoundingClientRect(); 
    line.style.transition = "stroke-dashoffset 0.28s linear";
    line.style.strokeDashoffset = "0";

    const fallback = setTimeout(() => resolve(), 320);
    
    // 2. Spawn the Continuous "Comet Tail" Surge!
    line.addEventListener("transitionend", () => {
      clearTimeout(fallback);
      
      const streamGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      
      // 🌟 MAGIC: Targetable class for the toggle, and default to hidden/shown based on state
      streamGroup.setAttribute("class", "signal-line signal-flow-group"); 
      streamGroup.style.pointerEvents = "none";
      streamGroup.style.filter = "drop-shadow(0px 0px 6px #ffffff)";
      streamGroup.style.display = isFlowEnabled ? "block" : "none";
      
      layer.appendChild(streamGroup);

      const tailLength = Math.min(length * 0.8, 120); 
      const glowColor = isReturnPath ? "#ffffff" : "#fef08a";

      for (let i = 0; i < 4; i++) {
        const segment = document.createElementNS("http://www.w3.org/2000/svg", "line");
        segment.setAttribute("x1", x1);
        segment.setAttribute("y1", y1);
        segment.setAttribute("x2", x2);
        segment.setAttribute("y2", y2);
        segment.setAttribute("stroke", glowColor); 
        
        segment.setAttribute("stroke-width", 3.5 - (i * 0.5)); 
        segment.setAttribute("stroke-linecap", "round");
        
        const segmentLength = tailLength * ((4 - i) / 4);
        segment.style.opacity = (i + 1) / 4; 
        segment.style.strokeDasharray = `${segmentLength} ${length + tailLength}`;
        
        const shiftForward = tailLength - segmentLength; 
        const startOffset = tailLength - shiftForward;
        const endOffset = -length - shiftForward;

        streamGroup.appendChild(segment);

        segment.animate([
          { strokeDashoffset: startOffset }, 
          { strokeDashoffset: endOffset }      
        ], {
          duration: Math.max(length * 3, 600), 
          iterations: Infinity,
          easing: "linear" 
        });
      }

      resolve();
    }, { once: true });
  });
}

export function drawLampboard() {
  const lampsGroup = document.getElementById("lamps");
  lampsGroup.innerHTML = "";
  const startX = 100, startY = 410, gap = 60, radius = 20;
  const rows = ["QWERTZUIO", "ASDFGHJK", "PYXCVBNML"];
  const rowOffsets = [0, 30, 0];

  rows.forEach((rowLetters, rowIndex) => {
    rowLetters.split("").forEach((letter, colIndex) => {
      const x = startX + rowOffsets[rowIndex] + colIndex * gap;
      const y = startY + rowIndex * 60;

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", radius);
      circle.setAttribute("fill", "#222");
      circle.setAttribute("stroke", "#555");
      circle.setAttribute("id", `lamp-${letter}`);

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", x);
      text.setAttribute("y", y + 5);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "#ccc");
      text.setAttribute("font-size", "14");
      text.textContent = letter;

      lampsGroup.appendChild(circle);
      lampsGroup.appendChild(text);
    });
  });
}

export function lightLamp(letter) {
  document.querySelectorAll("[id^='lamp-']").forEach(lamp => {
    lamp.setAttribute("fill", "#222");
  });
  if (letter) {
    const active = document.getElementById(`lamp-${letter}`);
    if (active) active.setAttribute("fill", "yellow");
  }
}

export function drawKeyboard(onKeyPress) {
  const kb = document.getElementById("keyboard");
  kb.innerHTML = "";
  const startX = 100, startY = 620, keySize = 40, gap = 60;
  const rows = ["QWERTZUIO", "ASDFGHJK", "PYXCVBNML"];
  const rowOffsets = [0, 30, 0];

  rows.forEach((rowLetters, rowIndex) => {
    rowLetters.split("").forEach((letter, colIndex) => {
      const x = startX + rowOffsets[rowIndex] + colIndex * gap;
      const y = startY + rowIndex * 60;

      const key = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      key.setAttribute("cx", x);
      key.setAttribute("cy", y);
      key.setAttribute("r", keySize / 2);
      key.setAttribute("fill", "#333");
      key.setAttribute("stroke", "#888");
      key.style.cursor = "pointer";
      key.addEventListener("mousedown", () => onKeyPress(letter));

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", x);
      text.setAttribute("y", y + 5);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "#eee");
      text.setAttribute("font-size", "14");
      text.textContent = letter;
      text.style.pointerEvents = "none";

      kb.appendChild(key);
      kb.appendChild(text);
    });
  });
}

function drawRotor(x, y, position, id) {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("id", id);
  group.setAttribute("transform", `translate(${x}, ${y})`);

  const rotationAngle = position * (360 / 26);
  const gearGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  gearGroup.setAttribute("id", `${id}-gear`);
  gearGroup.style.transition = "transform 0.25s ease-out";
  gearGroup.style.transformBox = "fill-box";
  gearGroup.style.transformOrigin = "center";
  gearGroup.style.transform = `rotate(${rotationAngle}deg)`;

  const teeth = 26;
  const rOut = 80; 
  const rIn = 74;  
  let pathData = "";

  for (let i = 0; i < teeth; i++) {
    const centerAngle = (i * 2 * Math.PI) / teeth;
    const step = (2 * Math.PI) / teeth;

    const a1 = centerAngle - step * 0.30; 
    const a2 = centerAngle - step * 0.18; 
    const a3 = centerAngle + step * 0.18; 
    const a4 = centerAngle + step * 0.30; 

    const p1x = Math.sin(a1) * rIn;
    const p1y = -Math.cos(a1) * rIn;
    const p2x = Math.sin(a2) * rOut;
    const p2y = -Math.cos(a2) * rOut;
    const p3x = Math.sin(a3) * rOut;
    const p3y = -Math.cos(a3) * rOut;
    const p4x = Math.sin(a4) * rIn;
    const p4y = -Math.cos(a4) * rIn;

    if (i === 0) {
      pathData += `M ${p1x},${p1y} `;
    } else {
      pathData += `L ${p1x},${p1y} `; 
    }
    
    pathData += `L ${p2x},${p2y} L ${p3x},${p3y} L ${p4x},${p4y} `;
  }
  pathData += "Z"; 

  const gearBody = document.createElementNS("http://www.w3.org/2000/svg", "path");
  gearBody.setAttribute("d", pathData);
  gearBody.setAttribute("fill", "#1a1a1a");
  gearBody.setAttribute("stroke", "#444");
  gearBody.setAttribute("stroke-width", "1.5"); 
  gearBody.setAttribute("stroke-linejoin", "round"); 
  gearGroup.appendChild(gearBody);

  const innerRing1 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  innerRing1.setAttribute("r", 55);
  innerRing1.setAttribute("fill", "none");
  innerRing1.setAttribute("stroke", "#444");
  innerRing1.setAttribute("stroke-width", "2");
  gearGroup.appendChild(innerRing1);

  const innerRing2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  innerRing2.setAttribute("r", 51);
  innerRing2.setAttribute("fill", "#111");
  innerRing2.setAttribute("stroke", "#222");
  gearGroup.appendChild(innerRing2);

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  letters.split("").forEach((l, i) => {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", 0);
    text.setAttribute("y", 5); 
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-family", "monospace");
    text.setAttribute("font-weight", "bold");
    text.setAttribute("font-size", "15");
    text.setAttribute("fill", i === 0 ? "yellow" : "#ccc");
    text.textContent = l;
    gearGroup.appendChild(text);
  });
  
  group.appendChild(gearGroup);
  return group;
}

export function updateRotorRotation(id, position) {
  const gear = document.getElementById(`${id}-gear`);
  if (!gear) return;

  if (gear.dataset.currentPos === undefined) {
    gear.dataset.currentPos = position;
    gear.dataset.accumulatedAngle = position * (360 / 26);
  }

  let currentPos = parseFloat(gear.dataset.currentPos);
  let accumulatedAngle = parseFloat(gear.dataset.accumulatedAngle);

  let diff = position - currentPos;
  
  if (diff < -13) diff += 26;
  if (diff > 13) diff -= 26;

  accumulatedAngle += diff * (360 / 26);
  
  gear.dataset.currentPos = position;
  gear.dataset.accumulatedAngle = accumulatedAngle;

  gear.style.transition = "transform 0.25s ease-out";
  gear.style.transform = `rotate(${accumulatedAngle}deg)`;

  const letters = gear.querySelectorAll("text");
  const letterRadius = 66; 

  letters.forEach((text, i) => {
    const baseAngle = (i * 360) / 26;
    const rad = (baseAngle * Math.PI) / 180;
    const x = Math.sin(rad) * letterRadius;
    const y = -Math.cos(rad) * letterRadius;

    text.style.transition = "transform 0.25s ease-out";
    text.style.transform = `translate(${x}px, ${y}px) rotate(${-accumulatedAngle}deg)`;
  });
}

function drawReflector(x, y) {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("id", "reflector-unit");
  group.setAttribute("transform", `translate(${x}, ${y})`);

  const outerRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  outerRing.setAttribute("r", 60);
  outerRing.setAttribute("fill", "#1a1a1a");
  outerRing.setAttribute("stroke", "#444");
  outerRing.setAttribute("stroke-width", "2");
  outerRing.style.transition = "stroke 0.2s ease, filter 0.2s ease"; 
  group.appendChild(outerRing);

  const innerRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  innerRing.setAttribute("r", 40);
  innerRing.setAttribute("fill", "#111");
  innerRing.setAttribute("stroke", "#222");
  innerRing.setAttribute("stroke-width", "2");
  group.appendChild(innerRing);

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", 0);
  text.setAttribute("y", 5);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-family", "monospace");
  text.setAttribute("font-weight", "bold");
  text.setAttribute("font-size", "14");
  text.setAttribute("fill", "#444");
  text.textContent = "UKW";
  group.appendChild(text);

  return group;
}

export function drawRotors(state) {
  const rotors = document.getElementById("rotors");
  rotors.innerHTML = "";
  rotors.appendChild(drawReflector(BASE_X, ROTOR_Y));
  rotors.appendChild(drawRotor(BASE_X + ROTOR_GAP, ROTOR_Y, state.positions[0], "rotor-left"));
  rotors.appendChild(drawRotor(BASE_X + ROTOR_GAP * 2, ROTOR_Y, state.positions[1], "rotor-middle"));
  rotors.appendChild(drawRotor(BASE_X + ROTOR_GAP * 3, ROTOR_Y, state.positions[2], "rotor-right"));

  updateRotorRotation("rotor-left", state.positions[0]);
  updateRotorRotation("rotor-middle", state.positions[1]);
  updateRotorRotation("rotor-right", state.positions[2]);
}

export function drawPlugboard(state) {
  const group = document.getElementById("plugboard");
  group.innerHTML = "";
  
  const startX = 100, gap = 60;
  const startY = 810; 
  const rows = ["QWERTZUIO", "ASDFGHJK", "PYXCVBNML"];
  const rowOffsets = [0, 30, 0];
  const positions = {};

  rows.forEach((rowLetters, rowIndex) => {
    rowLetters.split("").forEach((letter, colIndex) => {
      const x = startX + rowOffsets[rowIndex] + colIndex * gap;
      const y = startY + rowIndex * 45;
      positions[letter] = { x, y };

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", 11);
      circle.setAttribute("fill", "#222");
      circle.setAttribute("stroke", "#888");
      // 🌟 NEW: This ID allows the routing engine to target the specific plug socket
      circle.setAttribute("id", `plug-${letter}`);
      circle.style.cursor = "pointer";
      circle.addEventListener("click", () => handlePlugClick(letter, state));

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", x-18);
      text.setAttribute("y", y + 5); 
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "#ccc");
      text.setAttribute("font-size", "14");
      text.textContent = letter;

      group.appendChild(circle);
      group.appendChild(text);
    });
  });

  Object.entries(state.plugboard).forEach(([a, b]) => {
    if (a < b) { 
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", positions[a].x);
      line.setAttribute("y1", positions[a].y);
      line.setAttribute("x2", positions[b].x);
      line.setAttribute("y2", positions[b].y);
      line.setAttribute("stroke", "cyan");
      line.setAttribute("stroke-width", "3"); 
      line.style.pointerEvents = "none"; 
      group.appendChild(line);
    }
  });
}

function handlePlugClick(letter, state) {
  if (!selectedPlug) {
    selectedPlug = letter;
    return;
  }
  if (selectedPlug === letter) {
    selectedPlug = null;
    return;
  }
  if (state.plugboard[selectedPlug]) {
    const other = state.plugboard[selectedPlug];
    delete state.plugboard[selectedPlug];
    delete state.plugboard[other];
  }
  if (state.plugboard[letter]) {
    const other = state.plugboard[letter];
    delete state.plugboard[letter];
    delete state.plugboard[other];
  }

  state.plugboard[selectedPlug] = letter;
  state.plugboard[letter] = selectedPlug;
  selectedPlug = null;
  drawPlugboard(state);
}
/*
// ==========================================
// 🌟 DYNAMIC ROUTING FUNCTIONS
// ==========================================

async function routeFromKeyToRotor(keyX, keyY, entryX, entryY) {
  const OFFSET_DOWN = 25;
  const railX = RIGHT_RAIL_X;
  const downY = keyY + OFFSET_DOWN;

  await drawSmartLine(keyX, keyY, keyX, downY, false, false);
  await drawSmartLine(keyX, downY, railX, downY, false, false);
  await drawSmartLine(railX, downY, railX, entryY, false, false);
  await drawSmartLine(railX, entryY, entryX, entryY, false, true); 
  window._lastSignalPoint = { x: entryX, y: entryY };
}

async function routeFromRotorToLamp(rotorX, rotorY, lampX, lampY) {
  const OFFSET_DOWN = 35;
  const railX = RETURN_RAIL_X; 
  const belowLampY = lampY - OFFSET_DOWN;

  await drawSmartLine(rotorX, rotorY, railX, rotorY, true, false); 
  await drawSmartLine(railX, rotorY, railX, belowLampY, false, false);
  await drawSmartLine(railX, belowLampY, lampX, belowLampY, false, false);
  await drawSmartLine(lampX, belowLampY, lampX, lampY, false, false); 
  window._lastSignalPoint = { x: lampX, y: lampY };
}

// 🌟 NEW: Visual Path from Key down into Plugboard
async function routeFromKeyToPlug(keyX, keyY, plugX, plugY) {
  const busY = 780; // Safe horizontal path between Keyboard & Plugboard
  await drawSmartLine(keyX, keyY, keyX, busY, false, false);
  await drawSmartLine(keyX, busY, plugX, busY, false, false);
  await drawSmartLine(plugX, busY, plugX, plugY, false, true); // Shrink hitting socket
}

// 🌟 NEW: Visual Path across the Cyan cables
async function routePlugToPlug(pInX, pInY, pOutX, pOutY) {
  await drawSmartLine(pInX, pInY, pOutX, pOutY, true, true);
}

// 🌟 NEW: Visual Path from swapped Plugboard socket up into the Right Rotor
async function routeFromPlugToRotor(plugX, plugY, entryX, entryY) {
  const PLUG_BOTTOM_BUS = 890; 
  const railX = RIGHT_RAIL_X;

  await drawSmartLine(plugX, plugY, plugX, PLUG_BOTTOM_BUS, true, false);
  await drawSmartLine(plugX, PLUG_BOTTOM_BUS, railX, PLUG_BOTTOM_BUS, false, false);
  await drawSmartLine(railX, PLUG_BOTTOM_BUS, railX, entryY, false, false);
  await drawSmartLine(railX, entryY, entryX, entryY, false, true);
}

// 🌟 NEW: Visual Path returning from Right Rotor down into Plugboard
async function routeFromRotorToPlug(rotorX, rotorY, plugX, plugY) {
  const PLUG_RETURN_BUS = 905;
  const railX = RETURN_RAIL_X;

  await drawSmartLine(rotorX, rotorY, railX, rotorY, true, false);
  await drawSmartLine(railX, rotorY, railX, PLUG_RETURN_BUS, false, false);
  await drawSmartLine(railX, PLUG_RETURN_BUS, plugX, PLUG_RETURN_BUS, false, false);
  await drawSmartLine(plugX, PLUG_RETURN_BUS, plugX, plugY, false, true);
}

// 🌟 NEW: Visual Path from swapped Plugboard socket up to the Lampboard
async function routeFromPlugToLamp(plugX, plugY, lampX, lampY) {
  const busY = 770; // High bus, avoiding overlap with forward bus (780)
  await drawSmartLine(plugX, plugY, plugX, busY, true, false);
  await drawSmartLine(plugX, busY, LEFT_RAIL_X, busY, false, false);
  await drawSmartLine(LEFT_RAIL_X, busY, LEFT_RAIL_X, lampY, false, false);
  await drawSmartLine(LEFT_RAIL_X, lampY, lampX, lampY, false, false); 
}
  */













// ==========================================
// 🌟 CIRCUIT BOARD CHANNEL HELPERS
// ==========================================
function getKeyEscapeY(y) {
  if (y < 650) return 650;
  if (y < 710) return 710;
  return 770;
}
function getLampEscapeY(y) {
  if (y < 440) return 440;
  if (y < 500) return 500;
  return 560;
}

// 🌟 LANE 1: Top Entry (Key -> Plugboard)
function getPlugTopEscapeY(y) {
  if (y < 830) return 780;   // Above Row 1
  if (y < 870) return 825;   // High lane between Row 1 & 2
  return 870;                // High lane between Row 2 & 3
}

// 🌟 LANE 2: Middle Exit/Entry (Plugboard <-> Rotors)
function getPlugRotorEscapeY(y) {
  if (y < 830) return 832;   // Middle lane between Row 1 & 2
  if (y < 870) return 877;   // Middle lane between Row 2 & 3
  return 915;                // Middle lane below Row 3
}

// 🌟 LANE 3: Bottom Exit (Plugboard -> Lampboard)
function getPlugLampEscapeY(y) {
  if (y < 830) return 838;   // Low lane between Row 1 & 2
  if (y < 870) return 883;   // Low lane between Row 2 & 3
  return 925;                // Low lane below Row 3
}







// ==========================================
// 🌟 DYNAMIC ROUTING FUNCTIONS
// ==========================================

async function routeFromKeyToRotor(keyX, keyY, entryX, entryY) {
  const escY = getKeyEscapeY(keyY);
  await drawSmartLine(keyX, keyY, keyX, escY, false, false);
  await drawSmartLine(keyX, escY, RIGHT_RAIL_X, escY, false, false);
  await drawSmartLine(RIGHT_RAIL_X, escY, RIGHT_RAIL_X, entryY, false, false);
  await drawSmartLine(RIGHT_RAIL_X, entryY, entryX, entryY, false, true); 
  window._lastSignalPoint = { x: entryX, y: entryY };
}

async function routeFromRotorToLamp(rotorX, rotorY, lampX, lampY) {
  const escY = getLampEscapeY(lampY);
  await drawSmartLine(rotorX, rotorY, RETURN_RAIL_X, rotorY, true, false); 
  await drawSmartLine(RETURN_RAIL_X, rotorY, RETURN_RAIL_X, escY, false, false);
  await drawSmartLine(RETURN_RAIL_X, escY, lampX, escY, false, false);
  await drawSmartLine(lampX, escY, lampX, lampY, false, false); 
  window._lastSignalPoint = { x: lampX, y: lampY };
}

// 🌟 Uses LANE 1 (Top Entry)
async function routeFromKeyToPlug(keyX, keyY, plugX, plugY) {
  const kEscY = getKeyEscapeY(keyY); 
  const pTopEscY = getPlugTopEscapeY(plugY); 

  await drawSmartLine(keyX, keyY, keyX, kEscY, false, false);
  await drawSmartLine(keyX, kEscY, FORWARD_LEFT_RAIL, kEscY, false, false);
  await drawSmartLine(FORWARD_LEFT_RAIL, kEscY, FORWARD_LEFT_RAIL, pTopEscY, false, false);
  await drawSmartLine(FORWARD_LEFT_RAIL, pTopEscY, plugX, pTopEscY, false, false);
  await drawSmartLine(plugX, pTopEscY, plugX, plugY, false, true); 
}

async function routePlugToPlug(pInX, pInY, pOutX, pOutY) {
  await drawSmartLine(pInX, pInY, pOutX, pOutY, true, true);
}

// 🌟 Uses LANE 2 (Middle Line)
async function routeFromPlugToRotor(plugX, plugY, entryX, entryY) {
  const pEscY = getPlugRotorEscapeY(plugY);
  await drawSmartLine(plugX, plugY, plugX, pEscY, true, false); 
  await drawSmartLine(plugX, pEscY, RIGHT_RAIL_X, pEscY, false, false);
  await drawSmartLine(RIGHT_RAIL_X, pEscY, RIGHT_RAIL_X, entryY, false, false);
  await drawSmartLine(RIGHT_RAIL_X, entryY, entryX, entryY, false, true);
}

// 🌟 Uses LANE 2 (Middle Line)
async function routeFromRotorToPlug(rotorX, rotorY, plugX, plugY) {
  const pEscY = getPlugRotorEscapeY(plugY);
  await drawSmartLine(rotorX, rotorY, RETURN_RAIL_X, rotorY, true, false);
  await drawSmartLine(RETURN_RAIL_X, rotorY, RETURN_RAIL_X, pEscY, false, false);
  await drawSmartLine(RETURN_RAIL_X, pEscY, plugX, pEscY, false, false);
  await drawSmartLine(plugX, pEscY, plugX, plugY, false, true);
}

// 🌟 Uses LANE 3 (Low Line)
async function routeFromPlugToLamp(plugX, plugY, lampX, lampY) {
  const pEscY = getPlugLampEscapeY(plugY);
  const lEscY = getLampEscapeY(lampY);
  
  await drawSmartLine(plugX, plugY, plugX, pEscY, true, false); 
  await drawSmartLine(plugX, pEscY, RETURN_LEFT_RAIL, pEscY, false, false);
  await drawSmartLine(RETURN_LEFT_RAIL, pEscY, RETURN_LEFT_RAIL, lEscY, false, false);
  await drawSmartLine(RETURN_LEFT_RAIL, lEscY, lampX, lEscY, false, false);
  await drawSmartLine(lampX, lEscY, lampX, lampY, false, false); 
}