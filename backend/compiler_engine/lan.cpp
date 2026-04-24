#include <thread>
#include <chrono>
#include <array>
#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <stack>
#include <bitset>
#include <sstream>
#include <iomanip>
#include <cctype>
#include <stdexcept>
#include <utility>
#include <cstdint>
using namespace std;





// --- HELPER FUNCTION FOR JSON ---
string escapeJSON(const string& s) {
    string result;
    for (char c : s) {
        if (c == '"') result += "\\\"";
        else if (c == '\\') result += "\\\\";
        else if (c == '\n') result += "\\n";
        else if (c == '\r') result += "\\r";
        else if (c == '\t') result += "\\t";
        else result += c;
    }
    return result;
}


using uint8 = uint8_t;
using uint32 = uint32_t;
using uint64 = uint64_t;

static const uint32 k[64] = {
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,
    0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,
    0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,
    0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,
    0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,
    0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,
    0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,
    0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,
    0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
};

#define ROTRIGHT(a,b) (((a) >> (b)) | ((a) << (32-(b))))
#define CH(x,y,z) (((x)&(y)) ^ (~(x)&(z)))
#define MAJ(x,y,z) (((x)&(y)) ^ ((x)&(z)) ^ ((y)&(z)))
#define EP0(x) (ROTRIGHT(x,2) ^ ROTRIGHT(x,13) ^ ROTRIGHT(x,22))
#define EP1(x) (ROTRIGHT(x,6) ^ ROTRIGHT(x,11) ^ ROTRIGHT(x,25))
#define SIG0(x) (ROTRIGHT(x,7) ^ ROTRIGHT(x,18) ^ ((x)>>3))
#define SIG1(x) (ROTRIGHT(x,17) ^ ROTRIGHT(x,19) ^ ((x)>>10))

string sha256(const string& input) {
    uint64 bitlen = input.size() * 8;
    vector<uint8> data(input.begin(), input.end());
    data.push_back(0x80);
    while ((data.size() % 64) != 56) data.push_back(0);
    for (int i = 7; i >= 0; i--) data.push_back((bitlen >> (i * 8)) & 0xff);

    uint32 h[8] = {
        0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
        0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
    };

    for (size_t i = 0; i < data.size(); i += 64) {
        uint32 w[64];
        for (int j = 0; j < 16; j++)
            w[j] = (data[i+4*j]<<24)|(data[i+4*j+1]<<16)|(data[i+4*j+2]<<8)|(data[i+4*j+3]);
        for (int j = 16; j < 64; j++)
            w[j] = SIG1(w[j-2]) + w[j-7] + SIG0(w[j-15]) + w[j-16];

        uint32 a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
        for (int j = 0; j < 64; j++) {
            uint32 t1 = hh + EP1(e) + CH(e,f,g) + k[j] + w[j];
            uint32 t2 = EP0(a) + MAJ(a,b,c);
            hh=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2;
        }
        h[0]+=a; h[1]+=b; h[2]+=c; h[3]+=d;
        h[4]+=e; h[5]+=f; h[6]+=g; h[7]+=hh;
    }

    stringstream ss;
    for (int i = 0; i < 8; i++)
        ss << hex << setw(8) << setfill('0') << h[i];
    return ss.str();
}


bool cipherDeclared = false;
bool isROT13 = false;
bool isAtbash = false;
bool isBinary = false;
bool isMorse = false;
bool isBase64 = false;
bool isVigenere = false;
string vigenereKey = "";
bool isAffine = false;
int affineA = 0;
int affineB = 0;
bool isSHA256 = false;
bool hasReturn = false;
int returnValue = 0;
unordered_map<string, string> varTable;
unordered_map<string, int> funcTable;
unordered_map<string, string> funcReturnType;
string lexicalOutput = "";







// ============================================================================
// INTERMEDIATE REPRESENTATION (IR) STRUCTURES
// ============================================================================

/* * struct IR represents a single "Three-Address Code" (TAC) instruction.
 * TAC is a standard compiler format where every operation has at most two 
 * operands (arg1, arg2) and one destination (result).
 * Example: "t3 = t1 + t2" becomes {op: "+", arg1: "t1", arg2: "t2", result: "t3"}
 */
struct IR {
    string op;     // The operation to perform (e.g., "+", "LOAD_NUM", "IF_FALSE_GOTO")
    string arg1;   // The first operand (can be a variable name, temporary, or number)
    string arg2;   // The second operand (often empty for unary operations)
    string result; // Where the output of this operation is stored
};

// Global vector that acts as the sequential list of instructions for your program.
vector<IR> irCode;

// Global counter to track how many temporary variables have been generated.
int tempCount = 0;

/*
 * newTemp() generates a strictly unique temporary variable name.
 * Every time your compiler evaluates a piece of an expression (like 5 * 10), 
 * it needs a safe, invisible place in memory to store that intermediate step.
 * Returns: "t1", "t2", "t3", etc.
 */
string newTemp() {
    return "t" + to_string(++tempCount);
}

// ============================================================================
// COMPILER OPTIMIZATION PASS 1: CONSTANT FOLDING & PROPAGATION
// ============================================================================

/*
 * optimizeIR() scans through the generated instructions and attempts to do 
 * math at "compile-time" rather than "run-time" to save the Virtual Machine work.
 */
void optimizeIR() {
    // Maps a temporary variable to its known numeric literal value.
    // Example: if t1 = 5, constMap["t1"] = "5"
    unordered_map<string, string> constMap;

    for (auto &i : irCode) {

        // Phase 1: Tracking
        // If an instruction directly loads a number into a result, remember it!
        if (i.op == "LOAD_NUM") {
            constMap[i.result] = i.arg1;
        }

        // Phase 2: Constant Propagation
        // If an argument is a temporary we already know the exact value of, 
        // overwrite the temporary name with the actual raw number.
        if (constMap.count(i.arg1))
            i.arg1 = constMap[i.arg1];

        if (constMap.count(i.arg2))
            i.arg2 = constMap[i.arg2];

        // Phase 3: Constant Folding
        // Now check if both arguments for an arithmetic operation are raw numbers.
        if (i.op == "+" || i.op == "-" || i.op == "*" || i.op == "/") {

            // isdigit() ensures we don't try to fold variables like "counter" or "t5"
            if (isdigit(i.arg1[0]) && isdigit(i.arg2[0])) {

                // Convert string arguments to actual integers to perform the math
                int a = stoi(i.arg1);
                int b = stoi(i.arg2);
                int res = 0;

                // Execute the math operation inside the compiler itself
                if (i.op == "+") res = a + b;
                else if (i.op == "-") res = a - b;
                else if (i.op == "*") res = a * b;
                else if (i.op == "/") res = a / b;

                // Mutate the instruction! Change it from an arithmetic operation 
                // into a simple number load, bypassing the math entirely at runtime.
                i.op = "LOAD_NUM";
                i.arg1 = to_string(res);
                i.arg2 = "";

                // Propagate this newly calculated result forward so future 
                // instructions can fold it too!
                constMap[i.result] = i.arg1; 
            }
        }
    }
}

// ============================================================================
// COMPILER OPTIMIZATION PASS 2: DEAD CODE ELIMINATION
// ============================================================================

/*
 * deadCodeElimination() cleans up the mess left behind by Constant Folding.
 * When Constant Folding turns `t3 = t1 + t2` into `t3 = 15`, `t1` and `t2` 
 * might never be used again. This function deletes them to save memory.
 */
void deadCodeElimination() {
    // A mathematical set to store the exact names of every temporary variable 
    // that is *actually needed* by an instruction.
    unordered_set<string> used;

    // Step 1: The "Mark" Phase
    // Scan all instructions. If a temporary variable is used as an input (arg1/arg2),
    // mark it as "alive" by tossing it into the set.
    for (auto &i : irCode) {
        if (i.arg1 != "" && i.arg1[0] == 't')
            used.insert(i.arg1);
        if (i.arg2 != "" && i.arg2[0] == 't')
            used.insert(i.arg2);
    }

    // A fresh vector to hold only the surviving instructions.
    vector<IR> newIR;

    // Step 2: The "Sweep" Phase
    for (auto &i : irCode) {

        // Rule 1: Always preserve instructions that alter state, control flow, 
        // or communicate with memory/IO. We cannot safely delete these.
        if (i.op == "PRINT" || i.op == "STORE" ||
            i.op == "CALL" || i.op == "RET" ||
            i.op == "LABEL" || i.op == "GOTO") {
            newIR.push_back(i);
            continue;
        }

        // Rule 2: If the instruction outputs to a temporary variable (result begins with 't')
        // AND that temporary variable is NOT in our "used" set, we completely ignore it.
        // It is "dead code" and will not be pushed to the newIR vector.
        if (i.result != "" && i.result[0] == 't' &&
            used.find(i.result) == used.end()) {
            continue; // The instruction is dropped into the void here.
        }

        // If the instruction passed the checks, it survives the sweep.
        newIR.push_back(i);
    }

    // Overwrite the original instruction list with our newly scrubbed list.
    irCode = newIR;
}












/* ============================================================================
 * THE TOKENIZER (LEXICAL ANALYZER)
 * ============================================================================
 * The Lexer is the very first stage of the compiler. It takes a raw string of 
 * human-readable source code and chops it up into meaningful "Tokens". 
 * It doesn't care about grammar or logic; it just categorizes words and symbols.
 */

// TokType defines the entire "Vocabulary" of your programming language.
// If a word or symbol isn't in this list, your language doesn't understand it!
enum TokType {
    // Keywords
    TOK_CIPHER, TOK_ENCRYPT, TOK_DECRYPT, TOK_PRINT, TOK_LET, TOK_FUNC, TOK_RETURN,
    TOK_IF, TOK_ELSE, TOK_WHILE, TOK_BREAK, TOK_CONTINUE,
    
    // Identifiers (Variable/Function names) and Literals (Numbers/Strings)
    TOK_IDENT, TOK_NUMBER, TOK_STRING,
    
    // Cryptography Built-ins
    TOK_ROT13, TOK_ATBASH, TOK_BINARY, TOK_MORSE, TOK_BASE64, 
    TOK_VIGENERE, TOK_AFFINE, TOK_SHA256,
    
    // Operators and Syntax
    TOK_EQUAL, TOK_SEMI, TOK_PLUS, TOK_MINUS, TOK_MUL, TOK_DIV, 
    TOK_AND, TOK_OR, TOK_COMMA, TOK_LPAREN, TOK_RPAREN, TOK_LBRACE, TOK_RBRACE,
    TOK_GT, TOK_LT, TOK_EQEQ, TOK_NEQ, TOK_LTE, TOK_GTE,
    
    // End of File marker
    TOK_EOF 
};

// A Token is a packaged piece of data containing its Category (type) 
// and its exact text (value). Example: {TOK_NUMBER, "42"}
struct Token {
    TokType type;
    string value;
};

class Lexer {
    string src;    // The raw source code string
    size_t pos = 0; // The current reading position (cursor)

public:
    Lexer(const string& s) : src(s) {}

    // Checks if the cursor has reached the end of the source code.
    bool eof() { return pos >= src.size(); }

    // peek() looks at the current character WITHOUT moving the cursor forward.
    char peek() { return eof() ? '\0' : src[pos]; }
    
    // get() looks at the current character AND moves the cursor forward by 1.
    char get() { return eof() ? '\0' : src[pos++]; }

    // Skips over spaces, tabs, and newlines. The compiler doesn't care about formatting!
    void skipWhitespace() {
        while (isspace(peek())) get();
    }

    /*
     * next() is the core engine of the Lexer. Every time the Parser calls next(),
     * this function scans forward to build and return exactly ONE token.
     */
    Token next() {
        skipWhitespace();
        char c = peek();

        if (c == '\0') return {TOK_EOF, ""};
        
        // --- SINGLE CHARACTER TOKENS ---
        if (c == '+') { get(); return {TOK_PLUS, "+"}; }
        if (c == '-') { get(); return {TOK_MINUS, "-"}; }
        if (c == '*') { get(); return {TOK_MUL, "*"}; }
        if (c == '/') { get(); return {TOK_DIV, "/"}; }
        if (c == '{') { get(); return {TOK_LBRACE, "{"}; }
        if (c == '}') { get(); return {TOK_RBRACE, "}"}; }
        if (c == '(') { get(); return {TOK_LPAREN, "("}; }
        if (c == ')') { get(); return {TOK_RPAREN, ")"}; }
        if (c == ',') { get(); return {TOK_COMMA, ","}; }
        if (c == ';') { get(); return {TOK_SEMI, ";"}; }

        // --- MULTI-CHARACTER OPERATORS (Lookahead) ---
        // Here we use peek() to check if a '=' is actually a '=='
        if (c == '=') {
            get();
            if (peek() == '=') { get(); return {TOK_EQEQ, "=="}; }
            return {TOK_EQUAL, "="};
        }
        if (c == '!') {
            get();
            if (peek() == '=') { get(); return {TOK_NEQ, "!="}; }
            throw runtime_error("Unexpected '!'");
        }
        if (c == '<') {
            get();
            if (peek() == '=') { get(); return {TOK_LTE, "<="}; }
            return {TOK_LT, "<"};
        }
        if (c == '>') {
            get();
            if (peek() == '=') { get(); return {TOK_GTE, ">="}; }
            return {TOK_GT, ">"};
        }
        if (c == '&') {
            get();
            if (peek() == '&') { get(); return {TOK_AND, "&&"}; }
            throw runtime_error("Unexpected '&'");
        }
        if (c == '|') {
            get();
            if (peek() == '|') { get(); return {TOK_OR, "||"}; }
            throw runtime_error("Unexpected '|'");
        }

        // --- IDENTIFIERS & KEYWORDS ---
        // If it starts with a letter or underscore, it's a word!
        if (isalpha(c) || c == '_') {
            string word;
            // Keep consuming characters as long as they are alphanumeric or underscores.
            while (isalnum(peek()) || peek() == '_') word += get();
            
            // Check if this word is a reserved keyword in our language.
            if (word == "cipher") return {TOK_CIPHER, word};
            if (word == "encrypt") return {TOK_ENCRYPT, word};
            if (word == "decrypt") return {TOK_DECRYPT, word};
            if (word == "print")   return {TOK_PRINT, word};
            if (word == "let") return {TOK_LET, word};
            if (word == "if") return {TOK_IF, word};
            if (word == "else") return {TOK_ELSE, word};
            if (word == "while") return {TOK_WHILE, word};
            if (word == "break") return {TOK_BREAK, word};
            if (word == "continue") return {TOK_CONTINUE, word};
            if (word == "func") return {TOK_FUNC, word};
            if (word == "return") return {TOK_RETURN, word};
            
            // Built-in Crypto Functions
            if (word == "rot13") return {TOK_ROT13, word};
            if (word == "atbash") return {TOK_ATBASH, word};
            if (word == "binary") return {TOK_BINARY, word};
            if (word == "morse") return {TOK_MORSE, word};
            if (word == "base64") return {TOK_BASE64, word};
            if (word == "vigenere") return {TOK_VIGENERE, word};
            if (word == "affine") return {TOK_AFFINE, word};
            if (word == "sha256") return {TOK_SHA256, word};
            if (word == "key") return {TOK_IDENT, word}; // "key" is treated as a normal variable name
            
            // If it's not a keyword, it must be a user-defined variable or function name.
            return {TOK_IDENT, word};
        }

        // --- NUMBERS ---
        if (isdigit(c)) {
            string num;
            while (isdigit(peek())) num += get();
            return {TOK_NUMBER, num};
        }

        // --- STRINGS ---
        if (c == '"') {
            get(); // Consume the opening quote
            string s;
            while (peek() != '"' && !eof()) s += get();
            get(); // Consume the closing quote
            return {TOK_STRING, s};
        }

        // If we reach this point, the character doesn't belong to our language.
        throw runtime_error(string("Unexpected character: ") + c);
    }
};










