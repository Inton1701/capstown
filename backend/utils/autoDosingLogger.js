const fs = require('fs');
const path = require('path');

// Move logs directory outside of backend folder to project root
const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'autodosing.log');
const JSON_LOG_FILE = path.join(LOG_DIR, 'autodosing_data.json');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Initialize JSON log if it doesn't exist
if (!fs.existsSync(JSON_LOG_FILE)) {
  fs.writeFileSync(JSON_LOG_FILE, JSON.stringify({
    logs: [],
    errors: []
  }));
}

/**
 * Auto-dosing logger
 * Specialized logger for auto-dosing related activities
 */

const AUTO_DOSING_LOG_PREFIX = '[AUTO-DOSING]';

class AutoDosingLogger {
  info(message) {
    console.log(`${AUTO_DOSING_LOG_PREFIX} ${message}`);
  }
  
  warn(message) {
    console.warn(`${AUTO_DOSING_LOG_PREFIX} WARNING: ${message}`);
  }
  
  error(message) {
    console.error(`${AUTO_DOSING_LOG_PREFIX} ERROR: ${message}`);
  }
  
  logObject(label, obj) {
    console.log(`${AUTO_DOSING_LOG_PREFIX} ${label}:`, JSON.stringify(obj, null, 2));
  }
}

module.exports = new AutoDosingLogger();
