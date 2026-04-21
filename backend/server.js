


const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const { exec } = require("child_process");


const app = express();
app.use(cors());
app.use(express.json());





const Diff = require("diff");


// backend/server.js
const CryptoJS = require("crypto-js");



//1. Load Environment Variables
require('dotenv').config();



const nodemailer = require("nodemailer");

//2. Production Transporter (Free Gmail Route)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});




// Helper for Affine cipher modular inverse
function modInverse(a, m) {
  a = a % m;
  for (let x = 1; x < m; x++) {
    if ((a * x) % m === 1) return x;
  }
  return null;
}
//------------Helper for Affine cipher modular inverse------------//




//------------ceasar cipher backend route integrated directly into server.js------------//




// TEMP test route
/*
app.get("/", (req, res) => {
  res.send("Backend is running");
});
*/







// Serve the Main Hub (Your landing page with the two buttons)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Serve the Static Frontends
app.use("/enigma", express.static(path.join(__dirname, '../frontend/enigma')));
app.use("/compiler", express.static(path.join(__dirname, '../frontend/compiler')));







// The Compiler API Route
app.post("/run", express.text(), (req, res) => {
    const code = req.body; 

    // Point to where you placed the 'lan' executable inside your backend folder
    const executablePath = path.join(__dirname, 'compiler_engine', 'lan'); 
    
    // Execute the C++ parser
    const process = exec(executablePath);

    let output = "";
    let errorOutput = "";

    process.stdout.on("data", data => {
        console.log("STDOUT:", data.toString());
        output += data.toString();
    });

    process.stderr.on("data", data => {
        console.log("STDERR:", data.toString());
        errorOutput += data.toString();
    });

    process.on("close", () => {
        console.log("===== PROCESS FINISHED =====");
        res.set("Content-Type", "text/plain");
        res.send(output || errorOutput || "No output from compiler");
    });
   
    // Feed the code into the C++ program
    process.stdin.write(code);
    process.stdin.end();
});

// Caesar route
/*
app.post("/api/caesar", (req, res) => {
  const { text, shift = 3, mode } = req.body;

  let result = "";
  let steps = [];

  for (let c of text) {
    if (/[a-z]/.test(c)) {
      const base = 97;
      const s = mode === "decrypt" ? 26 - shift : shift;
      const newChar = String.fromCharCode(
        (c.charCodeAt(0) - base + s) % 26 + base
      );
      steps.push(`${c} → ${newChar}`);
      result += newChar;
    } 
    else if (/[A-Z]/.test(c)) {
      const base = 65;
      const s = mode === "decrypt" ? 26 - shift : shift;
      const newChar = String.fromCharCode(
        (c.charCodeAt(0) - base + s) % 26 + base
      );
      steps.push(`${c} → ${newChar}`);
      result += newChar;
    } 
    else {
      steps.push(`${c} → ${c} (unchanged)`);
      result += c;
    }
  }

  res.json({ result, steps });
});
*/









// ------------ 1. Updated Caesar Route (Supports A-Z, a-z, 0-9) ------------ //
// ------------ Updated Dynamic Caesar Route ------------ //
app.post("/api/caesar", (req, res) => {
  // It now accepts the custom alphabet from the frontend!
  const { text, shift = 3, mode, alphabet } = req.body;
  const CAESAR_ALPHABET = alphabet || "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  
  let result = "";
  let steps = [];
  const len = CAESAR_ALPHABET.length;
  const s = parseInt(shift);

  for (let c of text) {
    const idx = CAESAR_ALPHABET.indexOf(c);
    if (idx !== -1) {
      // Safe modulo math to handle both encrypt/decrypt perfectly within the custom boundaries
      let newIdx = mode === "decrypt" 
        ? (((idx - s) % len) + len) % len 
        : (((idx + s) % len) + len) % len;
      
      const newChar = CAESAR_ALPHABET[newIdx];
      steps.push(`${c} → ${newChar}`);
      result += newChar;
    } else {
      steps.push(`${c} → ${c} (unchanged)`);
      result += c;
    }
  }
  res.json({ result, steps });
});
//------------ceasar cipher backend route integrated directly into server.js------------//




