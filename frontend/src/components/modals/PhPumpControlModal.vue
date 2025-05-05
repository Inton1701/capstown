<template>
  <div class="ph-pump-modal" v-if="actuator">
    <!-- Add notification banner at the top of the modal -->
    <div 
      v-if="notification.show" 
      class="notification-banner"
      :class="notification.type"
    >
      <i :class="notification.icon"></i>
      {{ notification.message }}
    </div>

    <!-- Tab Navigation -->
    <div class="tab-navigation">
      <button 
        class="tab-button" 
        :class="{ active: activeTab === 'settings' }"
        @click="activeTab = 'settings'"
      >
        <i class="fas fa-sliders-h me-2"></i>Settings
      </button>
      <button 
        class="tab-button" 
        :class="{ active: activeTab === 'calibration' }"
        @click="activeTab = 'calibration'"
      >
        <i class="fas fa-balance-scale me-2"></i>Calibration
      </button>
      <button 
        class="tab-button" 
        :class="{ active: activeTab === 'manual-dose' }"
        @click="activeTab = 'manual-dose'"
      >
        <i class="fas fa-syringe me-2"></i>Manual Dose
      </button>
    </div>
    
    <!-- Settings Tab -->
    <div v-if="activeTab === 'settings'" class="tab-content">
      <div class="setting-group">
        <label class="setting-label">
          <i class="fas" :class="actuator.direction === 'up' ? 'fa-arrow-up' : 'fa-arrow-down'"></i>
          {{ actuator.name }}
        </label>
        
        <!-- Toggle Slider Switch -->
        <div class="switch-container">
          <span class="switch-label">{{ localState.enabled ? 'Enabled' : 'Disabled' }}</span>
          <label class="switch">
            <input
              type="checkbox"
              :checked="localState.enabled"
              @change="handleToggle"
            >
            <span class="slider round"></span>
          </label>
        </div>
        
        <!-- Fix flow rate display in settings tab to properly show the value -->
        <div class="pump-specs" :class="{ 'disabled': !localState.enabled }">
          <i class="fas fa-info-circle"></i>
          <span>Flow Rate: </span>
          <span class="flow-rate-value">{{ Number(localState.flowRate).toFixed(1) }} mL/min</span>
        </div>
      </div>
      
      <!-- Add modal-footer for settings tab -->
      <div class="modal-footer">
        <button 
          class="btn-test"
          :disabled="!localState.enabled"
          @click="testPump"
        >
          <i :class="testButtonIcon"></i>
          {{ testButtonText }}
        </button>
        <button 
          class="btn-save"
          @click="saveChanges"
        >
          <i class="fas fa-save me-2"></i>
          Save Changes
        </button>
      </div>
    </div>
    
    <!-- Calibration Tab -->
    <div v-if="activeTab === 'calibration'" class="tab-content">
      <div class="calibration-info mb-3">
        <i class="fas fa-info-circle me-2"></i>
        <span>Calibrate your pump by testing at three different flow rates and measuring the actual output.</span>
      </div>
      
      <div class="calibration-stages">
        <div 
          v-for="(stage, index) in calibrationStages" 
          :key="`stage-${index}`"
          class="calibration-stage"
          :class="{ 'active': currentStage === index, 'completed': stage.completed }"
        >
          <div class="stage-header">
            <div class="stage-title">Stage {{ index + 1 }}</div>
            <div class="stage-status">{{ getStageStatus(index) }}</div>
          </div>
          
          <div class="stage-content">
            <div class="stage-description">
              Run the pump and measure the actual amount of fluid pumped during a 30-second test.
            </div>
            
            <div class="form-group">
              <label>Measured Flow Rate (mL/min):</label>
              <input 
                type="number" 
                v-model.number="stage.measuredRate"
                class="flow-rate-input"
                step="0.1"
                min="0"
                :disabled="isCalibrationRunning || !stage.testCompleted"
              >
            </div>
            
            <div class="stage-actions">
              <button 
                class="btn-test-stage"
                :disabled="isCalibrationRunning && currentStage !== index"
                @click="runCalibrationStage(index)"
              >
                <i class="fas" :class="stage.isRunning ? 'fa-stop' : 'fa-play'"></i>
                {{ stage.isRunning ? 'Stop Test' : 'Run 30s Test' }}
              </button>
              
              <button
                class="btn-save-stage"
                :disabled="!stage.testCompleted || stage.measuredRate <= 0 || isCalibrationRunning"
                @click="saveStage(index)"
              >
                <i class="fas" :class="stage.completed ? 'fa-check-circle' : 'fa-check'"></i>
                {{ stage.completed ? 'Saved' : 'Confirm' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="calibration-result" v-if="hasCompletedCalibration">
        <div class="result-header">Calibration Results</div>
        <div class="result-content">
          <p>Based on your measurements, the calibrated flow rate is: <strong class="result-value">{{ averageFlowRate.toFixed(1) }} mL/min</strong></p>
          <p>This will be applied to all flow rate settings for more accurate dispensing.</p>
        </div>
      </div>
      
      <div class="modal-footer">
        <button 
          class="btn-reset"
          @click="resetCalibration"
          :disabled="isCalibrationRunning"
        >
          <i class="fas fa-redo me-2"></i>
          Reset
        </button>
        <button 
          class="btn-save"
          @click="saveCalibration"
          :disabled="isCalibrationRunning || !hasCompletedCalibration"
        >
          <i class="fas fa-save me-2"></i>
          Save Calibration
        </button>
      </div>
    </div>

    <!-- Manual Dose Tab -->
    <div v-if="activeTab === 'manual-dose'" class="tab-content">
      <div class="dose-info mb-3">
        <i class="fas fa-info-circle me-2"></i>
        <span>Manually dispense a specific amount of pH solution.</span>
      </div>
      
      <div class="dose-settings">
        <div class="form-group">
          <label class="setting-label">
            <i :class="actuator.direction === 'up' ? 'fa-arrow-up' : 'fa-arrow-down'" class="fas"></i>
            Amount to dispense:
          </label>
          <div class="input-group">
            <input 
              type="number" 
              v-model="doseAmount" 
              class="form-control" 
              min="0.1" 
              step="0.1"
              :disabled="dosing"
            />
            <span class="input-group-text">mL</span>
          </div>
          <small class="text-muted">
            At the current flow rate of {{ Number(localState.flowRate).toFixed(1) }} mL/min, 
            this will take approximately {{ calculateDoseTime }} seconds.
          </small>
        </div>
        
        <div class="dose-status" v-if="dosing">
          <div class="progress mb-2">
            <div 
              class="progress-bar progress-bar-striped progress-bar-animated" 
              role="progressbar" 
              :style="{ width: doseProgress + '%' }"
            ></div>
          </div>
          <p class="text-center">
            Dispensing... {{ Math.ceil(doseTimeRemaining) }}s remaining
          </p>
        </div>
        
        <div class="modal-footer">
          <button 
            class="btn-test"
            :disabled="dosing || doseAmount <= 0 || !localState.enabled"
            @click="startDosing"
          >
            <i class="fas fa-syringe me-2"></i>
            Dose Now
          </button>
          <button 
            class="btn-danger"
            v-if="dosing"
            @click="stopDosing"
          >
            <i class="fas fa-stop me-2"></i>
            Stop
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watchEffect, computed, onMounted, onBeforeUnmount } from 'vue';
import { Modal } from 'bootstrap';

const props = defineProps({
  actuator: {
    type: Object,
    required: true,
    validator: (value) => {
      return value && value.id && value.type === 'ph-pump';
    }
  }
});

const emit = defineEmits(['close', 'save']);

// Tab control
const activeTab = ref('settings');

// Create local state for each pump instance
const localState = ref({
  isActive: false,
  enabled: false, // Add separate enabled property
  flowRate: 0,
  id: '',
  direction: '',
  status: 'idle',
  calibrationFactor: 1.0, // Default calibration factor
  testMode: false // Track test mode explicitly
});

// Initialize state when actuator changes
watchEffect(() => {
  if (props.actuator) {
    localState.value = {
      isActive: props.actuator.status === 'active',
      enabled: props.actuator.enabled === undefined ? (props.actuator.status === 'active') : props.actuator.enabled,
      status: props.actuator.status || 'idle',
      flowRate: Number(props.actuator.flowRate || 0),
      id: props.actuator.id,
      direction: props.actuator.direction,
      calibrationFactor: props.actuator.calibrationFactor || 1.0,
      testMode: false // Always reset test mode when actuator changes
    };
  }
});

// Toggle only changes enabled, not status
const handleToggle = (event) => {
  localState.value.enabled = event.target.checked;
};

// Add reactive computed properties for the button state
const testButtonText = computed(() => {
  return localState.value.status === 'active' && localState.value.testMode ? 'Stop Test' : 'Test';
});

const testButtonIcon = computed(() => {
  return localState.value.status === 'active' && localState.value.testMode ? 'fas fa-stop me-2' : 'fas fa-vial me-2';
});

// Add an explicit function to handle the modal closing
const handleModalClose = () => {
  console.log('Modal closing - stopping any test operation');
  stopTestIfRunning();
  
  // Also stop any calibration or dosing
  calibrationStages.value.forEach((stage, index) => {
    if (stage.isRunning) {
      stopCalibrationStage(index);
    }
  });
  
  if (dosing.value) {
    stopDosing();
  }
};

// Unified test pump function that handles test mode
const testPump = async () => {
  if (!localState.value.enabled) return;
  
  // Toggle status based on current test mode
  const newStatus = localState.value.status === 'active' && localState.value.testMode ? 'idle' : 'active';
  const isTestMode = newStatus === 'active';
  
  // Update local state immediately for UI responsiveness
  localState.value.status = newStatus;
  localState.value.testMode = isTestMode;
  
  // Create settings object
  const testSettings = {
    ...props.actuator,
    id: localState.value.id,
    status: newStatus,
    flowRate: localState.value.flowRate,
    direction: localState.value.direction,
    type: 'ph-pump',
    testMode: true,
    duration: isTestMode ? 5 : 0
  };
  
  // Emit the save event to update the database
  emit('save', testSettings);
};

// Unified function to stop test mode
const stopTestIfRunning = () => {
  if (localState.value.testMode && localState.value.status === 'active') {
    console.log('Stopping active test mode');
    
    // Create settings object to stop the test
    const stopSettings = {
      ...props.actuator,
      id: localState.value.id,
      status: 'idle',
      flowRate: localState.value.flowRate,
      direction: localState.value.direction,
      type: 'ph-pump',
      testMode: true,
      duration: 0
    };
    
    // Emit the save event to update the database
    emit('save', stopSettings);
    
    // Update local state
    localState.value.status = 'idle';
    localState.value.testMode = false;
  }
};

// Clean save changes function
const saveChanges = () => {
  // Only stop a test if we're actually running a test
  if (localState.value.testMode && localState.value.status === 'active') {
    stopTestIfRunning();
  }

  // Create clean settings object that preserves current status but updates enabled state
  const settingsToSave = {
    ...props.actuator,
    id: localState.value.id,
    enabled: localState.value.enabled,
    status: localState.value.status, // Keep current status, don't change based on enabled
    flowRate: localState.value.flowRate,
    direction: localState.value.direction,
    type: 'ph-pump'
  };

  emit('save', settingsToSave);

  // Close the modal
  const modalElement = document.getElementById('phPumpModal');
  if (modalElement) {
    const modal = Modal.getInstance(modalElement);
    if (modal) {
      modal.hide();
      // Clean up after animation
      modalElement.addEventListener('hidden.bs.modal', () => {
        modal.dispose();
        emit('close');
      }, { once: true });
    }
  }
};

// Calibration tab functionality
const calibrationStages = ref([
  { power: 25, measuredRate: 0, completed: false, isRunning: false, testCompleted: false },
  { power: 50, measuredRate: 0, completed: false, isRunning: false, testCompleted: false },
  { power: 75, measuredRate: 0, completed: false, isRunning: false, testCompleted: false }
]);

const currentStage = ref(-1);
const isCalibrationRunning = computed(() => calibrationStages.value.some(stage => stage.isRunning));
const calibrationTimer = ref(null);
const calibrationTimeLeft = ref(0);

const hasCompletedCalibration = computed(() => {
  return calibrationStages.value.every(stage => stage.completed);
});

const averageFlowRate = computed(() => {
  if (!hasCompletedCalibration.value) return 0;
  
  // Calculate the average of measured rates from all three stages
  const totalMeasured = calibrationStages.value.reduce((sum, stage) => {
    return sum + stage.measuredRate;
  }, 0);
  
  // Multiply by 2 to get mL per minute (since tests run for 30 seconds)
  return (totalMeasured / calibrationStages.value.length) * 2;
});

const getStageStatus = (index) => {
  const stage = calibrationStages.value[index];
  if (stage.isRunning) return `Testing... (${calibrationTimeLeft.value}s)`;
  if (stage.completed) return 'Completed';
  return 'Not Started';
};

const runCalibrationStage = (index) => {
  const stage = calibrationStages.value[index];
  
  // If this stage is already running, stop it
  if (stage.isRunning) {
    stopCalibrationStage(index);
    return;
  }
  
  // Stop any other running stage
  calibrationStages.value.forEach((s, i) => {
    if (s.isRunning && i !== index) {
      stopCalibrationStage(i);
    }
  });
  
  // Reset flags when starting a new test
  stage.testCompleted = false;
  stage.completed = false;
  stage.measuredRate = 0; // Reset measured rate for new test
  
  // Start this stage
  currentStage.value = index;
  stage.isRunning = true;
  calibrationTimeLeft.value = 30;
  
  // Create settings object for this calibration stage
  const testSettings = {
    ...props.actuator,
    id: localState.value.id,
    status: 'active',
    flowRate: stage.power, // Use the stage's power level
    direction: localState.value.direction,
    type: 'ph-pump',
    testMode: true,
    duration: 30
  };
  
  // Emit the save event to update the database
  emit('save', testSettings);
  
  // Start the countdown timer
  calibrationTimer.value = setInterval(() => {
    calibrationTimeLeft.value--;
    
    if (calibrationTimeLeft.value <= 0) {
      stopCalibrationStage(index);
      // Don't automatically mark as completed - user must confirm
    }
  }, 1000);
};

const stopCalibrationStage = (index) => {
  const stage = calibrationStages.value[index];
  stage.isRunning = false;
  clearInterval(calibrationTimer.value);
  
  // Mark the test as completed when it finishes or is stopped
  stage.testCompleted = true;
  
  // Stop the pump
  const stopSettings = {
    ...props.actuator,
    id: localState.value.id,
    status: 'idle',
    flowRate: 0,
    direction: localState.value.direction,
    type: 'ph-pump',
    testMode: true,
    duration: 0
  };
  
  // Emit the save event to update the database
  emit('save', stopSettings);
};

const saveStage = (index) => {
  const stage = calibrationStages.value[index];
  
  if (stage.measuredRate <= 0) {
    alert('Please enter a valid flow rate measurement.');
    return;
  }
  
  // Mark this stage as completed when saved
  stage.completed = true;
};

const resetCalibration = () => {
  calibrationStages.value.forEach(stage => {
    stage.measuredRate = 0;
    stage.completed = false;
  });
  currentStage.value = -1;
};

const saveCalibration = () => {
  if (!hasCompletedCalibration.value) return;
  
  // Set the computed flow rate as a Number to ensure proper handling
  const newFlowRate = Number(averageFlowRate.value);
  
  // Update local state with new flow rate
  localState.value.flowRate = newFlowRate;
  
  // Save settings with the new flow rate
  emit('save', {
    ...props.actuator,
    id: localState.value.id,
    flowRate: newFlowRate
  });
  
  // Switch back to settings tab
  activeTab.value = 'settings';
};

// Manual dosing state
const doseAmount = ref(1.0);  // Default 1.0 ml
const dosing = ref(false);
const doseTimeRemaining = ref(0);
const doseProgress = ref(0);
const doseTimer = ref(null);
const doseStartTime = ref(null);
const doseEndTime = ref(null);

// Calculate dose time in seconds
const calculateDoseTime = computed(() => {
  if (!localState.value.flowRate || localState.value.flowRate <= 0) {
    return "unknown";
  }
  
  // Calculate time in seconds: amount (ml) / flow rate (ml/min) * 60 seconds
  const timeSeconds = (doseAmount.value / localState.value.flowRate) * 60;
  return timeSeconds.toFixed(1);
});

// Start manual dosing
const startDosing = async () => {
  if (dosing.value || doseAmount.value <= 0 || !localState.value.enabled) return;
  
  try {
    // Calculate duration in seconds
    const duration = parseFloat(calculateDoseTime.value);
    if (isNaN(duration) || duration <= 0) {
      alert('Invalid dose amount or flow rate');
      return;
    }
    
    dosing.value = true;
    doseTimeRemaining.value = duration;
    doseProgress.value = 0;
    doseStartTime.value = Date.now();
    doseEndTime.value = doseStartTime.value + (duration * 1000);
    
    // Create settings object for manual dosing
    const doseSettings = {
      ...props.actuator,
      id: localState.value.id,
      status: 'active',
      flowRate: localState.value.flowRate,
      direction: localState.value.direction,
      type: 'ph-pump',
      testMode: false,
      duration: Math.ceil(duration)
    };
    
    // Emit the save event to update the database
    emit('save', doseSettings);
    
    // Start the countdown timer
    doseTimer.value = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - doseStartTime.value) / 1000;
      const remaining = Math.max(0, duration - elapsed);
      
      doseTimeRemaining.value = remaining;
      doseProgress.value = (elapsed / duration) * 100;
      
      if (remaining <= 0) {
        stopDosing(true);
      }
    }, 100);
  } catch (error) {
    console.error('Error starting pH dose:', error);
    alert('Failed to start dosing. Please try again.');
    dosing.value = false;
  }
};