/* ============================================================================
 * THE CRYPTOGRAPHY ENGINE
 * ============================================================================
 * This is the standard library of your language. These functions execute the 
 * actual mathematical transformations when your VM hits an ENCRYPT or DECRYPT op.
 */

/*
 * CAESAR CIPHER: The oldest substitution cipher. 
 * It shifts every letter forward in the alphabet by a set number.
 * If it goes past 'Z', the modulo operator (% 26) wraps it back around to 'A'.
 */
string caesarEncrypt(string s, int shift) {
    for (char& c : s) {
        if (isalpha(c)) {
            // Find if we are working with uppercase 'A' (65) or lowercase 'a' (97) in ASCII
            char base = isupper(c) ? 'A' : 'a';
            // Normalize to 0-25, add the shift, wrap around, and push back to ASCII
            c = (c - base + shift) % 26 + base;
        }
    }
    return s;
}

/*
 * ATBASH CIPHER: A reflection cipher originally used for the Hebrew alphabet.
 * 'A' becomes 'Z', 'B' becomes 'Y', 'C' becomes 'X', etc.
 */
string atbashEncrypt(string s) {
    for (char &c : s) {
        if (isalpha(c)) {
            char base = isupper(c) ? 'A' : 'a';
            // Subtracting the letter's position from 25 flips it to the opposite end.
            c = base + (25 - (c - base));
        }
    }
    return s; // Note: Atbash decryption is identical to encryption!
}

/*
 * BINARY ENCODING: Converts text into 8-bit machine code.
 */
string binaryEncrypt(string s) {
    string out = "";
    for (char c : s) {
        // bitset<8> automatically converts an ASCII char into an 8-bit binary string
        bitset<8> b(c);
        out += b.to_string() + " "; // Space delimited for readability
    }
    return out;
}

string binaryDecrypt(string s) {
    string out = "";
    string temp = "";

    for (char c : s) {
        if (c == ' ') {
            if (!temp.empty()) {
                // stoi(..., 2) parses the string "01000001" as a Base-2 number (65 -> 'A')
                char ch = static_cast<char>(stoi(temp, nullptr, 2));
                out += ch;
                temp = "";
            }
        } else {
            temp += c;
        }
    }
    // Catch the final byte if the string didn't end with a space
    if (!temp.empty()) {
        char ch = static_cast<char>(stoi(temp, nullptr, 2));
        out += ch;
    }
    return out;
}

/*
 * MORSE CODE: A simple dictionary lookup algorithm.
 */
unordered_map<char, string> morseMap = {
    {'A', ".-"},   {'B', "-..."}, {'C', "-.-."}, {'D', "-.."},
    {'E', "."},    {'F', "..-."}, {'G', "--."},  {'H', "...."},
    {'I', ".."},   {'J', ".---"}, {'K', "-.-"},  {'L', ".-.."},
    {'M', "--"},   {'N', "-."},   {'O', "---"},  {'P', ".--."},
    {'Q', "--.-"}, {'R', ".-."},  {'S', "..."},  {'T', "-"},
    {'U', "..-"},  {'V', "...-"}, {'W', ".--"},  {'X', "-..-"},
    {'Y', "-.--"}, {'Z', "--.."},
    {' ', "/"}
};
unordered_map<string, char> revMorseMap;

string morseEncrypt(string s) {
    string out;
    for (char c : s) {
        c = toupper(c); // Morse code doesn't care about case
        if (morseMap.count(c)) out += morseMap[c] + " ";
    }
    return out;
}

string morseDecrypt(string s) {
    // Lazily populate the reverse dictionary only the first time someone decrypts
    if (revMorseMap.empty())
        for (auto &p : morseMap) revMorseMap[p.second] = p.first;

    string out, temp;
    for (char c : s) {
        if (c == ' ') {
            if (!temp.empty()) {
                if (revMorseMap.count(temp)) out += revMorseMap[temp];
                temp.clear();
            }
        } else temp += c;
    }
    if (!temp.empty()) if (revMorseMap.count(temp)) out += revMorseMap[temp];
    return out;
}

/*
 * BASE64 ENCODING: Used to transmit binary data over text-based protocols (like email/HTTP).
 * It takes 3 bytes of standard text (24 bits total), chops them into 4 chunks of 6 bits, 
 * and maps those 6-bit chunks to a custom 64-character alphabet.
 */
static const string b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

string base64Encrypt(const string &in) {
    string out;
    int val = 0, valb = -6; // val holds the bits, valb tracks how many bits we have
    for (unsigned char c : in) {
        val = (val << 8) + c; // Shift left by 8 and absorb the new character
        valb += 8;            // We just gained 8 bits
        while (valb >= 0) {
            // Extract the top 6 bits and look them up in the b64 dictionary
            out.push_back(b64[(val >> valb) & 0x3F]);
            valb -= 6;
        }
    }
    if (valb > -6) // Handle leftover bits
        out.push_back(b64[((val << 8) >> (valb + 8)) & 0x3F]);
    while (out.size() % 4) // Base64 length must be a multiple of 4, pad with '='
        out.push_back('=');
    return out;
}

string base64Decrypt(const string &in) {
    vector<int> T(256, -1);
    for (int i = 0; i < 64; i++) T[b64[i]] = i; // Build reverse lookup table

    string out;
    int val = 0, valb = -8;
    for (unsigned char c : in) {
        if (T[c] == -1) break; // Stop if we hit padding '='
        val = (val << 6) + T[c]; // Absorb 6 bits
        valb += 6;
        if (valb >= 0) {
            // Once we have 8 bits, output the standard ASCII character
            out.push_back(char((val >> valb) & 0xFF));
            valb -= 8;
        }
    }
    return out;
}

/*
 * VIGENÈRE CIPHER: A Polyalphabetic cipher. It's like the Caesar cipher, but 
 * the shift amount changes for every letter based on a keyword.
 */
string vigenereEncrypt(string text, string key) {
    string out;
    int k = 0; // Tracks our position in the keyword

    for (char c : text) {
        if (isalpha(c)) {
            char base = isupper(c) ? 'A' : 'a';
            // Calculate the shift amount using the current letter of the keyword
            int shift = toupper(key[k % key.size()]) - 'A';
            out += char((c - base + shift) % 26 + base);
            k++; // Only advance the keyword if we actually encrypted a letter
        } else {
            out += c; // Ignore spaces and punctuation
        }
    }
    return out;
}

// Decryption simply subtracts the shift instead of adding it.
string vigenereDecrypt(string text, string key) {
    string out;
    int k = 0;
    for (char c : text) {
        if (isalpha(c)) {
            char base = isupper(c) ? 'A' : 'a';
            int shift = toupper(key[k % key.size()]) - 'A';
            // Add 26 before modulo to prevent negative numbers in C++
            out += char((c - base - shift + 26) % 26 + base);
            k++;
        } else {
            out += c;
        }
    }
    return out;
}

/*
 * AFFINE CIPHER: A mathematical cipher combining multiplication and addition.
 * Formula: E(x) = (ax + b) mod 26.
 * Note: 'a' MUST be coprime to 26 (e.g., 1, 3, 5, 7, 9, 11...), otherwise 
 * multiple letters will encrypt to the same character, breaking decryption!
 */
int modInverse(int a) {
    a = a % 26;
    for (int x = 1; x < 26; x++)
        // Finds a number 'x' where multiplying by 'a' wraps around exactly to 1
        if ((a * x) % 26 == 1) return x;
    return -1; // Fails if 'a' is not coprime to 26
}

string affineEncrypt(string s, int a, int b) {
    for (char &c : s) {
        if (isalpha(c)) {
            char base = isupper(c) ? 'A' : 'a';
            int x = c - base; 
            // C++ Safe Modulo applied directly to the math
            c = base + (((a * x + b) % 26) + 26) % 26; 
        }
    }
    return s;
}

string affineDecrypt(string s, int a, int b) {
    int aInv = modInverse(a); 
    for (char &c : s) {
        if (isalpha(c)) {
            char base = isupper(c) ? 'A' : 'a';
            int x = c - base;
            // C++ Safe Modulo to handle negative shifts properly
            c = base + ((aInv * (((x - b) % 26) + 26)) % 26);
        }
    }
    return s;
}

// ============================================================================
// PARSE TREE NODE (AST)
// ============================================================================

/*
 * PTNode (Parse Tree Node) represents a single block of logic in your tree.
 * Instead of strictly "Left" and "Right" pointers (like a simple binary tree), 
 * you used a vector of children. This is incredibly smart because some structures 
 * (like a function call with 5 parameters) need more than two branches!
 */
struct PTNode {
    string label;              // What is this node? (e.g., "+", "LetStmt", "Number")
    vector<PTNode*> children;  // The sub-components that make up this node

    PTNode(string l) : label(l) {}
};

/*
 * IParser is an "Interface". It acts as a blueprint. 
 * By forcing all your parsers to inherit from this, your main program doesn't 
 * have to care if it's using the LL(1) Parser or the Recursive Descent parser. 
 * It just calls parse() and trusts that a tree will come out!
 */
class IParser {
public:
    virtual PTNode* parse(vector<Token>& tokens) = 0;
    virtual ~IParser() {}
};

// ============================================================================
// SYMBOL TABLE (SEMANTIC ANALYSIS & SCOPE)
// ============================================================================

/*
 * Symbol represents a registered identifier in memory.
 */
struct Symbol {
    string name;   // The variable or function name (e.g., "counter", "calculateHash")
    string type;   // The category (e.g., "var", "func")
};

/*
 * SymbolTable tracks variable declarations and Scope (like inside a while loop).
 * It uses a vector of hash maps. Each map in the vector represents one "layer" of scope.
 */
class SymbolTable {
    vector<unordered_map<string, Symbol>> scopes;

public:
    SymbolTable() {
        enterScope(); // Initialize the "Global" scope automatically
    }

    // Pushes a fresh, empty hash map onto the stack. Call this when you hit a '{'
    void enterScope() {
        scopes.push_back({});
    }

    // Destroys the top hash map. Call this when you hit a '}'. 
    // All variables declared inside that block instantly vanish from memory!
    void exitScope() {
        scopes.pop_back();
    }

    // Registers a new variable in the CURRENT (top-most) scope.
    void declare(string name, string type) {
        // Prevent writing "let x = 1; let x = 2;" in the exact same scope
        if (scopes.back().count(name))
            throw runtime_error("Semantic Error: Redeclaration of " + name);

        scopes.back()[name] = {name, type};
    }

    // Searches for a variable starting from the innermost scope and working outward.
    bool exists(string name) {
        for (int i = scopes.size() - 1; i >= 0; i--) {
            if (scopes[i].count(name)) return true; // Found it!
        }
        return false; // The variable was never declared
    }
};

// ============================================================================
// LL(1) RECURSIVE DESCENT PARSER
// ============================================================================

enum GrammarType {
    ARITHMETIC,
    BOOLEAN
};

class LL1Parser : public IParser {
    vector<Token>* tokens;
    int pos;

    // Helper to look at the current token without moving forward
    Token& cur() { return (*tokens)[pos]; }

    // Helper to consume a token. If the token isn't what we expect, the code is invalid!
    void eat(TokType t) {
        if (cur().type == t) pos++;
        else throw runtime_error("Unexpected token: " + cur().value);
    }

public:
    LL1Parser(vector<Token>& t) {
        tokens = &t;
        pos = 0;
    }

    /* ================= ARITHMETIC GRAMMAR ================= 
     * Enforces mathematical precedence: Parentheses -> Multiplication -> Addition
     */

    // E -> T E'
    PTNode* parseE() {
        PTNode* left = parseT(); // Always try to parse multiplication/division first
        return parseEPrime(left); // Then handle trailing addition/subtraction
    }

    // E' -> + T E' | - T E' | epsilon
    // 'inherited' is the Left-Hand Side of the math equation!
    PTNode* parseEPrime(PTNode* inherited) {
        if (cur().type == TOK_PLUS || cur().type == TOK_MINUS) {
            string op = cur().value;
            eat(cur().type); // Consume the '+' or '-'

            PTNode* right = parseT(); // Parse the Right-Hand Side

            // Build a tree node where the operator is the root, and the numbers are leaves
            PTNode* node = new PTNode(op);
            node->children.push_back(inherited); 
            node->children.push_back(right);

            // Pass this new mini-tree forward in case there is MORE addition chaining!
            return parseEPrime(node); 
        }
        return inherited; // If there's no addition, just return the left side unmodified
    }

    // T -> F T'
    PTNode* parseT() {
        PTNode* left = parseF(); // Always try to parse numbers/parentheses first
        return parseTPrime(left); // Then handle trailing multiplication
    }

    // T' -> * F T' | / F T' | epsilon
    PTNode* parseTPrime(PTNode* inherited) {
        if (cur().type == TOK_MUL || cur().type == TOK_DIV) {
            string op = cur().value;
            eat(cur().type);

            PTNode* right = parseF();

            PTNode* node = new PTNode(op);
            node->children.push_back(inherited);
            node->children.push_back(right);

            return parseTPrime(node);
        }
        return inherited;
    }

