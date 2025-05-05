/**
 * Auto-dosing service for fertilizers based on EC readings
 */

const ActuatorController = require('../controllers/ActuatorController');
const { Actuator } = require('../models/Actuator');
const autoDosingLogger = require('../utils/autoDosingLogger');
const fs = require('fs').promises;
const path = require('path');

// Add state persistence path
const AUTO_DOSING_STATE_FILE = path.join(__dirname, '../data/autoDosing-state.json');

let autoDoseConfig = null;
let ecCheckTimer = null;

// Initialize auto-dosing system
const initializeAutoDosing = () => {
  autoDosingLogger.info('Auto-dosing service initialized');
  
  // Ensure data directory exists
  ensureDataDirectoryExists();
  
  // Set up global variables for access
  global.autoDoseConfig = autoDoseConfig;
  global.ecCheckTimer = ecCheckTimer;
};

// Disable auto-dosing
const disableAutoDosing = () => {
  if (global.ecCheckTimer) {
    clearTimeout(global.ecCheckTimer);
    global.ecCheckTimer = null;
  }
  
  if (global.autoDoseConfig) {
    global.autoDoseConfig.enabled = false;
  }
  
  console.log('Auto-dosing disabled');
};

// Function to calculate fertilizer amount for a target EC increase
const calculateFertilizerAmountForEC = async (fertilizerPumpId, targetECIncrease) => {
  try {
    // Get fertilizer pump data including flow rate and ratio information
    const pump = await Actuator.findOne({ id: fertilizerPumpId });
    if (!pump) {
      throw new Error(`Fertilizer pump ${fertilizerPumpId} not found`);
    }
    
    // Get current water volume from sensors (implement this)
    const waterVolume = 100; // Default 100L if not available from sensors
    
    // Calculate ratio from pump settings
    const fertilizerAmount = pump.fertilizerAmount || 1.0;
    const waterAmount = pump.waterAmount || 1.0;
    const ratio = fertilizerAmount / waterAmount;
    
    // Calculate required amount based on target EC increase
    const ecFactor = 0.25; // This should be calibrated for your fertilizers
    const amount = (targetECIncrease / ecFactor) * waterVolume * ratio;
    
    // Ensure reasonable limits and round to nearest mL
    const finalAmount = Math.min(50, Math.max(1, Math.round(amount)));
    
    // Calculate how long the pump should run based on flow rate
    const flowRate = pump.flowRate || 1.0; // mL per second
    const durationSeconds = Math.max(1, Math.ceil(finalAmount / flowRate));
    
    return {
      amount: finalAmount,
      durationSeconds: durationSeconds
    };
  } catch (error) {
    console.error('Error calculating fertilizer amount:', error);
    return { amount: 0, durationSeconds: 0 };
  }
};

// New function to restore auto-dosing state from file
const restoreAutoDosingState = async () => {
  try {
    // Check if state file exists
    try {
      await fs.access(AUTO_DOSING_STATE_FILE);
    } catch (err) {
      autoDosingLogger.info('No auto-dosing state file found, starting fresh');
      return false;
    }
    
    // Read state file
    const stateData = await fs.readFile(AUTO_DOSING_STATE_FILE, 'utf8');
    const savedState = JSON.parse(stateData);
    
    // Validate saved state
    if (!savedState || !savedState.active || !savedState.targetEC) {
      autoDosingLogger.info('Invalid or inactive saved auto-dosing state, not restoring');
      return false;
    }
    
    // Check if state is recent (within last 24 hours)
    const stateTimestamp = new Date(savedState.timestamp || 0);
    const now = new Date();
    const hoursSinceSaved = (now.getTime() - stateTimestamp.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceSaved > 24) {
      autoDosingLogger.info(`Auto-dosing state is ${hoursSinceSaved.toFixed(1)} hours old, not restoring`);
      return false;
    }
    
    // Restore auto-dosing with saved settings
    autoDosingLogger.info(`Restoring auto-dosing with target EC: ${savedState.targetEC}`);
    
    // Get fertilizer pumps
    const fertilizerPumps = await Actuator.find({ type: 'fertilizer-pump' }).lean();
    
    // Start auto-dosing with saved settings
    await ActuatorController.setupAutoFertilizerDosing({
      targetEC: savedState.targetEC,
      checkInterval: savedState.checkInterval || 300,
      dispensingDelay: savedState.dispensingDelay || 5,
      waterVolume: savedState.waterVolume || 100,
      currentEC: null, // Let it fetch the current EC
      fertilizers: savedState.fertilizers || fertilizerPumps.map(pump => ({
        id: pump.id,
        name: pump.name
      }))
    });
    
    autoDosingLogger.info('Auto-dosing state restored successfully');
    return true;
  } catch (error) {
    autoDosingLogger.error(`Error restoring auto-dosing state: ${error.message}`);
    return false;
  }
};

// Save auto-dosing state for persistence
const saveAutoDosingState = async () => {
  try {
    if (!global.autoDosing || !global.autoDosing.active) {
      // If auto-dosing is not active, delete state file if it exists
      try {
        await fs.unlink(AUTO_DOSING_STATE_FILE);
        autoDosingLogger.info('Removed auto-dosing state file (not active)');
      } catch (err) {
        // File probably doesn't exist, that's fine
      }
      return;
    }
    
    // Create state object
    const stateToSave = {
      active: global.autoDosing.active,
      targetEC: global.autoDosing.targetEC,
      checkInterval: global.autoDosing.checkInterval,
      dispensingDelay: global.autoDosing.dispensingDelay,
      waterVolume: global.autoDosing.waterVolume,
      fertilizers: global.autoDosing.fertilizers,
      timestamp: new Date().toISOString()
    };
    
    // Save to file
    await fs.writeFile(AUTO_DOSING_STATE_FILE, JSON.stringify(stateToSave, null, 2));
    autoDosingLogger.info('Auto-dosing state saved to file');
  } catch (error) {
    autoDosingLogger.error(`Error saving auto-dosing state: ${error.message}`);
  }
};

// Ensure data directory exists for state persistence
const ensureDataDirectoryExists = async () => {
  try {
    const dataDir = path.dirname(AUTO_DOSING_STATE_FILE);
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    autoDosingLogger.error(`Error creating data directory: ${error.message}`);
  }
};

module.exports = {
  initializeAutoDosing,
  disableAutoDosing,
  calculateFertilizerAmountForEC,
  restoreAutoDosingState,
  saveAutoDosingState
};
