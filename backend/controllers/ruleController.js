const mongoose = require('mongoose');
const Rule = require('../models/Rule');
const ActuatorController = require('./ActuatorController');
const Reading = require('../models/Reading');
const Sensor = require('../models/Sensor');

class RuleController {
  // Get all rules
  async getAllRules() {
    try {
      return await Rule.find({}).sort({ priority: -1, createdAt: -1 });
    } catch (error) {
      console.error('[RuleController] Error fetching rules:', error);
      throw error;
    }
  }

  // Create a new rule
  async createRule(ruleData) {
    try {
      console.log('[RuleController] Creating new rule:', ruleData);
      
      // Remove any duration-related fields if present
      const { durationEnabled, duration, ...cleanedRuleData } = ruleData;
      
      const rule = new Rule({
        name: cleanedRuleData.name || `${cleanedRuleData.trigger} ${cleanedRuleData.condition} ${cleanedRuleData.value}`,
        ...cleanedRuleData
      });
      
      await rule.save();
      return rule;
    } catch (error) {
      console.error('[RuleController] Error creating rule:', error);
      throw error;
    }
  }

  // Get a rule by ID
  async getRuleById(id) {
    try {
      console.log(`[RuleController] Fetching rule with ID: ${id}`);
      
      // Validate ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        console.error(`[RuleController] Invalid ObjectID format: ${id}`);
        throw new Error('Invalid rule ID format');
      }
      
      const rule = await Rule.findById(id);
      
      if (!rule) {
        console.error(`[RuleController] Rule not found with ID: ${id}`);
        throw new Error('Rule not found');
      }
      
      return rule;
    } catch (error) {
      console.error('[RuleController] Error fetching rule:', error);
      throw error;
    }
  }

  // Update a rule
  async updateRule(id, ruleData) {
    try {
      console.log(`[RuleController] Updating rule with ID: ${id}`, ruleData);
      
      // First validate the ID is a valid ObjectID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        console.error(`[RuleController] Invalid ObjectID format: ${id}`);
        throw new Error('Invalid rule ID format');
      }
      
      // Get the existing rule to check for actuator changes
      const existingRule = await Rule.findById(id);
      if (!existingRule) {
        console.error(`[RuleController] Rule not found with ID: ${id}`);
        throw new Error('Rule not found');
      }
      
      // Check if the actuator is being changed and if the rule is currently active
      if (ruleData.actuatorId && 
          existingRule.actuatorId !== ruleData.actuatorId && 
          existingRule.currentlyActive) {
        
        console.log(`[RuleController] Rule is changing actuator from ${existingRule.actuatorId} to ${ruleData.actuatorId} while active`);
        
        // Deactivate the current actuator first
        await this.deactivateCurrentActuator(existingRule);
      }
      
      // Now update the rule
      const rule = await Rule.findByIdAndUpdate(id, ruleData, { new: true });
      
      console.log(`[RuleController] Rule updated successfully: ${rule.name}`);
      return rule;
    } catch (error) {
      console.error('[RuleController] Error updating rule:', error);
      throw error;
    }
  }

  // Helper method to deactivate the current actuator
  async deactivateCurrentActuator(rule) {
    try {
      console.log(`[RuleController] Deactivating current actuator ${rule.actuatorId} before switching`);
      
      // Get the actuator
      const actuator = await ActuatorController.getActuatorStatus(rule.actuatorId);
      if (!actuator) {
        console.error(`[RuleController] ❌ Could not find actuator with ID ${rule.actuatorId}`);
        return;
      }
      
      // Only attempt to restore actuator state if it's in rule mode and triggered by THIS rule
      if (actuator.mode === 'rule' && 
          actuator.triggeredByRule && 
          actuator.triggeredByRule.toString() === rule._id.toString()) {
        
        // Determine the mode to revert to
        const targetMode = actuator.previousMode || 'manual';
        
        console.log(`[RuleController] Restoring actuator ${actuator.name} from rule mode to ${targetMode} mode`);
        
        const settings = {
          id: rule.actuatorId,
          status: 'idle', // Set actuator to idle
          mode: targetMode, // Restore to previous mode
          overrideMode: false,
          triggeredByRule: null
        };
        
        try {
          const updatedActuator = await ActuatorController.updateSettings(rule.actuatorId, settings);
          
          console.log(`[RuleController] ✅ Actuator restored to previous state:`, {
            status: updatedActuator.status,
            mode: updatedActuator.mode,
            overrideMode: updatedActuator.overrideMode
          });
        } catch (updateError) {
          console.error(`[RuleController] ❌ Failed to restore actuator:`, updateError);
        }
      } else {
        console.log(`[RuleController] Actuator not controlled by this rule, no restoration needed`);
      }
    } catch (error) {
      console.error(`[RuleController] Error deactivating current actuator:`, error);
    }
  }

  // Delete a rule
  async deleteRule(id) {
    try {
      // Validate ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid rule ID format');
      }
      
      // First, check if rule is active and deactivate it if needed
      const rule = await Rule.findById(id);
      if (!rule) {
        throw new Error('Rule not found');
      }
      
      // If rule is active, deactivate it first to release any associated actuator
      if (rule.currentlyActive) {
        await this.deactivateRule(rule);
      }
      
      // Delete the rule
      await Rule.findByIdAndDelete(id);
      return { success: true, message: 'Rule deleted successfully' };
    } catch (error) {
      console.error('[RuleController] Error deleting rule:', error);
      throw error;
    }
  }

  // Toggle rule status
  async toggleRuleStatus(id) {
    console.log(`[RuleController] Toggle rule status request for ID: ${id}`);
    
    try {
      // Validate ObjectID format (this should be done in the route as well)
      if (!mongoose.Types.ObjectId.isValid(id)) {
        console.error(`[RuleController] Invalid ObjectID format: ${id}`);
        throw new Error('Invalid rule ID format');
      }
      
      // Find the rule with minimal projection
      const rule = await Rule.findById(id);
      
      // Check if rule exists
      if (!rule) {
        console.error(`[RuleController] Rule not found with ID: ${id}`);
        throw new Error('Rule not found');
      }
      
      // Toggle the status
      rule.enabled = !rule.enabled;
      console.log(`[RuleController] Setting rule "${rule.name}" enabled status to: ${rule.enabled}`);
      
      // If disabling an active rule, deactivate it first
      if (!rule.enabled && rule.currentlyActive) {
        console.log(`[RuleController] Rule is currently active but being disabled. Deactivating...`);
        await this.deactivateRule(rule);

        // Force rule properties to be false/null after deactivation to ensure state consistency
        rule.currentlyActive = false;
        rule.activeSince = null;
      }
      
      // Save changes to the rule
      await rule.save();
      
      return rule;
    } catch (error) {
      console.error(`[RuleController] Error in toggleRuleStatus:`, error);
      throw error; // Re-throw to let the route handler deal with it
    }
  }

  // Check and apply rules
  async checkAndApplyRules() {
    try {
      console.log('[RuleController] Checking rules');
      const rules = await Rule.find({ enabled: true }).sort({ priority: -1 });
      const reading = await this.getLatestReading();

      if (!reading) {
        console.log('[RuleController] No sensor readings available, skipping rule check');
        return;
      }

      console.log(`[RuleController] Retrieved ${rules.length} active rules`);

      // Get all actuators currently in rule mode
      let actuatorsInRuleMode = {};
      try {
        const actuatorList = await ActuatorController.getActuatorsStatus();
        actuatorList.forEach(actuator => {
          if (actuator.mode === 'rule' && actuator.triggeredByRule) {
            actuatorsInRuleMode[actuator.id] = actuator;
          }
        });
        console.log(`[RuleController] Found ${Object.keys(actuatorsInRuleMode).length} actuators in rule mode`);
      } catch (error) {
        console.error('[RuleController] Error fetching actuator status:', error);
      }

      // Process rules sequentially to maintain control flow
      for (const rule of rules) {
        // Skip rules on cooldown
        if (rule.cooldownUntil && new Date(rule.cooldownUntil) > new Date()) {
          const timeRemaining = Math.round((new Date(rule.cooldownUntil) - new Date()) / 1000);
          console.log(`[RuleController] Rule "${rule.name}" is on cooldown for ${timeRemaining} more seconds`);
          continue;
        }

        // Skip fertilizer dispensing rules that haven't met minimum interval
        if (rule.action.includes('Release Fertilizer') && rule.minInterval) {
          const now = new Date();
          const lastTriggered = rule.lastTriggered ? new Date(rule.lastTriggered) : null;
          
          if (lastTriggered) {
            // Calculate elapsed time since last trigger in minutes
            const elapsedMinutes = (now - lastTriggered) / (1000 * 60);
            
            // Check if minimum interval has passed
            if (elapsedMinutes < rule.minInterval) {
              const remainingMinutes = Math.ceil(rule.minInterval - elapsedMinutes);
              console.log(`[RuleController] Fertilizer rule "${rule.name}" needs ${remainingMinutes} more minutes before dispensing`);
              continue;
            }
          }
        }

        const shouldActivate = await this.evaluateRule(rule, reading);
        
        if (shouldActivate && !rule.currentlyActive) {
          console.log(`[RuleController] Rule "${rule.name}" activated`);
          
          // If this actuator is already controlled by a different rule, deactivate that rule first
          const targetActuator = actuatorsInRuleMode[rule.actuatorId];
          if (targetActuator && 
              targetActuator.triggeredByRule && 
              targetActuator.triggeredByRule.toString() !== rule._id.toString()) {
            
            console.log(`[RuleController] Actuator ${rule.actuatorId} already controlled by rule ${targetActuator.triggeredByRule}`);
            
            // Find the other rule
            const conflictingRule = await Rule.findById(targetActuator.triggeredByRule);
            
            if (conflictingRule) {
              console.log(`[RuleController] Deactivating conflicting rule: ${conflictingRule.name}`);
              await this.deactivateRule(conflictingRule);
              
              // Update actuators in rule mode tracking
              delete actuatorsInRuleMode[rule.actuatorId];
            }
          }
          
          // For fertilizer rules, always check the EC level is below threshold
          if (rule.action.includes('Release Fertilizer') && rule.checkEcLevel) {
            const ecKey = this.getSensorKey('EC Level');
            if (reading[ecKey] && reading[ecKey].value >= rule.maxEcLevel) {
              console.log(`[RuleController] Skipping fertilizer release due to high EC: ${reading[ecKey].value} >= ${rule.maxEcLevel}`);
              continue;
            }
          }

          // Now apply this rule
          await this.applyRule(rule);
          
          // Update tracking of actuators in rule mode
          actuatorsInRuleMode[rule.actuatorId] = {
            id: rule.actuatorId,
            mode: 'rule',
            triggeredByRule: rule._id
          };
          
        } else if (!shouldActivate && rule.currentlyActive) {
          console.log(`[RuleController] Rule "${rule.name}" deactivated`);
          
          // Deactivate this rule
          await this.deactivateRule(rule);
          
          // Remove from actuators tracking
          if (actuatorsInRuleMode[rule.actuatorId] && 
              actuatorsInRuleMode[rule.actuatorId].triggeredByRule.toString() === rule._id.toString()) {
            delete actuatorsInRuleMode[rule.actuatorId];
          }
        }
      }

      console.log('[RuleController] Rule check complete');
    } catch (error) {
      console.error('[RuleController] Error checking rules:', error);
    }
  }

  // Get the latest sensor reading
  async getLatestReading() {
    try {
      const latestSensor = await Sensor.findOne().sort({ timestamp: -1 });
      
      if (!latestSensor) {
        console.log('[RuleController] No sensor readings found');
        return null;
      }
      
      // Extract only the actual readings (no metadata)
      return latestSensor.readings;
    } catch (error) {
      console.error('[RuleController] Error fetching latest reading:', error);
      return null;
    }
  }

  // Evaluate a specific rule against a reading
  async evaluateRule(rule, reading) {
    try {
      // Skip evaluation if rule is not enabled
      if (!rule.enabled) {
        return false;
      }
      
      // Get the sensor reading value based on the trigger type
      const triggerKey = this.getSensorKey(rule.trigger);
      if (!triggerKey || !reading[triggerKey]) {
        console.log(`[RuleController] No data for ${rule.trigger}`);
        return false;
      }
      
      const sensorValue = reading[triggerKey].value;
      
      // Check for sensor error condition (like -127 for temperature)
      if (sensorValue === -127) {
        console.log(`[RuleController] Sensor error detected for ${rule.trigger}`);
        return false;
      }
      
      // Compare based on condition
      let conditionMet = false;
      switch (rule.condition) {
        case '<':
          conditionMet = sensorValue < rule.value;
          break;
        case '>':
          conditionMet = sensorValue > rule.value;
          break;
        case '=':
          // Use a small epsilon for floating point equality
          conditionMet = Math.abs(sensorValue - rule.value) < 0.1;
          break;
      }
      
      // Check if the rule is currently active
      if (rule.currentlyActive) {
        // For active rules, check until condition if enabled
        if (rule.untilConditionEnabled) {
          const untilKey = this.getSensorKey(rule.untilTrigger);
          if (!untilKey || !reading[untilKey]) {
            console.log(`[RuleController] No data for until condition ${rule.untilTrigger}`);
            return true; // Keep active if we can't evaluate until condition
          }
          
          const untilValue = reading[untilKey].value;
          
          // Check for sensor error condition (like -127 for temperature)
          if (untilValue === -127) {
            console.log(`[RuleController] Sensor error detected for ${rule.untilTrigger}`);
            return true; // Keep active if sensor error
          }
          
          // Evaluate until condition
          let untilConditionMet = false;
          switch (rule.untilCondition) {
            case '<':
              untilConditionMet = untilValue < rule.untilValue;
              break;
            case '>':
              untilConditionMet = untilValue > rule.untilValue;
              break;
            case '=':
              untilConditionMet = Math.abs(untilValue - rule.untilValue) < 0.1;
              break;
          }
          
          // Deactivate rule if until condition is met
          if (untilConditionMet) {
            console.log(`[RuleController] Until condition met for rule "${rule.name}"`);
            return false;
          }
          
          return true; // Keep active otherwise
        }
        
        // For regular trigger condition, keep active as long as condition is met
        return conditionMet;
      } else {
        // Rule is not active yet, activate if condition is met
        return conditionMet;
      }
    } catch (error) {
      console.error(`[RuleController] Error evaluating rule ${rule._id}:`, error);
      return false;
    }
  }

  // Helper function to get sensor reading key based on trigger type
  getSensorKey(trigger) {
    const keyMap = {
      'pH Level': 'ph',
      'EC Level': 'ec',
      'Water Level': 'waterLevel',
      'Air Temperature': 'airTemp',
      'Water Temperature': 'waterTemp'
    };
    return keyMap[trigger];
  }

  // Apply a rule's action
  async applyRule(rule) {
    try {
      console.log(`[RuleController] Applying rule "${rule.name}" to actuator ${rule.actuatorId}`);
      
      // Get the actuator
      const actuator = await ActuatorController.getActuatorStatus(rule.actuatorId);
      if (!actuator) {
        console.error(`[RuleController] ❌ Could not find actuator with ID ${rule.actuatorId}`);
        return;
      }
      
      // Debug dump of actuator state
      console.log(`[RuleController] Current actuator state:`, JSON.stringify({
        id: actuator.id,
        name: actuator.name,
        type: actuator.type,
        status: actuator.status,
        mode: actuator.mode,
        overrideMode: actuator.overrideMode
      }, null, 2));
      
      // Determine the correct actuator status based on the rule action
      let newStatus = 'active'; // Default for "Turn On" actions
      if (rule.action.includes('Turn Off')) {
        newStatus = 'idle';
      } else if (rule.action.includes('Release')) {
        // For release actions, just trigger a release
        console.log(`[RuleController] Rule action is a release operation`);
      }
      
      console.log(`[RuleController] Rule action "${rule.action}" translates to status: ${newStatus}`);
      
      // Create explicit settings object with all required fields
      const settings = {
        id: rule.actuatorId,
        status: newStatus,
        mode: 'rule',
        overrideMode: true,
        triggeredByRule: rule._id,
        enabled: true // Make sure actuator is enabled
      };
      
      // Store previous mode if overriding a non-rule mode
      if (actuator.mode !== 'rule') {
        settings.previousMode = actuator.mode || 'manual';
        console.log(`[RuleController] Storing previous mode: ${settings.previousMode}`);
      } else if (!actuator.previousMode) {
        // If actuator is already in rule mode but somehow doesn't have previousMode set
        settings.previousMode = 'manual'; // Set a default
        console.log(`[RuleController] No previous mode found, setting default: manual`);
      }
      
      // Add solution amount for release actions
      if (rule.action.includes('Release')) {
        settings.solutionAmount = rule.solutionAmount || 0;
      }

      console.log(`[RuleController] Final settings to be sent to actuator:`, JSON.stringify(settings, null, 2));
      
      try {
        const updatedActuator = await ActuatorController.updateSettings(rule.actuatorId, settings);
        
        if (!updatedActuator) {
          throw new Error('Actuator update returned null');
        }
        
        console.log(`[RuleController] ✅ Actuator updated successfully:`, {
          status: updatedActuator.status,
          mode: updatedActuator.mode,
          previousMode: updatedActuator.previousMode,
          overrideMode: updatedActuator.overrideMode
        });
      } catch (updateError) {
        console.error(`[RuleController] ❌ Failed to update actuator:`, updateError);
        throw updateError;
      }
      
      // Update rule status only after successful actuator update
      rule.lastTriggered = new Date();
      rule.currentlyActive = true;
      rule.activeSince = new Date();
      await rule.save();
      
      console.log(`[RuleController] ✅ Rule "${rule.name}" applied successfully, status updated in database`);
    } catch (error) {
      console.error(`[RuleController] Error applying rule ${rule._id}:`, error);
    }
  }

  // Deactivate a rule
  async deactivateRule(rule) {
    try {
      console.log(`[RuleController] Deactivating rule "${rule.name}" (${rule._id})`);
      
      // Get the actuator
      const actuator = await ActuatorController.getActuatorStatus(rule.actuatorId);
      if (!actuator) {
        console.error(`[RuleController] ❌ Could not find actuator with ID ${rule.actuatorId}`);
        
        // Still mark the rule as inactive in the database even if actuator isn't found
        rule.currentlyActive = false;
        rule.activeSince = null;
        
        await rule.save();
        
        console.log(`[RuleController] ⚠️ Rule marked as inactive, but actuator not found`);
        return;
      }
      
      console.log(`[RuleController] Found actuator: ${actuator.name} (${actuator.id})`);
      console.log(`[RuleController] Current actuator state: mode=${actuator.mode}, triggeredByRule=${actuator.triggeredByRule}, previousMode=${actuator.previousMode || 'not set'}`);
      
      // Only attempt to restore actuator state if it's in rule mode and triggered by THIS rule
      if (actuator.mode === 'rule' && 
          actuator.triggeredByRule && 
          actuator.triggeredByRule.toString() === rule._id.toString()) {
        
        // Determine the mode to revert to
        const targetMode = actuator.previousMode || 'manual';
        
        console.log(`[RuleController] Restoring actuator ${actuator.name} from rule mode to ${targetMode} mode`);
        
        const settings = {
          id: rule.actuatorId,
          status: 'idle', // Set actuator to idle
          mode: targetMode, // Restore to previous mode
          overrideMode: false,
          triggeredByRule: null
        };
        
        try {
          const updatedActuator = await ActuatorController.updateSettings(rule.actuatorId, settings);
          
          console.log(`[RuleController] ✅ Actuator restored to previous state:`, {
            status: updatedActuator.status,
            mode: updatedActuator.mode,
            overrideMode: updatedActuator.overrideMode
          });
        } catch (updateError) {
          console.error(`[RuleController] ❌ Failed to restore actuator:`, updateError);
        }
      } else {
        if (actuator.mode !== 'rule') {
          console.log(`[RuleController] Actuator not in rule mode - no restoration needed`);
        } else if (!actuator.triggeredByRule) {
          console.log(`[RuleController] Actuator in rule mode but has no triggeredByRule - restoring to manual mode`);
          await ActuatorController.updateSettings(rule.actuatorId, {
            id: rule.actuatorId,
            mode: 'manual',
            status: 'idle', 
            overrideMode: false,
            triggeredByRule: null
          });
        } else {
          console.log(`[RuleController] Actuator triggered by different rule (${actuator.triggeredByRule}) - not restoring`);
        }
      }
      
      // Update rule status
      rule.currentlyActive = false;
      rule.activeSince = null;
      
      await rule.save();
      
      console.log(`[RuleController] ✅ Rule "${rule.name}" deactivated successfully`);
    } catch (error) {
      console.error(`[RuleController] Error deactivating rule ${rule._id}:`, error);
    }
  }
}

module.exports = new RuleController();