    // F -> ( E ) | number | identifier
    PTNode* parseF() {
        // If we see a parenthesis, we loop ALL the way back to the top of the math logic!
        if (cur().type == TOK_LPAREN) {
            eat(TOK_LPAREN);
            PTNode* node = parseE(); 
            eat(TOK_RPAREN);
            return node;
        }

        // Base case: It's just a raw number
        if (cur().type == TOK_NUMBER) {
            PTNode* node = new PTNode("Number");
            node->children.push_back(new PTNode(cur().value));
            eat(TOK_NUMBER);
            return node;
        }

        // Base case: It's a variable
        if (cur().type == TOK_IDENT) {
            PTNode* node = new PTNode("Var");
            node->children.push_back(new PTNode(cur().value));
            eat(TOK_IDENT);
            return node;
        }

        throw runtime_error("Invalid factor");
    }

    /* ================= BOOLEAN GRAMMAR ================= 
     * Follows the exact same logic structure, but prioritizes logical operators:
     * Parentheses -> Relational (>, <, ==) -> AND (&&) -> OR (||)
     */

    PTNode* parseB() {
        PTNode* left = parseC();
        return parseBPrime(left);
    }

    PTNode* parseBPrime(PTNode* inherited) {
        if (cur().type == TOK_OR) {
            eat(TOK_OR);
            PTNode* right = parseC();
            PTNode* node = new PTNode("||");
            node->children.push_back(inherited);
            node->children.push_back(right);
            return parseBPrime(node);
        }
        return inherited;
    }

    PTNode* parseC() {
        PTNode* left = parseD();
        return parseCPrime(left);
    }

    PTNode* parseCPrime(PTNode* inherited) {
        if (cur().type == TOK_AND) {
            eat(TOK_AND);
            PTNode* right = parseD();
            PTNode* node = new PTNode("&&");
            node->children.push_back(inherited);
            node->children.push_back(right);
            return parseCPrime(node);
        }
        return inherited;
    }

    PTNode* parseD() {
        if (cur().type == TOK_LPAREN) {
            eat(TOK_LPAREN);
            PTNode* node = parseB();
            eat(TOK_RPAREN);
            return node;
        }

        // Relational operators link back to the Arithmetic parser!
        PTNode* left = parseE();

        if (cur().type == TOK_GT || cur().type == TOK_LT ||
            cur().type == TOK_EQEQ || cur().type == TOK_NEQ ||
            cur().type == TOK_GTE || cur().type == TOK_LTE) {

            string op = cur().value;
            eat(cur().type);
            PTNode* right = parseE();

            PTNode* node = new PTNode(op);
            node->children.push_back(left);
            node->children.push_back(right);
            return node;
        }

        return left;
    }

    /* ================= ENTRY ================= */

    PTNode* parse(GrammarType type) {
        PTNode* root;
        if (type == ARITHMETIC) root = parseE();
        else root = parseB();

        // If the parser finished but there are still tokens left over, the syntax is garbage
        if (cur().type != TOK_EOF) throw runtime_error("Unexpected tokens at end");

        return root;
    }

    PTNode* parse(vector<Token>& t) override { return nullptr; }
    PTNode* parseWithGrammar(GrammarType type) { return parse(type); }
};


// ============================================================================
// THE RECURSIVE DESCENT PARSER
// ============================================================================

class RDParser {
    vector<Token> tokens;       // The flat list of tokens from the Lexer
    size_t pos = 0;             // The current reading position


    // Global state to track which cipher is currently active for encrypt/decrypt
    string cipherType;
    int shift = 0;
    
    // The root of the entire Abstract Syntax Tree (AST)
    PTNode* root = new PTNode("Program");


    // 'current' acts as a moving cursor. When parsing inside a loop or function,
    // 'current' points to that specific block so new statements are added as children to it,
    // rather than to the main Program root.
    PTNode* current = root;


    // A registry to keep track of user-defined functions
    unordered_map<string, PTNode*> functions;


public:
    PTNode* getRoot() {
        return root;
    }


public:
    //Parser(vector<Token> t) : tokens(move(t)) {}
    RDParser(vector<Token> t) : tokens(std::move(t)) {}

    // Look at the current token or peek at the next one
    Token& cur() { return tokens[pos]; }
    Token& next() { return tokens[pos + 1]; }

    // Consumes a token. If the token doesn't match expectations, throw a Syntax Error!
    void eat(TokType t) {
        if (cur().type != t)
            throw runtime_error("Unexpected token: " + cur().value);
        pos++;
    }
    // The main entry point. Keep parsing statements until the file ends.
    void parse() {
        while (cur().type != TOK_EOF) {
            statement();
        }
    }

    /*
     * statement() is the "Traffic Cop". It looks at the very first word of a line 
     * and decides which specific parsing rule to execute.
     */
    void statement() {
        if (cur().type == TOK_CIPHER) parseCipher();
        else if (cur().type == TOK_FUNC) parseFunction();

        
        else if (cur().type == TOK_PRINT) parsePrint();
        else if (cur().type == TOK_LET) parseLet();
        else if (cur().type == TOK_IF) parseIf();
        else if (cur().type == TOK_WHILE) parseWhile();

        // Variable Reassignment (e.g., "counter = 5;")
        else if (cur().type == TOK_IDENT && next().type == TOK_EQUAL)
            parseAssign();

        // Standalone Function Calls (e.g., "calculateHash(data);")
        else if (cur().type == TOK_IDENT && next().type == TOK_LPAREN) {
            auto* callNode = parseExpr(); // This automatically parses the FuncCall
            eat(TOK_SEMI);
            current->children.push_back(callNode);
        }
        // ---------------------------------------------------------------
        else if (cur().type == TOK_BREAK) parseBreak();
        else if (cur().type == TOK_CONTINUE) parseContinue();
        else if (cur().type == TOK_RETURN) parseReturn();
        





        else throw runtime_error("Invalid statement");
    }


    /*
     * parseCipher() acts as compiler directives. It configures the global 
     * state of the parser to know which algorithm to apply when it sees 'encrypt'
     */
    void parseCipher() {
    
        if (cipherDeclared) {
        throw runtime_error("Semantic Error: Cipher already declared");
    }

    eat(TOK_CIPHER);


    // ---------- SHA256 ----------
    if (cur().type == TOK_SHA256) {
    eat(TOK_SHA256);
    eat(TOK_SEMI);

    cipherDeclared = true;
    cipherType = "sha256";

    isSHA256 = true;

    // disable others
    isROT13 = isAtbash = isBinary = isMorse =
    isBase64 = isVigenere = isAffine = false;
    
    // Add the declaration to the syntax tree
    auto* node = new PTNode("CipherStmt");
    node->children.push_back(new PTNode("name: sha256"));
    root->children.push_back(node);

    cout << "[OK] Cipher set to SHA256\n";
    return;
    }
    // ---------- END SHA256 ----------


    // ---------- ROT13 SPECIAL CASE ----------
    if (cur().type == TOK_ROT13) {
    eat(TOK_ROT13);
    eat(TOK_SEMI);

    cipherDeclared = true;
    cipherType = "rot13";
    shift = 13;
    isROT13 = true;

    auto* node = new PTNode("CipherStmt");
    node->children.push_back(new PTNode("name: rot13"));
    root->children.push_back(node);

    cout << "[OK] Cipher set to ROT13" << endl;
    return;
    }
    // ---------- END ROT13 ----------


    // ---------- VIGENERE ----------
    if (cur().type == TOK_VIGENERE) {
    eat(TOK_VIGENERE);

    // expect: key "WORD"
    if (cur().value != "key")
        throw runtime_error("Expected 'key'");

    eat(TOK_IDENT);

    if (cur().type != TOK_STRING)
        throw runtime_error("Expected key string");

    vigenereKey = cur().value;
    eat(TOK_STRING);
    eat(TOK_SEMI);

    cipherDeclared = true;
    isVigenere = true;
    isROT13 = isAtbash = isBinary = false;

    auto* node = new PTNode("CipherStmt");
    node->children.push_back(new PTNode("name: vigenere"));
    node->children.push_back(new PTNode("key: " + vigenereKey));
    root->children.push_back(node);

    cout << "[OK] Cipher set to VIGENERE (key=" << vigenereKey << ")\n";
    return;
    }
    // ---------- END VIGENERE ----------

    // ---------- ATBASH ----------
    if (cur().type == TOK_ATBASH) {
    eat(TOK_ATBASH);
    eat(TOK_SEMI);

    cipherDeclared = true;
    cipherType = "atbash";
    isAtbash = true;

    auto* node = new PTNode("CipherStmt");
    node->children.push_back(new PTNode("name: atbash"));
    root->children.push_back(node);

    cout << "[OK] Cipher set to ATBASH" << endl;
    return;
    }
    // ---------- END ATBASH ----------

    // ---------- BINARY ----------
    if (cur().type == TOK_BINARY) {
    eat(TOK_BINARY);
    eat(TOK_SEMI);

    cipherDeclared = true;
    cipherType = "binary";

    isBinary = true;
    isAtbash = false;
    isROT13 = false;
    shift = 0;

    auto* node = new PTNode("CipherStmt");
    node->children.push_back(new PTNode("name: binary"));
    root->children.push_back(node);

    cout << "[OK] Cipher set to BINARY" << endl;
    return;
    }
    // ---------- END BINARY ----------

    // ---------- BASE64 ----------
    if (cur().type == TOK_BASE64) {
    eat(TOK_BASE64);
    eat(TOK_SEMI);

    cipherDeclared = true;
    cipherType = "base64";

    isBase64 = true;
    isBinary = false;
    isAtbash = false;
    isROT13 = false;
    shift = 0;

    auto* node = new PTNode("CipherStmt");
    node->children.push_back(new PTNode("name: base64"));
    root->children.push_back(node);

    cout << "[OK] Cipher set to BASE64" << endl;
    return;
    }
    // ---------- END BASE64 ----------

    // ---------- AFFINE ----------
    if (cur().type == TOK_AFFINE) {
    eat(TOK_AFFINE);

    // Expected Syntax: "cipher affine a = 5 b = 8;"
    eat(TOK_IDENT); // Expects the literal variable name 'a'
    eat(TOK_EQUAL);
    affineA = stoi(cur().value);
    eat(TOK_NUMBER);

    eat(TOK_IDENT); // Expects the literal variable name 'b'
    eat(TOK_EQUAL);
    affineB = stoi(cur().value);
    eat(TOK_NUMBER);

    eat(TOK_SEMI);

    //SANITIZE INPUTS (Fixes massive numbers and negative modulo)
        affineA = ((affineA % 26) + 26) % 26;
        affineB = ((affineB % 26) + 26) % 26;

        //SEMANTIC ANALYSIS: Throw Compile Error if 'A' is invalid
        if (affineA % 2 == 0 || affineA == 13 || affineA == 0) {
            cerr << "[COMPILE ERROR] Affine 'a' (" << affineA << ") must be coprime to 26!\n";
            exit(1); // Halt compilation!
        }

    isAffine = true;
    cipherDeclared = true;
    cipherType = "affine";

    auto* node = new PTNode("CipherStmt");
    node->children.push_back(new PTNode("name: affine"));
    node->children.push_back(new PTNode("a: " + to_string(affineA)));
    node->children.push_back(new PTNode("b: " + to_string(affineB)));
    root->children.push_back(node);

    cout << "[OK] Cipher set to AFFINE (a=" 
         << affineA << ", b=" << affineB << ")\n";
    return;
    }
    // ---------- END AFFINE ----------

    // ---------- MORSE ----------
    if (cur().type == TOK_MORSE) {
    eat(TOK_MORSE);
    eat(TOK_SEMI);

    cipherDeclared = true;
    cipherType = "morse";

    isMorse = true;
    isBinary = false;
    isAtbash = false;
    isROT13 = false;
    shift = 0;

    auto* node = new PTNode("CipherStmt");
    node->children.push_back(new PTNode("name: morse"));
    root->children.push_back(node);

    cout << "[OK] Cipher set to MORSE" << endl;
    return;
    }
    // ---------- END MORSE ----------
    
    // ---------- CUSTOM SHIFT (e.g., "cipher caesar shift = 3;") ----------
    string name = cur().value;  // "caesar"
    eat(TOK_IDENT);

    string shiftWord = cur().value;
    eat(TOK_IDENT);


    if (shiftWord != "shift") {
        throw runtime_error("Expected 'shift' keyword");
    }
    eat(TOK_EQUAL);

    int s = stoi(cur().value);
    eat(TOK_NUMBER);

    if (s <= 0 || s >= 26) {
        throw runtime_error("Semantic Error: Invalid shift value");
    }

    eat(TOK_SEMI);

    cipherDeclared = true;
    cipherType = name;
    shift = s;

    auto* node = new PTNode("CipherStmt");
    node->children.push_back(new PTNode("name: " + name));
    node->children.push_back(new PTNode("shift: " + to_string(s)));

    root->children.push_back(node);

    cout << "[OK] Cipher set to " << name << " shift=" << s << endl;
    }



    /*
     * parsePrimary() handles the "base cases" of expressions.
     * It parses fundamental values: Strings, Variables, Function Calls, Encrypt ops, and Numbers.
     */
    PTNode* parsePrimary() {

    // --- NEW: Handle Parentheses in Math! ---
    if (cur().type == TOK_LPAREN) {
        eat(TOK_LPAREN);
        auto* node = parseExpr(); // Loop back up to evaluate the inside
        eat(TOK_RPAREN);
        return node;
    }
        // ----------------------------------------

    // string literal
    if (cur().type == TOK_STRING) {
        auto* n = new PTNode("String");
        n->children.push_back(
            new PTNode("\"" + cur().value + "\"")
        );
        eat(TOK_STRING);
        return n;
    }

    // Identifier (Variable or Function Call)
    if (cur().type == TOK_IDENT) {
    string name = cur().value;

    // If an identifier is immediately followed by '(', it's a Function Call
    if (next().type == TOK_LPAREN) {
        eat(TOK_IDENT);
        eat(TOK_LPAREN);

        auto* call = new PTNode("FuncCall");
        call->children.push_back(new PTNode(name));

        auto* args = new PTNode("Args");

        // Parse comma-separated arguments until we hit the closing parenthesis
        if (cur().type != TOK_RPAREN) {
            do {
                args->children.push_back(parseExpr());
                if (cur().type == TOK_COMMA) eat(TOK_COMMA);
                else break;
            } while (true);
        }

        eat(TOK_RPAREN);

        call->children.push_back(args);
        return call;
    }

   
    // Otherwise, it's just a regular variable usage
    auto* n = new PTNode("Var");
    n->children.push_back(new PTNode(name));
    eat(TOK_IDENT);
    return n;
    }

    // Built-in Language Syntax: encrypt
    if (cur().type == TOK_ENCRYPT) {
        if (!cipherDeclared)
            throw runtime_error("encrypt used before cipher");

        eat(TOK_ENCRYPT);
        auto* n = new PTNode("EncryptExpr");
        n->children.push_back(parseExpr());
        n->children.push_back(
            new PTNode("shift: " + to_string(shift))
        );
        return n;

    }

    // Built-in Language Syntax: decrypt
    if (cur().type == TOK_DECRYPT) {
    if (isSHA256)
        throw runtime_error("Semantic Error: SHA256 cannot be decrypted");

        if (!cipherDeclared)
            throw runtime_error("decrypt used before cipher");

        eat(TOK_DECRYPT);
        auto* n = new PTNode("DecryptExpr");
        n->children.push_back(parseExpr());
        n->children.push_back(
            new PTNode("shift: " + to_string(26 - shift))
        );
        return n;

    }

    // number literal
    if (cur().type == TOK_NUMBER) {
    auto* n = new PTNode("Number");
    n->children.push_back(new PTNode(cur().value));
    eat(TOK_NUMBER);
    return n;
    }

    throw runtime_error("Invalid expression");
    }

