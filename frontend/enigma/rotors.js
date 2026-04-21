console.log("rotors.js loaded");

const ROTOR_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function drawRotor(groupId, cx, cy, position) {
  const group = document.getElementById(groupId);
  group.innerHTML = "";

  const body = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  body.setAttribute("cx", cx);
  body.setAttribute("cy", cy);
  body.setAttribute("r", 55);
  body.setAttribute("fill", "#111");
  body.setAttribute("stroke", "#777");
  group.appendChild(body);

  ROTOR_LETTERS.split("").forEach((letter, i) => {
    const angle = ((i - position) * 360) / 26;
    const rad = angle * Math.PI / 180;

    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", cx + Math.sin(rad) * 40);
    t.setAttribute("y", cy - Math.cos(rad) * 40);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("dominant-baseline", "middle");
    t.setAttribute("font-size", "10");

    t.setAttribute("fill", i === 0 ? "yellow" : "#ccc");
    t.textContent = letter;

    group.appendChild(t);
  });
}

function drawRotors(state) {
  drawRotor("rotor-left",   400, 250, state.positions[0]);
  drawRotor("rotor-middle", 550, 250, state.positions[1]);
  drawRotor("rotor-right",  700, 250, state.positions[2]);
}

window.drawRotors = drawRotors;