// Fix the stopDosing function to always set status to idle, even when completed naturally
const stopDosing = async (completed = false) => {
  if (!dosing.value) return;
  
  try {
    clearInterval(doseTimer.value);
    doseTimer.value = null;
    dosing.value = false;
    
    // Always send stop command to ensure pump is idle
    const stopSettings = {
      ...props.actuator,
      id: localState.value.id,
      status: 'idle',
      flowRate: localState.value.flowRate,
      direction: localState.value.direction,
      type: 'ph-pump',
      testMode: false
    };
    
    // Emit the save event to update the database
    emit('save', stopSettings);
    
    if (completed) {
      console.log('pH dosing completed successfully');
      // Replace alert with in-modal notification
      showNotification('pH dosing completed successfully');
    } else {
      console.log('pH dosing stopped manually');
      showNotification('pH dosing stopped manually', 'info');
    }
  } catch (error) {
    console.error('Error stopping pH dose:', error);
    showNotification('Error stopping pH dose', 'error');
  }
};

// Add notification state
const notification = ref({
  show: false,
  message: '',
  type: 'success',
  icon: 'fas fa-check-circle me-2',
  timeout: null
});

// Show notification helper
const showNotification = (message, type = 'success') => {
  // Clear any existing timeout
  if (notification.value.timeout) {
    clearTimeout(notification.value.timeout);
  }
  
  // Set notification properties
  notification.value.show = true;
  notification.value.message = message;
  notification.value.type = type;
  notification.value.icon = type === 'success' ? 'fas fa-check-circle me-2' : 'fas fa-exclamation-circle me-2';
  
  // Auto-hide after 5 seconds
  notification.value.timeout = setTimeout(() => {
    notification.value.show = false;
  }, 5000);
};

