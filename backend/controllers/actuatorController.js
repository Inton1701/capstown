const { Actuator, PhPump, FertilizerPump, SensorPump } = require('../models/Actuator');
const { broadcastActuatorUpdate, broadcastFertilizerProgress } = require('../services/websocket');

// Add a global state to track the fertilizer dispensing process
let fertilizerDispensingProcess = {
  active: false,
  stopRequested: false
};

// Add an auto-dosing state object
let autoDosingState = {
  active: false,
  targetEC: null,
  currentEC: null,
  waterVolume: null,
  checkInterval: null, // seconds
  dispensingDelay: null, // seconds
  lastCheck: null,
  lastDispensing: null,
  nextCheckTime: null,
  fertilizers: [], // Array of configured fertilizers
  recentlyActive: [], // Currently active fertilizer pumps
  inMixingPhase: false, // Mixing phase flag
  mixingEndTime: null, // When mixing ends
  mixingTimeRemaining: null, // Seconds remaining in mixing
  
  // Test-pulse method state variables
  testPulseActive: false,
  testPulsePhase: null, // 'baseline', 'test-pulse', 'measuring', 'calculation', 'final-dose'
  baselineEC: null,
  testPulseEC: null,
  testPulseAmount: 5, // Default 5mL test pulse
  ecSensitivity: null, // EC change per mL
  calculatedDose: null, // Final dose after calculation
  phasesCompleted: []
};

class ActuatorController {
  // Get status of all actuators.
  // For sensor pumps, no schedule or auto countdown is applied.
  async getActuatorsStatus() {
    try {
      const actuators = await Actuator.find({});
      const now = Date.now();

      return actuators.map(actuator => {
        const data = actuator.toObject();

        // If the actuator is NOT a sensor pump and is active with a valid startTime/duration,
        // auto-calculate the remaining time.
        if (data.type !== 'sensor-pump' && data.status === 'active' && data.startTime && data.duration) {
          const elapsed = (now - new Date(data.startTime).getTime()) / 1000;
          data.remainingTime = Math.max(0, data.duration - elapsed);
          if (data.remainingTime <= 0) {
            // When auto run completes, update to idle.
            this.updateStatus(data.id, { 
              status: 'idle',
              wasActive: true
            }).catch(err => console.error('Error updating actuator status:', err));
            data.status = 'idle';
            data.remainingTime = 0;
            data.lastRun = new Date();
          }
        }
        // For sensor pumps, simply leave the status and remainingTime as is.
        if (data.type === 'sensor-pump') {
          data.remainingTime = data.remainingTime || 0;
        }
        return data;
      });
    } catch (error) {
      console.error('Error getting actuator status:', error);
      throw error;
    }
  }

  // Toggle actuator status (on/off)
  async toggleActuator(id) {
    try {
      const actuator = await Actuator.findOne({ id });
      if (!actuator) throw new Error('Actuator not found');

      // Toggle status manually (sensor pumps will always remain manual)
      actuator.status = actuator.status === 'active' ? 'idle' : 'active';
      if (actuator.status === 'active') {
        actuator.lastRun = new Date();
      }
      await actuator.save();
      return actuator;
    } catch (error) {
      console.error('Error toggling actuator:', error);
      throw error;
    }
  }

