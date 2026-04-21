const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  // Aiven requires SSL for security, so we add this line:
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = db;
