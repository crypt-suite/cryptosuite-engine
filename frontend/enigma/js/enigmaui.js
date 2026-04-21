import { encryptLetter } from "./enigmacore.js";
import { enigmaState } from "./enigmaState.js";
import { animateSignal, drawLampboard, drawKeyboard, drawRotors, lightLamp, drawPlugboard, updateRotorRotation, toggleVisualization, /*toggleFlow, clearHighlights*/} from "./enigmaviz.js";
import { ROTOR_LIBRARY } from "./enigmaState.js";

//The Electrical Lock! Prevents overlapping animations from crashing the SVG.
let isAnimating = false; 

window.addEventListener("load", () => {
  drawLampboard();
  drawKeyboard(pressKey);
  drawRotors(enigmaState);
  drawPlugboard(enigmaState);
  createRotorControls();
  createOutputPanel();
  createResetButton();
  createTurboButton();
  //createFlowButton();
});

document.addEventListener("keydown", (e) => {
  // If the machine is currently animating electricity, ignore the keystroke!
  if (e.repeat || isAnimating) return; 

  // Prevent dropdowns from stealing focus when you type
  if (document.activeElement && document.activeElement.tagName === "SELECT") {
    document.activeElement.blur();
  }

  const letter = e.key.toUpperCase();
  if (/^[A-Z]$/.test(letter)) {
    pressKey(letter);
  }
});

export async function pressKey(letter) {
  if (isAnimating) return;
  isAnimating = true; // Lock the machine!

  //Instantly break the previous electrical circuit
  lightLamp(null);

  const result = encryptLetter(letter, enigmaState);

  // UPDATE ROTOR VISUALS
  updateRotorRotation("rotor-left", enigmaState.positions[0]);
  updateRotorRotation("rotor-middle", enigmaState.positions[1]);
  updateRotorRotation("rotor-right", enigmaState.positions[2]);

  // LIVE-SYNC THE DROPDOWNS
  const drop0 = document.getElementById("pos-dropdown-0");
  const drop1 = document.getElementById("pos-dropdown-1");
  const drop2 = document.getElementById("pos-dropdown-2");
  if (drop0) drop0.value = enigmaState.positions[0].toString();
  if (drop1) drop1.value = enigmaState.positions[1].toString();
  if (drop2) drop2.value = enigmaState.positions[2].toString();

  // Print the text to the Output Box IMMEDIATELY
  const textSpan = document.getElementById("cipher-text");
  textSpan.textContent += result.outputLetter;

  // Auto-scroll the text box to the latest character
  const scrollBox = document.getElementById("cipher-scroll");
  scrollBox.scrollLeft = scrollBox.scrollWidth;



  //Wait for the physical gear to finish clicking into place!
  //await new Promise(resolve => setTimeout(resolve, 260));

  // Now let the electricity animation play out...
  await animateSignal(
    result.signalPath,
    letter,
    result.outputLetter,
    result.rotorPositions 
  );
  
  // Light up the final bulb!
  lightLamp(result.outputLetter);

  isAnimating = false; // Unlock the machine for the next keystroke!
}

function createRotorControls() {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.top = "90px";
  container.style.left = "20px";
  container.style.color = "white";

  ["left", "middle", "right"].forEach((label, index) => {

    // 1. Rotor Type Selection
    const select = document.createElement("select");
    Object.keys(ROTOR_LIBRARY).forEach(rotorName => {
      const option = document.createElement("option");
      option.value = rotorName;
      option.textContent = rotorName;
      select.appendChild(option);
    });
    select.value = enigmaState.rotors[index].name;
    select.addEventListener("change", () => {
      const selected = select.value;
      enigmaState.rotors[index] = { name: selected, ...ROTOR_LIBRARY[selected] };
      drawRotors(enigmaState);
    });

    // 2. Starting Position Selection (A-Z)
    const posSelect = document.createElement("select");
    posSelect.id = `pos-dropdown-${index}`;
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((letter, i) => {
      const opt = document.createElement("option");
      opt.value = i.toString(); 
      opt.textContent = letter;
      posSelect.appendChild(opt);
    });
    posSelect.value = enigmaState.positions[index].toString();
    posSelect.addEventListener("change", () => {
      enigmaState.positions[index] = parseInt(posSelect.value);
      updateRotorRotation(`rotor-${label}`, enigmaState.positions[index]);
    });

    // 3. Ring Setting Control
    const ringInput = document.createElement("input");
    ringInput.type = "number";
    ringInput.min = 0;
    ringInput.max = 25;
    ringInput.value = enigmaState.rings[index];
    ringInput.style.width = "40px";
    ringInput.addEventListener("change", () => {
      enigmaState.rings[index] = parseInt(ringInput.value) % 26;
    });

    const labelEl = document.createElement("label");
    labelEl.textContent = `Rotor ${label}: `;
   
    container.appendChild(labelEl);
    container.appendChild(select);
    container.appendChild(document.createTextNode("  Pos: "));
    container.appendChild(posSelect);
    container.appendChild(document.createTextNode("  Ring: "));
    container.appendChild(ringInput);
    container.appendChild(document.createElement("br"));
    container.appendChild(document.createElement("br"));
  });

  document.body.appendChild(container);
}

