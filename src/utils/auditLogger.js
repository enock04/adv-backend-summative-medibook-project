const fs = require('fs/promises');
const path = require('path');
const config = require('../config');

const logFile = path.resolve(config.auditLogDir, 'audit.log');
let directoryReady = null;

const ensureDirectory = () => {
  if (!directoryReady) {
    directoryReady = fs.mkdir(path.dirname(logFile), { recursive: true }).catch((err) => {
      directoryReady = null;
      throw err;
    });
  }
  return directoryReady;
};

// Appends one JSON line. Never throws: a logging failure must not fail the caller's request.
const logEvent = async (event, details = {}) => {
  try {
    await ensureDirectory();
    const line = JSON.stringify({ timestamp: new Date().toISOString(), event, ...details });
    await fs.appendFile(logFile, `${line}\n`, 'utf8');
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
};

module.exports = { logEvent };
