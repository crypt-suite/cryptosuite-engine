const keyboardGroup = document.getElementById("keyboard");

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const startX = 100;
const startY = 450;
const KEY_GAP= 35;

letters.split("").forEach((letter, i) => {
  const x = startX + i * KEY_GAP;

  const key = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  key.setAttribute("cx", x);
  key.setAttribute("cy", startY);
  key.setAttribute("r", 14);
  key.setAttribute("fill", "#ddd");
  key.setAttribute("stroke", "#333");

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", x);
  text.setAttribute("y", startY + 5);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-size", "12");
  text.textContent = letter;

 key.addEventListener("click", () => {
  console.log("Key pressed:", letter);

  stepRotors(enigmaState);   // real stepping
  
});



  keyboardGroup.appendChild(key);
  keyboardGroup.appendChild(text);
});