function createOutputPanel() {
  const output = document.createElement("div");
  output.id = "cipher-output";

  output.innerHTML = `
    <span id="output-label">OUTPUT:</span>
    <div id="cipher-scroll">
      <span id="cipher-text"></span>
    </div>
  `;

  document.body.appendChild(output);
}
/*
function createResetButton() {
  const btn = document.createElement("button");
  btn.textContent = "Reset Machine";
  btn.style.position = "absolute";
  btn.style.top = "100px";
  btn.style.left = "650px";

  //Assign the new CSS class
  btn.className = "enigma-btn";

  btn.addEventListener("click", () => {
    enigmaState.positions = [0, 0, 0];
    updateRotorRotation("rotor-left", 0);
    updateRotorRotation("rotor-middle", 0);
    updateRotorRotation("rotor-right", 0);

    const drop0 = document.getElementById("pos-dropdown-0");
    const drop1 = document.getElementById("pos-dropdown-1");
    const drop2 = document.getElementById("pos-dropdown-2");
    if (drop0) drop0.value = "0";
    if (drop1) drop1.value = "0";
    if (drop2) drop2.value = "0";

    const defaultRotors = ["I", "II", "III"];
    defaultRotors.forEach((name, i) => {
      enigmaState.rotors[i] = { name, ...ROTOR_LIBRARY[name] };
    });
    drawRotors(enigmaState);

    enigmaState.rings = [0, 0, 0];
    enigmaState.plugboard = {};
    drawPlugboard(enigmaState);

    const selects = document.querySelectorAll("select:not([id^='pos-dropdown-'])");
    const inputs = document.querySelectorAll("input[type='number']");
    selects.forEach((sel, i) => { sel.value = defaultRotors[i]; });
    inputs.forEach(input => { input.value = 0; });

    document.querySelectorAll("[id^='lamp-']").forEach(lamp => {
      lamp.setAttribute("fill", "#222");
    });
    document.getElementById("cipher-text").textContent = "";

    document.getElementById("wires").innerHTML = "";
    document.querySelectorAll(".signal-dot").forEach(el => el.remove());
    document.querySelectorAll(".signal-line").forEach(el => el.remove());
    document.querySelectorAll(".signal-active").forEach(el => el.classList.remove("signal-active"));
  });

  document.body.appendChild(btn);
}



function createTurboButton() {
  const btn = document.createElement("button");
  
  //Set the initial text to OFF
  btn.textContent = "⚡ VIZ: OFF"; 
  btn.style.position = "absolute";
  btn.style.top = "145px"; 
  btn.style.left = "650px";
  
  // Add BOTH the base class and the red "off" class so it boots up correctly
  btn.className = "enigma-btn enigma-btn-off";

  btn.addEventListener("click", (e) => {
    const currentlyOn = toggleVisualization();
    
    // Toggle the warning class instead of hardcoding colors
    if (currentlyOn) {
        e.target.textContent = "⚡ VIZ: ON";
        e.target.classList.remove("enigma-btn-off");
    } else {
        e.target.textContent = "⚡ VIZ: OFF";
        e.target.classList.add("enigma-btn-off");
    }
    
    document.activeElement.blur(); 
  });

  document.body.appendChild(btn);
}
*/