    void parsePrint() {
    eat(TOK_PRINT);

    auto* node = new PTNode("PrintStmt");
    node->children.push_back(parseExpr());

    eat(TOK_SEMI);
    current->children.push_back(node);
    }

    void parseLet() {
    eat(TOK_LET);

    string name = cur().value;
    eat(TOK_IDENT);



    //symtab.declare(name, "var");  
    eat(TOK_EQUAL);

    auto* expr = parseExpr();

    eat(TOK_SEMI);

    auto* node = new PTNode("LetStmt");
    node->children.push_back(new PTNode("name: " + name));
    node->children.push_back(expr);

    current->children.push_back(node);
    }

    PTNode* parseFactor() {
        return parsePrimary();
    }

    PTNode* parseTerm() {
    PTNode* node = parseFactor();

    while (cur().type == TOK_MUL || cur().type == TOK_DIV) {
        string op = cur().value;
        eat(cur().type);

        auto* parent = new PTNode(op);
        parent->children.push_back(node);
        parent->children.push_back(parseFactor());
        node = parent;
    }
    return node;
    }

    PTNode* parseExpr() {
    PTNode* node = parseTerm();

    // arithmetic (+, -)
    while (cur().type == TOK_PLUS || cur().type == TOK_MINUS) {
        string op = cur().value;
        eat(cur().type);

        auto* parent = new PTNode(op);
        parent->children.push_back(node);
        parent->children.push_back(parseTerm());
        node = parent;
    }

    return node;
    }

    /*
     * parseIf() demonstrates block parsing and the 'current' pointer manipulation.
     */
    void parseIf() {
    eat(TOK_IF);

    auto* cond = parseLogicalOr();  // a > 10

    eat(TOK_LBRACE);

    auto* ifNode = new PTNode("IfStmt");
    ifNode->children.push_back(cond);

    // --- THE POINTER SHIFT ---
        // Save the outer context (e.g., the main program)
    PTNode* prev = current;

    // Tell the parser: "Any new statements you find, put them inside the If block!"
    current = ifNode;

   int prevPos;
while (cur().type != TOK_RBRACE) {
    prevPos = pos;
    statement();
    if (pos == prevPos)
        throw runtime_error("Parser stuck: no token consumed");
}


    // --- RESTORE THE POINTER ---
    // The block is over, point back to the outer context.
    current = prev;
    eat(TOK_RBRACE);

    // else block
    if (cur().type == TOK_ELSE) {
        eat(TOK_ELSE);
        eat(TOK_LBRACE);


        auto* elseNode = new PTNode("ElseStmt");

        // --- Point 'current' to the else block so statements go inside it ---
        PTNode* prevElse = current;
        current = elseNode;


        while (cur().type != TOK_RBRACE)
            statement();

            //symtab.exitScope();


            // --- Restore 'current' ---
            current = prevElse;

        eat(TOK_RBRACE);
        ifNode->children.push_back(elseNode);
    }

    // Finally, attach the completed If block to the main program
    current->children.push_back(ifNode);
    }


    void parseWhile() {
    eat(TOK_WHILE);

    auto* node = new PTNode("WhileStmt");

    // condition
    node->children.push_back(parseLogicalOr());

    eat(TOK_LBRACE);

    //symtab.enterScope();

    PTNode* prev = current;
    current = node;

    while (cur().type != TOK_RBRACE)
        statement();

    current = prev;

    //symtab.exitScope();

    eat(TOK_RBRACE);

    current->children.push_back(node);
    }

    void parseAssign() {
    string name = cur().value;


    eat(TOK_IDENT);
    eat(TOK_EQUAL);

    auto* expr = parseExpr();
    eat(TOK_SEMI);

    auto* node = new PTNode("AssignStmt");
    node->children.push_back(new PTNode(name));
    node->children.push_back(expr);

    current->children.push_back(node);

    }

    PTNode* parseComparison() {
    PTNode* node = parseExpr();

    while (cur().type == TOK_LT || cur().type == TOK_GT ||
        cur().type == TOK_EQEQ || cur().type == TOK_NEQ ||
        cur().type == TOK_LTE || cur().type == TOK_GTE) {

        string op = cur().value;
        eat(cur().type);

        auto* parent = new PTNode(op);
        parent->children.push_back(node);
        parent->children.push_back(parseExpr());
        return parent;
    }

    return node;
    }

    void parseBreak() {
        eat(TOK_BREAK);
        eat(TOK_SEMI);
        current->children.push_back(new PTNode("BreakStmt"));
    }


    void parseContinue() {
        eat(TOK_CONTINUE);
        eat(TOK_SEMI);
        current->children.push_back(new PTNode("ContinueStmt"));
    }


    PTNode* parseLogicalAnd() {
    PTNode* node = parseComparison();

    while (cur().type == TOK_AND) {
        eat(TOK_AND);
        auto* parent = new PTNode("&&");
        parent->children.push_back(node);
        parent->children.push_back(parseComparison());
        node = parent;
    }

    return node;
    }


    PTNode* parseLogicalOr() {
    PTNode* node = parseLogicalAnd();

    while (cur().type == TOK_OR) {
        eat(TOK_OR);
        auto* parent = new PTNode("||");
        parent->children.push_back(node);
        parent->children.push_back(parseLogicalAnd());
        node = parent;
    }

    return node;
    }

    /*
     * parseFunction() handles user-defined logic blocks.
     */
    void parseFunction() {
    eat(TOK_FUNC);

    string name = cur().value;
    eat(TOK_IDENT);

    eat(TOK_LPAREN);

     //symtab.enterScope();

    auto* params = new PTNode("Params");
   

    // Parse the comma-separated parameter definitions
    if (cur().type != TOK_RPAREN) {
        do {
            string p = cur().value;
            eat(TOK_IDENT);
            params->children.push_back(new PTNode(p));
            

            if (cur().type == TOK_COMMA) eat(TOK_COMMA);
            else break;
        } while (true);
    }


    eat(TOK_RPAREN);
    eat(TOK_LBRACE);

   

    auto* func = new PTNode("FuncDef");
    func->children.push_back(new PTNode(name));
    func->children.push_back(params);

    // Pointer shift to parse the body of the function
    PTNode* prev = current;
    current = func;

    while (cur().type != TOK_RBRACE)
        statement();

    current = prev;

     
    eat(TOK_RBRACE);

    // Register the function so the semantic analyzer knows it exists
    functions[name] = func;
    root->children.push_back(func);
    
    }

    void parseReturn() {
    eat(TOK_RETURN);
    auto* node = new PTNode("ReturnStmt");
    node->children.push_back(parseExpr());
    eat(TOK_SEMI);
    current->children.push_back(node);
    }


    // Entry point called by main.cpp
    PTNode* parseTree() {
    parse();
    return getRoot();
}

};




//============================================================================
// PARSER ADAPTER
// ============================================================================

/*
 * This Adapter class is a brilliant use of the "Adapter Design Pattern".
 * Because your main code expects all parsers to look like `IParser` (so it can 
 * swap between LL(1) and RDParser easily), this wrapper class forces the 
 * RDParser to fit the standard IParser blueprint.
 */
class RDParserAdapter : public IParser {
public:
    PTNode* parse(vector<Token>& tokens) override {
        RDParser parser(tokens);
        return parser.parseTree();
    }
};



// ============================================================================
// TREE VISUALIZER (TERMINAL)
// ============================================================================

/*
 * Recursively prints the Parse Tree to the terminal using ASCII graphics.
 * It uses `isLast` to determine whether to draw a branch `|--` or a corner `+--`.
 */
void printTree(PTNode* node, string prefix = "", bool isLast = true) {
    if (!node) return;

    cout << prefix;
    cout << (isLast ? "+-- " : "|-- ");
    cout << node->label << endl;

    //Sleep(500);
    //this_thread::sleep_for(chrono::milliseconds(500));

    // Defines the prefix for the NEXT level down
    string newPrefix = prefix + (isLast ? "    " : "|   ");

    for (size_t i = 0; i < node->children.size(); i++) {
        printTree(
            node->children[i],
            newPrefix,
            i == node->children.size() - 1
        );
    }
}

// Helper to convert the numeric Enum back into a printable string
string tokenName(TokType t) {
    switch (t) {
        case TOK_CIPHER: return "CIPHER";
        case TOK_ENCRYPT: return "ENCRYPT";
        case TOK_DECRYPT: return "DECRYPT";
        case TOK_IDENT: return "IDENT";
        case TOK_NUMBER: return "NUMBER";
        case TOK_STRING: return "STRING";
        case TOK_EQUAL: return "EQUAL";
        case TOK_SEMI: return "SEMI";
        case TOK_EOF: return "EOF";
        case TOK_PRINT: return "PRINT";
        case TOK_LET: return "LET";
        case TOK_PLUS:  return "PLUS";
        case TOK_MINUS: return "MINUS";
        case TOK_MUL:   return "MUL";
        case TOK_DIV:   return "DIV";
        case TOK_IF: return "IF";
        case TOK_ELSE: return "ELSE";
        case TOK_GT: return "GT";
        case TOK_LT: return "LT";
        case TOK_LBRACE: return "LBRACE";
        case TOK_RBRACE: return "RBRACE";
        case TOK_WHILE: return "WHILE";
        case TOK_EQEQ: return "EQEQ";
        case TOK_NEQ: return "NEQ";
        case TOK_LTE: return "LTE";
        case TOK_GTE: return "GTE";
        case TOK_BREAK: return "BREAK";
        case TOK_CONTINUE: return "CONTINUE";
        case TOK_AND: return "AND";
        case TOK_OR:  return "OR";
        case TOK_FUNC: return "FUNC";
        case TOK_RETURN: return "RETURN";
        case TOK_COMMA: return "COMMA";
        case TOK_LPAREN: return "LPAREN";
        case TOK_RPAREN: return "RPAREN";
        case TOK_ROT13:  return "ROT13";
        case TOK_ATBASH: return "ATBASH";
        case TOK_BINARY: return "BINARY";
        case TOK_MORSE: return "MORSE";
        case TOK_BASE64: return "BASE64";
        case TOK_VIGENERE: return "VIGENERE";
        case TOK_AFFINE: return "AFFINE";
        case TOK_SHA256: return "SHA256";

        default: return "UNKNOWN";
    }
}


// ============================================================================
// TAC / IR GENERATION STATE
// ============================================================================

/*
struct TAC {
    string op;
    string arg1;
    string arg2;
    string result;

    TAC(string o, string a1, string a2, string r)
        : op(o), arg1(a1), arg2(a2), result(r) {}
};

vector<TAC> tac;
*/
// Stacks used to track jump labels for loops. 
// A stack is required because loops can be nested! (e.g. while inside a while)
stack<string> breakStack;
stack<string> continueStack;

// Stacks for tracking function memory context (Scope) and where to return after a call.
stack<unordered_map<string, string>> callStack;
stack<int> returnAddr;

// Forward declarations so these functions can call each other circularly
string genExprTAC(PTNode* node);
string genCondTAC(PTNode* node);
void generateTAC(PTNode* node);



// ============================================================================
// THE TAC GENERATOR (TREE TRAVERSAL)
// ============================================================================

/*
 * generateTAC traverses the tree and translates high-level concepts (like loops 
 * or variable declarations) into flat, low-level instructions.
 */
