export const ROTOR_LIBRARY = {
  I:   { wiring: "EKMFLGDQVZNTOWYHXUSPAIBRCJ", notch: "Q" },
  II:  { wiring: "AJDKSIRUXBLHWTMCQGZNPYFVOE", notch: "E" },
  III: { wiring: "BDFHJLCPRTXVZNYEIWGAKMUSQO", notch: "V" },
  IV:  { wiring: "ESOVPZJAYQUIRHXLNFTGKDCMWB", notch: "J" },
  V:   { wiring: "VZBRGITYUPSDNHLXAWMJQOFECK", notch: "Z" }
};



export const enigmaState = {
  rotors: [
    { name: "I",   wiring: "EKMFLGDQVZNTOWYHXUSPAIBRCJ", notch: "Q" },
    { name: "II",  wiring: "AJDKSIRUXBLHWTMCQGZNPYFVOE", notch: "E" },
    { name: "III", wiring: "BDFHJLCPRTXVZNYEIWGAKMUSQO", notch: "V" }
  ],

  positions: [0, 0, 0],   // A A A
  rings:     [0, 0, 0],   // A A A

  reflector: {
     name: "B",
    wiring: "YRUHQSLDPXNGOKMIEBFZCWVJAT"
  },

  plugboard: {
    // "A": "Z",
    // "Z": "A"
  }
};
