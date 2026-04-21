const lampsGroup = document.getElementById("lamps");

const LAMP_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";



const LAMP_START_X = 100;
const LAMP_START_Y = 400;
const LAMP_GAP = 35;

const lampElements = {};

LAMP_KEYS.split("").forEach((letter, i) => {
  const x = LAMP_START_X + i * LAMP_GAP;
  const lamp = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  lamp.setAttribute("cx", x);
  lamp.setAttribute("cy", LAMP_START_Y);
  lamp.setAttribute("r", 14);
  lamp.setAttribute("fill", "#222");
  lamp.setAttribute("stroke", "#999");

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", x);
  text.setAttribute("y", LAMP_START_Y + 5);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-size", "12");
  text.setAttribute("fill", "#fff");
  text.textContent = letter;

  lampsGroup.appendChild(lamp);
  lampsGroup.appendChild(text);

  lampElements[letter] = lamp;
});





export function lightLamp(letter) {
  Object.values(lampElements).forEach(lamp => {
    lamp.setAttribute("fill", "#222");
  });

  if (lampElements[letter]) {
    lampElements[letter].setAttribute("fill", "yellow");
  }
}