// Setup modal event listeners when component is mounted
onMounted(() => {
  // Add event listener to the modal to ensure pumps stop when modal is closed
  const modalElement = document.getElementById('phPumpModal');
  if (modalElement) {
    // Add listeners for both the modal hide event (triggered by clicking close button)
    // and the hidden event (after animation completes)
    modalElement.addEventListener('hide.bs.modal', handleModalClose);
    modalElement.addEventListener('hidden.bs.modal', handleModalClose);
    
    console.log('Added modal close event listeners for pH pump modal');
  } else {
    console.warn('Could not find pH pump modal element');
  }
});

// Consolidated cleanup for all timers and event listeners
onBeforeUnmount(() => {
  // Make sure to stop any running operations
  handleModalClose();
  
  // Clean up calibration timer
  if (calibrationTimer.value) {
    clearInterval(calibrationTimer.value);
  }
  
  // Clean up modal event listeners
  const modalElement = document.getElementById('phPumpModal');
  if (modalElement) {
    modalElement.removeEventListener('hide.bs.modal', handleModalClose);
    modalElement.removeEventListener('hidden.bs.modal', handleModalClose);
  }

  // Clean up notification timeout
  if (notification.value.timeout) {
    clearTimeout(notification.value.timeout);
  }
});
</script>