void generateTAC(PTNode* node) {
    if (!node) return;

    // --- 1. THE ROOT (Program) ---
    if (node->label == "Program") {
        // Output: "GOTO __main"
        // This ensures the Virtual Machine doesn't accidentally execute a function 
        // definition before it is actually called.
        irCode.push_back({"GOTO", "", "", "__main"});
        
        // Scan the tree for Functions and generate their code blocks FIRST
        for (auto c : node->children)
            if (c->label == "FuncDef")
                generateTAC(c);

    // Mark the start of the actual script
    irCode.push_back({"LABEL", "", "", "__main"});

    // Scan the tree again for everything else and generate the main logic
    for (auto c : node->children)
        if (c->label != "FuncDef")
            generateTAC(c);

    return;
    }

    // --- 2. FUNCTION DEFINITION ---
    if (node->label == "FuncDef") {
    string fname = node->children[0]->label;
    PTNode* params = node->children[1];

    // Mark where this function begins in memory
    irCode.push_back({"LABEL", "", "", fname});

    // Pull passed arguments off the stack and assign them to local variables.
    // We do this in reverse order due to how Stacks (LIFO) operate.
    for (int i = params->children.size() - 1; i >= 0; i--) {
        string p = params->children[i]->label;
        //tac.push_back({"POP_PARAM", "", "", p});
        irCode.push_back({"POP_PARAM", "", "", p});
    }

    bool hasReturn = false;

// Generate the code inside the function
for (size_t i = 2; i < node->children.size(); i++) {
    if (node->children[i]->label == "ReturnStmt")
        hasReturn = true;
    generateTAC(node->children[i]);
}

// Failsafe: If the user forgot to write `return;`, force the VM to return 0
        // so the program doesn't crash or bleed into other memory!
if (!hasReturn)
    irCode.push_back({"RET", "0", "", ""});


    return;
    }



    // --- 3. VARIABLE DECLARATION (LET) ---
    if (node->label == "LetStmt") {
        string name = node->children[0]->label.substr(6);  // Remove the "name: " prefix
        // Generate the math/logic for the right side of the equals sign
        string temp = genExprTAC(node->children[1]);
        // Store the final calculated temporary into the actual variable
        irCode.push_back({"STORE", temp, "", name});
    }

    // --- 4. PRINT STATEMENT ---
    else if (node->label == "PrintStmt") {
        string temp = genExprTAC(node->children[0]);
        //tac.push_back({"PRINT", temp, "", ""});
        irCode.push_back({"PRINT", temp, "", ""});
    }

    // --- 5. IF / ELSE STATEMENT ---
    else if (node->label == "IfStmt") {

    // Evaluate the condition
    string cond = genCondTAC(node->children[0]);

    // Generate two unique jump targets
    string Lelse = "L" + to_string(++tempCount);
    string Lend  = "L" + to_string(++tempCount);

    // If the condition is 0 (False), skip the IF block and jump to the ELSE block
    irCode.push_back({"IF_FALSE_GOTO", cond, "", Lelse});

    // IF body: Generate all statements until we hit the Else block
    for (size_t i = 1; i < node->children.size(); i++) {
        if (node->children[i]->label == "ElseStmt") break;
        generateTAC(node->children[i]);
    }


    // If the IF block finished successfully, jump to the END (skip the ELSE block)
    irCode.push_back({"GOTO", "", "", Lend});

    // Mark the start of the ELSE block
    irCode.push_back({"LABEL", "", "", Lelse});

    // ELSE body: Generate all statements inside the else block
    if (node->children.size() > 2) {
        for (auto stmt : node->children[2]->children)
            generateTAC(stmt);
    }

    

    // Mark the end of the entire IF/ELSE structure
    irCode.push_back({"LABEL", "", "", Lend});
    } 


    // --- 6. WHILE LOOP ---
    else if (node->label == "WhileStmt") {
        string Lstart = "L" + to_string(++tempCount);
        string Lend   = "L" + to_string(++tempCount);

        // Push labels to the stack so 'break' and 'continue' know exactly where to jump!
        breakStack.push(Lend);
        continueStack.push(Lstart);

        // Mark the very beginning of the loop
        irCode.push_back({"LABEL", "", "", Lstart});

        // Evaluate the condition. If false, jump to Lend to exit the loop entirely.
        string cond = genCondTAC(node->children[0]);
        
        irCode.push_back({"IF_FALSE_GOTO", cond, "", Lend});

        // Generate the code inside the loop
        for (size_t i = 1; i < node->children.size(); i++)
            generateTAC(node->children[i]);

            // Force the loop to jump back to the start to evaluate the condition again
            irCode.push_back({"GOTO", "", "", Lstart});

            // Mark the exit point of the loop
            irCode.push_back({"LABEL", "", "", Lend});


        // Cleanup: We left the loop, so pop the targets off the stack.
        breakStack.pop();
        continueStack.pop();
        return;
    }


    // --- 7. ASSIGNMENT ---
    else if (node->label == "AssignStmt") {
        string name = node->children[0]->label;
        string temp = genExprTAC(node->children[1]);
        //tac.push_back({"STORE", temp, "", name});
        irCode.push_back({"STORE", temp, "", name});
    }


    // --- 8. BREAK / CONTINUE ---
    else if (node->label == "BreakStmt") {
        if (breakStack.empty())
            throw runtime_error("Semantic Error: 'break' used outside loop");
        
        // Jump to the `Lend` label of the current loop
        irCode.push_back({"GOTO", "", "", breakStack.top()});
    }


    else if (node->label == "ContinueStmt") {
        if (continueStack.empty())
            throw runtime_error("Semantic Error: 'continue' used outside loop");
        // Jump to the `Lstart` label of the current loop
        irCode.push_back({"GOTO", "", "", continueStack.top()});
    }


    // --- 9. RETURN STATEMENT ---
    else if (node->label == "ReturnStmt") {
    string temp = genExprTAC(node->children[0]);
    irCode.push_back({"RET", temp, "", ""});
    }

    // --- 10. STANDALONE FUNCTION CALL ---
    else if (node->label == "FuncCall") {

        // Even though we aren't assigning the return value to a variable, 
        // we still need to execute the math/logic of the function call!
        genExprTAC(node); // This handles all the PARAMs and the CALL instruction!
    }
    
    
}



// ============================================================================
// EXPRESSION TAC GENERATION
// ============================================================================

/*
 * genExprTAC evaluates a mathematical, logical, or cryptographic expression.
 * It translates the AST node into bytecode, and RETURNS a string.
 * This string is the name of the temporary variable (e.g., "t4") that holds 
 * the final result of this specific calculation.
 */
string newTemp();

string genExprTAC(PTNode* node) {

    // --- 1. PRIMITIVES (The Base Cases) ---

    // String literal
    if (node->label == "String") {
        string val = node->children[0]->label;
        string t = newTemp();// Grab a new memory slot (e.g., "t1")
        // Note: LOAD places raw strings into memory.
        irCode.push_back({"LOAD", val, "", t});
        return t;// Tell the parent node where to find the string!
    }

    // Variable usage (e.g., `let x = y;` -> evaluating `y`)
    if (node->label == "Var") {
        string name = node->children[0]->label;
        string t = newTemp();
        // Note: LOAD_VAR pulls an existing variable from the VM's hashmap
        irCode.push_back({"LOAD_VAR", name, "", t});
        return t;
    }

    // --- 2. MATHEMATICAL & RELATIONAL OPERATORS ---

    // Binary math operations
    if (node->label == "+" || node->label == "-" ||
    node->label == "*" || node->label == "/") {

    
    // RECURSION: Solve the left side first, then the right side.
    // If the AST is `(5 * 2) + 10`, this forces the `5*2` to fully calculate
    // and return its temporary variable BEFORE the addition is generated!
    string left = genExprTAC(node->children[0]);
    string right = genExprTAC(node->children[1]);

    string t = newTemp();
    irCode.push_back({node->label, left, right, t});
    return t;
    }

    // Comparison operations (Same recursive logic as math)
    if (node->label == ">" || node->label == "<" ||
    node->label == "==" || node->label == "!=" ||
    node->label == "<=" || node->label == ">=") {

    string left = genExprTAC(node->children[0]);
    string right = genExprTAC(node->children[1]);

    string t = newTemp();
    irCode.push_back({node->label, left, right, t});
    return t;
    }
    

    // --- 3. CRYPTOGRAPHY ENGINE MAPPING ---
    // The parser verified the cipher globally, so we check the boolean flags
    // to determine exactly which IR operation to inject.

    if (node->label == "EncryptExpr" && isSHA256) {
    string src = genExprTAC(node->children[0]);
    string t = newTemp();
    irCode.push_back({"SHA256", src, "", t});
    return t;
    }

    // Encrypt (AFFINE)
    if (node->label == "EncryptExpr" && isAffine) {
    string src = genExprTAC(node->children[0]);
    string t = newTemp();
    irCode.push_back({"AFFINE", src,
                   to_string(affineA) + "," + to_string(affineB),
                   t});
    return t;
    }

    // Decrypt (AFFINE)
    if (node->label == "DecryptExpr" && isAffine) {
    string src = genExprTAC(node->children[0]);
    string t = newTemp();
    irCode.push_back({"AFFINE_DEC", src,
                   to_string(affineA) + "," + to_string(affineB),
                   t});
    return t;
    }   
    // Encrypt (BINARY)
    if (node->label == "EncryptExpr" && isBinary) {
    string src = genExprTAC(node->children[0]);
    string t = newTemp();
    irCode.push_back({"BINARY", src, "", t});
    return t;
    }

    // Decrypt (BINARY)
    if (node->label == "DecryptExpr" && isBinary) {
    string src = genExprTAC(node->children[0]);
    string t = newTemp();
    irCode.push_back({"BINARY_DEC", src, "", t});
    return t;
    }
    // Encrypt (ATBASH)
    if (node->label == "EncryptExpr" && isAtbash) {
    string src = genExprTAC(node->children[0]);
    string t = newTemp();
    irCode.push_back({"ATBASH", src, "", t});
    return t;
    }
    // Decrypt (ATBASH)
    if (node->label == "DecryptExpr" && isAtbash) {
    string src = genExprTAC(node->children[0]);
    string t = newTemp();
    irCode.push_back({"ATBASH", src, "", t});
    return t;
    }
    // Encrypt (MORSE)
    if (node->label == "EncryptExpr" && isMorse) {
    string src = genExprTAC(node->children[0]);
    string t = newTemp();
    irCode.push_back({"MORSE", src, "", t});
    return t;
    }

    // Decrypt (MORSE)
    if (node->label == "DecryptExpr" && isMorse) {
    string src = genExprTAC(node->children[0]);
    string t = newTemp();
    irCode.push_back({"MORSE_DEC", src, "", t});
    return t;
    }
    // Encrypt (BASE64)
    if (node->label == "EncryptExpr" && isBase64) {
    string src = genExprTAC(node->children[0]);
    string t = newTemp();
    irCode.push_back({"BASE64", src, "", t});
    return t;
    }

    // Decrypt (BASE64)
    if (node->label == "DecryptExpr" && isBase64) {
    string src = genExprTAC(node->children[0]);
    string t = newTemp();
    irCode.push_back({"BASE64_DEC", src, "", t});
    return t;
    }
    // Encrypt (VIGENERE)
    if (node->label == "EncryptExpr" && isVigenere) {
    string src = genExprTAC(node->children[0]);
    string t = newTemp();
    irCode.push_back({"VIGENERE", src, vigenereKey, t});
    return t;
    }

    // Decrypt (VIGENERE)
    if (node->label == "DecryptExpr" && isVigenere) {
    string src = genExprTAC(node->children[0]);
    string t = newTemp();
    irCode.push_back({"VIGENERE_DEC", src, vigenereKey, t});
    return t;
    }

    // Default Fallback: CAESAR CIPHER
    if (node->label == "EncryptExpr") {
    string src = genExprTAC(node->children[0]);

    string shiftLabel = node->children[1]->label; // "shift: 3"
    string shiftVal = shiftLabel.substr(7);   // Chops off "shift: " to leave "3"

    string t = newTemp();
    irCode.push_back({"CAESAR", src, shiftVal, t});
    return t;
    }

    // Decrypt
    if (node->label == "DecryptExpr") {
    string src = genExprTAC(node->children[0]);

    string shiftLabel = node->children[1]->label; // "shift: 23"
    string shiftVal = shiftLabel.substr(7);

    string t = newTemp();
    irCode.push_back({"CAESAR", src, shiftVal, t});
    return t;
    }

    // Number literal
    if (node->label == "Number") {
    string val = node->children[0]->label;
    string t = newTemp();
    irCode.push_back({"LOAD_NUM", val, "", t});
    return t;
    }

    // --- 4. SHORT-CIRCUIT BOOLEAN LOGIC ---

    // Logical OR (||)
    if (node->label == "||") {
    string result = newTemp();

    string Ltrue = "L" + to_string(++tempCount);
    string Lend  = "L" + to_string(++tempCount);

    // Evaluate the Left Side first
    string left = genExprTAC(node->children[0]);

    // If the left side is False, jump to Ltrue to check the right side
    irCode.push_back({"IF_FALSE_GOTO", left, "", Ltrue});

    // SHORT-CIRCUIT: If we didn't jump, the left side was True!
    // An OR statement only needs one True side to be completely True. 
    // We load '1' and instantly skip the right-side evaluation entirely!
    irCode.push_back({"LOAD_NUM", "1", "", result});
    irCode.push_back({"GOTO", "", "", Lend});

    // This label is only hit if the left side was false
    irCode.push_back({"LABEL", "", "", Ltrue});
    string right = genExprTAC(node->children[1]);   // Evaluate right side
    irCode.push_back({"STORE", right, "", result});

    irCode.push_back({"LABEL", "", "", Lend});
    return result;
    }

    // Logical AND (&&)
    if (node->label == "&&") {
    string result = newTemp();

    string Lfalse = "L" + to_string(++tempCount);
    string Lend   = "L" + to_string(++tempCount);

    // Evaluate the Left Side
    string left = genExprTAC(node->children[0]);

    // SHORT-CIRCUIT: An AND statement requires BOTH sides to be True.
        // If the left side is False, the whole equation is instantly ruined.
        // We immediately jump to Lfalse and skip the right side entirely!
    irCode.push_back({"IF_FALSE_GOTO", left, "", Lfalse});

    // If we didn't jump, the left side was true, so we MUST check the right side.
    string right = genExprTAC(node->children[1]);
    irCode.push_back({"STORE", right, "", result});
    irCode.push_back({"GOTO", "", "", Lend});

    // This label is only hit if the left side was false
    irCode.push_back({"LABEL", "", "", Lfalse});
    irCode.push_back({"LOAD_NUM", "0", "", result});

    irCode.push_back({"LABEL", "", "", Lend});
    return result;
    }

    // --- 5. FUNCTION CALLS ---
    if (node->label == "FuncCall") {
    string funcName = node->children[0]->label;
    PTNode* args = node->children[1];

        // Evaluate arguments and push them to the VM's Param Stack.
        // We push them in REVERSE order. This is standard compiler calling convention!
        // If a function expects (x, y), it pops y first, then x.
        for (int i = args->children.size() - 1; i >= 0; i--) {
    string t = genExprTAC(args->children[i]);
    irCode.push_back({"PARAM", t, "", ""});
}

    string ret = newTemp();
    // Pause the current logic and jump to the function's bytecode label
    irCode.push_back({"CALL", funcName, "", ""});
    
    // Once the function hits a RET instruction, it puts the answer in a global 
        // __ret register. We grab it from there and assign it to our temporary!
    irCode.push_back({"LOAD_VAR", "__ret", "", ret});
    return ret;

    }


    // --- 6. MISC (Fallbacks & Condition Helpers) ---

    // Note: FuncDef and ReturnStmt are structurally statements, not expressions, 
    // so they are usually handled by generateTAC. These act as safety fallbacks.
    if (node->label == "FuncDef") {
    string fname = node->children[0]->label;

    irCode.push_back({"LABEL", "", "", fname}); // function entry

    // generate TAC for function body
    for (auto child : node->children) {
        if (child->label != "Params")
            generateTAC(child);
    }

    return "";

    }


    if (node->label == "ReturnStmt") {
    string val = genExprTAC(node->children[0]);
    irCode.push_back({"RET", val, "", ""});
    return "";
    
    }

    throw runtime_error("Unknown expression node");
}