  // Update actuator settings (unchanged for now)
  async updateSettings(id, settings) {
    try {
      console.log('\n==== ACTUATOR SETTINGS UPDATE DEBUG ====');
      console.log(`Updating settings for actuator: ${id}`);
      console.log('Request payload:', JSON.stringify(settings, null, 2));
      
      // First, verify the actuator exists by ID
      const existingActuator = await Actuator.findOne({ id });
      if (!existingActuator) {
        console.error(`❌ Actuator not found with id: ${id}`);
        throw new Error(`Actuator not found with id: ${id}`);
      }
      console.log('✅ Found actuator:', existingActuator.id, existingActuator.type, existingActuator.name);

      // Create an update object with all possible fields
      const updateData = {};
      
      // Handle rule override flags and previous mode
      if (settings.overrideMode !== undefined) {
        updateData.overrideMode = settings.overrideMode;
      }
      
      if (settings.triggeredByRule !== undefined) {
        updateData.triggeredByRule = settings.triggeredByRule;
      }
      
      // If we're switching to rule mode, store the current mode
      if (settings.mode === 'rule' && existingActuator.mode !== 'rule') {
        updateData.previousMode = existingActuator.mode;
      }
      
      // If we're removing rule mode, restore previous mode
      if (existingActuator.mode === 'rule' && settings.mode && settings.mode !== 'rule') {
        console.log(`Exiting rule mode. Restoring from ${settings.mode || existingActuator.previousMode || 'manual'}`);
      }
      
      // Add this right before creating the updateData object to handle schedule resets
      if (settings.resetSchedule) {
        console.log('Resetting schedule timing information');
        updateData.nextScheduledRun = null;
        updateData.lastRun = null;
      }

      // Only include defined fields to avoid overwriting with undefined values
      if (settings.mode !== undefined) updateData.mode = settings.mode;
      if (settings.status !== undefined) updateData.status = settings.status;
      if (settings.enabled !== undefined) {
        updateData.enabled = settings.enabled;
        console.log(`Setting enabled to: ${settings.enabled}`);
      }
      
      // Check for interval changes
      const intervalChanged = settings.intervalUpdated || 
        (settings.schedule && existingActuator.schedule && (
          settings.schedule.interval.hours !== existingActuator.schedule.interval.hours ||
          settings.schedule.interval.minutes !== existingActuator.schedule.interval.minutes ||
          settings.schedule.interval.seconds !== existingActuator.schedule.interval.seconds
        ));
      
      if (intervalChanged) {
        console.log('INTERVAL CHANGE DETECTED ⏰ - Will recalculate next run time');
        updateData.intervalUpdated = true;
        
        // If in auto mode and schedule is enabled, immediately recalculate next run time
        if (settings.mode === 'auto' && settings.schedule?.enabled) {
          const now = Date.now();
          const newInterval = settings.schedule.interval;
          
          // Calculate new interval in milliseconds
          const intervalMs = (
            (newInterval.hours * 3600) + 
            (newInterval.minutes * 60) + 
            newInterval.seconds
          ) * 1000;
          
          if (intervalMs > 0) {
            // Start fresh countdown from now
            updateData.nextScheduledRun = now + intervalMs;
            console.log(`Next run recalculated for immediate interval change: ${new Date(updateData.nextScheduledRun).toISOString()}`);
          }
        }
      }
      
      // Add this right before creating the updateData object to handle schedule resets
      if (settings.resetSchedule) {
        console.log('Resetting schedule timing information');
        updateData.nextScheduledRun = null;
        updateData.lastRun = null;
        // If the schedule's interval was updated, we need to force timer recalculation
        if (settings.schedule) {
          console.log('Schedule intervals updated, forcing recalculation');
        }
      }

      // Only include defined fields to avoid overwriting with undefined values
      if (settings.mode !== undefined) updateData.mode = settings.mode;
      if (settings.status !== undefined) updateData.status = settings.status;
      if (settings.enabled !== undefined) {
        updateData.enabled = settings.enabled;
        console.log(`Setting enabled to: ${settings.enabled}`);
      }
      
      // Process special fields based on actuator type
      if (existingActuator.type === 'fertilizer-pump') {
        console.log('Processing fertilizer pump specific fields');
        
        // Explicitly check for string value before setting
        if (settings.nutrientType !== undefined && settings.nutrientType !== null) {
          const nutrientType = String(settings.nutrientType).trim();
          updateData.nutrientType = nutrientType || '';
          console.log(`Setting nutrient type to: "${updateData.nutrientType}"`);
        }
      }
      
      // Add flowRate if it's present in the settings
      if (settings.flowRate !== undefined) {
        updateData.flowRate = Number(settings.flowRate);
        console.log(`Setting flow rate to: ${updateData.flowRate}`);
      }
      
      // Add schedule if present
      if (settings.schedule) {
        updateData.schedule = {
          enabled: settings.schedule.enabled,
          activeDays: settings.schedule.activeDays ? [...settings.schedule.activeDays] : [],
          interval: {
            hours: Number(settings.schedule.interval.hours),
            minutes: Number(settings.schedule.interval.minutes),
            seconds: Number(settings.schedule.interval.seconds)
          },
          duration: {
            hours: Number(settings.schedule.duration.hours),
            minutes: Number(settings.schedule.duration.minutes),
            seconds: Number(settings.schedule.duration.seconds)
          }
        };
      }

      console.log('Final update data:', JSON.stringify(updateData, null, 2));
      
      try {
        // Use a more specific query to ensure we're updating the right document
        const query = { id: id };
        console.log('MongoDB query:', JSON.stringify(query, null, 2));
        
        // Set { strict: false } to allow updates to fields not in schema
        const actuator = await Actuator.findOneAndUpdate(
          query,
          { $set: updateData },
          { new: true, runValidators: true, strict: false }
        );

        if (!actuator) {
          console.error(`❌ Update failed: Actuator with id ${id} not found after update`);
          throw new Error('Actuator not found after update');
        }
        
        console.log('✅ Actuator updated successfully with new data:');
        console.log(JSON.stringify({
          id: actuator.id,
          type: actuator.type,
          name: actuator.name,
          nutrientType: actuator.nutrientType,
          flowRate: actuator.flowRate,
          status: actuator.status
        }, null, 2));
        console.log('==========================================\n');
        
        broadcastActuatorUpdate(actuator);
        return actuator;
      } catch (dbError) {
        console.error('❌ MongoDB update error:', dbError);
        console.log('==========================================\n');
        throw dbError;
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  // Update actuator status.
  // For sensor pumps (manual only) we simply update the status without scheduling logic.
  async updateStatus(id, statusData) {
    try {
      console.log(`[ActuatorController] Updating status for ${id}:`, statusData);
      
      const currentActuator = await Actuator.findOne({ id });
      if (!currentActuator) {
        throw new Error('Actuator not found');
      }
  
      // SAFETY CHECK: Prevent irrigation pump from activating during fertilizer dispensing
      if (currentActuator.type === 'pump' && 
          currentActuator.name === 'Irrigation Pump' && 
          statusData.status === 'active' && 
          this.isFertilizerDispensingActive()) {
        
        console.log(`[ActuatorController] BLOCKED: Irrigation pump activation prevented during fertilizer dispensing`);
        
        // Notify via websocket that the attempt was blocked
        broadcastActuatorUpdate({
          ...currentActuator.toObject(),
          status: 'idle',
          mode: 'rule',
          preventedActivation: true,
          disabledByFertilizer: true,
          overrideMessage: 'Blocked during fertilizer cycle'
        });
        
        // Return the current actuator without changes
        return currentActuator;
      }
  
      const now = Date.now();
      const updateData = {
        status: statusData.status,
        updatedAt: now
      };

      // Save mode if provided. For sensor pumps, mode should be 'manual'.
      if (statusData.mode !== undefined) {
        updateData.mode = statusData.mode;
      }
  
      // Save nextScheduledRun if provided (used only for scheduled actuators).
      if (statusData.nextScheduledRun !== undefined) {
        updateData.nextScheduledRun = statusData.nextScheduledRun;
      }
  
      // If the actuator is not a sensor pump, apply duration and remainingTime updates.
      if (currentActuator.type !== 'sensor-pump') {
        if (statusData.status === 'active') {
          updateData.startTime = statusData.startTime || now;
          updateData.lastRun = now;
          
          // If resuming from paused state, use the provided remainingTime
          if (currentActuator.status === 'paused' && statusData.remainingTime) {
            updateData.remainingTime = statusData.remainingTime;
            updateData.duration = statusData.remainingTime; // Duration and remainingTime should match
          } else {
            // For new activations, use the provided duration or default to 0
            updateData.duration = statusData.duration || 0;
            updateData.remainingTime = statusData.duration || 0;
          }
        } else if (statusData.status === 'paused') {
          // Preserve remainingTime when pausing
          updateData.remainingTime = statusData.remainingTime || currentActuator.remainingTime || 0;
        } else if (statusData.status === 'idle') {
          updateData.startTime = null;
          updateData.duration = 0;
          updateData.remainingTime = 0;
          updateData.lastRun = now;
        }
      } else {
        // For sensor pumps, simply update the status and lastRun.
        if (statusData.status === 'active') {
          updateData.lastRun = now;
        } else if (statusData.status === 'idle') {
          updateData.lastRun = now;
        }
      }
  
      const updatedActuator = await Actuator.findOneAndUpdate(
        { id },
        { $set: updateData },
        { new: true }
      );
  
      console.log(`[ActuatorController] Status updated:`, {
        id: updatedActuator.id,
        name: updatedActuator.name,
        status: updatedActuator.status,
        remainingTime: updatedActuator.remainingTime,
        mode: updatedActuator.mode
      });
  
      broadcastActuatorUpdate(updatedActuator);
      return updatedActuator;
    } catch (error) {
      console.error('[ActuatorController] Error:', error);
      throw error;
    }
  }

  // Get live remaining time for a specific actuator.
  // For sensor pumps, we return the stored remainingTime (which is typically 0).
  async getRemainingTime(id) {
    try {
      const actuator = await Actuator.findOne({ id }).lean();
      if (!actuator) throw new Error('Actuator not found');
      let remainingTime = 0;
      if (actuator.type !== 'sensor-pump' && actuator.status === 'active' && actuator.startTime && actuator.duration) {
        const now = Date.now();
        const elapsed = (now - new Date(actuator.startTime).getTime()) / 1000;
        remainingTime = Math.max(0, actuator.duration - elapsed);
      } else if (actuator.type === 'sensor-pump') {
        remainingTime = actuator.remainingTime || 0;
      }
      return { id: actuator.id, remainingTime };
    } catch (error) {
      console.error('Error getting remaining time:', error);
      throw error;
    }
  }

  // Get a specific actuator status.
  async getActuatorStatus(id) {
    try {
      const actuator = await Actuator.findOne({ id }).lean();
      if (!actuator) throw new Error('Actuator not found');
      return actuator;
    } catch (error) {
      console.error('Error getting actuator status:', error);
      throw error;
    }
  }
  
  // Add utility method to check if fertilizer dispensing is active
  isFertilizerDispensingActive() {
    return fertilizerDispensingProcess.active || autoDosingState.active;
  }
  
  // Update helper method to find and turn off irrigation pump with rule mode
  async findAndDisableIrrigationPump() {
    try {
      console.log('Looking for irrigation pump to disable before fertilizer dispensing');
      
      // Find the irrigation pump - typically named "Irrigation Pump" and type "pump"
      const irrigationPump = await Actuator.findOne({
        name: "Irrigation Pump",
        type: "pump"
      });
      
      if (!irrigationPump) {
        console.log('Irrigation pump not found, continuing without disabling');
        return null;
      }
      
      // Check if it's already idle
      if (irrigationPump.status !== 'active') {
        console.log('Irrigation pump already inactive, no need to disable');
        
        // Store the current mode even if we're not changing status
        const previousMode = irrigationPump.mode;
        
        // Update the database to store previous mode
        await Actuator.findOneAndUpdate(
          { id: irrigationPump.id },
          { $set: { previousMode: previousMode } },
          { new: true }
        );
        
        return irrigationPump;
      }
      
      // Store the pump's current mode before changing it
      const previousMode = irrigationPump.mode;
      
      console.log(`Turning off irrigation pump (${irrigationPump.id}) and saving previous mode: ${previousMode}`);
      
      // Turn off the irrigation pump and set to rule mode
      // First update the database with both status change and previousMode
      const updatedPump = await Actuator.findOneAndUpdate(
        { id: irrigationPump.id },
        { 
          $set: { 
            status: 'idle',
            mode: 'rule',
            previousMode: previousMode
          } 
        },
        { new: true }
      );
      
      if (!updatedPump) {
        console.error('Failed to update irrigation pump in database');
        return null;
      }
      
      // Broadcast a specific message for UI awareness
      broadcastActuatorUpdate({
        ...updatedPump.toObject(),
        status: 'idle',
        mode: 'rule',
        previousMode: previousMode,
        disabledByFertilizer: true,
        overrideMessage: 'Disabled during fertilizer dispensing'
      });
      
      return updatedPump;
    } catch (error) {
      console.error('Error disabling irrigation pump:', error);
      return null; // Continue with fertilizer process even if this fails
    }
  }

  // Add method to restore irrigation pump after fertilizer dispensing
  async restoreIrrigationPumpMode() {
    try {
      console.log('Restoring irrigation pump mode after fertilizer dispensing');
      
      // Find the irrigation pump
      const irrigationPump = await Actuator.findOne({
        name: "Irrigation Pump",
        type: "pump"
      });
      
      if (!irrigationPump) {
        console.log('Irrigation pump not found');
        return null;
      }
      
      // Determine mode to restore with better fallback logic
      let modeToRestore = 'manual'; // Default fallback
      
      if (irrigationPump.previousMode) {
        // Use saved previous mode if available
        modeToRestore = irrigationPump.previousMode;
        console.log(`Found saved previous mode: ${modeToRestore}`);
      } else if (irrigationPump.mode === 'rule') {
        // If currently in rule mode but no previousMode, use manual as fallback
        console.log('No previous mode found, but pump is in rule mode. Restoring to manual mode');
      } else {
        // If not in rule mode and no previousMode, keep current mode
        modeToRestore = irrigationPump.mode;
        console.log(`No previous mode found, keeping current mode: ${modeToRestore}`);
      }
      
      console.log(`Restoring irrigation pump to ${modeToRestore} mode`);
      
      // Update the pump's mode and clear the previousMode field
      const restoredPump = await Actuator.findOneAndUpdate(
        { id: irrigationPump.id },
        { 
          $set: { mode: modeToRestore },
          $unset: { previousMode: "" } // Clear the previousMode field
        },
        { new: true }
      );
      
      if (!restoredPump) {
        console.error('Failed to restore irrigation pump mode in database');
        return null;
      }
      
      // Broadcast update
      broadcastActuatorUpdate({
        ...restoredPump.toObject(),
        mode: modeToRestore,
        disabledByFertilizer: false,
        overrideMessage: null
      });
      
      return restoredPump;
    } catch (error) {
      console.error('Error restoring irrigation pump mode:', error);
      return null;
    }
  }

  // Add helper method to find and activate the sensor pump
  async findAndActivateSensorPump() {
    try {
      console.log('Looking for sensor pump to activate before fertilizer dispensing');
      
      // Find the sensor pump by type
      const sensorPump = await Actuator.findOne({
        type: "sensor-pump"
      });
      
      if (!sensorPump) {
        console.log('Sensor pump not found, continuing without activating');
        return null;
      }
      
      // Store the current mode for later restoration, regardless of current status
      const previousMode = sensorPump.mode;
      console.log(`Storing current sensor pump mode: ${previousMode}`);
      
      // Always force activate the pump regardless of its current state for consistency
      console.log(`Activating sensor pump (${sensorPump.id}) in rule mode`);
      
      // Force the update with both status and mode changes
      const updatedPump = await Actuator.findOneAndUpdate(
        { id: sensorPump.id },
        { 
          $set: { 
            status: 'active',  // Force to active status
            mode: 'rule',      // Set to rule mode
            previousMode: previousMode,
            duration: 0,       // No automatic duration
            remainingTime: 0,
            disabledControls: true  // Disable UI controls
          } 
        },
        { new: true }
      );
      
      if (!updatedPump) {
        console.error('Failed to update sensor pump in database - attempting direct activation');
        // Fallback: Try direct method if update fails
        try {
          // Direct activation without DB update as fallback
          const directActivation = await this.updateStatus(sensorPump.id, {
            status: 'active',
            mode: 'rule'
          });
          console.log('Direct activation result:', directActivation ? 'Success' : 'Failed');
        } catch (directError) {
          console.error('Direct activation also failed:', directError);
        }
        return sensorPump; // Return original pump reference
      }
      
      // Broadcast update with clear messaging
      broadcastActuatorUpdate({
        ...updatedPump.toObject(),
        status: 'active',
        mode: 'rule',
        previousMode: previousMode,
        activatedByFertilizer: true,
        overrideMessage: 'Required for fertilizer mixing',
        disabledControls: true
      });
      
      console.log('Sensor pump successfully activated in rule mode');
      return updatedPump;
    } catch (error) {
      console.error('Error activating sensor pump:', error);
      // Even if we error, try one last attempt to turn on the pump
      try {
        console.log('Attempting emergency activation of sensor pump');
        const emergencyPump = await Actuator.findOne({ type: "sensor-pump" });
        if (emergencyPump) {
          await this.updateStatus(emergencyPump.id, { 
            status: 'active',
            mode: 'rule'
          });
        }
      } catch (emergencyError) {
        console.error('Emergency activation failed:', emergencyError);
      }
      return null;
    }
  }

  // Add method to deactivate sensor pump after fertilizer dispensing
  async deactivateSensorPump() {
    try {
      console.log('Deactivating sensor pump after fertilizer dispensing');
      
      // Find the sensor pump
      const sensorPump = await Actuator.findOne({
        type: "sensor-pump"
      });
      
      if (!sensorPump) {
        console.log('Sensor pump not found');
        return null;
      }
      
      // Determine mode to restore
      let modeToRestore = 'manual'; // Default fallback
      
      if (sensorPump.previousMode) {
        // Use saved previous mode if available
        modeToRestore = sensorPump.previousMode;
        console.log(`Found saved previous mode: ${modeToRestore}`);
      } else if (sensorPump.mode === 'rule') {
        console.log('No previous mode found, but pump is in rule mode. Restoring to manual mode');
      } else {
        modeToRestore = sensorPump.mode;
        console.log(`No previous mode found, keeping current mode: ${modeToRestore}`);
      }
      
      console.log(`Turning off sensor pump and restoring to ${modeToRestore} mode`);
      
      // Update to turn off the pump and restore previous mode
      const restoredPump = await Actuator.findOneAndUpdate(
        { id: sensorPump.id },
        { 
          $set: { 
            status: 'idle',
            mode: modeToRestore,
            disabledControls: false
          },
          $unset: { 
            previousMode: "",
            activatedByFertilizer: "",
            overrideMessage: "" 
          }
        },
        { new: true }
      );
      
      if (!restoredPump) {
        console.error('Failed to deactivate sensor pump in database - attempting direct deactivation');
        // Fallback: Try direct method
        try {
          await this.updateStatus(sensorPump.id, {
            status: 'idle',
            mode: modeToRestore
          });
        } catch (directError) {
          console.error('Direct deactivation also failed:', directError);
        }
        return sensorPump;
      }
      
      // Broadcast update with clear messaging about restoration
      broadcastActuatorUpdate({
        ...restoredPump.toObject(),
        status: 'idle',
        mode: modeToRestore,
        activatedByFertilizer: false,
        overrideMessage: null
      });
      
      console.log('Sensor pump successfully deactivated and restored to previous mode');
      return restoredPump;
    } catch (error) {
      console.error('Error deactivating sensor pump:', error);
      // Still try to turn it off even if there was an error
      try {
        const emergencyPump = await Actuator.findOne({ type: "sensor-pump" });
        if (emergencyPump) {
          await this.updateStatus(emergencyPump.id, { 
            status: 'idle',
            mode: 'manual'
          });
        }
      } catch (emergencyError) {
        console.error('Emergency deactivation failed:', emergencyError);
      }
      return null;
    }
  }

  // Handle combined fertilizer dispensing (manual mode)
  async handleCombinedFertilizer(data) {
    try {
      console.log('Processing combined fertilizer request:', data);
      const { fertilizers, dispensingDelay } = data;
      
      if (!fertilizers || !Array.isArray(fertilizers) || fertilizers.length === 0) {
        throw new Error('No fertilizers provided for dispensing');
      }
      
      // Disable irrigation pump before starting fertilizer dispensing
      await this.findAndDisableIrrigationPump();
      
      // Activate sensor pump with enhanced error handling
      const sensorPumpResult = await this.findAndActivateSensorPump();
      if (!sensorPumpResult) {
        console.warn('Warning: Could not activate sensor pump - continuing anyway');
      } else {
        console.log('Sensor pump activated successfully in rule mode');
      }
      
      // Set global state for fertilizer dispensing
      fertilizerDispensingProcess = {
        active: true,
        stopRequested: false,
        startTime: Date.now(),
        totalSteps: fertilizers.length,
        currentStep: 0,
        sensorPumpActive: !!sensorPumpResult // Track if we have an active sensor pump
      };
      
      // NEW: Calculate waiting fertilizers list (all fertilizers at first)
      const waitingFertilizerIds = fertilizers.map(f => f.id);
      
      // Broadcast initial dispensing state with waiting fertilizers
      broadcastFertilizerProgress({
        isDispensing: true,
        currentStep: 0,
        totalSteps: fertilizers.length,
        dispensingDelay,
        remainingTime: dispensingDelay,
        waitingFertilizerIds // Add list of waiting fertilizer IDs
      });
      
      // Process fertilizers sequentially
      const results = [];
      for (let i = 0; i < fertilizers.length; i++) {
        // Check if stop was requested
        if (fertilizerDispensingProcess.stopRequested) {
          console.log('Fertilizer dispensing process was stopped by request');
          
          // Broadcast stopped status (no more waiting fertilizers)
          broadcastFertilizerProgress({
            isDispensing: false,
            stopped: true,
            currentStep: i,
            totalSteps: fertilizers.length,
            waitingFertilizerIds: [] // Clear waiting list when stopped
          });
          
          break;
        }
        
        const fertilizer = fertilizers[i];
        fertilizerDispensingProcess.currentStep = i + 1;
        
        // NEW: Remove this fertilizer from waiting list since we're starting it now
        const currentFertilizerId = fertilizer.id;
        const remainingWaitingIds = waitingFertilizerIds.filter(id => id !== currentFertilizerId);
        
        // Broadcast step update with updated waiting list
        broadcastFertilizerProgress({
          isDispensing: true,
          currentStep: i + 1,
          totalSteps: fertilizers.length,
          currentFertilizer: currentFertilizerId,
          dispensingDelay,
          remainingTime: fertilizer.amount, // Initially set to amount
          waitingFertilizerIds: remainingWaitingIds // Add updated waiting list
        });
        
        // Find the actuator
        const actuator = await Actuator.findOne({ id: currentFertilizerId });
        if (!actuator) {
          console.error(`Fertilizer pump not found: ${currentFertilizerId}`);
          continue;
        }
        
        // Activate the pump
        console.log(`Activating fertilizer pump ${actuator.id} for ${fertilizer.amount}mL`);
        
        // Calculate dispensing time based on the pump's actual flow rate
        const flowRate = actuator.flowRate || fertilizer.flowRate || 60; // ml/minute, use actuator rate, then request rate, or default
        const dispenseTimeSeconds = Math.max(3, (fertilizer.amount / (flowRate / 60))); // Convert ml/min to ml/sec, minimum 3 seconds
        
        console.log(`Using flow rate of ${flowRate}ml/min, calculated dispense time: ${dispenseTimeSeconds.toFixed(1)}s for ${fertilizer.amount}mL`);
        
        await this.updateStatus(actuator.id, {
          status: 'active',
          mode: 'manual',
          duration: dispenseTimeSeconds, // Use calculated time based on flow rate
          remainingTime: dispenseTimeSeconds
        });
        
        // Wait for the dispense to complete, updating progress every second
        const startTime = Date.now();
        const endTime = startTime + (dispenseTimeSeconds * 1000);
        
        while (Date.now() < endTime && !fertilizerDispensingProcess.stopRequested) {
          const elapsed = (Date.now() - startTime) / 1000;
          const remaining = Math.max(0, dispenseTimeSeconds - elapsed);
          
          // Broadcast progress update every second with waiting fertilizers
          broadcastFertilizerProgress({
            isDispensing: true,
            currentStep: i + 1,
            totalSteps: fertilizers.length,
            currentFertilizer: currentFertilizerId,
            remainingTime: remaining,
            progress: Math.min(100, (elapsed / dispenseTimeSeconds) * 100),
            waitingFertilizerIds: remainingWaitingIds // Include waiting list
          });
          
          await new Promise(resolve => setTimeout(resolve, 1000)); // Update every second
        }
        
        // Set back to idle
        await this.updateStatus(actuator.id, {
          status: 'idle',
          mode: 'manual'
        });
        
        results.push({
          id: actuator.id,
          name: actuator.name,
          amount: fertilizer.amount,
          nutrientType: actuator.nutrientType || 'Fertilizer',
          dispensed: true
        });
        
        // Wait for the specified delay before moving to the next fertilizer
        if (i < fertilizers.length - 1 && dispensingDelay && !fertilizerDispensingProcess.stopRequested) {
          // Broadcast delay status with waiting fertilizers
          broadcastFertilizerProgress({
            isDispensing: true,
            currentStep: i + 1,            totalSteps: fertilizers.length,
            inDelay: true,
            dispensingDelay,
            remainingTime: dispensingDelay,
            waitingFertilizerIds: waitingFertilizerIds.slice(i + 1)          });
          
          // Wait with updates every second
          for (let d = dispensingDelay; d > 0 && !fertilizerDispensingProcess.stopRequested; d--) {
            broadcastFertilizerProgress({
              isDispensing: true,
              currentStep: i + 1,
              totalSteps: fertilizers.length,
              inDelay: true,
              remainingTime: d,
              waitingFertilizerIds: waitingFertilizerIds.slice(i + 1) // Only include fertilizers that haven't been processed yet
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // Make sure we always broadcast completion and reset state, even if the loop completes normally
      if (!fertilizerDispensingProcess.stopRequested) {
        console.log('Fertilizer dispensing completed normally, sending completion broadcast');
        
        // Restore irrigation pump to its previous mode with enhanced error handling
        try {
          await this.restoreIrrigationPumpMode();
        } catch (pumpError) {
          console.error('Error restoring irrigation pump mode after completion:', pumpError);
          // Continue with completion broadcasting even if pump restoration fails
        }
        
        // Deactivate sensor pump after dispensing is complete - added retry logic
        try {
          console.log('Attempting to deactivate sensor pump...');
          const deactivateResult = await this.deactivateSensorPump();
          if (!deactivateResult) {
            console.warn('First deactivation attempt failed, retrying...');
            // Wait a moment and retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.deactivateSensorPump();
          }
        } catch (pumpError) {
          console.error('Error deactivating sensor pump after completion:', pumpError);
          // Still try one final direct approach
          try {
            const emergencyPump = await Actuator.findOne({ type: "sensor-pump" });
            if (emergencyPump) {
              await this.updateStatus(emergencyPump.id, { status: 'idle', mode: 'manual' });
            }
          } catch (finalError) {
            console.error('Final deactivation attempt failed:', finalError);
          }
        }
        
        // Broadcast completion - no more waiting fertilizers
        broadcastFertilizerProgress({
          isDispensing: false,
          currentStep: fertilizers.length,
          totalSteps: fertilizers.length,
          completed: true,
          waitingFertilizerIds: [] // Empty waiting list on completion
        });
      }
      
      // Reset the global state - moved outside the conditional to always execute
      console.log('Resetting fertilizer dispensing process state');
      fertilizerDispensingProcess = {
        active: false,
        stopRequested: false,
        sensorPumpActive: false
      };
      
      return { fertilizers: results };
    } catch (error) {
      console.error('Error handling combined fertilizer:', error);
      
      // Always attempt to restore irrigation pump even on error
      try {
        await this.restoreIrrigationPumpMode();
      } catch (pumpError) {
        console.warn('Failed to restore irrigation pump after fertilizer error:', pumpError);
      }
      
      // Always attempt to deactivate sensor pump even on error
      try {
        await this.deactivateSensorPump();
      } catch (pumpError) {
        console.warn('Failed to deactivate sensor pump after fertilizer error:', pumpError);
        // One last try with direct method
        try {
          const emergencyPump = await Actuator.findOne({ type: "sensor-pump" });
          if (emergencyPump) {
            await this.updateStatus(emergencyPump.id, { status: 'idle', mode: 'manual' });
          }
        } catch (emergencyError) {
          console.error('Emergency sensor pump deactivation failed:', emergencyError);
        }
      }
      
      // Broadcast error state
      broadcastFertilizerProgress({
        isDispensing: false,
        error: error.message,
        waitingFertilizerIds: [] // Clear waiting list on error
      });
      
      // Reset the global state
      fertilizerDispensingProcess = {
        active: false,
        stopRequested: false
      };
      
      throw error;
    }
  }

  // Add method to stop fertilizer dispensing
  async stopFertilizerDispensing() {
    try {
      console.log('Stopping fertilizer dispensing process');
      
      // Set stop flag
      fertilizerDispensingProcess.stopRequested = true;
      
      // Find any active fertilizer pumps and stop them
      const activePumps = await Actuator.find({ 
        type: 'fertilizer-pump',
        status: 'active'
      });
      
      console.log(`Found ${activePumps.length} active fertilizer pumps to stop`);
      
      // Create promises array for stopping all pumps in parallel
      const stopPromises = activePumps.map(pump => 
        this.updateStatus(pump.id, {
          status: 'idle',
          mode: 'manual'
        }).catch(err => {
          console.warn(`Failed to stop pump ${pump.id}: ${err.message}`);
          return null;
        })
      );
      
      // Wait for all stop operations to complete
      await Promise.all(stopPromises);
      
      // Restore irrigation pump to its previous mode with enhanced error handling
      try {
        await this.restoreIrrigationPumpMode();
      } catch (pumpError) {
        console.error('Error restoring irrigation pump mode after stopping:', pumpError);
        // Continue with process even if pump restoration fails
      }
      
      // Deactivate sensor pump when dispensing is stopped
      try {
        await this.deactivateSensorPump();
      } catch (pumpError) {
        console.error('Error deactivating sensor pump after stopping:', pumpError);
        // Continue with process even if pump deactivation fails
      }
      
      return {
        status: 'stopped',
        timestamp: new Date().toISOString(),
        message: 'Fertilizer dispensing process stopped successfully'
      };
    } catch (error) {
      console.error('Error stopping fertilizer dispensing:', error);
      
      // Try to restore/deactivate pumps even if there was an error
      try {
        await this.restoreIrrigationPumpMode();
        await this.deactivateSensorPump();
      } catch (pumpError) {
        console.warn('Failed to manage pumps after stop error:', pumpError);
      }
      
      throw error;
    }
  }

  // Start auto-dosing process
  async startAutoDosing(config) {
    try {
      console.log('Starting auto-dosing with config:', config);
      
      // Validate required fields
      if (!config.targetEC || !config.checkInterval || !config.fertilizers || !config.waterVolume) {
        throw new Error('Missing required auto-dosing parameters');
      }
      
      // Stop any existing auto-dosing first
      if (autoDosingState.active) {
        await this.stopAutoDosing();
      }
      
      // Disable irrigation pump before starting auto-dosing
      await this.findAndDisableIrrigationPump();
      
      // Activate sensor pump for mixing
      await this.findAndActivateSensorPump();
      
      // Convert and validate the targetEC value - ensure it's in mS/cm format
      let targetEC = parseFloat(config.targetEC);
      if (isNaN(targetEC)) {
        targetEC = 2.0; // Default if invalid
        console.warn(`Invalid targetEC value: ${config.targetEC}, using default: ${targetEC}`);
      } else if (targetEC > 100) {
        // If the targetEC is given in μS/cm format, convert to mS/cm
        targetEC = targetEC / 1000;
        console.log(`Converting targetEC from μS/cm to mS/cm: ${targetEC}`);
      }
      
      // Initialize auto-dosing state
      autoDosingState = {
        active: true,
        targetEC: targetEC,
        currentEC: config.currentEC ? this.convertToMSCM(parseFloat(config.currentEC)) : null,
        waterVolume: parseFloat(config.waterVolume),
        checkInterval: parseInt(config.checkInterval),
        dispensingDelay: parseInt(config.dispensingDelay || 5),
        lastCheck: Date.now(),
        nextCheckTime: Date.now() + (parseInt(config.checkInterval) * 1000),
        fertilizers: config.fertilizers,
        recentlyActive: [], 
        inMixingPhase: false,
        mixingEndTime: null,
        mixingTimeRemaining: null,
        
        // Initialize test-pulse parameters
        testPulseActive: false,
        testPulsePhase: null,
        baselineEC: null,
        testPulseEC: null,
        testPulseAmount: config.testPulseAmount || 5, // Default 5mL test pulse
        ecSensitivity: null,
        calculatedDose: null,
        phasesCompleted: []
      };
      
      console.log('Auto-dosing initialized with state:', {
        ...autoDosingState,
        targetEC: `${autoDosingState.targetEC} mS/cm`,
        currentEC: autoDosingState.currentEC ? `${autoDosingState.currentEC} mS/cm` : 'Not set yet'
      });
      
      // Perform initial EC check with proper error handling
      try {
        await this.checkAndAdjustEC();
      } catch (checkError) {
        console.error('Error during initial EC check:', checkError);
        // Continue anyway - we'll retry on next cycle
      }
      
      return {
        success: true,
        message: 'Auto-dosing started successfully with test-pulse method',
        status: this.getAutoDosingStatus()
      };
    } catch (error) {
      console.error('Error starting auto-dosing:', error);
      
      // Try to deactivate sensor pump on error
      try {
        await this.deactivateSensorPump();
      } catch (pumpError) {
        console.warn('Failed to deactivate sensor pump after auto-dosing start error:', pumpError);
      }
      
      autoDosingState.active = false;
      throw error;
    }
  }
  
  // Stop auto-dosing process
  async stopAutoDosing() {
    try {
      console.log('Stopping auto-dosing process');
      
      // Set active flag to false
      autoDosingState.active = false;
      
      // Stop any active fertilizer pumps
      const activePumps = await Actuator.find({ 
        type: 'fertilizer-pump',
        status: 'active'
      });
      
      console.log(`Found ${activePumps.length} active fertilizer pumps to stop`);
      
      // Create promises array for stopping all pumps in parallel
      const stopPromises = activePumps.map(pump => 
        this.updateStatus(pump.id, {
          status: 'idle',
          mode: 'manual'
        }).catch(err => {
          console.warn(`Failed to stop pump ${pump.id}: ${err.message}`);
          return null;
        })
      );
      
      // Wait for all stop operations to complete
      await Promise.all(stopPromises);
      
      // Restore irrigation pump mode
      try {
        await this.restoreIrrigationPumpMode();
      } catch (pumpError) {
        console.error('Error restoring irrigation pump mode after stopping auto-dosing:', pumpError);
      }
      
      // Deactivate sensor pump
      try {
        await this.deactivateSensorPump();
      } catch (pumpError) {
        console.error('Error deactivating sensor pump after stopping auto-dosing:', pumpError);
      }
      
      // Clear any auto-dosing broadcasting
      broadcastFertilizerProgress({
        isDispensing: false,
        autoDosingMode: true,
        stopped: true,
        message: 'Auto-dosing stopped by user'
      });
      
      return {
        status: 'stopped',
        timestamp: new Date().toISOString(),
        message: 'Auto-dosing process stopped successfully'
      };
    } catch (error) {
      console.error('Error stopping auto-dosing:', error);
      
      // Try to restore/deactivate pumps even if there was an error
      try {
        await this.restoreIrrigationPumpMode();
        await this.deactivateSensorPump();
      } catch (pumpError) {
        console.warn('Failed to manage pumps after auto-dosing stop error:', pumpError);
      }
      
      throw error;
    }
  }
  
  // Check EC and adjust if needed - updated with test-pulse logic
  async checkAndAdjustEC() {
    try {
      if (!autoDosingState.active) {
        console.log('Auto-dosing is not active, aborting EC check');
        return;
      }
      
      console.log('Checking EC level for auto-dosing adjustment');
      
      // Update last check time
      autoDosingState.lastCheck = Date.now();
      
      // Get latest EC reading from sensors (already converted to mS/cm)
      let latestEC = await this.getLatestECReading();
      
      // Store current EC value
      autoDosingState.currentEC = latestEC;
      
      // Calculate EC gap (positive means need to add more fertilizer)
      const ecGap = autoDosingState.targetEC - latestEC;
      console.log(`Current EC: ${latestEC} mS/cm, Target EC: ${autoDosingState.targetEC} mS/cm, Gap: ${ecGap.toFixed(2)} mS/cm`);
      
      // If EC is already at or above target, no adjustment needed
      if (ecGap <= 0.2) {
        console.log('EC is at or near target, no adjustment needed');
        
        // Set next check time based on check interval
        this.scheduleNextECCheck();
        
        // Broadcast status update with current values
        broadcastFertilizerProgress({
          isDispensing: false,
          autoDosingMode: true,
          testPulseComplete: autoDosingState.testPulseActive, // Include if we just completed a test pulse
          currentEC: autoDosingState.currentEC,
          targetEC: autoDosingState.targetEC,
          ecGap: ecGap,
          progress: (latestEC / autoDosingState.targetEC) * 100,
          nextCheckTime: autoDosingState.nextCheckTime
        });
        
        // Reset test pulse flag if we're done
        autoDosingState.testPulseActive = false;
        autoDosingState.testPulsePhase = null;
        
        return;
      }
      
      // If not in test-pulse mode and EC gap is significant, start test-pulse sequence
      if (!autoDosingState.testPulseActive && ecGap > 0.2) {
        console.log('EC is below target, starting test-pulse sequence');
        await this.startTestPulseSequence();
        return;
      }
      
      // If already in test-pulse mode, advance to next phase
      if (autoDosingState.testPulseActive) {
        await this.advanceTestPulsePhase();
      }
    } catch (error) {
      console.error('Error during EC check and adjust:', error);
      
      // Schedule next check despite error
      this.scheduleNextECCheck();
    }
  }
  
  // Schedule the next EC check
  scheduleNextECCheck() {
    // Calculate next check time
    const now = Date.now();
    autoDosingState.nextCheckTime = now + (autoDosingState.checkInterval * 1000);
    console.log(`Next EC check scheduled for: ${new Date(autoDosingState.nextCheckTime).toLocaleTimeString()}`);
  }
  
  // Start the test-pulse dosing sequence
  async startTestPulseSequence() {
    try {
      // Initialize test-pulse state
      autoDosingState.testPulseActive = true;
      autoDosingState.testPulsePhase = 'baseline';
      autoDosingState.baselineEC = autoDosingState.currentEC;
      autoDosingState.phasesCompleted = [];
      
      console.log('Started test-pulse sequence with baseline EC:', autoDosingState.baselineEC);
      
      // Broadcast start of test-pulse sequence
      broadcastFertilizerProgress({
        isDispensing: false,
        autoDosingMode: true,
        testPulseActive: true,
        testPulsePhase: 'baseline',
        baselineEC: autoDosingState.baselineEC,
        currentEC: autoDosingState.currentEC,
        targetEC: autoDosingState.targetEC,
        message: 'Measuring baseline EC level'
      });
      
      // Move to test-pulse phase immediately
      await this.advanceTestPulsePhase();
    } catch (error) {
      console.error('Error starting test-pulse sequence:', error);
      autoDosingState.testPulseActive = false;
      this.scheduleNextECCheck();
    }
  }
  
  // Advance to the next phase of the test-pulse sequence
  async advanceTestPulsePhase() {
    try {
      if (!autoDosingState.testPulseActive) {
        console.log('Test-pulse not active, cannot advance phase');
        return;
      }
      
      const currentPhase = autoDosingState.testPulsePhase;
      console.log(`Advancing test-pulse phase from: ${currentPhase}`);
      
      // Add current phase to completed phases
      if (currentPhase && !autoDosingState.phasesCompleted.includes(currentPhase)) {
        autoDosingState.phasesCompleted.push(currentPhase);
      }
      
      switch (currentPhase) {
        case 'baseline':
          // Next step: Deliver test pulse
          autoDosingState.testPulsePhase = 'test-pulse';
          await this.executeTestPulsePhase();
          break;
          
        case 'test-pulse':
          // Next step: Enter mixing phase
          autoDosingState.testPulsePhase = 'measuring';
          await this.executeTestPulsePhase();
          break;
          
        case 'measuring':
          // Next step: Calculate sensitivity
          autoDosingState.testPulsePhase = 'calculation';
          await this.executeTestPulsePhase();
          break;
          
        case 'calculation':
          // Next step: Deliver final dose
          autoDosingState.testPulsePhase = 'final-dose';
          await this.executeTestPulsePhase();
          break;
          
        case 'final-dose':
          // Sequence complete
          console.log('Test-pulse sequence complete');
          autoDosingState.testPulseActive = false;
          autoDosingState.testPulsePhase = null;
          
          // Enter final mixing phase
          autoDosingState.inMixingPhase = true;
          autoDosingState.mixingEndTime = Date.now() + (autoDosingState.checkInterval * 1000);
          autoDosingState.mixingTimeRemaining = autoDosingState.checkInterval;
          autoDosingState.nextCheckTime = autoDosingState.mixingEndTime;
          
          // Start mixing countdown
          this.startMixingCountdown();
          
          // Broadcast completion
          broadcastFertilizerProgress({
            isDispensing: false,
            autoDosingMode: true,
            testPulseActive: false,
            testPulseComplete: true,
            mixingState: true,
            mixingTimeRemaining: autoDosingState.checkInterval,
            currentEC: autoDosingState.currentEC,
            targetEC: autoDosingState.targetEC,
            message: 'Test-pulse sequence complete, waiting for mixing'
          });
          break;
          
        default:
          console.log('Unknown test-pulse phase:', currentPhase);
          // Reset sequence on error
          autoDosingState.testPulseActive = false;
          autoDosingState.testPulsePhase = null;
          this.scheduleNextECCheck();
      }
    } catch (error) {
      console.error('Error advancing test-pulse phase:', error);
      // Reset on error
      autoDosingState.testPulseActive = false;
      autoDosingState.testPulsePhase = null;
      this.scheduleNextECCheck();
    }
  }
  
  // Execute the current phase of the test-pulse sequence
  async executeTestPulsePhase() {
    try {
      const phase = autoDosingState.testPulsePhase;
      console.log(`Executing test-pulse phase: ${phase}`);
      
      switch (phase) {
        case 'test-pulse':
          // Disable irrigation pump before test pulse dispensing
          await this.findAndDisableIrrigationPump();
          
          // Deliver the test pulse
          console.log('Delivering test pulse of', autoDosingState.testPulseAmount, 'mL');
          
          // Prepare fertilizers with test-pulse amount
          const testPulseFertilizers = autoDosingState.fertilizers
            .filter(f => f.id)
            .map(async fert => {
              const actuator = await Actuator.findOne({ id: fert.id });
              if (!actuator) return null;
              
              return {
                id: fert.id,
                name: actuator.name,
                amount: autoDosingState.testPulseAmount,
                nutrientType: actuator.nutrientType || 'Fertilizer',
                flowRate: actuator.flowRate || 60
              };
            });
          
          // Resolve promises and filter out nulls
          const fertilizersToDispense = (await Promise.all(testPulseFertilizers)).filter(f => f !== null);
          
          if (fertilizersToDispense.length > 0) {
            // Broadcast start of test pulse
            broadcastFertilizerProgress({
              isDispensing: true,
              autoDosingMode: true,
              testPulseActive: true,
              testPulsePhase: 'test-pulse',
              message: 'Delivering test pulse'
            });
            
            // Dispense test pulse
            await this.dispenseFertilizersForAutoDosing(fertilizersToDispense, 'test-pulse');
            
            // Now enter the measuring phase by setting up mixing
            autoDosingState.inMixingPhase = true;
            autoDosingState.mixingEndTime = Date.now() + (autoDosingState.checkInterval * 1000);
            autoDosingState.mixingTimeRemaining = autoDosingState.checkInterval;
            
            // Start mixing countdown to allow test pulse to mix
            this.startMixingCountdown('measuring');
            
            // Broadcast mixing phase
            broadcastFertilizerProgress({
              isDispensing: false,
              autoDosingMode: true,
              testPulseActive: true,
              testPulsePhase: 'measuring',
              mixingState: true,
              mixingTimeRemaining: autoDosingState.mixingTimeRemaining,
              message: 'Mixing test pulse, waiting for EC to stabilize'
            });
          } else {
            console.error('No valid fertilizers found for test pulse');
            autoDosingState.testPulseActive = false;
            this.scheduleNextECCheck();
          }
          break;
          
        case 'measuring':
          // Measure the EC after test pulse
          const latestEC = await this.getLatestECReading();
          autoDosingState.testPulseEC = latestEC;
          console.log('Measured EC after test pulse:', latestEC);
          
          // Broadcast measurement result
          broadcastFertilizerProgress({
            isDispensing: false,
            autoDosingMode: true,
            testPulseActive: true,
            testPulsePhase: 'measuring',
            baselineEC: autoDosingState.baselineEC,
            testPulseEC: autoDosingState.testPulseEC,
            message: 'EC measurement after test pulse complete'
          });
          
          // Move directly to calculation phase
          autoDosingState.testPulsePhase = 'calculation';
          await this.executeTestPulsePhase();
          break;
          
        case 'calculation':
          // Calculate EC sensitivity
          const ecChange = autoDosingState.testPulseEC - autoDosingState.baselineEC;
          
          if (ecChange <= 0) {
            console.warn('No EC change detected after test pulse, using default sensitivity');
            // Use a conservative default if no change detected
            autoDosingState.ecSensitivity = 0.02; // 0.02 EC units per mL
          } else {
            autoDosingState.ecSensitivity = ecChange / autoDosingState.testPulseAmount;
          }
          
          console.log(`EC Sensitivity calculated: ${autoDosingState.ecSensitivity.toFixed(4)} EC units per mL`);
          
          // Calculate remaining dose needed
          const remainingEcGap = autoDosingState.targetEC - autoDosingState.testPulseEC;
          
          if (remainingEcGap <= 0) {
            console.log('EC target reached after test pulse, no additional dosing needed');
            autoDosingState.calculatedDose = 0;
            
            // Skip final dose phase
            autoDosingState.testPulseActive = false;
            autoDosingState.testPulsePhase = null;
            
            // Schedule next check
            this.scheduleNextECCheck();
            
            // Broadcast calculation result
            broadcastFertilizerProgress({
              isDispensing: false,
              autoDosingMode: true,
              testPulseActive: false,
              testPulseComplete: true,
              ecSensitivity: autoDosingState.ecSensitivity,
              currentEC: autoDosingState.testPulseEC,
              targetEC: autoDosingState.targetEC,
              message: 'EC target reached after test pulse, no additional dose needed'
            });
            
            return;
          }
          
          // Calculate amount needed to reach target
          autoDosingState.calculatedDose = Math.ceil(remainingEcGap / autoDosingState.ecSensitivity);
          
          // Apply reasonable limits to prevent over-dosing
          const maxDoseLimit = 30; // Maximum 30mL per dose as safety limit
          if (autoDosingState.calculatedDose > maxDoseLimit) {
            console.warn(`Calculated dose (${autoDosingState.calculatedDose}mL) exceeds safety limit, capping at ${maxDoseLimit}mL`);
            autoDosingState.calculatedDose = maxDoseLimit;
          }
          
          console.log(`Calculated dose needed: ${autoDosingState.calculatedDose}mL`);
          
          // Broadcast calculation result
          broadcastFertilizerProgress({
            isDispensing: false,
            autoDosingMode: true,
            testPulseActive: true,
            testPulsePhase: 'calculation',
            ecSensitivity: autoDosingState.ecSensitivity,
            calculatedDose: autoDosingState.calculatedDose,
            baselineEC: autoDosingState.baselineEC,
            testPulseEC: autoDosingState.testPulseEC,
            targetEC: autoDosingState.targetEC,
            message: `Calculated ${autoDosingState.calculatedDose}mL needed to reach target EC`
          });
          
          // Move to final dose phase
          autoDosingState.testPulsePhase = 'final-dose';
          await this.executeTestPulsePhase();
          break;
          
        case 'final-dose':
          // No dose needed
          if (autoDosingState.calculatedDose <= 0) {
            console.log('No final dose needed');
            
            // Mark sequence complete
            autoDosingState.testPulseActive = false;
            autoDosingState.testPulsePhase = null;
            
            // Schedule next check
            this.scheduleNextECCheck();
            
            return;
          }
          
          // Disable irrigation pump before final dose dispensing
          await this.findAndDisableIrrigationPump();
          
          console.log(`Delivering final dose of ${autoDosingState.calculatedDose}mL`);
          
          // Prepare fertilizers with calculated dose
          const finalDoseFertilizers = autoDosingState.fertilizers
            .filter(f => f.id)
            .map(async fert => {
              const actuator = await Actuator.findOne({ id: fert.id });
              if (!actuator) return null;
              
              return {
                id: fert.id,
                name: actuator.name,
                amount: autoDosingState.calculatedDose,
                nutrientType: actuator.nutrientType || 'Fertilizer',
                flowRate: actuator.flowRate || 60
              };
            });
          
          // Resolve promises and filter out nulls
          const finalFertilizers = (await Promise.all(finalDoseFertilizers)).filter(f => f !== null);
          
          if (finalFertilizers.length > 0) {
            // Broadcast start of final dose
            broadcastFertilizerProgress({
              isDispensing: true,
              autoDosingMode: true,
              testPulseActive: true,
              testPulsePhase: 'final-dose',
              calculatedDose: autoDosingState.calculatedDose,
              message: 'Delivering final calculated dose'
            });
            
            // Dispense final dose
            await this.dispenseFertilizersForAutoDosing(finalFertilizers, 'final-dose');
            
            // Mark sequence as completed
            autoDosingState.testPulsePhase = null;
            autoDosingState.testPulseActive = false;
            
            // Set up final mixing phase
            autoDosingState.inMixingPhase = true;
            autoDosingState.mixingEndTime = Date.now() + (autoDosingState.checkInterval * 1000);
            autoDosingState.mixingTimeRemaining = autoDosingState.checkInterval;
            autoDosingState.nextCheckTime = autoDosingState.mixingEndTime;
            
            // Start mixing countdown
            this.startMixingCountdown();
            
            // Broadcast completion
            broadcastFertilizerProgress({
              isDispensing: false,
              autoDosingMode: true,
              testPulseActive: false,
              testPulseComplete: true,
              mixingState: true,
              mixingTimeRemaining: autoDosingState.checkInterval,
              calculatedDose: autoDosingState.calculatedDose,
              currentEC: autoDosingState.testPulseEC,
              targetEC: autoDosingState.targetEC,
              message: 'Final dose complete, waiting for mixing'
            });
          } else {
            console.error('No valid fertilizers found for final dose');
            autoDosingState.testPulseActive = false;
            this.scheduleNextECCheck();
          }
          break;
          
        default:
          console.warn('Unknown test-pulse phase:', phase);
          autoDosingState.testPulseActive = false;
          this.scheduleNextECCheck();
      }
    } catch (error) {
      console.error(`Error executing test-pulse phase ${autoDosingState.testPulsePhase}:`, error);
      autoDosingState.testPulseActive = false;
      this.scheduleNextECCheck();
    }
  }
  
  // Modify mixing countdown to support test-pulse phases
  startMixingCountdown(nextPhase = null) {
    // Clear any existing countdown
    if (autoDosingState.mixingCountdownTimer) {
      clearInterval(autoDosingState.mixingCountdownTimer);
    }
    
    // Start new countdown timer that updates every second
    autoDosingState.mixingCountdownTimer = setInterval(() => {
      if (!autoDosingState.active || 
         (!autoDosingState.inMixingPhase && !autoDosingState.testPulseActive)) {
        clearInterval(autoDosingState.mixingCountdownTimer);
        return;
      }
      
      const now = Date.now();
      const remaining = Math.max(0, Math.round((autoDosingState.mixingEndTime - now) / 1000));
      autoDosingState.mixingTimeRemaining = remaining;
      
      // Broadcast updated time every 5 seconds
      if (remaining % 5 === 0 || remaining <= 10) {
        broadcastFertilizerProgress({
          isDispensing: false,
          autoDosingMode: true,
          mixingState: true,
          testPulseActive: autoDosingState.testPulseActive,
          testPulsePhase: autoDosingState.testPulsePhase,
          mixingTimeRemaining: remaining,
          currentEC: autoDosingState.currentEC,
          targetEC: autoDosingState.targetEC
        });
      }
      
      // When mixing is complete, perform next action
      if (remaining <= 0) {
        clearInterval(autoDosingState.mixingCountdownTimer);
        autoDosingState.inMixingPhase = false;
        autoDosingState.mixingEndTime = null;
        
        if (autoDosingState.testPulseActive && nextPhase) {
          // If in test-pulse mode, advance to the next specified phase
          autoDosingState.testPulsePhase = nextPhase;
          this.executeTestPulsePhase().catch(err => {
            console.error(`Error during test-pulse phase ${nextPhase}:`, err);
          });
        } else if (autoDosingState.testPulseActive) {
          // If in test-pulse mode but no specific next phase, just advance
          this.advanceTestPulsePhase().catch(err => {
            console.error('Error advancing test-pulse phase:', err);
          });
        } else {
          // Regular auto-dosing process - trigger another EC check
          this.checkAndAdjustEC().catch(err => {
            console.error('Error during follow-up EC check:', err);
          });
        }
      }
    }, 1000);
  }
  
  // Modify dispenseFertilizersForAutoDosing to support test-pulse phases
  async dispenseFertilizersForAutoDosing(fertilizers, phase = null) {
    try {
      console.log(`Starting fertilizer dispensing for ${phase || 'auto-dosing'}`);
      
      // Update state and broadcast start of dispensing
      autoDosingState.lastDispensing = Date.now();
      autoDosingState.recentlyActive = [];
      
      // Calculate total steps for progress tracking
      const totalSteps = fertilizers.length;
      
      // Track waiting fertilizer IDs
      const waitingFertilizerIds = fertilizers.map(f => f.id);
      
      // Broadcast initial dispensing state
      broadcastFertilizerProgress({
        isDispensing: true,
        autoDosingMode: true,
        testPulseActive: autoDosingState.testPulseActive,
        testPulsePhase: autoDosingState.testPulsePhase,
        currentStep: 0,
        totalSteps: totalSteps,
        dispensingDelay: autoDosingState.dispensingDelay,
        waitingFertilizerIds,
        currentEC: autoDosingState.currentEC,
        targetEC: autoDosingState.targetEC
      });
      
      // Process fertilizers sequentially
      for (let i = 0; i < fertilizers.length; i++) {
        // Stop if auto-dosing was deactivated
        if (!autoDosingState.active) {
          console.log('Auto-dosing was stopped during dispensing');
          break;
        }
        
        const fertilizer = fertilizers[i];
        const currentFertilizerId = fertilizer.id;
        
        // Remove this fertilizer from waiting list
        const remainingWaitingIds = waitingFertilizerIds.filter(id => id !== currentFertilizerId);
        
        // Broadcast step update
        broadcastFertilizerProgress({
          isDispensing: true,
          autoDosingMode: true,
          testPulseActive: autoDosingState.testPulseActive,
          testPulsePhase: autoDosingState.testPulsePhase,
          currentStep: i + 1,
          totalSteps: totalSteps,
          currentFertilizer: currentFertilizerId,
          dispensingDelay: autoDosingState.dispensingDelay,
          waitingFertilizerIds: remainingWaitingIds,
          currentEC: autoDosingState.currentEC,
          targetEC: autoDosingState.targetEC
        });
        
        // Get the actuator
        const actuator = await Actuator.findOne({ id: currentFertilizerId });
        if (!actuator) {
          console.error(`Fertilizer pump not found: ${currentFertilizerId}`);
          continue;
        }
        
        // Track currently active fertilizer
        autoDosingState.recentlyActive.push({
          id: actuator.id,
          name: actuator.name,
          amount: fertilizer.amount,
          nutrientType: actuator.nutrientType || 'Fertilizer'
        });
        
        // Calculate dispensing time based on flow rate
        const flowRate = actuator.flowRate || fertilizer.flowRate || 60; // ml/minute
        const dispenseTimeSeconds = Math.max(3, (fertilizer.amount / (flowRate / 60))); // Convert ml/min to ml/sec, minimum 3 seconds
        
        console.log(`${phase || 'Auto-dosing'}: Dispensing ${fertilizer.amount}mL from ${actuator.name} with flow rate ${flowRate}ml/min (${dispenseTimeSeconds.toFixed(1)}s)`);
        
        // Activate the pump
        await this.updateStatus(actuator.id, {
          status: 'active',
          mode: 'manual',
          duration: dispenseTimeSeconds,
          remainingTime: dispenseTimeSeconds
        });
        
        // Wait for the dispense to complete, updating progress every second
        const startTime = Date.now();
        const endTime = startTime + (dispenseTimeSeconds * 1000);
        
        while (Date.now() < endTime && autoDosingState.active) {
          const elapsed = (Date.now() - startTime) / 1000;
          const remaining = Math.max(0, dispenseTimeSeconds - elapsed);
          
          // Broadcast progress update every second
          broadcastFertilizerProgress({
            isDispensing: true,
            autoDosingMode: true,
            testPulseActive: autoDosingState.testPulseActive,
            testPulsePhase: autoDosingState.testPulsePhase,
            currentStep: i + 1,
            totalSteps: totalSteps,
            currentFertilizer: currentFertilizerId,
            remainingTime: remaining,
            progress: Math.min(100, (elapsed / dispenseTimeSeconds) * 100),
            waitingFertilizerIds: remainingWaitingIds,
            currentEC: autoDosingState.currentEC,
            targetEC: autoDosingState.targetEC
          });
          
          await new Promise(resolve => setTimeout(resolve, 1000)); // Update every second
        }
        
        // Set back to idle
        await this.updateStatus(actuator.id, {
          status: 'idle',
          mode: 'manual'
        });
        
        // Wait for the specified delay before moving to the next fertilizer
        if (i < fertilizers.length - 1 && autoDosingState.dispensingDelay && autoDosingState.active) {
          // Broadcast delay status
          broadcastFertilizerProgress({
            isDispensing: true,
            autoDosingMode: true,
            testPulseActive: autoDosingState.testPulseActive,
            testPulsePhase: autoDosingState.testPulsePhase,
            currentStep: i + 1,
            totalSteps: totalSteps,
            inDelay: true,
            dispensingDelay: autoDosingState.dispensingDelay,
            remainingTime: autoDosingState.dispensingDelay,
            waitingFertilizerIds: remainingWaitingIds.slice(i + 1),
            currentEC: autoDosingState.currentEC,
            targetEC: autoDosingState.targetEC
          });
          
          // Wait with updates every second
          for (let d = autoDosingState.dispensingDelay; d > 0 && autoDosingState.active; d--) {
            broadcastFertilizerProgress({
              isDispensing: true,
              autoDosingMode: true,
              testPulseActive: autoDosingState.testPulseActive,
              testPulsePhase: autoDosingState.testPulsePhase,
              currentStep: i + 1,
              totalSteps: totalSteps,
              inDelay: true,
              remainingTime: d,
              waitingFertilizerIds: remainingWaitingIds.slice(i + 1),
              currentEC: autoDosingState.currentEC,
              targetEC: autoDosingState.targetEC
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // Broadcast completion of dispensing phase
      if (autoDosingState.active) {
        broadcastFertilizerProgress({
          isDispensing: false,
          autoDosingMode: true,
          testPulseActive: autoDosingState.testPulseActive,
          testPulsePhase: autoDosingState.testPulsePhase,
          currentStep: fertilizers.length,
          totalSteps: totalSteps,
          completed: true,
          waitingFertilizerIds: [],
          currentEC: autoDosingState.currentEC,
          targetEC: autoDosingState.targetEC,
          message: phase ? `${phase} dispensing complete` : 'Dispensing complete'
        });
      }
      
      console.log(`${phase || 'Auto-dosing'} dispensing sequence complete`);
    } catch (error) {
      console.error(`Error during ${phase || 'auto-dosing'} fertilizer dispensing:`, error);
      
      // Reset any active pumps
      const activePumps = await Actuator.find({ 
        type: 'fertilizer-pump',
        status: 'active'
      });
      
      const stopPromises = activePumps.map(pump => 
        this.updateStatus(pump.id, {
          status: 'idle',
          mode: 'manual'
        }).catch(err => {
          console.warn(`Failed to stop pump ${pump.id}: ${err.message}`);
          return null;
        })
      );
      
      await Promise.all(stopPromises);
      
      // Broadcast error
      broadcastFertilizerProgress({
        isDispensing: false,
        autoDosingMode: true,
        testPulseActive: autoDosingState.testPulseActive,
        error: error.message,
        waitingFertilizerIds: []
      });
      
      throw error;
    }
  }
  
  // Update startAutoDosing to disable irrigation pump before starting
  async startAutoDosing(config) {
    try {
      console.log('Starting auto-dosing with config:', config);
      
      // Validate required fields
      if (!config.targetEC || !config.checkInterval || !config.fertilizers || !config.waterVolume) {
        throw new Error('Missing required auto-dosing parameters');
      }
      
      // Stop any existing auto-dosing first
      if (autoDosingState.active) {
        await this.stopAutoDosing();
      }
      
      // Disable irrigation pump before starting auto-dosing
      await this.findAndDisableIrrigationPump();
      
      // Activate sensor pump for mixing
      await this.findAndActivateSensorPump();
      
      // Convert and validate the targetEC value - ensure it's in mS/cm format
      let targetEC = parseFloat(config.targetEC);
      if (isNaN(targetEC)) {
        targetEC = 2.0; // Default if invalid
        console.warn(`Invalid targetEC value: ${config.targetEC}, using default: ${targetEC}`);
      } else if (targetEC > 100) {
        // If the targetEC is given in μS/cm format, convert to mS/cm
        targetEC = targetEC / 1000;
        console.log(`Converting targetEC from μS/cm to mS/cm: ${targetEC}`);
      }
      
      // Initialize auto-dosing state
      autoDosingState = {
        active: true,
        targetEC: targetEC,
        currentEC: config.currentEC ? this.convertToMSCM(parseFloat(config.currentEC)) : null,
        waterVolume: parseFloat(config.waterVolume),
        checkInterval: parseInt(config.checkInterval),
        dispensingDelay: parseInt(config.dispensingDelay || 5),
        lastCheck: Date.now(),
        nextCheckTime: Date.now() + (parseInt(config.checkInterval) * 1000),
        fertilizers: config.fertilizers,
        recentlyActive: [], 
        inMixingPhase: false,
        mixingEndTime: null,
        mixingTimeRemaining: null,
        
        // Initialize test-pulse parameters
        testPulseActive: false,
        testPulsePhase: null,
        baselineEC: null,
        testPulseEC: null,
        testPulseAmount: config.testPulseAmount || 5, // Default 5mL test pulse
        ecSensitivity: null,
        calculatedDose: null,
        phasesCompleted: []
      };
      
      console.log('Auto-dosing initialized with state:', {
        ...autoDosingState,
        targetEC: `${autoDosingState.targetEC} mS/cm`,
        currentEC: autoDosingState.currentEC ? `${autoDosingState.currentEC} mS/cm` : 'Not set yet'
      });
      
      // Perform initial EC check with proper error handling
      try {
        await this.checkAndAdjustEC();
      } catch (checkError) {
        console.error('Error during initial EC check:', checkError);
        // Continue anyway - we'll retry on next cycle
      }
      
      return {
        success: true,
        message: 'Auto-dosing started successfully with test-pulse method',
        status: this.getAutoDosingStatus()
      };
    } catch (error) {
      console.error('Error starting auto-dosing:', error);
      
      // Try to deactivate sensor pump on error
      try {
        await this.deactivateSensorPump();
      } catch (pumpError) {
        console.warn('Failed to deactivate sensor pump after auto-dosing start error:', pumpError);
      }
      
      autoDosingState.active = false;
      throw error;
    }
  }
  
  // Stop auto-dosing process
  async stopAutoDosing() {
    try {
      console.log('Stopping auto-dosing process');
      
      // Set active flag to false
      autoDosingState.active = false;
      
      // Stop any active fertilizer pumps
      const activePumps = await Actuator.find({ 
        type: 'fertilizer-pump',
        status: 'active'
      });
      
      console.log(`Found ${activePumps.length} active fertilizer pumps to stop`);
      
      // Create promises array for stopping all pumps in parallel
      const stopPromises = activePumps.map(pump => 
        this.updateStatus(pump.id, {
          status: 'idle',
          mode: 'manual'
        }).catch(err => {
          console.warn(`Failed to stop pump ${pump.id}: ${err.message}`);
          return null;
        })
      );
      
      // Wait for all stop operations to complete
      await Promise.all(stopPromises);
      
      // Restore irrigation pump mode
      try {
        await this.restoreIrrigationPumpMode();
      } catch (pumpError) {
        console.error('Error restoring irrigation pump mode after stopping auto-dosing:', pumpError);
      }
      
      // Deactivate sensor pump
      try {
        await this.deactivateSensorPump();
      } catch (pumpError) {
        console.error('Error deactivating sensor pump after stopping auto-dosing:', pumpError);
      }
      
      // Clear any auto-dosing broadcasting
      broadcastFertilizerProgress({
        isDispensing: false,
        autoDosingMode: true,
        stopped: true,
        message: 'Auto-dosing stopped by user'
      });
      
      return {
        status: 'stopped',
        timestamp: new Date().toISOString(),
        message: 'Auto-dosing process stopped successfully'
      };
    } catch (error) {
      console.error('Error stopping auto-dosing:', error);
      
      // Try to restore/deactivate pumps even if there was an error
      try {
        await this.restoreIrrigationPumpMode();
        await this.deactivateSensorPump();
      } catch (pumpError) {
        console.warn('Failed to manage pumps after auto-dosing stop error:', pumpError);
      }
      
      throw error;
    }
  }
  
  // Check EC and adjust if needed - updated with test-pulse logic
  async checkAndAdjustEC() {
    try {
      if (!autoDosingState.active) {
        console.log('Auto-dosing is not active, aborting EC check');
        return;
      }
      
      console.log('Checking EC level for auto-dosing adjustment');
      
      // Update last check time
      autoDosingState.lastCheck = Date.now();
      
      // Get latest EC reading from sensors (already converted to mS/cm)
      let latestEC = await this.getLatestECReading();
      
      // Store current EC value
      autoDosingState.currentEC = latestEC;
      
      // Calculate EC gap (positive means need to add more fertilizer)
      const ecGap = autoDosingState.targetEC - latestEC;
      console.log(`Current EC: ${latestEC} mS/cm, Target EC: ${autoDosingState.targetEC} mS/cm, Gap: ${ecGap.toFixed(2)} mS/cm`);
      
      // If EC is already at or above target, no adjustment needed
      if (ecGap <= 0.2) {
        console.log('EC is at or near target, no adjustment needed');
        
        // Set next check time based on check interval
        this.scheduleNextECCheck();
        
        // Broadcast status update with current values
        broadcastFertilizerProgress({
          isDispensing: false,
          autoDosingMode: true,
          testPulseComplete: autoDosingState.testPulseActive, // Include if we just completed a test pulse
          currentEC: autoDosingState.currentEC,
          targetEC: autoDosingState.targetEC,
          ecGap: ecGap,
          progress: (latestEC / autoDosingState.targetEC) * 100,
          nextCheckTime: autoDosingState.nextCheckTime
        });
        
        // Reset test pulse flag if we're done
        autoDosingState.testPulseActive = false;
        autoDosingState.testPulsePhase = null;
        
        return;
      }
      
      // If not in test-pulse mode and EC gap is significant, start test-pulse sequence
      if (!autoDosingState.testPulseActive && ecGap > 0.2) {
        console.log('EC is below target, starting test-pulse sequence');
        await this.startTestPulseSequence();
        return;
      }
      
      // If already in test-pulse mode, advance to next phase
      if (autoDosingState.testPulseActive) {
        await this.advanceTestPulsePhase();
      }
    } catch (error) {
      console.error('Error during EC check and adjust:', error);
      
      // Schedule next check despite error
      this.scheduleNextECCheck();
    }
  }
  
  // Schedule the next EC check
  scheduleNextECCheck() {
    // Calculate next check time
    const now = Date.now();
    autoDosingState.nextCheckTime = now + (autoDosingState.checkInterval * 1000);
    console.log(`Next EC check scheduled for: ${new Date(autoDosingState.nextCheckTime).toLocaleTimeString()}`);
  }
  
  // Start the test-pulse dosing sequence
  async startTestPulseSequence() {
    try {
      // Initialize test-pulse state
      autoDosingState.testPulseActive = true;
      autoDosingState.testPulsePhase = 'baseline';
      autoDosingState.baselineEC = autoDosingState.currentEC;
      autoDosingState.phasesCompleted = [];
      
      console.log('Started test-pulse sequence with baseline EC:', autoDosingState.baselineEC);
      
      // Broadcast start of test-pulse sequence
      broadcastFertilizerProgress({
        isDispensing: false,
        autoDosingMode: true,
        testPulseActive: true,
        testPulsePhase: 'baseline',
        baselineEC: autoDosingState.baselineEC,
        currentEC: autoDosingState.currentEC,
        targetEC: autoDosingState.targetEC,
        message: 'Measuring baseline EC level'
      });
      
      // Move to test-pulse phase immediately
      await this.advanceTestPulsePhase();
    } catch (error) {
      console.error('Error starting test-pulse sequence:', error);
      autoDosingState.testPulseActive = false;
      this.scheduleNextECCheck();
    }
  }
  
  // Advance to the next phase of the test-pulse sequence
  async advanceTestPulsePhase() {
    try {
      if (!autoDosingState.testPulseActive) {
        console.log('Test-pulse not active, cannot advance phase');
        return;
      }
      
      const currentPhase = autoDosingState.testPulsePhase;
      console.log(`Advancing test-pulse phase from: ${currentPhase}`);
      
      // Add current phase to completed phases
      if (currentPhase && !autoDosingState.phasesCompleted.includes(currentPhase)) {
        autoDosingState.phasesCompleted.push(currentPhase);
      }
      
      switch (currentPhase) {
        case 'baseline':
          // Next step: Deliver test pulse
          autoDosingState.testPulsePhase = 'test-pulse';
          await this.executeTestPulsePhase();
          break;
          
        case 'test-pulse':
          // Next step: Enter mixing phase
          autoDosingState.testPulsePhase = 'measuring';
          await this.executeTestPulsePhase();
          break;
          
        case 'measuring':
          // Next step: Calculate sensitivity
          autoDosingState.testPulsePhase = 'calculation';
          await this.executeTestPulsePhase();
          break;
          
        case 'calculation':
          // Next step: Deliver final dose
          autoDosingState.testPulsePhase = 'final-dose';
          await this.executeTestPulsePhase();
          break;
          
        case 'final-dose':
          // Sequence complete
          console.log('Test-pulse sequence complete');
          autoDosingState.testPulseActive = false;
          autoDosingState.testPulsePhase = null;
          
          // Enter final mixing phase
          autoDosingState.inMixingPhase = true;
          autoDosingState.mixingEndTime = Date.now() + (autoDosingState.checkInterval * 1000);
          autoDosingState.mixingTimeRemaining = autoDosingState.checkInterval;
          autoDosingState.nextCheckTime = autoDosingState.mixingEndTime;
          
          // Start mixing countdown
          this.startMixingCountdown();
          
          // Broadcast completion
          broadcastFertilizerProgress({
            isDispensing: false,
            autoDosingMode: true,
            testPulseActive: false,
            testPulseComplete: true,
            mixingState: true,
            mixingTimeRemaining: autoDosingState.checkInterval,
            currentEC: autoDosingState.currentEC,
            targetEC: autoDosingState.targetEC,
            message: 'Test-pulse sequence complete, waiting for mixing'
          });
          break;
          
        default:
          console.log('Unknown test-pulse phase:', currentPhase);
          // Reset sequence on error
          autoDosingState.testPulseActive = false;
          autoDosingState.testPulsePhase = null;
          this.scheduleNextECCheck();
      }
    } catch (error) {
      console.error('Error advancing test-pulse phase:', error);
      // Reset on error
      autoDosingState.testPulseActive = false;
      autoDosingState.testPulsePhase = null;
      this.scheduleNextECCheck();
    }
  }
  
  // Execute the current phase of the test-pulse sequence
  async executeTestPulsePhase() {
    try {
      const phase = autoDosingState.testPulsePhase;
      console.log(`Executing test-pulse phase: ${phase}`);
      
      switch (phase) {
        case 'test-pulse':
          // Disable irrigation pump before test pulse dispensing
          await this.findAndDisableIrrigationPump();
          
          // Deliver the test pulse
          console.log('Delivering test pulse of', autoDosingState.testPulseAmount, 'mL');
          
          // Prepare fertilizers with test-pulse amount
          const testPulseFertilizers = autoDosingState.fertilizers
            .filter(f => f.id)
            .map(async fert => {
              const actuator = await Actuator.findOne({ id: fert.id });
              if (!actuator) return null;
              
              return {
                id: fert.id,
                name: actuator.name,
                amount: autoDosingState.testPulseAmount,
                nutrientType: actuator.nutrientType || 'Fertilizer',
                flowRate: actuator.flowRate || 60
              };
            });
          
          // Resolve promises and filter out nulls
          const fertilizersToDispense = (await Promise.all(testPulseFertilizers)).filter(f => f !== null);
          
          if (fertilizersToDispense.length > 0) {
            // Broadcast start of test pulse
            broadcastFertilizerProgress({
              isDispensing: true,
              autoDosingMode: true,
              testPulseActive: true,
              testPulsePhase: 'test-pulse',
              message: 'Delivering test pulse'
            });
            
            // Dispense test pulse
            await this.dispenseFertilizersForAutoDosing(fertilizersToDispense, 'test-pulse');
            
            // Now enter the measuring phase by setting up mixing
            autoDosingState.inMixingPhase = true;
            autoDosingState.mixingEndTime = Date.now() + (autoDosingState.checkInterval * 1000);
            autoDosingState.mixingTimeRemaining = autoDosingState.checkInterval;
            
            // Start mixing countdown to allow test pulse to mix
            this.startMixingCountdown('measuring');
            
            // Broadcast mixing phase
            broadcastFertilizerProgress({
              isDispensing: false,
              autoDosingMode: true,
              testPulseActive: true,
              testPulsePhase: 'measuring',
              mixingState: true,
              mixingTimeRemaining: autoDosingState.mixingTimeRemaining,
              message: 'Mixing test pulse, waiting for EC to stabilize'
            });
          } else {
            console.error('No valid fertilizers found for test pulse');
            autoDosingState.testPulseActive = false;
            this.scheduleNextECCheck();
          }
          break;
          
        case 'measuring':
          // Measure the EC after test pulse
          const latestEC = await this.getLatestECReading();
          autoDosingState.testPulseEC = latestEC;
          console.log('Measured EC after test pulse:', latestEC);
          
          // Broadcast measurement result
          broadcastFertilizerProgress({
            isDispensing: false,
            autoDosingMode: true,
            testPulseActive: true,
            testPulsePhase: 'measuring',
            baselineEC: autoDosingState.baselineEC,
            testPulseEC: autoDosingState.testPulseEC,
            message: 'EC measurement after test pulse complete'
          });
          
          // Move directly to calculation phase
          autoDosingState.testPulsePhase = 'calculation';
          await this.executeTestPulsePhase();
          break;
          
        case 'calculation':
          // Calculate EC sensitivity
          const ecChange = autoDosingState.testPulseEC - autoDosingState.baselineEC;
          
          if (ecChange <= 0) {
            console.warn('No EC change detected after test pulse, using default sensitivity');
            // Use a conservative default if no change detected
            autoDosingState.ecSensitivity = 0.02; // 0.02 EC units per mL
          } else {
            autoDosingState.ecSensitivity = ecChange / autoDosingState.testPulseAmount;
          }
          
          console.log(`EC Sensitivity calculated: ${autoDosingState.ecSensitivity.toFixed(4)} EC units per mL`);
          
          // Calculate remaining dose needed
          const remainingEcGap = autoDosingState.targetEC - autoDosingState.testPulseEC;
          
          if (remainingEcGap <= 0) {
            console.log('EC target reached after test pulse, no additional dosing needed');
            autoDosingState.calculatedDose = 0;
            
            // Skip final dose phase
            autoDosingState.testPulseActive = false;
            autoDosingState.testPulsePhase = null;
            
            // Schedule next check
            this.scheduleNextECCheck();
            
            // Broadcast calculation result
            broadcastFertilizerProgress({
              isDispensing: false,
              autoDosingMode: true,
              testPulseActive: false,
              testPulseComplete: true,
              ecSensitivity: autoDosingState.ecSensitivity,
              currentEC: autoDosingState.testPulseEC,
              targetEC: autoDosingState.targetEC,
              message: 'EC target reached after test pulse, no additional dose needed'
            });
            
            return;
          }
          
          // Calculate amount needed to reach target
          autoDosingState.calculatedDose = Math.ceil(remainingEcGap / autoDosingState.ecSensitivity);
          
          // Apply reasonable limits to prevent over-dosing
          const maxDoseLimit = 30; // Maximum 30mL per dose as safety limit
          if (autoDosingState.calculatedDose > maxDoseLimit) {
            console.warn(`Calculated dose (${autoDosingState.calculatedDose}mL) exceeds safety limit, capping at ${maxDoseLimit}mL`);
            autoDosingState.calculatedDose = maxDoseLimit;
          }
          
          console.log(`Calculated dose needed: ${autoDosingState.calculatedDose}mL`);
          
          // Broadcast calculation result
          broadcastFertilizerProgress({
            isDispensing: false,
            autoDosingMode: true,
            testPulseActive: true,
            testPulsePhase: 'calculation',
            ecSensitivity: autoDosingState.ecSensitivity,
            calculatedDose: autoDosingState.calculatedDose,
            baselineEC: autoDosingState.baselineEC,
            testPulseEC: autoDosingState.testPulseEC,
            targetEC: autoDosingState.targetEC,
            message: `Calculated ${autoDosingState.calculatedDose}mL needed to reach target EC`
          });
          
          // Move to final dose phase
          autoDosingState.testPulsePhase = 'final-dose';
          await this.executeTestPulsePhase();
          break;
          
        case 'final-dose':
          // No dose needed
          if (autoDosingState.calculatedDose <= 0) {
            console.log('No final dose needed');
            
            // Mark sequence complete
            autoDosingState.testPulseActive = false;
            autoDosingState.testPulsePhase = null;
            
            // Schedule next check
            this.scheduleNextECCheck();
            
            return;
          }
          
          // Disable irrigation pump before final dose dispensing
          await this.findAndDisableIrrigationPump();
          
          console.log(`Delivering final dose of ${autoDosingState.calculatedDose}mL`);
          
          // Prepare fertilizers with calculated dose
          const finalDoseFertilizers = autoDosingState.fertilizers
            .filter(f => f.id)
            .map(async fert => {
              const actuator = await Actuator.findOne({ id: fert.id });
              if (!actuator) return null;
              
              return {
                id: fert.id,
                name: actuator.name,
                amount: autoDosingState.calculatedDose,
                nutrientType: actuator.nutrientType || 'Fertilizer',
                flowRate: actuator.flowRate || 60
              };
            });
          
          // Resolve promises and filter out nulls
          const finalFertilizers = (await Promise.all(finalDoseFertilizers)).filter(f => f !== null);
          
          if (finalFertilizers.length > 0) {
            // Broadcast start of final dose
            broadcastFertilizerProgress({
              isDispensing: true,
              autoDosingMode: true,
              testPulseActive: true,
              testPulsePhase: 'final-dose',
              calculatedDose: autoDosingState.calculatedDose,
              message: 'Delivering final calculated dose'
            });
            
            // Dispense final dose
            await this.dispenseFertilizersForAutoDosing(finalFertilizers, 'final-dose');
            
            // Mark sequence as completed
            autoDosingState.testPulsePhase = null;
            autoDosingState.testPulseActive = false;
            
            // Set up final mixing phase
            autoDosingState.inMixingPhase = true;
            autoDosingState.mixingEndTime = Date.now() + (autoDosingState.checkInterval * 1000);
            autoDosingState.mixingTimeRemaining = autoDosingState.checkInterval;
            autoDosingState.nextCheckTime = autoDosingState.mixingEndTime;
            
            // Start mixing countdown
            this.startMixingCountdown();
            
            // Broadcast completion
            broadcastFertilizerProgress({
              isDispensing: false,
              autoDosingMode: true,
              testPulseActive: false,
              testPulseComplete: true,
              mixingState: true,
              mixingTimeRemaining: autoDosingState.checkInterval,
              calculatedDose: autoDosingState.calculatedDose,
              currentEC: autoDosingState.testPulseEC,
              targetEC: autoDosingState.targetEC,
              message: 'Final dose complete, waiting for mixing'
            });
          } else {
            console.error('No valid fertilizers found for final dose');
            autoDosingState.testPulseActive = false;
            this.scheduleNextECCheck();
          }
          break;
          
        default:
          console.warn('Unknown test-pulse phase:', phase);
          autoDosingState.testPulseActive = false;
          this.scheduleNextECCheck();
      }
    } catch (error) {
      console.error(`Error executing test-pulse phase ${autoDosingState.testPulsePhase}:`, error);
      autoDosingState.testPulseActive = false;
      this.scheduleNextECCheck();
    }
  }
  
  // Modify mixing countdown to support test-pulse phases
  startMixingCountdown(nextPhase = null) {
    // Clear any existing countdown
    if (autoDosingState.mixingCountdownTimer) {
      clearInterval(autoDosingState.mixingCountdownTimer);
    }
    
    // Start new countdown timer that updates every second
    autoDosingState.mixingCountdownTimer = setInterval(() => {
      if (!autoDosingState.active || 
         (!autoDosingState.inMixingPhase && !autoDosingState.testPulseActive)) {
        clearInterval(autoDosingState.mixingCountdownTimer);
        return;
      }
      
      const now = Date.now();
      const remaining = Math.max(0, Math.round((autoDosingState.mixingEndTime - now) / 1000));
      autoDosingState.mixingTimeRemaining = remaining;
      
      // Broadcast updated time every 5 seconds
      if (remaining % 5 === 0 || remaining <= 10) {
        broadcastFertilizerProgress({
          isDispensing: false,
          autoDosingMode: true,
          mixingState: true,
          testPulseActive: autoDosingState.testPulseActive,
          testPulsePhase: autoDosingState.testPulsePhase,
          mixingTimeRemaining: remaining,
          currentEC: autoDosingState.currentEC,
          targetEC: autoDosingState.targetEC
        });
      }
      
      // When mixing is complete, perform next action
      if (remaining <= 0) {
        clearInterval(autoDosingState.mixingCountdownTimer);
        autoDosingState.inMixingPhase = false;
        autoDosingState.mixingEndTime = null;
        
        if (autoDosingState.testPulseActive && nextPhase) {
          // If in test-pulse mode, advance to the next specified phase
          autoDosingState.testPulsePhase = nextPhase;
          this.executeTestPulsePhase().catch(err => {
            console.error(`Error during test-pulse phase ${nextPhase}:`, err);
          });
        } else if (autoDosingState.testPulseActive) {
          // If in test-pulse mode but no specific next phase, just advance
          this.advanceTestPulsePhase().catch(err => {
            console.error('Error advancing test-pulse phase:', err);
          });
        } else {
          // Regular auto-dosing process - trigger another EC check
          this.checkAndAdjustEC().catch(err => {
            console.error('Error during follow-up EC check:', err);
          });
        }
      }
    }, 1000);
  }
  
  // Modify dispenseFertilizersForAutoDosing to support test-pulse phases
  async dispenseFertilizersForAutoDosing(fertilizers, phase = null) {
    try {
      console.log(`Starting fertilizer dispensing for ${phase || 'auto-dosing'}`);
      
      // Update state and broadcast start of dispensing
      autoDosingState.lastDispensing = Date.now();
      autoDosingState.recentlyActive = [];
      
      // Calculate total steps for progress tracking
      const totalSteps = fertilizers.length;
      
      // Track waiting fertilizer IDs
      const waitingFertilizerIds = fertilizers.map(f => f.id);
      
      // Broadcast initial dispensing state
      broadcastFertilizerProgress({
        isDispensing: true,
        autoDosingMode: true,
        testPulseActive: autoDosingState.testPulseActive,
        testPulsePhase: autoDosingState.testPulsePhase,
        currentStep: 0,
        totalSteps: totalSteps,
        dispensingDelay: autoDosingState.dispensingDelay,
        waitingFertilizerIds,
        currentEC: autoDosingState.currentEC,
        targetEC: autoDosingState.targetEC
      });
      
      // Process fertilizers sequentially
      for (let i = 0; i < fertilizers.length; i++) {
        // Stop if auto-dosing was deactivated
        if (!autoDosingState.active) {
          console.log('Auto-dosing was stopped during dispensing');
          break;
        }
        
        const fertilizer = fertilizers[i];
        const currentFertilizerId = fertilizer.id;
        
        // Remove this fertilizer from waiting list
        const remainingWaitingIds = waitingFertilizerIds.filter(id => id !== currentFertilizerId);
        
        // Broadcast step update
        broadcastFertilizerProgress({
          isDispensing: true,
          autoDosingMode: true,
          testPulseActive: autoDosingState.testPulseActive,
          testPulsePhase: autoDosingState.testPulsePhase,
          currentStep: i + 1,
          totalSteps: totalSteps,
          currentFertilizer: currentFertilizerId,
          dispensingDelay: autoDosingState.dispensingDelay,
          waitingFertilizerIds: remainingWaitingIds,
          currentEC: autoDosingState.currentEC,
          targetEC: autoDosingState.targetEC
        });
        
        // Get the actuator
        const actuator = await Actuator.findOne({ id: currentFertilizerId });
        if (!actuator) {
          console.error(`Fertilizer pump not found: ${currentFertilizerId}`);
          continue;
        }
        
        // Track currently active fertilizer
        autoDosingState.recentlyActive.push({
          id: actuator.id,
          name: actuator.name,
          amount: fertilizer.amount,
          nutrientType: actuator.nutrientType || 'Fertilizer'
        });
        
        // Calculate dispensing time based on flow rate
        const flowRate = actuator.flowRate || fertilizer.flowRate || 60; // ml/minute
        const dispenseTimeSeconds = Math.max(3, (fertilizer.amount / (flowRate / 60))); // Convert ml/min to ml/sec, minimum 3 seconds
        
        console.log(`${phase || 'Auto-dosing'}: Dispensing ${fertilizer.amount}mL from ${actuator.name} with flow rate ${flowRate}ml/min (${dispenseTimeSeconds.toFixed(1)}s)`);
        
        // Activate the pump
        await this.updateStatus(actuator.id, {
          status: 'active',
          mode: 'manual',
          duration: dispenseTimeSeconds,
          remainingTime: dispenseTimeSeconds
        });
        
        // Wait for the dispense to complete, updating progress every second
        const startTime = Date.now();
        const endTime = startTime + (dispenseTimeSeconds * 1000);
        
        while (Date.now() < endTime && autoDosingState.active) {
          const elapsed = (Date.now() - startTime) / 1000;
          const remaining = Math.max(0, dispenseTimeSeconds - elapsed);
          
          // Broadcast progress update every second
          broadcastFertilizerProgress({
            isDispensing: true,
            autoDosingMode: true,
            testPulseActive: autoDosingState.testPulseActive,
            testPulsePhase: autoDosingState.testPulsePhase,
            currentStep: i + 1,
            totalSteps: totalSteps,
            currentFertilizer: currentFertilizerId,
            remainingTime: remaining,
            progress: Math.min(100, (elapsed / dispenseTimeSeconds) * 100),
            waitingFertilizerIds: remainingWaitingIds,
            currentEC: autoDosingState.currentEC,
            targetEC: autoDosingState.targetEC
          });
          
          await new Promise(resolve => setTimeout(resolve, 1000)); // Update every second
        }
        
        // Set back to idle
        await this.updateStatus(actuator.id, {
          status: 'idle',
          mode: 'manual'
        });
        
        // Wait for the specified delay before moving to the next fertilizer
        if (i < fertilizers.length - 1 && autoDosingState.dispensingDelay && autoDosingState.active) {
          // Broadcast delay status
          broadcastFertilizerProgress({
            isDispensing: true,
            autoDosingMode: true,
            testPulseActive: autoDosingState.testPulseActive,
            testPulsePhase: autoDosingState.testPulsePhase,
            currentStep: i + 1,
            totalSteps: totalSteps,
            inDelay: true,
            dispensingDelay: autoDosingState.dispensingDelay,
            remainingTime: autoDosingState.dispensingDelay,
            waitingFertilizerIds: remainingWaitingIds.slice(i + 1),
            currentEC: autoDosingState.currentEC,
            targetEC: autoDosingState.targetEC
          });
          
          // Wait with updates every second
          for (let d = autoDosingState.dispensingDelay; d > 0 && autoDosingState.active; d--) {
            broadcastFertilizerProgress({
              isDispensing: true,
              autoDosingMode: true,
              testPulseActive: autoDosingState.testPulseActive,
              testPulsePhase: autoDosingState.testPulsePhase,
              currentStep: i + 1,
              totalSteps: totalSteps,
              inDelay: true,
              remainingTime: d,
              waitingFertilizerIds: remainingWaitingIds.slice(i + 1),
              currentEC: autoDosingState.currentEC,
              targetEC: autoDosingState.targetEC
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // Broadcast completion of dispensing phase
      if (autoDosingState.active) {
        broadcastFertilizerProgress({
          isDispensing: false,
          autoDosingMode: true,
          testPulseActive: autoDosingState.testPulseActive,
          testPulsePhase: autoDosingState.testPulsePhase,
          currentStep: fertilizers.length,
          totalSteps: totalSteps,
          completed: true,
          waitingFertilizerIds: [],
          currentEC: autoDosingState.currentEC,
          targetEC: autoDosingState.targetEC,
          message: phase ? `${phase} dispensing complete` : 'Dispensing complete'
        });
      }
      
      console.log(`${phase || 'Auto-dosing'} dispensing sequence complete`);
    } catch (error) {
      console.error(`Error during ${phase || 'auto-dosing'} fertilizer dispensing:`, error);
      
      // Reset any active pumps
      const activePumps = await Actuator.find({ 
        type: 'fertilizer-pump',
        status: 'active'
      });
      
      const stopPromises = activePumps.map(pump => 
        this.updateStatus(pump.id, {
          status: 'idle',
          mode: 'manual'
        }).catch(err => {
          console.warn(`Failed to stop pump ${pump.id}: ${err.message}`);
          return null;
        })
      );
      
      await Promise.all(stopPromises);
      
      // Broadcast error
      broadcastFertilizerProgress({
        isDispensing: false,
        autoDosingMode: true,
        testPulseActive: autoDosingState.testPulseActive,
        error: error.message,
        waitingFertilizerIds: []
      });
      
      throw error;
    }
  }
  
  // Update startAutoDosing to disable irrigation pump before starting
  async startAutoDosing(config) {
    try {
      console.log('Starting auto-dosing with config:', config);
      
      // Validate required fields
      if (!config.targetEC || !config.checkInterval || !config.fertilizers || !config.waterVolume) {
        throw new Error('Missing required auto-dosing parameters');
      }
      
      // Stop any existing auto-dosing first
      if (autoDosingState.active) {
        await this.stopAutoDosing();
      }
      
      // Disable irrigation pump before starting auto-dosing
      await this.findAndDisableIrrigationPump();
      
      // Activate sensor pump for mixing
      await this.findAndActivateSensorPump();
      
      // Convert and validate the targetEC value - ensure it's in mS/cm format
      let targetEC = parseFloat(config.targetEC);
      if (isNaN(targetEC)) {
        targetEC = 2.0; // Default if invalid
        console.warn(`Invalid targetEC value: ${config.targetEC}, using default: ${targetEC}`);
      } else if (targetEC > 100) {
        // If the targetEC is given in μS/cm format, convert to mS/cm
        targetEC = targetEC / 1000;
        console.log(`Converting targetEC from μS/cm to mS/cm: ${targetEC}`);
      }
      
      // Initialize auto-dosing state
      autoDosingState = {
        active: true,
        targetEC: targetEC,
        currentEC: config.currentEC ? this.convertToMSCM(parseFloat(config.currentEC)) : null,
        waterVolume: parseFloat(config.waterVolume),
        checkInterval: parseInt(config.checkInterval),
        dispensingDelay: parseInt(config.dispensingDelay || 5),
        lastCheck: Date.now(),
        nextCheckTime: Date.now() + (parseInt(config.checkInterval) * 1000),
        fertilizers: config.fertilizers,
        recentlyActive: [], 
        inMixingPhase: false,
        mixingEndTime: null,
        mixingTimeRemaining: null,
        
        // Initialize test-pulse parameters
        testPulseActive: false,
        testPulsePhase: null,
        baselineEC: null,
        testPulseEC: null,
        testPulseAmount: config.testPulseAmount || 5, // Default 5mL test pulse
        ecSensitivity: null,
        calculatedDose: null,
        phasesCompleted: []
      };
      
      console.log('Auto-dosing initialized with state:', {
        ...autoDosingState,
        targetEC: `${autoDosingState.targetEC} mS/cm`,
        currentEC: autoDosingState.currentEC ? `${autoDosingState.currentEC} mS/cm` : 'Not set yet'
      });
      
      // Perform initial EC check with proper error handling
      try {
        await this.checkAndAdjustEC();
      } catch (checkError) {
        console.error('Error during initial EC check:', checkError);
        // Continue anyway - we'll retry on next cycle
      }
      
      return {
        success: true,
        message: 'Auto-dosing started successfully with test-pulse method',
        status: this.getAutoDosingStatus()
      };
    } catch (error) {
      console.error('Error starting auto-dosing:', error);
      
      // Try to deactivate sensor pump on error
      try {
        await this.deactivateSensorPump();
      } catch (pumpError) {
        console.warn('Failed to deactivate sensor pump after auto-dosing start error:', pumpError);
      }
      
      autoDosingState.active = false;
      throw error;
    }
  }
  
  // Update getAutoDosingStatus to include test-pulse information
  getAutoDosingStatus() {
    return {
      active: autoDosingState.active,
      targetEC: autoDosingState.targetEC,
      currentEC: autoDosingState.currentEC,
      waterVolume: autoDosingState.waterVolume,
      checkInterval: autoDosingState.checkInterval,
      dispensingDelay: autoDosingState.dispensingDelay,
      lastCheck: autoDosingState.lastCheck,
      lastDispensing: autoDosingState.lastDispensing,
      nextCheckTime: autoDosingState.nextCheckTime,
      recentlyActive: autoDosingState.recentlyActive,
      inMixingPhase: autoDosingState.inMixingPhase,
      mixingEndTime: autoDosingState.mixingEndTime,
      mixingTimeRemaining: autoDosingState.mixingTimeRemaining,
      
      // Test-pulse method specific information
      testPulseActive: autoDosingState.testPulseActive,
      testPulsePhase: autoDosingState.testPulsePhase,
      baselineEC: autoDosingState.baselineEC,
      testPulseEC: autoDosingState.testPulseEC,
      testPulseAmount: autoDosingState.testPulseAmount,
      ecSensitivity: autoDosingState.ecSensitivity,
      calculatedDose: autoDosingState.calculatedDose,
      phasesCompleted: autoDosingState.phasesCompleted
    };
  }
  
  // Helper method for consistent EC unit conversion
  convertToMSCM(value) {
    if (value === null || value === undefined || isNaN(value)) {
      return null;
    }
    
    // Convert to a number to ensure proper handling
    const numericValue = parseFloat(value);
    
    // If the value is high (likely in μS/cm), convert to mS/cm
    if (numericValue > 100) {
      return numericValue / 1000;
    }
    
    // Otherwise assume it's already in mS/cm
    return numericValue;
  }
  
  // Get latest EC reading from sensor data (already updated with mS/cm conversion)
  async getLatestECReading() {
    try {
      // In a production system, this would fetch from your sensor database
      // For now, we'll simulate with the stored value or a default
      
      // Check if we have a stored EC value
      if (autoDosingState.currentEC !== null) {
        return autoDosingState.currentEC;
      }
      
      // Try to get from database (this will depend on your sensor data model)
      // Placeholder code - replace with your actual sensor data access method
      try {
        const Reading = require('../models/Reading');
        const latestReading = await Reading.findOne({ 
          type: 'ec'
        }).sort({ timestamp: -1 }).limit(1);
        
        if (latestReading && latestReading.value !== undefined) {
          // Convert μS/cm to mS/cm if needed
          let ecValue = latestReading.value;
          if (ecValue > 100) { // likely in μS/cm
            ecValue = ecValue / 1000;
          }
          return ecValue;
        }
      } catch (dbError) {
        console.warn('Error fetching EC reading from database:', dbError);
      }
      
      // Default value if we couldn't get a real reading
      return 1.0; // Default EC assumption
    } catch (error) {
      console.error('Error getting latest EC reading:', error);
      return 1.0; // Default fallback
    }
  }
}

module.exports = new ActuatorController();

