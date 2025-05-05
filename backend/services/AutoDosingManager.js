/**
 * Auto-Dosing Manager
 * Centralized service for managing auto-dosing state and synchronization
 */

const autoDosingLogger = require('../utils/autoDosingLogger');
const websocketService = require('./websocket');

class AutoDosingManager {
  constructor() {
    // Initialize with default state
    this.state = {
      active: false,
      targetEC: null,
      currentEC: null,
      checkInterval: 900, // Default: 15 minutes
      dispensingDelay: 5,
      mixingTime: 300, // Default: 5 minutes of mixing time
      waterVolume: 100,
      fertilizers: [],
      lastCheck: null,
      lastDispensing: null,
      dispensingInProgress: false,
      inMixingPhase: false,
      mixingEndTime: null,
      nextCheckTime: null,
      lastUpdated: Date.now(),
      clients: new Set()
    };
    
    this.checkIntervalId = null;
  }
  
  // Get current auto-dosing state
  getState() {
    return { 
      ...this.state,
      clients: this.state.clients.size, // Only send count of connected clients
      mixingTimeRemaining: this.getMixingTimeRemaining()
    };
  }
  
  // Get remaining mixing time in seconds with more validation
  getMixingTimeRemaining() {
    if (!this.state.inMixingPhase || !this.state.mixingEndTime) {
      return 0;
    }
    
    try {
      const now = Date.now();
      const endTime = new Date(this.state.mixingEndTime).getTime();
      
      if (isNaN(endTime)) {
        autoDosingLogger.warn('Invalid mixing end time');
        return 0;
      }
      
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      
      // Apply a sanity check - maximum 1 hour
      return Math.min(remaining, 3600);
    } catch (error) {
      autoDosingLogger.error(`Error calculating mixing time: ${error.message}`);
      return 0;
    }
  }
  
  // Update state and broadcast changes
  updateState(updates) {
    // Update state
    this.state = {
      ...this.state,
      ...updates,
      lastUpdated: Date.now()
    };
    
    // Broadcast updated state to all clients
    this.broadcastState();
    
    // Log significant state changes
    if (updates.active !== undefined || 
        updates.dispensingInProgress !== undefined ||
        updates.inMixingPhase !== undefined ||
        updates.currentEC !== undefined) {
      autoDosingLogger.info(`Auto-dosing state updated: ${JSON.stringify({
        active: this.state.active,
        dispensing: this.state.dispensingInProgress,
        mixing: this.state.inMixingPhase,
        currentEC: this.state.currentEC,
        targetEC: this.state.targetEC
      })}`);
    }
    
    return this.state;
  }
  
  // Broadcast current state to all clients
  broadcastState() {
    try {
      if (typeof websocketService.broadcastAutoDosingStatus === 'function') {
        websocketService.broadcastAutoDosingStatus(this.getState());
      } else {
        // Log error but don't fail
        autoDosingLogger.warn('broadcastAutoDosingStatus function not available yet - broadcast will be skipped');
      }
    } catch (error) {
      autoDosingLogger.error(`Error broadcasting auto-dosing state: ${error.message}`);
    }
  }
  
  // Modify the start method to handle already active auto-dosing
  start(config) {
    // Check if already active
    if (this.state.active) {
      // Check if force restart is enabled in config
      if (config.forceRestart) {
        autoDosingLogger.info('Auto-dosing is already active - Force restarting with new configuration');
        
        // First stop the current auto-dosing session
        this.stop();
        
        // Short delay to ensure clean state
        setTimeout(() => {
          this._startNewSession(config);
        }, 500);
        
        return { 
          success: true, 
          message: 'Auto-dosing restarted with new configuration' 
        };
      }
      
      autoDosingLogger.warn('Attempted to start auto-dosing while already active');
      return { 
        success: false, 
        message: 'Auto-dosing is already active. Stop current session first or use force restart.' 
      };
    }
    
    // Start a new session if not already active
    return this._startNewSession(config);
  }