<style scoped>
.ph-pump-modal {
  padding: 1.5rem;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 500;
}

.btn-control {
  width: 100%;
  padding: 1rem;
  border: none;
  background: var(--success-color);
  color: white;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-control.active {
  background: var(--danger-color);
}

.fa-arrow-up {
  color: #2ecc71;
}

.fa-arrow-down {
  color: #e74c3c;
}

/* Add to existing styles */
.pump-specs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--bg-muted);
  border-radius: 6px;
  font-size: 0.9rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.pump-specs i {
  color: var(--accent-color);
}

.flow-rate-input {
  width: 70px;
  padding: 0.25rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  text-align: center;
  background: var(--bg-input);
  color: var(--text-color);
}

.flow-rate-input::-webkit-inner-spin-button,
.flow-rate-input::-webkit-outer-spin-button {
  opacity: 1;
}

.form-check.form-switch {
  padding-left: 2.5rem;
  margin: 1rem 0;
}

.form-check-input {
  width: 3rem;
  height: 1.5rem;
  cursor: pointer;
}

.form-check-input:checked {
  background-color: var(--success-color);
  border-color: var(--success-color);
}

.save-btn {
  margin-top: 1rem;
  width: 100%;
  padding: 0.75rem;
  font-weight: 500;
}

.flow-rate-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--bg-muted);
}

