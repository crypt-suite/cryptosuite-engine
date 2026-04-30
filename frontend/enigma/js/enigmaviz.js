import { enigmaState } from "./enigmaState.js";



//Global toggle for Visualization
export let isVizEnabled = false;



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

const RIGHT_RAIL_X = BASE_X + ROTOR_GAP * 3 + 120;
const RETURN_RAIL_X = RIGHT_RAIL_X - 10; 

let isReturnPath = false;

export async function animateSignal(signalPath, inputLetter, outputLetter, rotorPositions) {
  // TURBO BYPASS: If Viz is off, skip the entire animation sequence instantly!
  if (!isVizEnabled) return; 





  // NEW: Save the final output letter so the exit ring can target it!
  window._finalOutputLetter = outputLetter;

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

function clearHighlights() {
  document.querySelectorAll(".signal-active").forEach(el => el.classList.remove("signal-active"));
  document.querySelectorAll(".signal-dot").forEach(dot => dot.remove());
  document.querySelectorAll(".signal-line").forEach(line => line.remove());
  isReturnPath = false;
}

//THE ULTIMATE MATH FIX
// Uses Pythagorean theorem to shrink the wire from BOTH the start and the end!
async function drawSmartLine(x1, y1, x2, y2, shrinkStart, shrinkEnd) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  
  let sStart = shrinkStart ? 12 : 0;
  let sEnd = shrinkEnd ? 12 : 0;

  //Prevent Line Inversion!
  // If the rings are extremely close, the 12px offsets were pushing the 
  // start and end points past each other, drawing the line backwards 
  // through the glass rings! This proportionally shrinks the offsets
  // so the line stops perfectly on the outer boundaries.
  if (len > 0 && len <= (sStart + sEnd)) {
    const scale = (len - 1.5) / (sStart + sEnd); // The 1.5 leaves a clean visual gap
    sStart *= scale;
    sEnd *= scale;
  }

  let startX = x1;
  let startY = y1;
  let endX = x2;
  let endY = y2;

  // Apply the calculated offsets to the endpoints
  if (len > 0) {
    startX = x1 + (dx / len) * sStart;
    startY = y1 + (dy / len) * sStart;
    endX = x2 - (dx / len) * sEnd;
    endY = y2 - (dy / len) * sEnd;
  }

  await drawSignalLine(startX, startY, endX, endY);
}
/*
async function highlightStep(step, rotorPositions) {
  if (!window._lastSignalPoint) {
    window._lastSignalPoint = { x: RIGHT_RAIL_X, y: 470 };
  }

  // Clear previous highlights
  document.querySelectorAll(".rotor-active").forEach(r => r.classList.remove("rotor-active"));

  // Highlight rotor based on stage
  if (step.stage.includes("rotor-left")) highlightRotor("rotor-left");
  if (step.stage.includes("rotor-middle")) highlightRotor("rotor-middle");
  if (step.stage.includes("rotor-right")) highlightRotor("rotor-right");

  if (step.stage === "reflector") {
    highlightRotor("reflector-unit"); //  NEW: Trigger the Reflector glow!
    isReturnPath = true;
  }

// Lamp highlight (final output)
  if (step.stage === "plugboard-out" && step.letter) {
    const lamp = document.getElementById(`lamp-${step.letter}`);
    if (lamp) {
      const x = parseFloat(lamp.getAttribute("cx"));
      const y = parseFloat(lamp.getAttribute("cy"));
      await routeFromRotorToLamp(window._lastSignalPoint.x, window._lastSignalPoint.y, x, y);
      
      //Pass the letter!
      drawSignalDot(x, y, step.letter); 
      
      lamp.classList.add("signal-active");
    }
  }


  // Draw signal routing for Rotors
  if (step.stage.includes("rotor") && typeof step.index === "number") {
    let rotorId = null;
    if (step.stage.includes("rotor-left")) rotorId = "rotor-left";
    if (step.stage.includes("rotor-middle")) rotorId = "rotor-middle";
    if (step.stage.includes("rotor-right")) rotorId = "rotor-right";

    if (rotorId) {
      const angle = (step.index * 360) / 26;
      let radius = 62; 
      const rad = (angle * Math.PI) / 180;

      const gear = document.getElementById(`${rotorId}-gear`);
      const localX = Math.sin(rad) * radius;
      const localY = -Math.cos(rad) * radius;

      const point = gear.ownerSVGElement.createSVGPoint();
      point.x = localX;
      point.y = localY;
      const globalPoint = point.matrixTransform(gear.getCTM());

      const x = globalPoint.x;
      const y = globalPoint.y;

      //Grab the correct letter from the physical rotor position!
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const currentLetter = letters[step.index];

      if (step.stage === "rotor-right" && !isReturnPath) {
        // Forward path from Key
        await routeFromKeyToRotor(window._lastSignalPoint.x, window._lastSignalPoint.y, x, y);
      } else if (step.stage === "rotor-right" && isReturnPath) {
        // Return path from Middle Rotor -> Right Rotor (via rails)
        const RETURN_OFFSET = -12;   
        const railX = RIGHT_RAIL_X;
        const shiftedY = y + RETURN_OFFSET;

        await drawSmartLine(window._lastSignalPoint.x, window._lastSignalPoint.y, window._lastSignalPoint.x, shiftedY, true, false);
        await drawSmartLine(window._lastSignalPoint.x, shiftedY, railX, shiftedY, false, false);
        await drawSmartLine(railX, shiftedY, x, y, false, true); 
      } else {
        // Rotor to Rotor
        await drawSmartLine(window._lastSignalPoint.x, window._lastSignalPoint.y, x, y, true, true);
      }

      //Pass the letter!
      drawSignalDot(x, y, currentLetter); 
      window._lastSignalPoint = { x, y };


    }
  }
  // Reflector signal visualization
  if (step.stage === "reflector" && typeof step.index === "number") {
    const centerX = BASE_X;  
    const centerY = ROTOR_Y;
    const angle = (step.index * 360) / 26;
    const rad = (angle * Math.PI) / 180;
    const radius = 60;

    const x = centerX + Math.sin(rad) * radius;
    const y = centerY - Math.cos(rad) * radius;

    await drawSmartLine(window._lastSignalPoint.x, window._lastSignalPoint.y, x, y, true, true); 
    
    //Pass empty string (Reflector doesn't have letters)
    drawSignalDot(x, y, ""); 
    
    window._lastSignalPoint = { x, y };
  }
}
*/



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

  if (step.stage === "plugboard-out" && step.letter) {
    const lamp = document.getElementById(`lamp-${step.letter}`);
    if (lamp) {
      const x = parseFloat(lamp.getAttribute("cx"));
      const y = parseFloat(lamp.getAttribute("cy"));
      await routeFromRotorToLamp(window._lastSignalPoint.x, window._lastSignalPoint.y, x, y);
      drawSignalDot(x, y, step.letter); 
      lamp.classList.add("signal-active");
    }
  }

  if (step.stage.includes("rotor") && typeof step.index === "number") {
    let rotorId = null;
    if (step.stage.includes("rotor-left")) rotorId = "rotor-left";
    if (step.stage.includes("rotor-middle")) rotorId = "rotor-middle";
    if (step.stage.includes("rotor-right")) rotorId = "rotor-right";





    /*
    if (rotorId) {
      //const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      //const currentLetter = letters[step.index];
      // 1. Figure out which rotor we are looking at
      let rotorArrIndex = 0;
      if (rotorId === "rotor-middle") rotorArrIndex = 1;
      if (rotorId === "rotor-right") rotorArrIndex = 2;

      // 2. Grab its live rotation and ring setting from the core state
      const pos = enigmaState.positions[rotorArrIndex];
      const ring = enigmaState.rings[rotorArrIndex];

      //Calculate exactly what gear tooth just slid under this fixed stator hole!
      const localPin = (step.index - pos + 26) % 26;
      const currentLetter = String.fromCharCode(((localPin + ring) % 26) + 65);

      const angle = (step.index * 360) / 26;
      
      //Updated to 66 so the wire perfectly hits the newly spaced letters!
      let radius = 66; 
      const rad = (angle * Math.PI) / 180;

      const gear = document.getElementById(`${rotorId}-gear`);
      const localX = Math.sin(rad) * radius;
      const localY = -Math.cos(rad) * radius;

      const point = gear.ownerSVGElement.createSVGPoint();
      point.x = localX;
      point.y = localY;
      const globalPoint = point.matrixTransform(gear.getCTM());

      const x = globalPoint.x;
      const y = globalPoint.y;

      if (step.stage === "rotor-right" && !isReturnPath) {
        await routeFromKeyToRotor(window._lastSignalPoint.x, window._lastSignalPoint.y, x, y);
      } else if (step.stage === "rotor-right" && isReturnPath) {
        const RETURN_OFFSET = -12;   
        const railX = RIGHT_RAIL_X;
        const shiftedY = y + RETURN_OFFSET;

        await drawSmartLine(window._lastSignalPoint.x, window._lastSignalPoint.y, window._lastSignalPoint.x, shiftedY, true, false);
        await drawSmartLine(window._lastSignalPoint.x, shiftedY, railX, shiftedY, false, false);
        await drawSmartLine(railX, shiftedY, x, y, false, true); 
      } else {
        await drawSmartLine(window._lastSignalPoint.x, window._lastSignalPoint.y, x, y, true, true);
      }

      drawSignalDot(x, y, currentLetter); 
      window._lastSignalPoint = { x, y };
    }

    */




    



  if (rotorId) {
      // 1. Get the current physical rotation of this gear from the state
      let rotorArrIndex = 0;
      if (rotorId === "rotor-middle") rotorArrIndex = 1;
      if (rotorId === "rotor-right") rotorArrIndex = 2;
      const pos = enigmaState.positions[rotorArrIndex];

      //Intercept the final exit and force it to target the lampboard letter!
      let workingIndex = step.index;
      if (step.stage === "rotor-right-back" && window._finalOutputLetter) {
        const targetCharIndex = window._finalOutputLetter.charCodeAt(0) - 65;
        // Calculate the exact spatial pin where that specific letter is currently sitting
        workingIndex = (targetCharIndex + pos) % 26;
      }

      // 2. Calculate exactly which letter is visually sitting at the fixed pin right now!
      const visibleLetterIndex = (workingIndex - pos + 26) % 26;
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const currentLetter = letters[visibleLetterIndex];

      const angle = (workingIndex * 360) / 26;
      let radius = 66; 
      const rad = (angle * Math.PI) / 180;

      //TARGET THE FIXED PARENT GROUP INSTEAD OF THE SPINNING GEAR
      const parentRotor = document.getElementById(rotorId);
      const localX = Math.sin(rad) * radius;
      const localY = -Math.cos(rad) * radius;

      const point = parentRotor.ownerSVGElement.createSVGPoint();
      point.x = localX;
      point.y = localY;
      const globalPoint = point.matrixTransform(parentRotor.getCTM());

      const x = globalPoint.x;
      const y = globalPoint.y;

      // 3. Draw the wires 
      if (step.stage === "rotor-right" && !isReturnPath) {
        // Forward path from Keyboard -> Right Rotor (uses the bottom right rail)
        await routeFromKeyToRotor(window._lastSignalPoint.x, window._lastSignalPoint.y, x, y);
      } else {
        // ALL other rotor-to-rotor connections are just direct, straight wires!
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
/*
function getSignalLayer() {
  return document.getElementById("wires");
}

//Hollow Glass Ring Targeting System
function drawSignalDot(x, y) {
  const layer = getSignalLayer();
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("cx", x);
  dot.setAttribute("cy", y);
  dot.setAttribute("r", 10); // Perfectly surrounds the letter
  dot.setAttribute("fill", isReturnPath ? "rgba(255, 213, 128, 0.2)" : "rgba(255, 165, 0, 0.2)");
  dot.setAttribute("stroke", isReturnPath ? "#ffd580" : "orange");
  dot.setAttribute("stroke-width", "2");
  dot.setAttribute("class", "signal-dot");

  layer.appendChild(dot);
  return dot;
}

function drawSignalLine(x1, y1, x2, y2) {
  return new Promise(resolve => {
    const layer = getSignalLayer();
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", isReturnPath ? "#ffd580" : "orange");
    line.setAttribute("stroke-width", "3");
    line.setAttribute("class", "signal-line");

    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length < 1) {
      resolve();
      return;
    }

    line.style.strokeDasharray = length;
    line.style.strokeDashoffset = length;
    layer.appendChild(line);

    line.getBoundingClientRect(); // Force layout
    line.style.transition = "stroke-dashoffset 0.28s linear";
    line.style.strokeDashoffset = "0";

    const fallback = setTimeout(() => resolve(), 320);
    line.addEventListener("transitionend", () => {
      clearTimeout(fallback);
      resolve();
    }, { once: true });
  });
}
*/





//Strict Layering System
// Forces all Lines to draw underneath, and all Dots to draw on top!
function getLinesLayer() {
  const wires = document.getElementById("wires");
  let layer = document.getElementById("signal-lines-layer");
  if (!layer) {
    layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.setAttribute("id", "signal-lines-layer");
    wires.insertBefore(layer, wires.firstChild); // Keep at the bottom
  }
  return layer;
}

function getDotsLayer() {
  const wires = document.getElementById("wires");
  let layer = document.getElementById("signal-dots-layer");
  if (!layer) {
    layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.setAttribute("id", "signal-dots-layer");
    wires.appendChild(layer); // Keep at the top
  }
  return layer;
}
/*
//The Masking Dot
// Blocks lines underneath it, and redraws the letter so it stays on top!
function drawSignalDot(x, y, letterStr = "") {
  const layer = getDotsLayer();
  
  const dotGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  dotGroup.setAttribute("class", "signal-dot"); 

  // 1. SOLID MASK: Hides any wire that tries to cross through!
  const maskCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  maskCircle.setAttribute("cx", x);
  maskCircle.setAttribute("cy", y);
  maskCircle.setAttribute("r", 10);
  maskCircle.setAttribute("fill", "#1a1a1a"); // Matches the dark gear color
  dotGroup.appendChild(maskCircle);

  // 2. GLASS EFFECT: Re-adds the cool semi-transparent look and outline
  const glassCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  glassCircle.setAttribute("cx", x);
  glassCircle.setAttribute("cy", y);
  glassCircle.setAttribute("r", 10);
  glassCircle.setAttribute("fill", isReturnPath ? "rgba(255, 213, 128, 0.2)" : "rgba(255, 165, 0, 0.2)");
  glassCircle.setAttribute("stroke", isReturnPath ? "#ffd580" : "orange");
  glassCircle.setAttribute("stroke-width", "2");
  dotGroup.appendChild(glassCircle);

  // 3. THE LETTER: Redraws the letter so it sits flawlessly ON TOP of everything
  if (letterStr) {
     const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
     text.setAttribute("x", x);
     text.setAttribute("y", y + 5); 
     text.setAttribute("text-anchor", "middle");
     text.setAttribute("font-family", "monospace");
     text.setAttribute("font-weight", "bold");
     text.setAttribute("font-size", "15");
     text.setAttribute("fill", isReturnPath ? "#ffd580" : "yellow");
     text.textContent = letterStr;
     dotGroup.appendChild(text);
  }

  layer.appendChild(dotGroup);
  return dotGroup;
}
*/























function drawSignalDot(x, y, letterStr = "") {
  const layer = getDotsLayer();
  
  const dotGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  dotGroup.setAttribute("class", "signal-dot"); 

  //Shrunk the ring size from 10 to 8!
  const ringRadius = 8;

  // 1. SOLID MASK
  const maskCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  maskCircle.setAttribute("cx", x);
  maskCircle.setAttribute("cy", y);
  maskCircle.setAttribute("r", ringRadius);
  maskCircle.setAttribute("fill", "#1a1a1a"); 
  dotGroup.appendChild(maskCircle);

  // 2. GLASS EFFECT
  const glassCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  glassCircle.setAttribute("cx", x);
  glassCircle.setAttribute("cy", y);
  glassCircle.setAttribute("r", ringRadius);
  glassCircle.setAttribute("fill", isReturnPath ? "rgba(255, 213, 128, 0.2)" : "rgba(255, 165, 0, 0.2)");
  glassCircle.setAttribute("stroke", isReturnPath ? "#ffd580" : "orange");
  glassCircle.setAttribute("stroke-width", "2");
  dotGroup.appendChild(glassCircle);

  // 3. THE LETTER
  if (letterStr) {
     const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
     text.setAttribute("x", x);
     text.setAttribute("y", y + 4.5); // Adjusted slightly for visual center
     text.setAttribute("text-anchor", "middle");
     text.setAttribute("font-family", "monospace");
     text.setAttribute("font-weight", "bold");
     text.setAttribute("font-size", "14"); // Dropped slightly to perfectly fit the smaller ring
     text.setAttribute("fill", isReturnPath ? "#ffd580" : "yellow");
     text.textContent = letterStr;
     dotGroup.appendChild(text);
  }

  layer.appendChild(dotGroup);
  return dotGroup;
}




function drawSignalLine(x1, y1, x2, y2) {
  return new Promise(resolve => {
    const layer = getLinesLayer(); // Ensure line goes to the bottom layer!
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", isReturnPath ? "#ffd580" : "orange");
    line.setAttribute("stroke-width", "3");
    line.setAttribute("class", "signal-line");

    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length < 1) {
      resolve();
      return;
    }

    line.style.strokeDasharray = length;
    line.style.strokeDashoffset = length;
    layer.appendChild(line);

    line.getBoundingClientRect(); // Force layout
    line.style.transition = "stroke-dashoffset 0.28s linear";
    line.style.strokeDashoffset = "0";

    const fallback = setTimeout(() => resolve(), 320);
    line.addEventListener("transitionend", () => {
      clearTimeout(fallback);
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

  // 1. Classic Spur Gear Shape (Shallower, cleaner, less cramped)
  const teeth = 26;
  const rOut = 80; // Tip of the tooth
  const rIn = 74;  // Raised from 65 to 69 to make teeth shallower!
  let pathData = "";

  for (let i = 0; i < teeth; i++) {
    const centerAngle = (i * 2 * Math.PI) / teeth;
    const step = (2 * Math.PI) / teeth;

    // Adjusted proportions to make the teeth narrower and the valleys wider
    const a1 = centerAngle - step * 0.30; // Valley floor to tooth wall
    const a2 = centerAngle - step * 0.18; // Tooth wall to flat top
    const a3 = centerAngle + step * 0.18; // Flat top to tooth wall
    const a4 = centerAngle + step * 0.30; // Tooth wall to valley floor

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
  
  // Thinner stroke width reduces the visual clutter!
  gearBody.setAttribute("stroke-width", "1.5"); 
  gearBody.setAttribute("stroke-linejoin", "round"); 
  gearGroup.appendChild(gearBody);

  // 2. Machined Inner Rings (Authentic depth)
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

  // 3. Stamped Metal Letters
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
/*
export function updateRotorRotation(id, position) {
  const gear = document.getElementById(`${id}-gear`);
  if (!gear) return;

  const angle = position * (360 / 26);
  gear.style.transition = "transform 0.25s ease-out";
  gear.style.transform = `rotate(${angle}deg)`;

  const letters = gear.querySelectorAll("text");
  const letterRadius = 62;

  letters.forEach((text, i) => {
    const baseAngle = (i * 360) / 26;
    const rad = (baseAngle * Math.PI) / 180;
    const x = Math.sin(rad) * letterRadius;
    const y = -Math.cos(rad) * letterRadius;

    text.style.transition = "transform 0.25s ease-out";
    text.style.transform = `translate(${x}px, ${y}px) rotate(${-angle}deg)`;
  });
}
*/







/*
export function updateRotorRotation(id, position) {
  const gear = document.getElementById(`${id}-gear`);
  if (!gear) return;

  const angle = position * (360 / 26);
  gear.style.transition = "transform 0.25s ease-out";
  gear.style.transform = `rotate(${angle}deg)`;

  const letters = gear.querySelectorAll("text");
  
  //Pushed from 62 to 66 to maximize the space between letters!
  const letterRadius = 66; 

  letters.forEach((text, i) => {
    const baseAngle = (i * 360) / 26;
    const rad = (baseAngle * Math.PI) / 180;
    const x = Math.sin(rad) * letterRadius;
    const y = -Math.cos(rad) * letterRadius;

    text.style.transition = "transform 0.25s ease-out";
    text.style.transform = `translate(${x}px, ${y}px) rotate(${-angle}deg)`; 
  });
}
*/















export function updateRotorRotation(id, position) {
  const gear = document.getElementById(`${id}-gear`);
  if (!gear) return;

  // FIX: The Continuous Angle Tracker
  // We use HTML dataset to remember the gear's absolute rotation so it never unwinds!
  if (gear.dataset.currentPos === undefined) {
    gear.dataset.currentPos = position;
    gear.dataset.accumulatedAngle = position * (360 / 26);
  }

  let currentPos = parseFloat(gear.dataset.currentPos);
  let accumulatedAngle = parseFloat(gear.dataset.accumulatedAngle);

  // Calculate the shortest path to the next letter
  let diff = position - currentPos;
  
  // If it wrapped from 25 back to 0, this forces it to step FORWARD (+1) instead of backward (-25)
  if (diff < -13) diff += 26;
  // If you scroll backward from 0 to 25, this forces it to step BACKWARD (-1) instead of forward (+25)
  if (diff > 13) diff -= 26;

  // Add the difference to our continuous tracker
  accumulatedAngle += diff * (360 / 26);
  
  // Save the new state for the next keystroke
  gear.dataset.currentPos = position;
  gear.dataset.accumulatedAngle = accumulatedAngle;

  // 1. Rotate the main gear body continuously
  gear.style.transition = "transform 0.25s ease-out";
  gear.style.transform = `rotate(${accumulatedAngle}deg)`;

  const letters = gear.querySelectorAll("text");
  const letterRadius = 66; 

  // 2. Counter-rotate the letters using the exact same continuous angle!
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

  // 1. Outer Ring (This is the one we will make glow!)
  const outerRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  outerRing.setAttribute("r", 60);
  outerRing.setAttribute("fill", "#1a1a1a");
  outerRing.setAttribute("stroke", "#444");
  outerRing.setAttribute("stroke-width", "2");
  outerRing.style.transition = "stroke 0.2s ease, filter 0.2s ease"; // Smooth glow transition
  group.appendChild(outerRing);

  // 2. Inner Decorative Hub
  const innerRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  innerRing.setAttribute("r", 40);
  innerRing.setAttribute("fill", "#111");
  innerRing.setAttribute("stroke", "#222");
  innerRing.setAttribute("stroke-width", "2");
  group.appendChild(innerRing);

  // 3. Stamped Historical Label (UKW = Umkehrwalze)
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



/*
export function drawPlugboard(state) {
  const group = document.getElementById("plugboard");
  group.innerHTML = "";
  
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const startX = 90, startY = 820, gap = 45;
  const positions = {};


  letters.split("").forEach((letter, i) => {
    const row = i < 13 ? 0 : 1;
    const col = i % 13;
    const x = startX + col * gap;
    const y = startY + row * 60;
    positions[letter] = { x, y };

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", 10);
    circle.setAttribute("fill", "#222");
    circle.setAttribute("stroke", "#888");
    circle.style.cursor = "pointer";
    circle.addEventListener("click", () => handlePlugClick(letter, state));

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x - 20);
    text.setAttribute("y", y + 4);
    text.setAttribute("fill", "#ccc");
    text.setAttribute("font-size", "12");
    text.textContent = letter;

    group.appendChild(circle);
    group.appendChild(text);
  });

  Object.entries(state.plugboard).forEach(([a, b]) => {
    if (a < b) { 
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", positions[a].x);
      line.setAttribute("y1", positions[a].y);
      line.setAttribute("x2", positions[b].x);
      line.setAttribute("y2", positions[b].y);
      line.setAttribute("stroke", "cyan");
      line.setAttribute("stroke-width", "2");
      group.appendChild(line);
    }
  });
}
*/








export function drawPlugboard(state) {
  const group = document.getElementById("plugboard");
  group.innerHTML = "";
  
  // 1. Match the exact QWERTZ layout and spacing of the keyboard
  const startX = 100, gap = 60;
  const startY = 810; // Snugs it right beneath the keyboard
  const rows = ["QWERTZUIO", "ASDFGHJK", "PYXCVBNML"];
  const rowOffsets = [0, 30, 0];
  const positions = {};

  // 2. Loop through the rows and columns just like the keyboard
  rows.forEach((rowLetters, rowIndex) => {
    rowLetters.split("").forEach((letter, colIndex) => {
      const x = startX + rowOffsets[rowIndex] + colIndex * gap;
      const y = startY + rowIndex * 45;
      positions[letter] = { x, y };

      // Draw the Plugboard Socket
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", 11);
      circle.setAttribute("fill", "#222");
      circle.setAttribute("stroke", "#888");
      circle.style.cursor = "pointer";
      circle.addEventListener("click", () => handlePlugClick(letter, state));

      // Draw the Letter Label (Centered directly above the socket)
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

  // 3. Draw the active connection cables
  Object.entries(state.plugboard).forEach(([a, b]) => {
    if (a < b) { 
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", positions[a].x);
      line.setAttribute("y1", positions[a].y);
      line.setAttribute("x2", positions[b].x);
      line.setAttribute("y2", positions[b].y);
      line.setAttribute("stroke", "cyan");
      line.setAttribute("stroke-width", "3"); // Thickened slightly for better visibility
      line.style.pointerEvents = "none"; // Prevents the line from blocking clicks on the sockets
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

async function routeFromKeyToRotor(keyX, keyY, entryX, entryY) {
  const OFFSET_DOWN = 25;
  const railX = RIGHT_RAIL_X;
  const downY = keyY + OFFSET_DOWN;

  await drawSmartLine(keyX, keyY, keyX, downY, false, false);
  await drawSmartLine(keyX, downY, railX, downY, false, false);
  await drawSmartLine(railX, downY, railX, entryY, false, false);
  await drawSmartLine(railX, entryY, entryX, entryY, false, true); // True! Shrink the end where it hits the glass ring

  window._lastSignalPoint = { x: entryX, y: entryY };
}

async function routeFromRotorToLamp(rotorX, rotorY, lampX, lampY) {
  const OFFSET_DOWN = 35;
  const railX = RETURN_RAIL_X; 
  const belowLampY = lampY - OFFSET_DOWN;

  await drawSmartLine(rotorX, rotorY, railX, rotorY, true, false); // True! Shrink the start where it leaves the glass ring
  await drawSmartLine(railX, rotorY, railX, belowLampY, false, false);
  await drawSmartLine(railX, belowLampY, lampX, belowLampY, false, false);
  await drawSmartLine(lampX, belowLampY, lampX, lampY, false, false); 

  window._lastSignalPoint = { x: lampX, y: lampY };
}