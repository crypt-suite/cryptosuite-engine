# 1. Start with a blank Linux machine that has Node.js pre-installed
FROM node:18

# 2. Install the C++ Compiler (g++) so the cloud can build your engine
RUN apt-get update && apt-get install -y g++

# 3. Create a folder inside the cloud server to hold your app
WORKDIR /app

# 4. Copy your package files first (this makes future deployments much faster)
COPY package*.json ./

# 5. Install all your Node modules (Express, bcrypt, nodemailer, etc.)
RUN npm install

# 6. Copy the rest of your actual code into the cloud server
COPY . .

# 7. 🌟 THE COMPILER MAGIC: Tell the cloud to compile your C++ file!
# Make sure "your_cpp_file.cpp" matches your actual file name exactly.
RUN g++ -o backend/compiler_engine/lan backend/compiler_engine/lan.cpp

# 8. Open the port that your Node server uses
EXPOSE 3000

# 9. Finally, start your backend server
CMD ["node", "backend/server.js"]