/*
function createResetButton() {
  const btn = document.createElement("button");
  btn.textContent = "Reset Machine";
  btn.className = "enigma-btn";

  // --- 🎯 POSITION CONTROLS ---
  btn.style.position = "absolute";
  btn.style.top = "90px";   // Move UP/DOWN
  btn.style.left = "600px";  // Move LEFT/RIGHT

  // --- 📐 SIZE CONTROLS ---
  btn.style.padding = "5px 10px"; // Thickness (Top/Bottom) & Width (Left/Right)
  btn.style.fontSize = "14px";    // Text Size

  btn.addEventListener("click", () => {
    enigmaState.positions = [0, 0, 0];
    updateRotorRotation("rotor-left", 0);
    updateRotorRotation("rotor-middle", 0);
    updateRotorRotation("rotor-right", 0);

    const drop0 = document.getElementById("pos-dropdown-0");
    const drop1 = document.getElementById("pos-dropdown-1");
    const drop2 = document.getElementById("pos-dropdown-2");
    if (drop0) drop0.value = "0";
    if (drop1) drop1.value = "0";
    if (drop2) drop2.value = "0";

    const defaultRotors = ["I", "II", "III"];
    defaultRotors.forEach((name, i) => {
      enigmaState.rotors[i] = { name, ...ROTOR_LIBRARY[name] };
    });
    drawRotors(enigmaState);

    enigmaState.rings = [0, 0, 0];
    enigmaState.plugboard = {};
    drawPlugboard(enigmaState);

    const selects = document.querySelectorAll("select:not([id^='pos-dropdown-'])");
    const inputs = document.querySelectorAll("input[type='number']");
    selects.forEach((sel, i) => { sel.value = defaultRotors[i]; });
    inputs.forEach(input => { input.value = 0; });

    document.querySelectorAll("[id^='lamp-']").forEach(lamp => {
      lamp.setAttribute("fill", "#222");
    });
    document.getElementById("cipher-text").textContent = "";

    document.getElementById("wires").innerHTML = "";
    document.querySelectorAll(".signal-dot").forEach(el => el.remove());
    document.querySelectorAll(".signal-line").forEach(el => el.remove());
    document.querySelectorAll(".signal-active").forEach(el => el.classList.remove("signal-active"));
  });

  document.body.appendChild(btn);
}


function createTurboButton() {
  const btn = document.createElement("button");
  btn.textContent = "STROMLAUF: AUS";
  btn.className = "enigma-btn enigma-btn-off";

  // --- 🎯 POSITION CONTROLS ---
  btn.style.position = "absolute";
  btn.style.top = "125px";   // Move UP/DOWN
  btn.style.left = "600px";  // Move LEFT/RIGHT

  // --- 📐 SIZE CONTROLS ---
  btn.style.padding = "5px 10px"; // Thickness (Top/Bottom) & Width (Left/Right)
  btn.style.fontSize = "13px";    // Text Size

  btn.addEventListener("click", (e) => {
    const currentlyOn = toggleVisualization();
    
    if (currentlyOn) {
        e.target.textContent = "STROMLAUF: AUS";
        e.target.classList.remove("enigma-btn-off");
    } else {
        e.target.textContent = "STROMLAUF: AUS";
        e.target.classList.add("enigma-btn-off");
    }
    
    document.activeElement.blur(); 
  });

  document.body.appendChild(btn);
}
  */


function createResetButton() {
  const btn = document.createElement("button");
  btn.textContent = "Reset Machine";

  // --- 🎯 POSITION CONTROLS ---
  btn.style.position = "absolute";
  btn.style.top = "90px";   
  btn.style.left = "600px";  

  // --- 📐 SIZE CONTROLS ---
  btn.style.padding = "5px 10px"; 
  btn.style.fontSize = "14px";    

  // --- 🎨 COLOR & STYLE CONTROLS (Wood & Brass) ---
  btn.style.backgroundColor = "#2b1d12";
  btn.style.color = "#e0c097";
  btn.style.border = "2px solid #5a3a1e";
  btn.style.fontFamily = "'Courier New', monospace";
  btn.style.fontWeight = "bold";
  btn.style.borderRadius = "6px";
  btn.style.cursor = "pointer";

  btn.addEventListener("click", () => {
    enigmaState.positions = [0, 0, 0];
    updateRotorRotation("rotor-left", 0);
    updateRotorRotation("rotor-middle", 0);
    updateRotorRotation("rotor-right", 0);

    const drop0 = document.getElementById("pos-dropdown-0");
    const drop1 = document.getElementById("pos-dropdown-1");
    const drop2 = document.getElementById("pos-dropdown-2");
    if (drop0) drop0.value = "0";
    if (drop1) drop1.value = "0";
    if (drop2) drop2.value = "0";

    const defaultRotors = ["I", "II", "III"];
    defaultRotors.forEach((name, i) => {
      enigmaState.rotors[i] = { name, ...ROTOR_LIBRARY[name] };
    });
    drawRotors(enigmaState);

    enigmaState.rings = [0, 0, 0];
    enigmaState.plugboard = {};
    drawPlugboard(enigmaState);

    const selects = document.querySelectorAll("select:not([id^='pos-dropdown-'])");
    const inputs = document.querySelectorAll("input[type='number']");
    selects.forEach((sel, i) => { sel.value = defaultRotors[i]; });
    inputs.forEach(input => { input.value = 0; });

    document.querySelectorAll("[id^='lamp-']").forEach(lamp => {
      lamp.setAttribute("fill", "#222");
    });
    document.getElementById("cipher-text").textContent = "";

    document.getElementById("wires").innerHTML = "";
    document.querySelectorAll(".signal-dot").forEach(el => el.remove());
    document.querySelectorAll(".signal-line").forEach(el => el.remove());
    document.querySelectorAll(".signal-active").forEach(el => el.classList.remove("signal-active"));
  });

  document.body.appendChild(btn);
}