/*
 * genCondTAC is a safety wrapper used by If-statements and While-loops.
 * If a user writes `while ("hello") { ... }`, this ensures the string "hello" 
 * is forcefully evaluated into a boolean (1 or 0) before the VM tries to jump.
 */
string genCondTAC(PTNode* node) {
    string v = genExprTAC(node);    // Evaluate whatever the condition is
    string t = newTemp();
    irCode.push_back({"TO_BOOL", v, "", t});    // Cast it to a true/false boolean
    return t;
}



// ============================================================================
// TAC PRINTER (HUMAN-READABLE OUTPUT)
// ============================================================================

/*
 * printTAC() is a purely cosmetic function. It takes the abstract `irCode` 
 * (which is stored as a vector of structs) and translates it into standard 
 * "Three Address Code" syntax so you, the compiler engineer, can read it.
 * This is crucial for debugging your Optimizer!
 */

void printTAC() {
    cout << "\n=== Three Address Code ===\n";

    for (auto &i : irCode) {
        // Memory Operations
        if (i.op == "LOAD")
            cout << i.result << " = " << i.arg1 << endl;
        else if (i.op == "STORE")
            cout << i.result << " = " << i.arg1 << endl;
        else if (i.op == "LOAD_VAR")
            cout << i.result << " = " << i.arg1 << endl;

        // Output Operations
        else if (i.op == "PRINT")
            cout << "print " << i.arg1 << endl;

        // --- Cryptography Operations (Complete Library) ---
        else if (i.op == "CAESAR")
            cout << i.result << " = caesar(" << i.arg1 << ", shift:" << i.arg2 << ")" << endl;
        
        else if (i.op == "ATBASH")
            cout << i.result << " = atbash(" << i.arg1 << ")" << endl;
        
        else if (i.op == "BINARY")
            cout << i.result << " = binary(" << i.arg1 << ")" << endl;
        else if (i.op == "BINARY_DEC")
            cout << i.result << " = binary_dec(" << i.arg1 << ")" << endl;
        
        else if (i.op == "MORSE")
            cout << i.result << " = morse(" << i.arg1 << ")" << endl;
        else if (i.op == "MORSE_DEC")
            cout << i.result << " = morse_dec(" << i.arg1 << ")" << endl;
        
        else if (i.op == "BASE64")
            cout << i.result << " = base64(" << i.arg1 << ")" << endl;
        else if (i.op == "BASE64_DEC")
            cout << i.result << " = base64_dec(" << i.arg1 << ")" << endl;
        
        else if (i.op == "VIGENERE")
            cout << i.result << " = vigenere(" << i.arg1 << ", key:" << i.arg2 << ")" << endl;
        else if (i.op == "VIGENERE_DEC")
            cout << i.result << " = vigenere_dec(" << i.arg1 << ", key:" << i.arg2 << ")" << endl;
        
        else if (i.op == "AFFINE")
            cout << i.result << " = affine(" << i.arg1 << ", params:" << i.arg2 << ")" << endl;
        else if (i.op == "AFFINE_DEC")
            cout << i.result << " = affine_dec(" << i.arg1 << ", params:" << i.arg2 << ")" << endl;
        
        else if (i.op == "SHA256")
            cout << i.result << " = sha256(" << i.arg1 << ")" << endl;
            
        // Math Operations (e.g., t3 = t1 + t2)
        else if (i.op == "+" || i.op == "-" || i.op == "*" || i.op == "/")
            cout << i.result << " = " << i.arg1 << " "
            << i.op << " " << i.arg2 << endl;

        // Relational Operations (e.g., t4 = t3 >= 10)
        else if (i.op == "==" || i.op == "!=" ||
            i.op == "<=" || i.op == ">=")
            cout << i.result << " = " << i.arg1
            << " " << i.op << " " << i.arg2 << endl;
        else if (i.op == "<" || i.op == ">")
            cout << i.result << " = " << i.arg1
            << " " << i.op << " " << i.arg2 << endl;

        // Logical Operations
        else if (i.op == "&&" || i.op == "||")
            cout << i.result << " = " << i.arg1
            << " " << i.op << " " << i.arg2 << endl;

        // Function Calls & Control Flow
        else if (i.op == "PARAM")
            cout << "param " << i.arg1 << endl;

        else if (i.op == "CALL")
            cout << "call " << i.result << endl;

        else if (i.op == "LABEL")
        cout << i.result << ":" << endl;

        else if (i.op == "GOTO")
            cout << "goto " << i.result << endl; // FIX: Added unconditional jump
        else if (i.op == "IF_FALSE_GOTO")
            cout << "ifFalse " << i.arg1 << " goto " << i.result << endl;

        //Sleep(500);
        //this_thread::sleep_for(chrono::milliseconds(500));
    }
}

// ============================================================================
// BYTECODE DEFINITIONS (MACHINE-READABLE OUTPUT)
// ============================================================================

/*
 * OpCode (Operation Code) is the Instruction Set Architecture (ISA) of your 
 * Virtual Machine. Just like an Intel processor has an instruction set (x86), 
 * your custom CryptoVM uses this exact list of commands.
 */
enum OpCode {
    // Memory Management
    OP_LOAD,          // Load a string into memory
    OP_LOAD_VAR,      // Copy a variable's value
    OP_LOAD_NUM,      // Load a raw number into memory
    OP_STORE,         // Save a temporary result into a named variable
   
   

    // Math & Logic
    OP_ADD, 
    OP_SUB, 
    OP_MUL, 
    OP_DIV,
    OP_GT,
    OP_LT,
    OP_EQ, 
    OP_NEQ, 
    OP_LTE,
    OP_GTE,
    OP_AND,
    OP_TO_BOOL,
    OP_OR,

    // Control Flow (Jumps & Functions)
    OP_IF_FALSE_GOTO, // Conditional branch (used in IF and WHILE)
    OP_GOTO,          // Unconditional branch (used in loops and else blocks)
    OP_LABEL,         // A target marker for jumps
    OP_CALL,          // Jump to a function
    OP_RET,           // Return from a function
    OP_POP_PARAM,     // Pull arguments off the stack for a function

    // System I/O
    OP_PRINT,

    // Hardware-Accelerated Cryptography (Your standard library!)
    OP_CAESAR,
    OP_ATBASH,
    OP_BINARY,
    OP_BINARY_DEC,
    OP_MORSE,
    OP_MORSE_DEC,
    OP_BASE64,
    OP_BASE64_DEC,
    OP_VIGENERE,
    OP_VIGENERE_DEC,
    OP_AFFINE,
    OP_AFFINE_DEC,
    OP_SHA256
};

/*
 * Instr represents a single, compiled line of Bytecode.
 * It is slightly different from the `IR` struct because it uses `OpCode` 
 * integers instead of Strings, making it lightning fast for the VM to execute.
 */

struct Instr {
    OpCode op;      // The integer operation ID (e.g., OP_ADD)
    string dst;     // Destination (Where the result goes)
    string src;     // Source (The primary input)
    string extra;   // Secondary input (e.g., the right side of an addition, or jump target)
};


// --- BYTECODE HELPER: Converts Enums back to Strings for the UI ---
string getOpcodeName(OpCode op) {
    switch (op) {
        case OP_LOAD: return "LOAD";
        case OP_LOAD_VAR: return "LOAD_VAR";
        case OP_LOAD_NUM: return "LOAD_NUM";
        case OP_STORE: return "STORE";
        case OP_ADD: return "ADD";
        case OP_SUB: return "SUB";
        case OP_MUL: return "MUL";
        case OP_DIV: return "DIV";
        case OP_GT: return "GT";
        case OP_LT: return "LT";
        case OP_EQ: return "EQ";
        case OP_NEQ: return "NEQ";
        case OP_LTE: return "LTE";
        case OP_GTE: return "GTE";
        case OP_AND: return "AND";
        case OP_TO_BOOL: return "TO_BOOL";
        case OP_OR: return "OR";
        case OP_IF_FALSE_GOTO: return "IF_FALSE_GOTO";
        case OP_GOTO: return "GOTO";
        case OP_LABEL: return "LABEL";
        case OP_CALL: return "CALL";
        case OP_RET: return "RET";
        case OP_POP_PARAM: return "POP_PARAM";
        case OP_PRINT: return "PRINT";
        case OP_CAESAR: return "CAESAR";
        case OP_ATBASH: return "ATBASH";
        case OP_BINARY: return "BINARY";
        case OP_BINARY_DEC: return "BINARY_DEC";
        case OP_MORSE: return "MORSE";
        case OP_MORSE_DEC: return "MORSE_DEC";
        case OP_BASE64: return "BASE64";
        case OP_BASE64_DEC: return "BASE64_DEC";
        case OP_VIGENERE: return "VIGENERE";
        case OP_VIGENERE_DEC: return "VIGENERE_DEC";
        case OP_AFFINE: return "AFFINE";
        case OP_AFFINE_DEC: return "AFFINE_DEC";
        case OP_SHA256: return "SHA256";
        default: return "UNKNOWN";
    }
}

// ============================================================================
// BYTECODE GENERATOR (THE ASSEMBLER)
// ============================================================================

// The final, executable payload that will be handed to the Virtual Machine
vector<Instr> bytecode;

/*
 * generateBytecode() iterates through the optimized IR and performs a strict 
 * 1-to-1 mapping. It converts the slow `string` operators into fast `enum` 
 * operators, and reshuffles the arguments to match the VM's hardware architecture.
 */
void generateBytecode() {
    for (auto &i : irCode) {

        // --- MEMORY OPERATIONS ---
        // Notice the parameter shuffle! IR is {op, arg1, arg2, result}.
        // Bytecode is {OpCode, destination, source, extra}.
        // We map i.result to dst, and i.arg1 to src.
        if (i.op == "LOAD")
            bytecode.push_back({OP_LOAD, i.result, i.arg1, ""});

        else if (i.op == "STORE")
            bytecode.push_back({OP_STORE, i.result, i.arg1, ""});

        else if (i.op == "LOAD_VAR")
            bytecode.push_back({OP_LOAD_VAR, i.result, i.arg1, ""});

        else if (i.op == "LOAD_NUM")
            bytecode.push_back({OP_LOAD_NUM, i.result, i.arg1, ""});

        else if (i.op == "CAESAR")
            bytecode.push_back({OP_CAESAR, i.result, i.arg1, i.arg2});

        else if (i.op == "PRINT")
            // Print doesn't have a destination, so dst is empty.
            bytecode.push_back({OP_PRINT,"", i.arg1, ""});

        // --- MATH OPERATIONS ---
        else if (i.op == "+")
            bytecode.push_back({OP_ADD, i.result, i.arg1, i.arg2});

        else if (i.op == "-")
            bytecode.push_back({OP_SUB, i.result, i.arg1, i.arg2});

        else if (i.op == "*")
            bytecode.push_back({OP_MUL, i.result, i.arg1, i.arg2});

        else if (i.op == "/")
            bytecode.push_back({OP_DIV, i.result, i.arg1, i.arg2});

        // --- RELATIONAL & LOGICAL OPERATIONS ---
        else if (i.op == ">")
            bytecode.push_back({OP_GT, i.result, i.arg1, i.arg2});

        else if (i.op == "<")
            bytecode.push_back({OP_LT, i.result, i.arg1, i.arg2});

        // --- CONTROL FLOW ---
        else if (i.op == "IF_FALSE_GOTO")
        // dst = condition to check, extra = label to jump to
            bytecode.push_back({OP_IF_FALSE_GOTO, i.arg1, "", i.result});

        else if (i.op == "GOTO")
            bytecode.push_back({OP_GOTO, "", "", i.result});

        else if (i.op == "LABEL")
            // Labels don't execute logic, they just mark a spot in memory.
            // We store the label name in 'extra' so the VM can index it.
            bytecode.push_back({OP_LABEL, "", "", i.result});

        else if (i.op == "==")
            bytecode.push_back({OP_EQ, i.result, i.arg1, i.arg2});

        else if (i.op == "!=")
            bytecode.push_back({OP_NEQ, i.result, i.arg1, i.arg2});

        else if (i.op == "<=")
            bytecode.push_back({OP_LTE, i.result, i.arg1, i.arg2});

        else if (i.op == ">=")
            bytecode.push_back({OP_GTE, i.result, i.arg1, i.arg2});


        else if (i.op == "&&")
            bytecode.push_back({OP_AND, i.result, i.arg1, i.arg2});

        else if (i.op == "||")
            bytecode.push_back({OP_OR, i.result, i.arg1, i.arg2});


        else if (i.op == "TO_BOOL")
        bytecode.push_back({OP_TO_BOOL, i.result, i.arg1, ""});

        // --- FUNCTIONS & SCOPE ---
        else if (i.op == "CALL")
    bytecode.push_back({OP_CALL, i.arg1, "", ""});


        else if (i.op == "RET")
        bytecode.push_back({OP_RET, i.arg1, "", ""});


        else if (i.op == "POP_PARAM")
        bytecode.push_back({OP_POP_PARAM, i.result, "", ""});

        else if (i.op == "PARAM")
        // CLEVER HACK: Instead of a dedicated PARAM instruction, you tell the VM 
            // to literally just STORE the variable into a special "__param" register!
        bytecode.push_back({OP_STORE, "__param", i.arg1, ""});


        // --- CRYPTOGRAPHY HARDWARE MAPPING ---
        else if (i.op == "ATBASH")
        bytecode.push_back({OP_ATBASH, i.result, i.arg1, ""});

        else if (i.op == "BINARY")
        bytecode.push_back({OP_BINARY, i.result, i.arg1, ""});

        else if (i.op == "BINARY_DEC")
        bytecode.push_back({OP_BINARY_DEC, i.result, i.arg1, ""});


        else if (i.op == "MORSE")
        bytecode.push_back({OP_MORSE, i.result, i.arg1, ""});

        else if (i.op == "MORSE_DEC")
        bytecode.push_back({OP_MORSE_DEC, i.result, i.arg1, ""});


        else if (i.op == "BASE64")
        bytecode.push_back({OP_BASE64, i.result, i.arg1, ""});

        else if (i.op == "BASE64_DEC")
        bytecode.push_back({OP_BASE64_DEC, i.result, i.arg1, ""});


        else if (i.op == "VIGENERE")
        bytecode.push_back({OP_VIGENERE, i.result, i.arg1, i.arg2});

        else if (i.op == "VIGENERE_DEC")
        bytecode.push_back({OP_VIGENERE_DEC, i.result, i.arg1, i.arg2});


        else if (i.op == "AFFINE")
        bytecode.push_back({OP_AFFINE, i.result, i.arg1, i.arg2});

        else if (i.op == "AFFINE_DEC")
        bytecode.push_back({OP_AFFINE_DEC, i.result, i.arg1, i.arg2});

        else if (i.op == "SHA256")
        bytecode.push_back({OP_SHA256, i.result, i.arg1, ""});

        }
        
}