  // Helper method to start a new auto-dosing session
  _startNewSession(config) {
    // Validate config
    if (!config.targetEC || !config.mixingTime || !config.fertilizers) {
      return { success: false, message: 'Invalid configuration' };
    }
    
    // Update state with config
    this.updateState({
      active: true,
      targetEC: config.targetEC,
      currentEC: config.currentEC || null,
      // Use mixingTime as the interval for EC checks/dosing cycles
      checkInterval: config.mixingTime || 300,
      dispensingDelay: config.dispensingDelay || 5,
      mixingTime: config.mixingTime || 300,
      waterVolume: config.waterVolume || 100,
      fertilizers: config.fertilizers,
      lastCheck: null,
      lastDispensing: null,
      dispensingInProgress: false,
      inMixingPhase: false,
      mixingEndTime: null,
      nextCheckTime: Date.now() + 1000, // Start first check in 1 second
    });
    
    // Log start
    autoDosingLogger.info(`Auto-dosing started with target EC: ${config.targetEC}`);
    
    return { success: true };
  }
  
  // Stop auto-dosing
  stop() {
    // Only log if we're actually stopping something active
    if (this.state.active) {
      autoDosingLogger.info('Auto-dosing stopped');
    }
    
    // Update state
    this.updateState({
      active: false,
      dispensingInProgress: false,
      inMixingPhase: false,
      mixingEndTime: null
    });
    
    return { success: true, message: 'Auto-dosing stopped' };
  }
  
  // Set dispensing status
  setDispensing(isDispensing, completed = false) {
    this.updateState({ dispensingInProgress: isDispensing });
    
    if (isDispensing) {
      autoDosingLogger.info('Auto-dosing dispensing started');
    } else if (completed) {
      // When dispensing completes, enter mixing phase with valid time calculation
      const mixingTimeSeconds = this.state.mixingTime || 300; // Default to 5 minutes
      const mixingEndTime = Date.now() + (mixingTimeSeconds * 1000);
      
      this.updateState({ 
        inMixingPhase: true,
        mixingEndTime: mixingEndTime,
        nextCheckTime: mixingEndTime // Next check is after mixing is complete
      });
      
      autoDosingLogger.info(`Dispensing completed, entering mixing phase for ${mixingTimeSeconds} seconds until ${new Date(mixingEndTime).toISOString()}`);
      
      // Set a timer to exit mixing phase
      setTimeout(() => {
        if (this.state.active && this.state.inMixingPhase) {
          this.updateState({
            inMixingPhase: false,
            mixingEndTime: null
          });
          autoDosingLogger.info('Mixing phase completed');
        }
      }, mixingTimeSeconds * 1000);
    }
  }
  
  // Register a client
  registerClient(clientId) {
    this.state.clients.add(clientId);
    autoDosingLogger.info(`Client ${clientId} registered for auto-dosing updates (${this.state.clients.size} total)`);
  }
  
  // Unregister a client
  unregisterClient(clientId) {
    this.state.clients.delete(clientId);
    autoDosingLogger.info(`Client ${clientId} unregistered from auto-dosing updates (${this.state.clients.size} remaining)`);
  }
  
  // Update EC reading
  updateECReading(ecValue) {
    if (ecValue !== this.state.currentEC) {
      this.updateState({ currentEC: ecValue });
      autoDosingLogger.info(`Auto-dosing EC updated: ${ecValue}`);
    }
  }
  
  // Check if system should execute a dosing cycle
  canDoseNow() {
    // Don't dose if not active
    if (!this.state.active) return false;
    
    // Don't dose if already dispensing
    if (this.state.dispensingInProgress) return false;
    
    // Don't dose if in mixing phase
    if (this.state.inMixingPhase) return false;
    
    return true;
  }
}

// Create singleton instance
const autodosingManager = new AutoDosingManager();

// Set the manager in websocket service to avoid circular dependency
if (typeof websocketService.setAutoDosingManager === 'function') {
  websocketService.setAutoDosingManager(autodosingManager);
} else {
  autoDosingLogger.error('setAutoDosingManager function not available in websocket service');
}

module.exports = autodosingManager;