// Vigenere route
app.post("/api/vigenere", (req, res) => {
  const { text, key, mode } = req.body;

  if (!key) return res.status(400).json({ error: "Key required" });

  let result = "";
  let steps = [];
  const keylower = key.toLowerCase();

  let j = 0;
  for (let c of text) {
    if (/[a-zA-Z]/.test(c)) {
      const isUpper = c === c.toUpperCase();
      const base = isUpper ? 65 : 97;

      const keyChar = keylower[j % keylower.length];
      const keyShift = keyChar.charCodeAt(0) - 97;
      const shift = mode === "decrypt" ? 26 - keyShift : keyShift;

      const newChar = String.fromCharCode(
        (c.charCodeAt(0) - base + shift) % 26 + base
      );

      steps.push(`${c} + ${keyChar} → ${newChar}`);
      result += newChar;
      j++;
    } else {
      steps.push(`${c} → ${c} (unchanged)`);
      result += c;
    }
  }

  res.json({ result, steps });
});
//------------Vigenere cipher backend route integrated directly into server.js------------//


//------------ROT13 cipher backend route------------//
app.post("/api/rot13", (req, res) => {
  const { text } = req.body;

  let result = "";
  let steps = [];

  for (let c of text) {
    if (/[a-z]/.test(c)) {
      const newChar = String.fromCharCode(
        (c.charCodeAt(0) - 97 + 13) % 26 + 97
      );
      steps.push(`${c} → ${newChar}`);
      result += newChar;
    }
    else if (/[A-Z]/.test(c)) {
      const newChar = String.fromCharCode(
        (c.charCodeAt(0) - 65 + 13) % 26 + 65
      );
      steps.push(`${c} → ${newChar}`);
      result += newChar;
    }
    else {
      steps.push(`${c} → ${c} (unchanged)`);
      result += c;
    }
  }

  res.json({ result, steps });
});
//------------ROT13 cipher backend route------------//

//------------Atbash cipher backend route------------//
app.post("/api/atbash", (req, res) => {
  const { text } = req.body;

  let result = "";
  let steps = [];

  for (let c of text) {
    if (/[a-z]/.test(c)) {
      const newChar = String.fromCharCode(122 - (c.charCodeAt(0) - 97));
      steps.push(`${c} → ${newChar}`);
      result += newChar;
    }
    else if (/[A-Z]/.test(c)) {
      const newChar = String.fromCharCode(90 - (c.charCodeAt(0) - 65));
      steps.push(`${c} → ${newChar}`);
      result += newChar;
    }
    else {
      steps.push(`${c} → ${c} (unchanged)`);
      result += c;
    }
  }

  res.json({ result, steps });
});
//------------Atbash cipher backend route------------//


// Binary route
app.post("/api/binary", (req, res) => {
  const { text, mode } = req.body;

  let result = "";
  let steps = [];

  if (mode === "decrypt") {
    const parts = text.trim().split(" ");
    for (let bin of parts) {
      const char = String.fromCharCode(parseInt(bin, 2));
      steps.push(`${bin} → ${char}`);
      result += char;
    }
  } else {
    for (let c of text) {
      const bin = c.charCodeAt(0).toString(2).padStart(8, "0");
      steps.push(`${c} → ${bin}`);
      result += bin + " ";
    }
    result = result.trim();
  }

  res.json({ result, steps });
});
//------------Binary cipher backend route------------//

//------------Morse cipher backend route------------//
const morseMap = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".",
  F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
  K: "-.-", L: ".-..", M: "--", N: "-.", O: "---",
  P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
  U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--",
  Z: "--..",
  " ": "/"
};

const reverseMorse = Object.fromEntries(
  Object.entries(morseMap).map(([k, v]) => [v, k])
);

app.post("/api/morse", (req, res) => {
  const { text, mode } = req.body;

  let result = "";
  let steps = [];

  if (mode === "decrypt") {
    const parts = text.trim().split(" ");
    for (let code of parts) {
      const char = reverseMorse[code] || "";
      steps.push(`${code} → ${char}`);
      result += char;
    }
  } else {
    for (let c of text.toUpperCase()) {
      const code = morseMap[c] || "";
      steps.push(`${c} → ${code}`);
      result += code + " ";
    }
    result = result.trim();
  }

  res.json({ result, steps });
});
//------------Morse cipher backend route------------//