// ============================================================================
// THE VIRTUAL MACHINE (RUNTIME ENGINE)
// ============================================================================

/*
 * The Virtual Machine (VM) is the "CPU" of your programming language.
 * It does not look at Parse Trees or Tokens. It simply loops through the 
 * `bytecode` vector, executing the operations blindly and as fast as possible.
 */

// paramStack holds data being passed *into* a function.
stack<string> paramStack;

// The VM Hashmap is the actual RAM (Random Access Memory) of your running program.
// It maps variable names (like "counter") to their current runtime value ("5").
unordered_map<string, string> VM;

void runVM() {
    cout << "\n=== Bytecode Execution ===\n";


    //  THE BYTECODE BRIDGE 
    cout << "\n[BYTECODE_START]\n";
    cout << "=========================================================\n";
    cout << "  PC   |  OPCODE         |  DEST       |  SRC / EXTRA    \n";
    cout << "=========================================================\n";
    for (size_t i = 0; i < bytecode.size(); i++) {
        // Force RIGHT alignment and '0' fill just for the Hex number
        cout << " 0x" << right << setfill('0') << setw(2) << hex << i << "  |  ";
        
        // IMMEDIATELY switch back to LEFT alignment and SPACE fill for the text!
        cout << left << setfill(' ') << setw(13) << getOpcodeName(bytecode[i].op) << " |  ";
        cout << setw(9) << bytecode[i].dst << "  |  ";
        
        string src_extra = bytecode[i].src;
        if (bytecode[i].extra != "") {
            src_extra += " " + bytecode[i].extra;
        }
        cout << src_extra << "\n";
    }
    cout << "[BYTECODE_END]\n";
    cout << dec; // Reset cout back to decimal mode!
    //  END BYTECODE BRIDGE 

    // --- NEW: Buffer output so it doesn't interrupt the JSON ---
    string consoleOutput = "";
    string traceOutput = "\n[TRACE_START]\n[\n";
    bool firstTrace = true;

    // --- PASS 1: The Jump Table ---
    // Before executing anything, we scan the bytecode to find every OP_LABEL.
    // We record the exact index (pc) of each label so OP_GOTO knows where to jump.
    unordered_map<string, int> labelPos;

    for (int i = 0; i < bytecode.size(); i++) {
        if (bytecode[i].op == OP_LABEL)
            labelPos[bytecode[i].extra] = i;
    }

    // --- PASS 2: Execution Loop ---
    // 'pc' stands for Program Counter. It tracks which instruction we are on.
    for (size_t pc = 0; pc < bytecode.size(); pc++) {
        auto &ins = bytecode[pc];

        // Safe fetch helper: If `key` is a variable name, pull its value from Memory.
        // If it isn't in memory, assume it's a raw number generated by the Optimizer.
        auto val = [&](string key) {
            return VM.count(key) ? VM[key] : key;
        };

        // --- Memory Operations ---
        if (ins.op == OP_LOAD) {

            // Strip the quotes off string literals (e.g., "\"hello\"" -> "hello")
            if (ins.src.size() >= 2)
                VM[ins.dst] = ins.src.substr(1, ins.src.size() - 2);
            else
                VM[ins.dst] = ins.src;
        }
        else if (ins.op == OP_LOAD_VAR) VM[ins.dst] = VM[ins.src];
        else if (ins.op == OP_LOAD_NUM) VM[ins.dst] = ins.src;
        else if (ins.op == OP_CAESAR) {
            if (!VM.count(ins.src)) throw runtime_error("Encrypt expects string");
            VM[ins.dst] = caesarEncrypt(VM[ins.src], stoi(ins.extra));
        }

        // --- Output ---
        else if (ins.op == OP_PRINT) {
            // Buffer to string instead of cout!
            if (VM.count(ins.src)) consoleOutput += "Output: " + VM[ins.src] + "\n";
            else consoleOutput += "Output: " + ins.src + "\n";
        }

        // --- Math & Logic ---
        else if (ins.op == OP_ADD) VM[ins.dst] = to_string(stoi(val(ins.src)) + stoi(val(ins.extra)));
        else if (ins.op == OP_SUB) VM[ins.dst] = to_string(stoi(val(ins.src)) - stoi(val(ins.extra)));
        else if (ins.op == OP_MUL) VM[ins.dst] = to_string(stoi(val(ins.src)) * stoi(val(ins.extra)));
        else if (ins.op == OP_DIV) VM[ins.dst] = to_string(stoi(val(ins.src)) / stoi(val(ins.extra)));
        else if (ins.op == OP_GT)  VM[ins.dst] = (stoi(val(ins.src)) > stoi(val(ins.extra))) ? "1" : "0";
        else if (ins.op == OP_LT)  VM[ins.dst] = (stoi(val(ins.src)) < stoi(val(ins.extra))) ? "1" : "0";
        else if (ins.op == OP_IF_FALSE_GOTO) {

            // If the condition evaluated to 0 (False), manually change the Program Counter.
            // (We subtract 1 because the for-loop will immediately add 1 at the end of this cycle)
            if (val(ins.dst) == "0") pc = labelPos[ins.extra] - 1; 
        }

        // --- Control Flow (Jumps & Function Calls) ---
        else if (ins.op == OP_GOTO) pc = labelPos[ins.extra] - 1;
        else if (ins.op == OP_EQ)  VM[ins.dst] = (val(ins.src) == val(ins.extra)) ? "1" : "0";
        else if (ins.op == OP_NEQ) VM[ins.dst] = (val(ins.src) != val(ins.extra)) ? "1" : "0";
        else if (ins.op == OP_LTE) VM[ins.dst] = (stoi(val(ins.src)) <= stoi(val(ins.extra))) ? "1" : "0";
        else if (ins.op == OP_GTE) VM[ins.dst] = (stoi(val(ins.src)) >= stoi(val(ins.extra))) ? "1" : "0";
        else if (ins.op == OP_AND) VM[ins.dst] = (val(ins.src) != "0" && val(ins.extra) != "0") ? "1" : "0";
        else if (ins.op == OP_OR)  VM[ins.dst] = (val(ins.src) != "0" || val(ins.extra) != "0") ? "1" : "0";
        else if (ins.op == OP_TO_BOOL) VM[ins.dst] = (val(ins.src) != "0") ? "1" : "0";
        else if (ins.op == OP_CALL) {
            
            // 1. Save the current state of memory (so local variables aren't overwritten)
            callStack.push(VM);
            // 2. Save the current line of code so we know where to come back to
            returnAddr.push(pc);
            // 3. Jump to the function's label
            pc = labelPos[ins.dst] - 1;
            // 4. Give the function a clean, empty RAM block to work with
            VM.clear();
            VM["__ret"] = "";
        }
        else if (ins.op == OP_RET) {
            string retVal = VM.count(ins.dst) ? VM[ins.dst] : ins.dst;

            // Restore the caller's memory block and jump back to the saved line of code
            auto caller = callStack.top(); callStack.pop();
            pc = returnAddr.top(); returnAddr.pop();

            // Pass the calculated answer back to the caller
            caller["__ret"] = retVal;
            VM = caller;
        }

        // --- Parameter Handling ---
        else if (ins.op == OP_POP_PARAM) {
            VM[ins.dst] = paramStack.top(); paramStack.pop();
        }
        else if (ins.op == OP_STORE) {
            string valueToStore = VM.count(ins.src) ? VM[ins.src] : ins.src;

            // The HACK we built earlier: intercepting stores to __param
            if (ins.dst == "__param") paramStack.push(valueToStore);
            else VM[ins.dst] = valueToStore;
        }

        // --- Hardware Crypto Acceleration ---
        // These call out to your C++ Crypto Library to do the heavy mathematical lifting.
        else if (ins.op == OP_ATBASH) VM[ins.dst] = atbashEncrypt(VM[ins.src]);
        else if (ins.op == OP_BINARY) VM[ins.dst] = binaryEncrypt(VM[ins.src]);
        else if (ins.op == OP_BINARY_DEC) VM[ins.dst] = binaryDecrypt(VM[ins.src]);
        else if (ins.op == OP_MORSE)  VM[ins.dst] = morseEncrypt(VM[ins.src]);
        else if (ins.op == OP_MORSE_DEC) VM[ins.dst] = morseDecrypt(VM[ins.src]);
        else if (ins.op == OP_BASE64) VM[ins.dst] = base64Encrypt(VM[ins.src]);
        else if (ins.op == OP_BASE64_DEC) VM[ins.dst] = base64Decrypt(VM[ins.src]);
        else if (ins.op == OP_VIGENERE) VM[ins.dst] = vigenereEncrypt(VM[ins.src], ins.extra);
        else if (ins.op == OP_VIGENERE_DEC) VM[ins.dst] = vigenereDecrypt(VM[ins.src], ins.extra);
        else if (ins.op == OP_AFFINE) {
            int comma = ins.extra.find(',');
            VM[ins.dst] = affineEncrypt(VM[ins.src], stoi(ins.extra.substr(0, comma)), stoi(ins.extra.substr(comma + 1)));
        }
        else if (ins.op == OP_AFFINE_DEC) {
            int comma = ins.extra.find(',');
            VM[ins.dst] = affineDecrypt(VM[ins.src], stoi(ins.extra.substr(0, comma)), stoi(ins.extra.substr(comma + 1)));
        }
        else if (ins.op == OP_SHA256) VM[ins.dst] = sha256(VM[ins.src]);

        // Record Memory Snapshot
        if (!firstTrace) traceOutput += ",\n";
        firstTrace = false;

        traceOutput += "{ \"memory\": {";
        bool firstMem = true;
        for (auto const& pair : VM) {
            string key = pair.first;
            string val = pair.second;
            if (key.size() > 0 && key[0] == 't' && isdigit(key[1])) continue;
            if (key == "__ret" || key == "__param") continue;

            if (!firstMem) traceOutput += ",";
            traceOutput += "\"" + escapeJSON(key) + "\":\"" + escapeJSON(val) + "\"";
            firstMem = false;
        }
        traceOutput += "} }";
    }

    traceOutput += "\n]\n[TRACE_END]\n";

    // Print buffered console output first, then the JSON trace!
    cout << consoleOutput;
    cout << traceOutput;
}


// ============================================================================
// SEMANTIC ANALYZER (COMPILE-TIME SAFETY CHECKS)
// ============================================================================

/*
 * semanticAnalysis() runs BEFORE the bytecode is generated. 
 * It traverses the Parse Tree and tries to find logical errors, like using a 
 * variable before declaring it, or trying to pass 5 arguments to a function 
 * that only expects 2.
 */
void semanticAnalysis(PTNode* node) {
    if (!node) return;

    // --- Check Variable Declarations ---
    if (node->label == "LetStmt") {
    //string name = node->children[0]->label;
    string name = node->children[0]->label.substr(6);
    string type = node->children[1]->label;

    // Register the variable's type so we can type-check it later
    varTable[name] = type;

    // analyze RHS only
    semanticAnalysis(node->children[1]);

    return; //  stop further traversal
}

    // --- Check Function Declarations & Signatures ---
    else if (node->label == "FuncDef") {
    string fname = node->children[0]->label;
    int paramCount = node->children[1]->children.size();
    
    // Register the expected number of arguments for this function
        funcTable[fname] = paramCount;

    // Save the outer scope (globals) so we don't pollute it
        unordered_map<string, string> oldVars = varTable;

    // Register the function parameters as valid local variables
        for (auto p : node->children[1]->children)
            varTable[p->label] = "param";

    // Traverse the function body
    for (size_t i = 2; i < node->children.size(); i++) {
        semanticAnalysis(node->children[i]);
    }

    // Check Return Types (Make sure the function always returns the same type)
        string detectedType = "";

for (size_t i = 2; i < node->children.size(); i++) {
    if (node->children[i]->label == "ReturnStmt") {
        PTNode* val = node->children[i]->children[0];
        string returnType = val->label;

        if (returnType == "Var") {
            string varName = val->children[0]->label;
            if (varTable.count(varName))
                returnType = varTable[varName];
        }

        if (detectedType == "")
            detectedType = returnType;
        else if (detectedType != returnType)
            cout << "[Type Error] Conflicting return types in function " << fname << endl;
    }
}

if (detectedType != "")
    funcReturnType[fname] = detectedType;

    // Restore the global scope
    varTable = oldVars;

    return; // correct place
}

    // --- Check Function Calls ---
    else if (node->label == "FuncCall") {
    string fname = node->children[0]->label;

    // Did they call a function that doesn't exist?
    if (funcTable.find(fname) == funcTable.end()) {
        cout << "[Semantic Error] Undefined function: " << fname << endl;
    } else {

        // Did they pass the correct number of arguments?
        int expected = funcTable[fname];
        int given = node->children[1]->children.size();

        if (expected != given) {
            cout << "[Semantic Error] Function '" << fname 
                 << "' expects " << expected 
                 << " args, but got " << given << endl;
        }
    }
}



    // --- Check Variable Usage ---
    else if (node->label == "Var") {
        string name = node->children[0]->label;
        if (varTable.find(name) == varTable.end()) {
            cout << "[Semantic Error] Undefined variable: " << name << endl;
        }
    }

    // --- Check Type Safety (Cryptography constraints) ---
    else if (node->label == "EncryptExpr") {
    PTNode* val = node->children[0];

    if (val->label == "Var") {
        string name = val->children[0]->label;

        if (varTable.find(name) != varTable.end()) {
            // Ensure they are only encrypting Strings (or unknown function parameters)
                if (varTable[name] != "String" && varTable[name] != "param") {
                    cout << "[Type Error] encrypt expects string, got "
                         << varTable[name] << ": " << name << endl;
            }
        }
    } 
    else if (val->label == "Number") {
        // Catch raw numbers being encrypted: `encrypt 5;`
        cout << "[Type Error] encrypt cannot be applied to number" << endl;
    }
}

    // Keep traversing down the tree
    for (auto child : node->children)
        semanticAnalysis(child);
}