function createTurboButton() {
  const btn = document.createElement("button");
  btn.textContent = "STROMLAUF: AUS";

  // --- 🎯 POSITION CONTROLS ---
  btn.style.position = "absolute";
  btn.style.top = "125px";   
  btn.style.left = "600px";  

  // --- 📐 SIZE CONTROLS ---
  btn.style.padding = "5px 10px"; 
  btn.style.fontSize = "13px";    

  // --- 🎨 COLOR & STYLE CONTROLS (Starts out Dark Red for "AUS") ---
  btn.style.backgroundColor = "#5a1a1a";
  btn.style.color = "#ffb3b3";
  btn.style.border = "2px solid #7a2a2a";
  btn.style.fontFamily = "'Courier New', monospace";
  btn.style.fontWeight = "bold";
  btn.style.borderRadius = "6px";
  btn.style.cursor = "pointer";

  btn.addEventListener("click", (e) => {
    const currentlyOn = toggleVisualization();
    
    if (currentlyOn) {
        // Turn ON: Switch to normal Brass/Wood colors
        e.target.textContent = "STROMLAUF: EIN";
        e.target.style.backgroundColor = "#2b1d12"; 
        e.target.style.color = "#e0c097";
        e.target.style.border = "2px solid #5a3a1e";
    } else {
        // Turn OFF: Switch to Dark Red colors
        e.target.textContent = "STROMLAUF: AUS";
        e.target.style.backgroundColor = "#5a1a1a"; 
        e.target.style.color = "#ffb3b3";
        e.target.style.border = "2px solid #7a2a2a";
    }
    
    document.activeElement.blur(); 
  });

  document.body.appendChild(btn);
}


/*
function createFlowButton() {
  const btn = document.createElement("button");
  // 🌟 Use the Power Symbol instead of text
  btn.textContent = "⏻"; 

  // --- 🎯 POSITION CONTROLS ---
  // You can nudge the 'left' value to align it perfectly next to your other buttons
  btn.style.position = "absolute";
  btn.style.top = "125px";   
  btn.style.left = "555px";  

  // --- 📐 COMPACT SQUARE SIZING ---
  btn.style.width = "36px";
  btn.style.height = "30px";
  btn.style.padding = "0"; 
  btn.style.fontSize = "22px"; // Bigger font so the icon pops
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  
  // --- 🎨 DEFAULT STYLE (OFF) ---
  btn.style.backgroundColor = "#5a1a1a";
  btn.style.color = "#ffb3b3";
  btn.style.border = "2px solid #7a2a2a";
  btn.style.borderRadius = "6px";
  btn.style.cursor = "pointer";
  btn.style.transition = "all 0.2s ease"; // Smooth fading between colors

  btn.addEventListener("click", (e) => {
    const currentlyOn = toggleFlow();
    
    if (currentlyOn) {
        // Turn ON: Brass colors + Glowing Icon Effect!
        e.target.style.backgroundColor = "#2b1d12"; 
        e.target.style.color = "#e0c097";
        e.target.style.border = "2px solid #5a3a1e";
        e.target.style.textShadow = "0px 0px 8px #e0c097"; 
    } else {
        // Turn OFF: Dark Red colors + Remove Glow
        e.target.style.backgroundColor = "#5a1a1a"; 
        e.target.style.color = "#ffb3b3";
        e.target.style.border = "2px solid #7a2a2a";
        e.target.style.textShadow = "none";
    }
    
    document.activeElement.blur(); 
  });

  document.body.appendChild(btn);
}
*/