//------------Base64 backend route------------//
app.post("/api/base64", (req, res) => {
  const { text, mode } = req.body;

  let result = "";
  let steps = [];

  try {
    if (mode === "decrypt") {
      result = Buffer.from(text, "base64").toString("utf-8");
      steps.push("Base64 decoded to plain text");
    } else {
      result = Buffer.from(text, "utf-8").toString("base64");
      steps.push("Plain text encoded to Base64");
    }

    res.json({ result, steps });
  } catch (err) {
    res.status(400).json({ error: "Invalid Base64 input" });
  }
});
//------------Base64 backend route------------//


//------------AES backend route------------//
app.post("/api/aes", (req, res) => {
  const { text, key, mode } = req.body;

  if (!key) {
    return res.status(400).json({ error: "Key required" });
  }

  let result = "";
  let steps = [];

  try {
    if (mode === "decrypt") {
      const bytes = CryptoJS.AES.decrypt(text, key);
      result = bytes.toString(CryptoJS.enc.Utf8);

      if (!result) throw new Error();

      steps.push("AES decrypted using provided key");
    } else {
      result = CryptoJS.AES.encrypt(text, key).toString();
      steps.push("AES encrypted using provided key");
    }

    res.json({ result, steps });
  } catch {
    res.status(400).json({ error: "Invalid key or ciphertext" });
  }
});
//------------AES backend route------------//








// ------------ 2. SHA-256 Route ------------ //
app.post("/api/sha256", (req, res) => {
  const { text } = req.body;
  // SHA-256 is one-way, so we only hash it regardless of "mode"
  const hash = crypto.createHash("sha256").update(text).digest("hex");
  res.json({ result: hash, steps: ["Hashed input using SHA-256 protocol."] });
});

// ------------ 3. Affine Cipher Route ------------ //
app.post("/api/affine", (req, res) => {
  const { text, a = 5, b = 8, mode } = req.body;
  const m = 26;
  const aInv = modInverse(a, m);
  
  if (!aInv && mode === "decrypt") {
    return res.status(400).json({ error: "'A' must be coprime to 26 (e.g., 1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25)" });
  }

  let result = "";
  for (let c of text) {
    if (/[a-zA-Z]/.test(c)) {
      const isUpper = c === c.toUpperCase();
      const x = c.toLowerCase().charCodeAt(0) - 97;
      let newX;
      
      if (mode === "decrypt") {
        newX = (aInv * (x - b + m)) % m;
        if (newX < 0) newX += m;
      } else {
        newX = (a * x + b) % m;
      }
      
      result += String.fromCharCode(newX + (isUpper ? 65 : 97));
    } else {
      result += c;
    }
  }
  res.json({ result, steps: [`Affine applied with A=${a}, B=${b}`] });
});

// ------------ 4. Rail Fence Cipher Route ------------ //
app.post("/api/railfence", (req, res) => {
  const { text, rails = 3, mode } = req.body;
  const r = parseInt(rails);
  if (r < 2) return res.status(400).json({ error: "Rails must be >= 2" });

  let result = "";
  let visualGrid = Array.from({ length: r }, () => Array(text.length).fill("."));

  if (mode === "decrypt") {
    // Determine the zigzag pattern to know where to place ciphertext characters
    let row = 0, dir = 1;
    for (let i = 0; i < text.length; i++) {
      visualGrid[row][i] = "*"; 
      row += dir;
      if (row === 0 || row === r - 1) dir *= -1;
    }
    
    // Fill the pattern with the ciphertext
    let idx = 0;
    for (let i = 0; i < r; i++) {
      for (let j = 0; j < text.length; j++) {
        if (visualGrid[i][j] === "*" && idx < text.length) {
          visualGrid[i][j] = text[idx++];
        }
      }
    }
    
    // Read the zigzag to get plaintext
    row = 0; dir = 1;
    for (let i = 0; i < text.length; i++) {
      result += visualGrid[row][i];
      row += dir;
      if (row === 0 || row === r - 1) dir *= -1;
    }
  } else {
    // Encryption
    let row = 0, dir = 1;
    for (let i = 0; i < text.length; i++) {
      visualGrid[row][i] = text[i];
      row += dir;
      if (row === 0 || row === r - 1) dir *= -1;
    }
    result = visualGrid.map(row => row.filter(c => c !== ".").join("")).join("");
  }

  // Create text-based visualization of the rails
  const visualization = visualGrid.map(row => row.join(" ")).join("\n");
  res.json({ result, steps: ["Rail Fence Layout:\n" + visualization] });
});