vector<Token> tokenize(const string& source) {
    Lexer lexer(source);
    vector<Token> tokens;

    while (true) {
        Token t = lexer.next();
        tokens.push_back(t);
        if (t.type == TOK_EOF) break;
    }

    return tokens;
}


vector<Token> runLexical(const string& source) {
    cout << "\n=== LEXICAL ANALYSIS ===\n";
    lexicalOutput = "";
    vector<Token> tokens = tokenize(source);

    for (auto &t : tokens) {
        //cout << tokenName(t.type) << " : " << t.value << endl;
        string line = tokenName(t.type) + " : " + t.value;

    cout << line << endl;        // terminal
    lexicalOutput += line + "\n"; // store for UI
    }

    return tokens;
}




enum ParserType {
    RECURSIVE_DESCENT,
    LL1,
    SLR1,
    LR0,
    LALR1,
    CLR,
    OPERATOR_PRECEDENCE,
    SHIFT_REDUCE
};






// ============================================================================
// PARSER FACTORY (CREATIONAL DESIGN PATTERN)
// ============================================================================

/*
 * createParser uses the "Factory Pattern". Instead of `main()` needing to know 
 * the exact class names and setup routines for 10 different parsers, it just 
 * asks the factory: "Give me an SLR1 parser!" and the factory returns a generic 
 * IParser pointer.
 */
IParser* createParser(ParserType type) {

    switch (type) {
        case RECURSIVE_DESCENT:
            return new RDParserAdapter();

        // Placeholders for future expansion!
        case LL1:
            return nullptr;
        case SLR1:
        case LR0:
        case LALR1:
        case CLR:
        case OPERATOR_PRECEDENCE:
        case SHIFT_REDUCE:
            cout << "Parser not implemented yet, using RD\n";
            return new RDParserAdapter();

        default:
            return new RDParserAdapter();
    }
}

// Interactive CLI menus for selecting the compiler's behavior
ParserType chooseParser() {
    int category, choice;

    cout << "\n=== SELECT PARSER TYPE ===\n";
    cout << "1. Top-Down\n";
    cout << "2. Bottom-Up\n";
    cout << "Enter choice: ";
    cin >> category;

    if (category == 1) {
        cout << "\nTop-Down Parsers:\n";
        cout << "1. Recursive Descent\n";
        cout << "2. LL(1)\n";
        cout << "Enter choice: ";
        cin >> choice;

        if (choice == 1) return RECURSIVE_DESCENT;
        if (choice == 2) return LL1;
    }

    else if (category == 2) {
        cout << "\nBottom-Up Parsers:\n";
        cout << "1. Shift Reduce\n";
        cout << "2. Operator Precedence\n";
        cout << "3. LR(0)\n";
        cout << "4. SLR(1)\n";
        cout << "5. LALR(1)\n";
        cout << "6. CLR\n";
        cout << "Enter choice: ";
        cin >> choice;

        switch (choice) {
            case 1: return SHIFT_REDUCE;
            case 2: return OPERATOR_PRECEDENCE;
            case 3: return LR0;
            case 4: return SLR1;
            case 5: return LALR1;
            case 6: return CLR;
        }
    }

    cout << "Invalid choice. Defaulting to Recursive Descent.\n";
    return RECURSIVE_DESCENT;
}



// ============================================================================
// PIPELINE STAGES
// ============================================================================

/*
 * STAGE 1: SYNTAX ANALYSIS
 * Takes the raw Tokens and attempts to build the Abstract Syntax Tree.
 */
PTNode* runSyntax(vector<Token>& tokens, ParserType type, GrammarType selectedGrammar) {
    cout << "\n=== SYNTAX ANALYSIS ===\n";

    PTNode* root = nullptr;

if (type == LL1) {
        LL1Parser parser(tokens);
        // Parse the raw expression
        PTNode* exprRoot = parser.parseWithGrammar(selectedGrammar);
        
        // --- THE WRAPPER FIX ---
        // LL(1) only parses raw math equations (like `5 + 10`). But the rest of your 
        // compiler expects full statements! We dynamically wrap the math equation inside 
        // a `PrintStmt` node, and wrap THAT inside a `Program` node so the backend 
        // can successfully execute it.
        PTNode* printNode = new PTNode("PrintStmt");
        printNode->children.push_back(exprRoot);
        
        // Wrap the PrintStmt in a Program root so the execution engine starts
        root = new PTNode("Program");
        root->children.push_back(printNode);
    }
    
else {
    IParser* parser = createParser(type);
    root = parser->parse(tokens);
    delete parser;
}

    cout << "\n--- Parse Tree ---\n";
    printTree(root);

    return root;
}



/*
 * STAGE 2: INTERMEDIATE CODE GENERATION (ICG)
 * Converts the Tree into flat Three-Address Code.
 */
void runICG(PTNode* root) {
    if (!root) return;

    // If the root is NOT a "Program" (meaning it came from the LL1 parser as a raw expression)
    if (root->label != "Program") {
        // Evaluate the raw expression to generate TAC temporaries
        string finalTemp = genExprTAC(root);
        
        // Manually push a PRINT instruction to the IR so the Virtual Machine outputs the answer
        irCode.push_back({"PRINT", finalTemp, "", ""});
    } 
    // Otherwise, handle it like a normal Recursive Descent program
    else {
        generateTAC(root);
    }

    cout << "\n=== INTERMEDIATE CODE GENERATION ===\n";
    printTAC();
}

/*
 * STAGE 3: CODE GENERATION & EXECUTION
 * Assembles the IR into Bytecode and boots up the Virtual Machine.
 */
void runCodegen() {
    cout << "\n=== TARGET CODE GENERATION ===\n";

    generateBytecode();

    cout << "\n--- Execution ---\n";
    runVM();
}

/*
 * STAGE 4: SEMANTIC ANALYSIS
 * Checks for variable scope and type errors, then exports the JSON Symbol Table.
 */
void runSemantic(PTNode* root) {
    cout << "\n=== SEMANTIC ANALYSIS ===\n";

    varTable.clear();
    funcTable.clear();
    funcReturnType.clear(); 

    // Run the actual analysis
    semanticAnalysis(root); 

    // --- NEW: Output Symbol Table as JSON ---
    cout << "\n[SYMTAB_START]\n{\n";
    
    // 1. Export Variables
    cout << "  \"variables\": [\n";
    bool firstVar = true;
    for (auto const& pair : varTable) {
        if (!firstVar) cout << ",\n";
        cout << "    { \"name\": \"" << escapeJSON(pair.first) 
             << "\", \"type\": \"" << escapeJSON(pair.second) << "\" }";
        firstVar = false;
    }
    cout << "\n  ],\n";

    // 2. Export Functions
    cout << "  \"functions\": [\n";
    bool firstFunc = true;
    for (auto const& pair : funcTable) {
        if (!firstFunc) cout << ",\n";
        string rType = funcReturnType.count(pair.first) ? funcReturnType[pair.first] : "Void";
        cout << "    { \"name\": \"" << escapeJSON(pair.first) 
             << "\", \"params\": " << pair.second 
             << ", \"returnType\": \"" << escapeJSON(rType) << "\" }";
        firstFunc = false;
    }
    cout << "\n  ]\n";

    cout << "}\n[SYMTAB_END]\n";
}

// Console logs for the Optimizer
void runOptimization() {
    cout << "\n=== CODE OPTIMIZATION ===\n";
    //cout << "(Not implemented yet)\n";
    cout << ">> Constant Folding applied.\n";
    cout << ">> Dead Code Elimination applied.\n";
}




// Debugging utility to print raw IR
void printIR() {
    for (auto &i : irCode) {
        cout << i.op << " " << i.arg1 << " " << i.arg2 << " -> " << i.result << endl;
    }
}




GrammarType chooseGrammar() {
    int choice;
    cout << "\nChoose Grammar:\n";
    cout << "1. Arithmetic\n";
    cout << "2. Boolean\n";
    cin >> choice;

    if (choice == 2) return BOOLEAN;
    return ARITHMETIC;
}


// ============================================================================
// DATA EXPORTERS (THE FRONTEND API)
// ============================================================================

/*
 * printTreeJSON recursively converts your C++ PTNode pointers into a nested JSON 
 * object. This is what powers the D3.js Tree visualization on your website!
 */
void printTreeJSON(PTNode* node) {
    if (!node) return;

    cout << "{";
    cout << "\"name\":\"" << escapeJSON(node->label) << "\"";

    if (!node->children.empty()) {
        cout << ",\"children\":[";
        for (size_t i = 0; i < node->children.size(); i++) {
            printTreeJSON(node->children[i]);
            if (i != node->children.size() - 1)
                cout << ",";
        }
        cout << "]";
    }

    cout << "}";
}


/*
 * CONTROL FLOW GRAPH (CFG) GENERATOR
 * This algorithm groups raw, flat instructions into isolated "Blocks", and then 
 * draws lines (Edges) between the blocks based on where the GOTO instructions jump.
 */
struct BasicBlock {
    int id;
    vector<IR> instrs;
    vector<int> successors;
};

void printCFGJSON() {
    if (irCode.empty()) return;

    vector<BasicBlock> blocks;
    BasicBlock currentBlock;
    currentBlock.id = 0;

    unordered_map<string, int> labelToBlock;  // Maps "L1" to Block ID 0

    // --- STEP 1: GROUP INSTRUCTIONS INTO BLOCKS ---
    for (size_t i = 0; i < irCode.size(); i++) {
        auto& ins = irCode[i];

        // A new LABEL means a jump target, so we MUST start a new block!
        if (ins.op == "LABEL") {
            if (!currentBlock.instrs.empty()) {
                blocks.push_back(currentBlock);
                currentBlock = BasicBlock();
                currentBlock.id = blocks.size();
            }
            labelToBlock[ins.result] = currentBlock.id;
        }

        currentBlock.instrs.push_back(ins);

        // A jump (GOTO/RET) means control flow is leaving this area, 
        // so we MUST end the current block!
        if (ins.op == "GOTO" || ins.op == "IF_FALSE_GOTO" || ins.op == "RET") {
            blocks.push_back(currentBlock);
            currentBlock = BasicBlock();
            currentBlock.id = blocks.size();
        }
    }
    if (!currentBlock.instrs.empty()) blocks.push_back(currentBlock);

    // --- STEP 2: LINK THE BLOCKS (CALCULATE EDGES) ---
    for (size_t i = 0; i < blocks.size(); i++) {
        if (blocks[i].instrs.empty()) continue;

        // Anchor functions by drawing a line from the CALL instruction! ---
        for (auto& ins : blocks[i].instrs) {
            if (ins.op == "CALL" && labelToBlock.count(ins.arg1)) {
                blocks[i].successors.push_back(labelToBlock[ins.arg1]);
            }
        }
        // --------------------------------------------------------------------------

        auto& lastIns = blocks[i].instrs.back();

        // Unconditional Jump (Always goes to the target)
        if (lastIns.op == "GOTO") {
            if (labelToBlock.count(lastIns.result))
                blocks[i].successors.push_back(labelToBlock[lastIns.result]);
        }

        // Conditional Jump (Can go to the target, OR fall through to the next block)
        else if (lastIns.op == "IF_FALSE_GOTO") {
            if (labelToBlock.count(lastIns.result))
                blocks[i].successors.push_back(labelToBlock[lastIns.result]);
            if (i + 1 < blocks.size()) blocks[i].successors.push_back(i + 1); // Fallthrough
        }

        // Normal Execution (Just proceeds to the next block sequentially)
        else if (lastIns.op != "RET" && i + 1 < blocks.size()) {
            blocks[i].successors.push_back(i + 1); // Normal fallthrough
        }
    }

    // --- STEP 3: OUTPUT D3.js COMPATIBLE JSON ---
    cout << "\n[CFG_START]\n{\"nodes\": [";
    for (size_t i = 0; i < blocks.size(); i++) {
        cout << "{\"id\": \"block" << blocks[i].id << "\", \"label\": \"";
        for (auto& ins : blocks[i].instrs) {

            // Reconstruct the IR string
            string line = ins.op;
            if (ins.arg1 != "") line += " " + ins.arg1;
            if (ins.arg2 != "") line += " " + ins.arg2;
            if (ins.result != "") line += " -> " + ins.result;
            cout << escapeJSON(line) << "\\n";
        }
        cout << "\"}";
        if (i < blocks.size() - 1) cout << ",";
    }

    // Output Links
    cout << "], \"links\": [";
    bool firstLink = true;
    for (size_t i = 0; i < blocks.size(); i++) {
        for (int succ : blocks[i].successors) {
            if (!firstLink) cout << ",";
            cout << "{\"source\": \"block" << blocks[i].id << "\", \"target\": \"block" << succ << "\"}";
            firstLink = false;
        }
    }
    cout << "]}\n[CFG_END]\n";
}





// ============== 
// MAIN FUNC
// ==============
int main() {

    ParserType selectedParser = chooseParser();

GrammarType selectedGrammar = ARITHMETIC; // default

if (selectedParser == LL1) {
    selectedGrammar = chooseGrammar();
}

    cin.ignore();   // Clear buffer to prepare for text input

    string source, line;

    // Read the script from Node.js standard input
    cout << "\nEnter source code (type END on new line to finish):\n";

while (true) {
    getline(cin, line);
    if (line == "END") break;
    source += line + "\n";
}

    // --- THE COMPILER PIPELINE ---
    
    // 1. Lexer (Text -> Tokens)
    vector<Token> tokens = runLexical(source);
    cout << "\n[LEXICAL_OUTPUT_START]\n";
    cout << lexicalOutput;
    cout << "[LEXICAL_OUTPUT_END]\n";
    
    // 2. Parser (Tokens -> AST)
    PTNode* root = runSyntax(tokens, selectedParser, selectedGrammar);
    cout << "\n[TREE_START]\n";
    printTreeJSON(root);
    cout << "\n[TREE_END]\n";

    // 3. Semantic Analysis (AST -> Safety/Type Checking)
    runSemantic(root);
    irCode.clear();
    bytecode.clear();

    // 4. ICG (AST -> Unoptimized IR)
    runICG(root);
    
    cout << "\n=== IR BEFORE OPT ===\n";
    printIR();

    // 5. Optimizer (IR -> Faster IR)
    optimizeIR();  
    deadCodeElimination();

    cout << "\n=== IR AFTER OPT ===\n";
    printIR();

    // 6. Visualization (Generate CFG for the UI)
    printCFGJSON();
    runOptimization();

    // 7. Assembler & VM (IR -> Bytecode -> Execution)
    runCodegen();

    return 0;
}