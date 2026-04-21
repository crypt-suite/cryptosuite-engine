// Enigma Machine Core Logic
// No UI, No SVG, No DOM access








const A = "A".charCodeAt(0);

function charToIndex(c) {
  return c.charCodeAt(0) - A;
}

function indexToChar(i) {
  return String.fromCharCode((i + 26) % 26 + A);
}


function plugSwap(c, plugboard) {
  for (const key in plugboard) {
    if (key === c) return plugboard[key];
    if (plugboard[key] === c) return key;
  }
  return c;
}


function rotorForward(i, rotor, pos, ring) {
  const shifted = (i + pos - ring + 26) % 26;
  const wired = charToIndex(rotor.wiring[shifted]);
  return (wired - pos + ring + 26) % 26;
}

function rotorBackward(i, rotor, pos, ring) {
  const shifted = (i + pos - ring + 26) % 26;

  const letter = indexToChar(shifted);
  const wiredIndex = rotor.wiring.indexOf(letter);

  return (wiredIndex - pos + ring + 26) % 26;
}



function encryptLetter(letter, state) {
  // 1️⃣ Step rotors FIRST
  stepRotors(state);

  const path = [];
  let c = letter;

  // 2️⃣ Plugboard in
  c = plugSwap(c, state.plugboard);
  path.push({ stage: "plugboard-in", letter: c });

  let i = charToIndex(c);

  // 3️⃣ Forward through rotors (right → middle → left)
  i = rotorForward(i, state.rotors[2], state.positions[2], state.rings[2]);
  path.push({ stage: "rotor-right", index: i });

  i = rotorForward(i, state.rotors[1], state.positions[1], state.rings[1]);
  path.push({ stage: "rotor-middle", index: i });

  i = rotorForward(i, state.rotors[0], state.positions[0], state.rings[0]);
  path.push({ stage: "rotor-left", index: i });

  // 4️⃣ Reflector
  i = charToIndex(state.reflector.wiring[i]);
  path.push({ stage: "reflector", index: i });

  // 5️⃣ Backward through rotors (left → middle → right)
  i = rotorBackward(i, state.rotors[0], state.positions[0], state.rings[0]);
  path.push({ stage: "rotor-left-back", index: i });

  i = rotorBackward(i, state.rotors[1], state.positions[1], state.rings[1]);
  path.push({ stage: "rotor-middle-back", index: i });

  i = rotorBackward(i, state.rotors[2], state.positions[2], state.rings[2]);
  path.push({ stage: "rotor-right-back", index: i });

  // 6️⃣ Plugboard out
  c = plugSwap(indexToChar(i), state.plugboard);
  path.push({ stage: "plugboard-out", letter: c });

  console.log("Final rotor-right-back index:", i);
console.log("Final before plugboard:", indexToChar(i));

  return {
outputLetter: c,
signalPath: path,
rotorPositions: [...state.positions]   // ← snapshot
};
}












/*

function stepRotors(state) {
  const [left, middle, right] = state.rotors;
  const [lp, mp, rp] = state.positions;

  const rightAtNotch =
  indexToChar((rp + 26 - state.rings[2]) % 26) === right.notch;

   const middleAtNotch =
    indexToChar((mp + 26 - state.rings[1]) % 26) === middle.notch;
    
  // Double‑step behavior
  if (middleAtNotch) {
    state.positions[0] = (lp + 1) % 26; // left
    state.positions[1] = (mp + 1) % 26; // middle
  }  if (rightAtNotch) {
    state.positions[1] = (mp + 1) % 26; // middle
  }

  // Right rotor always steps
  state.positions[2] = (rp + 1) % 26;
}

*/





function stepRotors(state) {
  const [left, middle, right] = state.rotors;
  const [lp, mp, rp] = state.positions;

  // Check if rotors are sitting on their physical notches
  const rightAtNotch = indexToChar(rp) === right.notch;
  const middleAtNotch = indexToChar(mp) === middle.notch;

  let stepLeft = false;
  let stepMiddle = false;
  let stepRight = true; // The right rotor ALWAYS steps

  // The historical mechanical pawl logic
  if (middleAtNotch) {
    stepLeft = true;
    stepMiddle = true; // This causes the double-step!
  }
  if (rightAtNotch) {
    stepMiddle = true;
  }

  // Apply the rotations
  if (stepLeft) state.positions[0] = (lp + 1) % 26;
  if (stepMiddle) state.positions[1] = (mp + 1) % 26;
  if (stepRight) state.positions[2] = (rp + 1) % 26;
}






function encryptText(text, state) {
  let output = "";
  let fullPath = [];

  for (let c of text.toUpperCase()) {
    if (!/[A-Z]/.test(c)) continue;

    const result = encryptLetter(c, state);
    output += result.outputLetter;

    fullPath.push({
      input: c,
      output: result.outputLetter,
      path: result.signalPath,
      rotorPositions: [...state.positions]
    });
  }

  return {
    ciphertext: output,
    trace: fullPath
  };
}


export { encryptLetter, encryptText };