//------------User Registration Route------------//
const bcrypt = require("bcryptjs");
const db = require("./db"); // Assuming you have your DB connection here

app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;

  // 1. Check for missing fields
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  // 2. Server-side Airtight Email Validation
  const emailRegex = /^[a-zA-Z0-9]+(?:[._-][a-zA-Z0-9]+)*@[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*(?:\.[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)*\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format. Please check for typos, consecutive dots, or invalid characters." });
  }

  // Restrict to Popular Domains
  const allowedDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "ethereal.email"];
  const userDomain = email.split('@')[1].toLowerCase();
  
  if (!allowedDomains.includes(userDomain)) {
    return res.status(400).json({ 
      error: `Unsupported email provider. We only accept: ${allowedDomains.join(', ')}` 
    });
  }

  const hashed = await bcrypt.hash(password, 10);

  try {
    // 3. Insert into database including the new email column
    await db.execute(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, hashed]
    );
    res.json({ success: true });
  } catch (err) {
    // Check if error is due to duplicate username OR email
    if (err.code === 'ER_DUP_ENTRY' || err.code === '23505') { 
      return res.status(400).json({ error: "Username or Email already exists" });
    }
    console.error("Database error during registration:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
//------------User Registration Route------------//

/*
//------------User Login Route------------//
const jwt = require("jsonwebtoken");

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const [rows] = await db.execute(
    "SELECT * FROM users WHERE username = ?",
    [username]
  );

  if (rows.length === 0) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);

  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username },
    "SECRET_KEY",
    { expiresIn: "1d" }
  );

  res.json({ token });
});
//------------User Login Route------------//

*/










//------------User Login Route------------//
const jwt = require("jsonwebtoken");

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const [rows] = await db.execute(
    "SELECT * FROM users WHERE username = ?",
    [username]
  );

  if (rows.length === 0) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const user = rows[0];

  //THE DEADBOLT: Strict Number check to prevent string/buffer bypasses!
  if (Number(user.is_locked) === 1) {
    console.log(`🔒 Blocked login attempt for locked user: ${username}`);
    return res.status(403).json({ 
      error: "Account locked due to too many failed attempts. Please check your email to unlock." 
    });
  }

  const ok = await bcrypt.compare(password, user.password_hash);

  if (!ok) {
    //Increment failed attempts
    let attempts = (user.failed_login_attempts || 0) + 1;
    
    if (attempts >= 5) {
      // 1. Lock the account and generate token
      const unlockToken = crypto.randomBytes(32).toString("hex");
      await db.execute(
        "UPDATE users SET failed_login_attempts = ?, is_locked = 1, unlock_token = ? WHERE id = ?", 
        [attempts, unlockToken, user.id]
      );

      //2. AUTOMATE THE EMAIL (Upgraded with HTML!)
      // Note: Change this URL to your Render URL later when you deploy!
      const unlockLink = `http://localhost:3000/api/unlock/${unlockToken}`;
      
      const mailOptions = {
        from: '"Security Team" <' + process.env.EMAIL_USER + '>', 
        to: user.email, 
        subject: "🚨 Security Alert: Account Locked",
        
        // The plain text fallback (for old email clients)
        text: `Hello ${user.username},\n\nWe detected 5 failed login attempts on your account. For your security, we have locked it.\n\nCopy and paste this link to unlock your account: ${unlockLink}`,
        
        // The HTML version with a clickable button!
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <h2 style="color: #dc2626;">Account Locked</h2>
            <p>Hello <strong>${user.username}</strong>,</p>
            <p>We detected 5 failed login attempts on your account. For your security, we have temporarily locked it.</p>
            <p>If this was a mistake, please click the button below to unlock your account immediately:</p>
            
            <a href="${unlockLink}" style="display: inline-block; padding: 12px 24px; margin: 15px 0; background-color: #3b82f6; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 6px;">
              Unlock My Account
            </a>
            
            <p style="font-size: 13px; color: #6b7280;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${unlockLink}">${unlockLink}</a>
            </p>
            <p>If you did not attempt to log in, someone is trying to guess your password.</p>
          </div>
        `
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log("Failed to send fake unlock email:", error);
        } else {
            console.log("✅ Fake email 'sent' to:", user.email);
            //THIS IS THE MAGIC LINE: It gives you a clickable link to view the fake email!
            console.log("👀 Preview your email here:", nodemailer.getTestMessageUrl(info));
        }
      });

      return res.status(403).json({ error: "Account locked. An unlock link has been automatically sent to your registered email address." });
    } else {
      // 4. Warn the user how many attempts are left
      await db.execute(
        "UPDATE users SET failed_login_attempts = ? WHERE id = ?", 
        [attempts, user.id]
      );
      return res.status(401).json({ error: `Invalid credentials. ${5 - attempts} attempts remaining.` });
    }
  }

  // 5. Success! Reset failed attempts back to 0
  if (user.failed_login_attempts > 0) {
     await db.execute("UPDATE users SET failed_login_attempts = 0 WHERE id = ?", [user.id]);
  }

  const token = jwt.sign(
    { id: user.id, username: user.username },
    "SECRET_KEY",
    { expiresIn: "1d" }
  );

  res.json({ token });
});
//------------User Login Route------------//








//------------Automated Email Click Route------------//
app.get("/api/unlock/:token", async (req, res) => {
  const token = req.params.token;
  
  // 1. Check if the token from the email exists in the database
  const [rows] = await db.execute("SELECT id FROM users WHERE unlock_token = ?", [token]);
  
  if (rows.length === 0) {
    return res.send("<h1 style='color:red; text-align:center; margin-top:50px;'>Invalid or Expired Link</h1>");
  }

  // 2. Unlock the account
  await db.execute(
    "UPDATE users SET is_locked = 0, failed_login_attempts = 0, unlock_token = NULL WHERE id = ?", 
    [rows[0].id]
  );

  // 3. Automatically redirect the user back to your site with a success message in the URL
  res.redirect("/?unlocked=true");
});
//------------Automated Email Click Route------------//





//------------Account Unlock Route------------//
app.post("/api/unlock", async (req, res) => {
  const { token } = req.body;
  
  if (!token) return res.status(400).json({ error: "Token required" });

  const [rows] = await db.execute("SELECT id FROM users WHERE unlock_token = ?", [token]);
  
  if (rows.length === 0) {
    return res.status(400).json({ error: "Invalid or expired unlock token" });
  }

  // Reset the account to normal
  await db.execute(
    "UPDATE users SET is_locked = 0, failed_login_attempts = 0, unlock_token = NULL WHERE id = ?", 
    [rows[0].id]
  );

  res.json({ success: true, message: "Account successfully unlocked. You may now log in." });
});
//------------Account Unlock Route------------//





















const upload = multer({ dest: "uploads/" });
const HASH_DB = path.join(__dirname, "hashes.json");

//function loadHashes() {
// if (!fs.existsSync(HASH_DB)) return {};
// return JSON.parse(fs.readFileSync(HASH_DB, "utf8"));
//}









function loadHashes() {
  if (!fs.existsSync(HASH_DB)) return {};

  const data = fs.readFileSync(HASH_DB, "utf8");

  if (!data) return {}; // ✅ handles empty file

  try {
    return JSON.parse(data);
  } catch (err) {
    console.error("Corrupted hashes.json, resetting...");
    return {}; // ✅ prevents crash
  }
}




function saveHashes(data) {
 fs.writeFileSync(HASH_DB, JSON.stringify(data, null, 2));
}


function sha256(buffer) {
  let data = buffer;

  // normalize text files (Windows fix)
  if (buffer.toString("utf8").indexOf("\uFFFD") === -1) {
    data = buffer
      .toString("utf8")
      .replace(/\r\n/g, "\n")
      .trim();
  }

  return crypto.createHash("sha256").update(data).digest("hex");
}



function isText(buffer) {
 return buffer.toString("utf8").indexOf("\uFFFD") === -1;
}

























//------------------------------------added now-------------------------------


function normalizeText(text) {
  return text
    //.toLowerCase()
    .replace(/\r\n/g, "\n")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getWordHashes(buffer) {
  const text = buffer.toString("utf8");
  const normalized = normalizeText(text);

  return normalized
    .split(" ")
    .filter(w => w.length > 0)
    .map(word => sha256(word));
}




























//app.post("/api/integrity/check", upload.single("file"), (req, res) => {
//  if (!req.file) return res.status(400).json({ error: "No file" });
//
//  const hashes = loadHashes();
//  const originalHash = hashes[req.file.originalname];
//
//  if (!originalHash) {
//    fs.unlinkSync(req.file.path);
//    return res.json({ status: "UNKNOWN_FILE" });
//  }
//
//  const buffer = fs.readFileSync(req.file.path);
//  const currentHash = sha256(buffer);
//
//  fs.unlinkSync(req.file.path);
//
//  res.json({
//    status: currentHash === originalHash ? "SAFE" : "TAMPERED",
//    originalHash,
//    currentHash
//  });
//});



app.post("/api/integrity/check", upload.single("file"), (req, res) => {
 //console.log("Auth header:", req.headers.authorization);
  if (!req.file) return res.status(400).json({ error: "No file" });

  const hashes = loadHashes();
  const record = hashes[req.file.originalname];

  if (!record) {
    fs.unlinkSync(req.file.path);
    return res.json({ status: "UNKNOWN_FILE" });
  }

  const buffer = fs.readFileSync(req.file.path);
  const currentHash = sha256(buffer);

  let changedWords = [];

  // Declare deletedSpaces out here in the global route scope!
  let deletedSpaces = [];

  if (isText(buffer) && record.wordHashes) {
    const currentWordHashes = getWordHashes(buffer);
    const originalWordHashes = record.wordHashes;






/*
    for (let i = 0; i < Math.max(originalWordHashes.length, currentWordHashes.length); i++) {
      if (originalWordHashes[i] !== currentWordHashes[i]) {
        changedWords.push(i);
      }
    }


const differences = Diff.diffArrays(originalWordHashes, currentWordHashes);
    let currentIndex = 0;

    differences.forEach((part) => {
      if (part.added) {
        // Words were added or altered. Mark them all red.
        for (let i = 0; i < part.count; i++) {
          changedWords.push(currentIndex);
          currentIndex++;
        }
      } else if (part.removed) {
        // A word was deleted! 
        // We grab the index of the word sitting right next to the gap to act as the "scar".
        let scarIndex = currentIndex < currentWordHashes.length ? currentIndex : currentWordHashes.length - 1;
        
        // Push it to the changedWords array so it glows red on the frontend!
        if (scarIndex >= 0 && !changedWords.includes(scarIndex)) {
          changedWords.push(scarIndex);
        }
      } else {
        // These words are safe and untouched. Move past them.
        currentIndex += part.count;
      }
    });
  }

  fs.unlinkSync(req.file.path);

  res.json({
    status: currentHash === record.fileHash ? "SAFE" : "TAMPERED",
    originalHash: record.fileHash,
    currentHash,
    changedWords
  });

  
});
*/



const differences = Diff.diffArrays(originalWordHashes, currentWordHashes);
    let currentIndex = 0;

    differences.forEach((part) => {
      if (part.added) {
        // Words were added or altered.
        for (let i = 0; i < part.count; i++) {
          changedWords.push(currentIndex);
          currentIndex++;
        }
      } else if (part.removed) {
        // A word was deleted! Mark the exact space index.
        let spaceIndex = currentIndex <= currentWordHashes.length ? currentIndex : currentWordHashes.length;
        if (!deletedSpaces.includes(spaceIndex)) {
          deletedSpaces.push(spaceIndex);
        }
      } else {
        // Words are safe and untouched.
        currentIndex += part.count;
      }
    });
  }

  fs.unlinkSync(req.file.path);

  // Ensure deletedSpaces is sent back to the frontend!
  res.json({
    status: currentHash === record.fileHash ? "SAFE" : "TAMPERED",
    originalHash: record.fileHash,
    currentHash,
    changedWords,
    deletedSpaces 
  });
});

//------------File integrity check route------------//








































const archiver = require("archiver");

const SECURE_META = path.join(__dirname, "secure_meta.json");

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
}

app.post("/api/secure/encrypt", upload.single("file"), (req, res) => {
  console.log(" ENCRYPT ROUTE HIT NEW CODE");
  try {
    const password = req.body.password;
    if (!req.file || !password) {
      return res.status(400).json({ error: "Missing file or password" });
    }

    const fileBuffer = fs.readFileSync(req.file.path);

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16);
    const key = deriveKey(password, salt);

    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(fileBuffer),
      cipher.final()
    ]);










    // Split encrypted data
    const mid = Math.floor(encrypted.length / 2);
    const part1 = encrypted.slice(0, mid);
    const part2 = encrypted.slice(mid);
      








    // Save metadata
    const meta = fs.existsSync(SECURE_META)
      ? JSON.parse(fs.readFileSync(SECURE_META))
      : {};

    const id = crypto.randomUUID();
    meta[id] = {
      salt: salt.toString("hex"),
      iv: iv.toString("hex"),
      originalName: req.file.originalname
    };

    fs.writeFileSync(SECURE_META, JSON.stringify(meta, null, 2));

    fs.unlinkSync(req.file.path);

    // Send ZIP
    res.setHeader("Content-Type", "application/zip");
    //res.setHeader("Content-Disposition", "attachment; filename=secure_files.zip");

    res.setHeader("Content-Disposition", `attachment; filename=secure_${Date.now()}.zip`);




    const archive = archiver("zip");
    archive.pipe(res);

    archive.on("error", err => {
  console.error("Archive error:", err);
  res.status(500).end();
});


    //archive.append(part1, { name: "encrypted.data" });
    //archive.append(part2, { name: "encrypted.key" });
    //archive.append(Buffer.from(id), { name: "id.txt" });
     

    archive.append(part1, { name: `${id}.data` });
    archive.append(part2, { name: `${id}.key` });
    archive.append(Buffer.from(id), { name: `${id}.id` });


    archive.finalize();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Encryption failed" });
  }
});







app.post(
  "/api/secure/decrypt",
  upload.fields([
  { name: "dataFile", maxCount: 1 },
  { name: "keyFile", maxCount: 1 },
  { name: "idFile", maxCount: 1 }
]),
  (req, res) => {
    try {
      const password = req.body.password;
      const dataFile = req.files.dataFile?.[0];
      const keyFile = req.files.keyFile?.[0];

      if (!password || !dataFile || !keyFile || !req.files.idFile?.[0]) {
  return res.status(400).json({ error: "Missing inputs" });
}







      
     





      const idFile = req.files.idFile?.[0];
if (!idFile) {
  return res.status(400).json({ error: "Missing ID file" });
}

const id = fs.readFileSync(idFile.path, "utf8").trim();

const meta = JSON.parse(fs.readFileSync(SECURE_META));

if (!meta[id]) {
  return res.status(400).json({ error: "Invalid ID" });
}

const info = meta[id];


 const salt = Buffer.from(info.salt, "hex");
      const iv = Buffer.from(info.iv, "hex");

      const encrypted = Buffer.concat([
        fs.readFileSync(dataFile.path),
        fs.readFileSync(keyFile.path)
      ]);



     



      const key = deriveKey(password, salt);

      const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      //fs.unlinkSync(dataFile.path);
      //fs.unlinkSync(keyFile.path);
      //fs.unlinkSync(idFile.path);

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${info.originalName}`
      );
      res.send(decrypted);

    } catch (err) {
      console.error(err);
      res.status(400).json({ error: "Decryption failed (wrong password or files)" });
    }
  }
);





















//app.post("/api/integrity/store", upload.single("file"), (req, res) => {
//  if (!req.file) return res.status(400).json({ error: "No file" });
//
//  const buffer = fs.readFileSync(req.file.path);
//  const hash = sha256(buffer);
//
//  const hashes = loadHashes();
//  hashes[req.file.originalname] = hash;
//  saveHashes(hashes);
//
//  fs.unlinkSync(req.file.path);
//
//  res.json({ success: true });
//});








app.post("/api/integrity/store", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });

  const buffer = fs.readFileSync(req.file.path);
  const fileHash = sha256(buffer);

  const hashes = loadHashes();

  // ✅ NEW: word hashes (only if text file)
  let wordHashes = [];
  if (isText(buffer)) {
    wordHashes = getWordHashes(buffer);
  }

  // ✅ STORE OBJECT instead of just hash
  hashes[req.file.originalname] = {
    fileHash,
    wordHashes
  };

  saveHashes(hashes);
  fs.unlinkSync(req.file.path);

  res.json({ success: true });
});











// Start server

app.listen(3000, () => {
  console.log("Backend running on http://localhost:3000");
});
//------------Server started on port 3000------------//