/* Add these new styles for the slider switch */
.switch-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin: 1rem 0;
}

.switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 34px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
}

.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--accent-color);
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.switch-label {
  font-weight: 500;
  color: var(--text-color);
}

/* Update existing styles */
.pump-specs.disabled {
  opacity: 0.6;
}

/* Update the save button design to green */
.btn-primary.save-btn {
  background-color: #2ecc71;
  border: none;
  color: white;
}

/* Add modal-footer style to match ActuatorControlModal */
.modal-footer {
  border-top: 1px solid var(--border-color);
  padding-top: 1rem;
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

/* Add the btn-save style to match ActuatorControlModal */
.btn-save {
  padding: 0.75rem 1.5rem;
  border: none;
  background: var(--accent-color);
  color: white;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-save:disabled {
  background: var(--text-muted);
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-save:not(:disabled):hover {
  background: var(--accent-color-dark);
}

/* Add the btn-test style */
.btn-test {
  padding: 0.75rem 1.5rem;
  border: none;
  background: var(--warning-color, #f39c12);
  color: white;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  transition: all 0.3s ease;
  margin-right: 1rem;
}

.btn-test:disabled {
  background: var(--text-muted);
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-test:not(:disabled):hover {
  opacity: 0.9;
}

/* Tab Navigation */
.tab-navigation {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.tab-button {
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  position: relative;
}

.tab-button.active {
  color: var(--accent-color);
}

.tab-button.active::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--accent-color);
}

.tab-content {
  padding: 1rem 0;
}

/* Calibration Styles */
.calibration-info {
  padding: 0.75rem;
  background: var(--bg-muted);
  border-radius: 8px;
  font-size: 0.9rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
}

.calibration-stages {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.calibration-stage {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.calibration-stage.active {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 1px var(--accent-color);
}

.calibration-stage.completed {
  border-color: var(--success-color);
}

.stage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--bg-muted);
  border-bottom: 1px solid var(--border-color);
}

.stage-title {
  font-weight: 500;
}

.stage-status {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.stage-content {
  padding: 1rem;
}

.stage-description {
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.form-group {
  margin-bottom: 1rem;
}

.stage-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.btn-test-stage {
  flex: 1;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background: var(--warning-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-test-stage:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-save-stage {
  flex: 1;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background: var(--success-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-save-stage:disabled {
  opacity: 0.7;
  background: var(--bg-muted);
  color: var(--text-muted);
  cursor: not-allowed;
}

.calibration-result {
  border: 1px solid var(--success-color);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.result-header {
  padding: 0.75rem 1rem;
  background: var(--success-color);
  color: white;
  font-weight: 500;
}

.result-content {
  padding: 1rem;
}

.result-content p {
  margin-bottom: 0.5rem;
}

/* Highlight the calculated flow rate */
.result-value {
  font-family: monospace;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--accent-color);
}

.btn-reset {
  padding: 0.75rem 1.5rem;
  border: none;
  background: var(--bg-muted);
  color: var(--text-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  margin-right: auto;
}

.btn-reset:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Add style for flow-rate-value */
.flow-rate-value {
  font-family: monospace;
  font-weight: 500;
  background: var(--bg-muted);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

/* Manual Dose Tab Styles */
.dose-info {
  padding: 0.75rem;
  background: var(--bg-muted);
  border-radius: 8px;
  font-size: 0.9rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
}

.dose-settings {
  padding: 1rem 0;
}

.input-group {
  display: flex;
  align-items: center;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.form-control {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px 0 0 4px;
  text-align: center;
}

.input-group-text {
  padding: 0.5rem 0.75rem;
  background: var(--bg-muted);
  border: 1px solid var(--border-color);
  border-left: none;
  border-radius: 0 4px 4px 0;
}

.text-muted {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
  display: block;
}

.progress {
  height: 8px;
  border-radius: 4px;
  background: var(--bg-muted);
  overflow: hidden;
}

.progress-bar {
  background: var(--accent-color);
}

.btn-danger {
  padding: 0.75rem 1.5rem;
  border: none;
  background: var(--danger-color);
  color: white;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

/* Add notification banner styles */
.notification-banner {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  animation: slideDown 0.3s ease-out;
}

.notification-banner.success {
  background-color: rgba(46, 204, 113, 0.2);
  border-left: 4px solid var(--success-color, #2ecc71);
  color: var(--success-color, #2ecc71);
}

.notification-banner.error {
  background-color: rgba(231, 76, 60, 0.2);
  border-left: 4px solid var(--danger-color, #e74c3c);
  color: var(--danger-color, #e74c3c);
}

.notification-banner.info {
  background-color: rgba(52, 152, 219, 0.2);
  border-left: 4px solid var(--info-color, #3498db);
  color: var(--info-color, #3498db);
}

@keyframes slideDown {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Add mobile responsive styles */
@media (max-width: 768px) {
  .tab-navigation {
    gap: 0.5rem;
  }
  
  .tab-button {
    padding: 0.5rem;
    font-size: 0.9rem;
  }
  
  .modal-footer {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .btn-save, .btn-test, .btn-reset {
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  }
  
  .stage-actions {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .btn-test-stage, .btn-save-stage {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .ph-pump-modal {
    padding: 1rem;
  }
  
  .tab-navigation {
    flex-direction: column;
    gap: 0;
  }
  
  .tab-button {
    width: 100%;
    text-align: center;
    border-bottom: 1px solid var(--border-color);
  }
  
  .tab-button.active::after {
    height: 2px;
    bottom: -1px;
  }
  
  .modal-footer {
    flex-direction: column;
    align-items: stretch;
  }
  
  .btn-save, .btn-test, .btn-reset, .btn-danger {
    width: 100%;
    justify-content: center;
    margin: 0.25rem 0;
  }
  
  .btn-reset {
    margin-right: 0;
    order: 2;
  }
  
  .flow-rate-value {
    font-size: 0.9rem;
  }
  
  .calibration-stage {
    margin-bottom: 1rem;
  }
  
  .stage-content {
    padding: 0.75rem;
  }
  
  .result-value {
    font-size: 1rem;
  }
}
</style>