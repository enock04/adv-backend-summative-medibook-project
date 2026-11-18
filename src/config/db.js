const mysql = require('mysql2/promise');
const config = require('./index');

// dateStrings keeps DATETIME values as 'YYYY-MM-DD HH:mm:ss' strings so no
// timezone conversion happens between MySQL and Node.
const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  decimalNumbers: true,
});

module.exports = pool;
