<template>
  <div class="col-md-6 mb-4">
    <div class="card h-100">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">
          <i class="fas fa-cogs icon-animate me-1"></i> Actuator Controls
        </h5>
        <div class="status-help">
          <i class="fas fa-circle-question help-icon" 
             @click="toggleLegendModal"></i>
        </div>
      </div>

      <div class="card-body">
        <div class="actuators-grid">
          <!-- Replace combined fertilizer dispenser card with standard actuator styling -->
          <div class="actuator-card">
            <div class="mode-badge manual">
              <i class="fas fa-hand"></i>
            </div>
            
            <div class="actuator-content clickable" @click="openCombinedFertilizerModal">
              <div class="actuator-header">
                <span class="status-bullet status-idle"></span>
                <i class="fas fa-vials actuator-icon" style="color: #4361ee;"></i>
                <span class="actuator-name">Combined Fertilizer</span>
              </div>
              
              <!-- Remove the timer display with "Mix & Dispense" text -->
            </div>
          </div>
          
          <!-- Existing actuators -->
          <div class="actuator-card" 
               v-for="actuator in actuators" 
               :key="actuator.id"
               :data-actuator-type="actuator.type"
               :class="{
                 'rule-controlled': actuator.mode === 'rule',
                 'dispensing-disabled': (actuator.type === 'fertilizer-pump' && isDispensingFertilizers) || 
                                     (actuator.type === 'pump' && actuator.name === 'Irrigation Pump' && isDispensingFertilizers)
               }">
            <div class="mode-badge" :class="getModeClass(actuator)">
              <i :class="getModeIcon(actuator.mode)"></i>
            </div>
            
            <div class="actuator-content" 
                 @click="handleActuatorClick(actuator)"
                 :class="{ 
                   'clickable': isClickable(actuator.id), 
                   'disabled': actuator.mode === 'rule' || 
                               (actuator.type === 'fertilizer-pump' && isDispensingFertilizers) || 
                               (actuator.type === 'pump' && actuator.name === 'Irrigation Pump' && isDispensingFertilizers),
                   'waiting-fertilizer': actuator.type === 'fertilizer-pump' && isDispensingFertilizers && isWaitingForDispensing(actuator)
                 }">
              <div class="actuator-header">
                <span class="status-bullet" :class="getStatusClass(actuator)"></span>
                <i :class="[actuator.icon, 'actuator-icon']"></i>
                <span class="actuator-name">
                  {{ 
                    actuator.type === 'fertilizer-pump' 
                      ? `${actuator.nutrientType || 'Fertilizer'} (${actuator.name.slice(-1)})` 
                      : actuator.name 
                  }}
                </span>
                <span v-if="isPumpActive(actuator)" class="status-label">dispensing</span>
                <span v-else-if="actuator.type === 'fertilizer-pump' && isDispensingFertilizers && isWaitingForDispensing(actuator)" class="status-label waiting">waiting</span>
                
                <!-- Add dose amount display for fertilizer pumps -->
                <span v-if="actuator.type === 'fertilizer-pump' && getActiveFertilizerAmount(actuator.id)" class="dose-amount">
                  {{ getActiveFertilizerAmount(actuator.id) }} mL
                </span>
              </div>
              
              <!-- Display rule control message when in rule mode -->
              <div v-if="actuator.mode === 'rule'" class="rule-control-message">
                <i class="fas fa-robot me-1"></i> 
                {{ actuator.overrideMessage || 'Rule Controlled' }}
              </div>
              
              <!-- Timer display for manual mode - hide for active AND waiting fertilizer pumps -->
              <div v-else-if="actuator.mode === 'manual' && !(actuator.type === 'fertilizer-pump' && (isPumpActive(actuator) || (isDispensingFertilizers && isWaitingForDispensing(actuator))))" class="timer-display text-success">
                <template v-if="!['fertilizer-pump', 'ph-pump','sensor-pump'].includes(actuator.type) && actuator.status === 'active'">
                  <i class="fas fa-clock me-2"></i>
                </template>
                {{ formatTime(actuator.remainingTime) }}
              </div>
              
              <!-- Timer display for auto mode with schedule enabled - add condition to hide for waiting fertilizers -->
              <div v-else-if="actuator.mode === 'auto' && actuator.schedule.enabled && !(actuator.type === 'fertilizer-pump' && (isPumpActive(actuator) || (isDispensingFertilizers && isWaitingForDispensing(actuator))))" class="timer-display">
                <template v-if="actuator.status === 'active'">
                  <i class="fas fa-play-circle me-2" style="color: #52b788;"></i>
                  <span class="timer-label">Running:</span>
                  <span class="timer-value">{{ formatTime(actuator.remainingTime) }}</span>
                </template>
                <template v-else>
                  <template v-if="isScheduledToday(actuator)">
                    <i class="fas fa-hourglass-start me-2" style="color: #4361ee;"></i>
                    <span class="timer-label">Interval:</span>
                    <span class="timer-value">{{ formatTime(getNextRunCountdown(actuator)) }}</span>
                  </template>
                  <template v-else>
                    <span class="timer-label">Not Scheduled Today</span>
                  </template>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Status Legend Modal -->
  <div class="legend-modal" v-if="showLegendModal">
    <div class="legend-modal-content">
      <div class="legend-modal-header">
        <h5>Status Indicator Guide</h5>
        <button class="legend-modal-close" @click="toggleLegendModal">&times;</button>
      </div>
      <div class="legend-modal-body">
        <div class="status-legend">
          <div class="legend-item">
            <span class="legend-dot status-active"></span> 
            <div>
              <strong>Active:</strong> 
              <div class="legend-description">Device is currently running</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-dot status-paused"></span> 
            <div>
              <strong>Paused:</strong> 
              <div class="legend-description">Operation temporarily suspended</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-dot status-idle"></span> 
            <div>
              <strong>Idle:</strong> 
              <div class="legend-description">Device is enabled but not running</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-dot status-disabled"></span> 
            <div>
              <strong>Disabled:</strong> 
              <div class="legend-description">Device is turned off</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Add Combined Fertilizer Modal -->
  <div class="modal fade" id="combinedFertilizerModal" data-bs-backdrop="static" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Combined Fertilizer Dispensing</h5>
          <button type="button" class="btn-close" @click="closeCombinedFertilizerModal"></button>
        </div>
        <div class="modal-body">
          <!-- Mode selector tabs -->
          <ul class="nav nav-tabs mb-3">
            <li class="nav-item">
              <button 
                class="nav-link" 
                :class="{ active: fertilizerMode === 'manual' }"
                @click="fertilizerMode = 'manual'"
              >
                <i class="fas fa-sliders-h me-2"></i>Manual Mode
              </button>
            </li>
            <li class="nav-item">
              <button 
                class="nav-link" 
                :class="{ active: fertilizerMode === 'auto' }"
                @click="fertilizerMode = 'auto'"
              >
                <i class="fas fa-magic me-2"></i>Auto Mode
              </button>
            </li>
          </ul>
          
          <!-- Add Dispensing Progress Display -->
          <div v-if="isDispensingFertilizers" class="dispensing-progress mb-3">
            <div class="progress" style="height: 10px;">
              <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" 
                   :style="{width: `${(currentDispensingStep / totalDispensingSteps) * 100}%`}"></div>
            </div>
            <div class="d-flex justify-content-between mt-2">
              <div>
                <i class="fas fa-vials me-1"></i>
                <span>Dispensing fertilizer {{ currentDispensingStep }} of {{ totalDispensingSteps }}</span>
              </div>
              <!-- Restore the countdown timer display for the modal -->
              <div v-if="dispensingTimerId" class="countdown-timer">
                <i class="fas fa-clock me-1"></i>
                <span>Next in: {{ formatDispensingTimer() }}</span>
              </div>
            </div>
            <!-- Add Emergency Controls -->
            <div class="emergency-controls mt-2">
              <div class="alert alert-info">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <i class="fas fa-info-circle me-2"></i>
                    <span>Dispensing in progress...</span>
                  </div>
                  <div class="emergency-buttons">
                    <button 
                      class="btn btn-sm btn-danger" 
                      @click="emergencyStopDispensing"
                    >
                      <i class="fas fa-stop-circle"></i>
                      Emergency Stop
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Add Auto-Dosing Status Display -->
          <div v-if="fertilizerMode === 'auto' && autoDosingActive" class="auto-dosing-status mb-3">
            <h6 class="status-title">
              <i class="fas fa-robot me-2"></i>Auto-Dosing Status
            </h6>
            
            <div class="progress" style="height: 10px;">
              <div class="progress-bar bg-info progress-bar-striped progress-bar-animated" 
                   :style="{width: `${autoDosingProgress}%`}"></div>
            </div>
            
            <div class="d-flex justify-content-between mt-2">
              <div>
                <i class="fas fa-tachometer-alt me-1"></i>
                <span>Current EC: {{ formattedEC }}</span>
                <span class="mx-2">→</span>
                <span>Target: {{ targetEC }} mS/cm</span>
                <span v-if="ecGap !== null" class="ms-2" :class="{
                  'text-danger': ecGap > 0.2,
                  'text-success': Math.abs(ecGap) <= 0.2,
                  'text-warning': ecGap < -0.2
                }">
                  ({{ ecGap > 0 ? '+' : '' }}{{ ecGap.toFixed(2) }})
                </span>
              </div>
              <div v-if="autoDosingStatus" class="status-indicator">
                <span class="status-badge" :class="autoDosingStatusClass">
                  {{ autoDosingStatusText }}
                </span>
              </div>
            </div>
            
            <!-- EC Check Countdown -->
            <div v-if="autoDosingStatus === 'waiting'" class="auto-status-details mt-2">
              <div class="alert alert-info py-2">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <i class="fas fa-hourglass-half me-2"></i>
                    <span>{{ 
                      ecGap && ecGap > 0.2 ? 
                      'Checking EC again in: ' : 
                      'Monitoring EC levels: ' 
                    }}</span>
                    <span>{{ formatTime(nextCheckCountdown) }}</span>
                  </div>
                  <div v-if="ecGap !== null" class="gap-display">
                    <span :class="{
                      'text-danger': ecGap > 0.2,
                      'text-success': Math.abs(ecGap) <= 0.2
                    }">
                      {{ ecGap > 0.2 ? 'Still below target' : 'Target reached' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Dispensing Status -->
            <div v-else-if="autoDosingStatus === 'dispensing'" class="auto-status-details mt-2">
              <div class="alert alert-success py-2">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <i class="fas fa-fill-drip me-2"></i>
                    <span>Dispensing fertilizer {{ currentAutoStep }} of {{ totalAutoSteps }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Delay Status -->
            <div v-else-if="autoDosingStatus === 'delay'" class="auto-status-details mt-2">
              <div class="alert alert-warning py-2">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <i class="fas fa-clock me-2"></i>
                    <span>Waiting between dispensing: {{ formatTime(delayCountdown) }}</span>
                  </div>
                </div>
              </div>
            </div>

            
            
            <!-- Add Mixing Status display with more detailed timing -->
            <div v-if="autoDosingStatus === 'mixing'" class="auto-status-details mt-2">
              <div class="alert alert-primary py-2">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <i class="fas fa-blender me-2"></i>
                    <span>Mixing nutrients: {{ formatTime(mixingCountdown) }}</span>
                  </div>
                  <div v-if="ecGap !== null" class="gap-display">
                    <span :class="{
                      'text-danger': ecGap > 0.2,
                      'text-success': Math.abs(ecGap) <= 0.2
                    }">
                      <i class="fas fa-arrows-alt-v me-1"></i>
                      {{ ecGap > 0 ? '+' : '' }}{{ ecGap.toFixed(2) }} mS/cm
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Add Emergency Stop Button -->
            <div class="emergency-controls mt-2">
              <button 
                class="btn btn-sm btn-danger" 
                @click="stopAutoDosing"
              >
                <i class="fas fa-stop-circle me-1"></i>
                Stop Auto-Dosing
              </button>
            </div>
          </div>
          
          <!-- Manual Mode Content -->
          <div v-if="fertilizerMode === 'manual'">
            <!-- Dispensing delay option with hours, minutes, and seconds -->
            <div class="form-group mb-3">
              <label class="form-label">Dispensing Delay</label>
              <div class="row g-2">
                <div class="col">
                  <div class="input-group input-group-sm">
                    <input 
                      type="number" 
                      class="form-control" 
                      v-model.number="dispensingDelayHours"
                      min="0"
                      max="23"
                    >
                    <span class="input-group-text">hr</span>
                  </div>
                </div>
                <div class="col">
                  <div class="input-group input-group-sm">
                    <input 
                      type="number" 
                      class="form-control" 
                      v-model.number="dispensingDelayMinutes"
                      min="0"
                      max="59"
                    >
                    <span class="input-group-text">min</span>
                  </div>
                </div>
                <div class="col">
                  <div class="input-group input-group-sm">
                    <input 
                      type="number" 
                      class="form-control" 
                      v-model.number="dispensingDelaySeconds"
                      min="0"
                      max="59"
                    >
                    <span class="input-group-text">sec</span>
                  </div>
                </div>
              </div>
              <small class="form-text text-muted">
                Delay between each fertilizer to avoid power surges
              </small>
            </div>
            <h6 class="fertilizer-section-title">
              <i class="fas fa-flask me-2"></i>
              Fertilizer Selection
            </h6>
            <!-- Fertilizer selection grid with enhanced styling -->
            <div class="fertilizer-grid">
              <div v-for="pump in fertilizerPumps" :key="pump.id" 
                   class="fertilizer-item" 
                   :class="{'selected': pump.selected}">
                <div class="fertilizer-header" @click="pump.selected = !pump.selected">
                  <div class="fertilizer-icon">
                    <i class="fas fa-vial"></i>
                  </div>
                  <div class="fertilizer-type">
                    {{ pump.nutrientType || `Fertilizer ${pump.name.slice(-1)}` }}
                  </div>
                  <div class="fertilizer-toggle">
                    <div class="toggle-switch">
                      <input 
                        type="checkbox" 
                        :id="`pump-${pump.id}`" 
                        v-model="pump.selected"
                      >
                      <span class="toggle-slider"></span>
                    </div>
                  </div>
                </div>
                <div v-if="pump.selected" class="fertilizer-details">
                  <!-- Original amount control transformed into calculated amount -->
                  <div class="dose-control mb-3">
                    <label>Total Amount to Dispense (mL)</label>
                    <div class="dose-input-group">
                      <button class="dose-btn minus" @click="decrementDose(pump)">-</button>
                      <input 
                        type="number" 
                        class="dose-input" 
                        v-model.number="pump.amount"
                        min="1"
                        max="100"
                        step="1"
                      >
                      <button class="dose-btn plus" @click="incrementDose(pump)">+</button>
                    </div>
           
                  </div>
            
                  <div class="sequence-number">
                    <span class="sequence-badge">{{ getDispenseSequence(pump) }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="selectedFertilizerCount > 1" class="dispensing-order mt-3">
              <i class="fas fa-info-circle me-1"></i>
              Fertilizers will be dispensed in the order shown above ({{ formatDelayDisplay() }} delay between each)
            </div>
          </div>
          <!-- Auto Mode Content -->
          <div v-else>
            <div class="row g-3 mb-3">
              <!-- Water level information - moved to top -->
              <div class="col-md-6">
                <div class="form-group">
                  <label class="form-label">Current System Water Level</label>
                  <div class="water-level-display">
                    <i class="fas fa-water me-2"></i>
                    <span class="water-volume">{{ formatVolume(actualWaterVolume) }}</span>
                  </div>
                  <small class="form-text text-muted">
                    Estimated volume based on sensor readings
                  </small>
                </div>
              </div>
              <!-- Current EC display for Auto mode - moved to top -->
              <div class="col-md-6">
                <div class="form-group">
                  <label class="form-label">Current EC Level</label>
                  <div class="ec-level-display">
                    <i class="fas fa-tachometer-alt me-2"></i>
                    <span class="ec-value">{{ formattedEC }}</span>
                </div>
                  <small class="form-text text-muted">
                    Based on latest sensor readings
                  </small>
                </div>
              </div>
            </div>
           
            <div class="row g-3">
              <!-- Checking Interval -->
              <div class="col-md-6 mb-3">
                <label class="form-label">Mixing Time</label>
                <div class="input-group input-group-sm">
                  <input 
                    type="number" 
                    class="form-control" 
                    v-model.number="autoCheckIntervalMinutes"
                    min="1"
                    max="60"
                    step="1"
                  >
                  <span class="input-group-text">minutes</span>
                </div>
                <small class="form-text text-muted">
                  Time to allow fertilizers to mix before next EC check
                </small>
              </div>
              <!-- Target EC setting - now added to row -->
              <div class="col-md-6 mb-3">
                <label class="form-label">Target EC Adjustment</label>
                <div class="input-group">
                  <input 
                    type="number" 
                    class="form-control" 
                    v-model.number="targetEC"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                  >
                  <span class="input-group-text">mS/cm</span>
                </div>
                <small class="form-text text-muted">
                  System will maintain EC within ±0.2 of this value
                </small>
              </div>
              <!-- Sequential dispensing delay -->
              <div class="col-md-12 mb-3">
                <label class="form-label">Sequential Dispensing Delay</label>
                <div class="row g-2">
                  <div class="col">
                    <div class="input-group input-group-sm">
                      <input 
                        type="number" 
                        class="form-control" 
                        v-model.number="autoDispensingDelayHours"
                        min="0"
                        max="23"
                      >
                      <span class="input-group-text">hr</span>
                    </div>
                  </div>
                  <div class="col">
                    <div class="input-group input-group-sm">
                      <input 
                        type="number" 
                        class="form-control" 
                        v-model.number="autoDispensingDelayMinutes"
                        min="0"
                        max="59"
                      >
                      <span class="input-group-text">min</span>
                    </div>
                  </div>
                  <div class="col">
                    <div class="input-group input-group-sm">
                      <input 
                        type="number" 
                        class="form-control" 
                        v-model.number="autoDispensingDelaySeconds"
                        min="0"
                        max="59"
                      >
                      <span class="input-group-text">sec</span>
                    </div>
                  </div>
                </div>
                <small class="form-text text-muted">
                  Delay between dispensing multiple fertilizers
                </small>
              </div>
            </div>
            <!-- Auto dosing preferences -->
            <div class="fertilizer-priority mt-3">
              <h6 class="fertilizer-section-title">
                <i class="fas fa-flask me-2"></i>
                Fertilizer Selection & Ratio
              </h6>
              <!-- New fertilizer grid with individual ratios -->
              <div class="fertilizer-grid auto-grid">
                <div v-for="pump in fertilizerPumps" :key="pump.id" 
                     class="fertilizer-item" 
                     :class="{'selected': pump.selectedAuto}">
                  <div class="fertilizer-header" @click="pump.selectedAuto = !pump.selectedAuto">
                    <div class="fertilizer-icon">
                      <i class="fas fa-vial"></i>
                    </div>
                    <div class="fertilizer-type">
                      {{ pump.nutrientType || `Fertilizer ${pump.name.slice(-1)}` }}
                    </div>
                    <div class="fertilizer-toggle">
                      <div class="toggle-switch">
                        <input 
                          type="checkbox" 
                          :id="`auto-${pump.id}`" 
                          v-model="pump.selectedAuto"
                        >
                        <span class="toggle-slider"></span>
                      </div>
                    </div>
                  </div>
                  <!-- Add ratio controls for each fertilizer when selected -->
                  <div v-if="pump.selectedAuto" class="fertilizer-details">
                    <div class="auto-dose-info">
                      <i class="fas fa-robot me-2"></i>
                      <span>Amount will be calculated automatically based on EC levels</span>
                      <div class="estimated-time">
                        <i class="fas fa-clock me-2"></i>
                        <span>Estimated Time: {{ calculateAutoDispenseTime(pump) }}</span>
                      </div>
                      <div class="flow-rate-info mt-2">
                        <i class="fas fa-tachometer-alt me-2"></i>
                        <span>Flow Rate: {{ Number(pump.flowRate).toFixed(1) }} mL/min</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <small class="form-text text-muted mt-2">
                Selected fertilizers will be dispensed in order when EC needs adjustment
              </small>
            </div>
          </div>
          <p>Dispensing Delay: {{ formatDelayDisplay() }}</p>
          <div class="d-flex justify-content-end mt-3">
            <button 
              class="btn btn-light me-2" 
              @click="closeCombinedFertilizerModal"
              :disabled="isDispensingFertilizers"
            >
              Cancel
                  </button>
            <button 
              class="btn btn-primary" 
              :disabled="!isFormValid || isDispensingFertilizers"
              @click="startFertilizerDispensing"
            >
              <i class="fas fa-flask me-2"></i>
              <span v-if="isDispensingFertilizers">
                <i class="fas fa-spinner fa-spin me-2"></i>
                Processing...
              </span>
              <span v-else>{{ fertilizerMode === 'manual' ? 'Start Dispensing' : 'Start Auto-Dosing' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject, computed, onUnmounted, watch } from 'vue'
import { Modal } from 'bootstrap'
import axios from 'axios'

// Use environment variable for API URL with localhost fallback
const API_URL = process.env.VUE_APP_API_URL || 'http://localhost:3000'

// Define pin constants (if needed)
const PIN_DEFINITIONS = {
  CHILLER_PIN: 16,
  FAN_PIN: 4,
  IRRIGATION_PUMP: 5,
  SENSOR_PUMP: 18,
  FERTILIZER_PUMP_A: 19,
  FERTILIZER_PUMP_B: 21,
  FERTILIZER_PUMP_C: 22,
  PH_UP_PUMP: 23,
  PH_DOWN_PUMP: 25
}

const actuators = ref([])
let countdownInterval

// Helper: Returns an icon class based on actuator type.
const getActuatorIcon = (type, direction) => {
  const iconMap = {
    'chiller': 'fas fa-snowflake',
    'fan': 'fas fa-fan',
    'pump': 'fas fa-tint',
    'sensor-pump': 'fas fa-microscope',
    'fertilizer-pump': 'fas fa-flask',
    'ph-pump': direction === 'up' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'
  }
  return iconMap[type] || 'fas fa-cog';
}

// Inject modal functions
const openSensorPumpModal = inject('openSensorPumpModal')
const openActuatorModal = inject('openActuatorModal')
const openPhPumpModal = inject('openPhPumpModal')
const openFertilizerPumpModal = inject('openFertilizerPumpModal')

const isClickable = (id) => {
  const actuator = actuators.value.find(a => a.id === id);
  // Don't allow clicking if dispensing is in progress and this is a fertilizer pump or irrigation pump
  if (isDispensingFertilizers.value && actuator && 
      (actuator.type === 'fertilizer-pump' || 
       (actuator.type === 'pump' && actuator.name === 'Irrigation Pump'))) {
    return false;
  }
  return actuator && ['pump', 'fertilizer-pump', 'ph-pump', 'sensor-pump', 'fan', 'chiller'].includes(actuator.type);
};

const handleActuatorClick = (actuator) => {
  // Don't allow clicking on rule-controlled actuators
  if (actuator.mode === 'rule') {
    console.log(`Actuator ${actuator.name} is under rule control - manual interaction disabled`);
    return;
  }

  if (!isClickable(actuator.id)) return

  switch(actuator.type) {
    case 'ph-pump':
      openPhPumpModal(actuator)
      break
    case 'fertilizer-pump':
      openFertilizerPumpModal(actuator)
      break
    case 'sensor-pump':
      openSensorPumpModal(actuator)
      break
    default:
      openActuatorModal(actuator)
  }
}

// WebSocket setup with localhost fallback
const WS_URL = process.env.VUE_APP_WS_URL || 'ws://localhost:5000';

const ws = ref(null);
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

const connectWebSocket = () => {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('Max WebSocket reconnection attempts reached, will try again in 60 seconds');
    setTimeout(() => {
      reconnectAttempts = 0;
      connectWebSocket();
    }, 60000);
    return;
  }

  try {
    console.log('Attempting to connect WebSocket to:', WS_URL);
    ws.value = new WebSocket(WS_URL);

    ws.value.onopen = () => {
      console.log('WebSocket connected successfully');
      reconnectAttempts = 0;
    };

    let pingTimeout;
    const heartbeat = () => {
      clearTimeout(pingTimeout);
      pingTimeout = setTimeout(() => {
        ws.value.close();
      }, 45000);
    };

    ws.value.onmessage = (event) => {
      heartbeat();
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'actuator_update') {
          const updatedActuator = message.data;
          const index = actuators.value.findIndex(a => a.id === updatedActuator.id);
          if (index !== -1) {
            actuators.value[index] = {
              ...actuators.value[index],
              ...updatedActuator,
              icon: getActuatorIcon(updatedActuator.type, updatedActuator.direction),
              remainingTime: Number(updatedActuator.remainingTime || 0),
              nextScheduledRun: updatedActuator.nextScheduledRun,
            };
          }
        } 
        // Handle fertilizer progress updates
        else if (message.type === 'fertilizer_progress') {
          handleFertilizerProgressUpdate(message.data);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    ws.value.onclose = (event) => {
      clearTimeout(pingTimeout);
      console.log('WebSocket disconnected, attempting to reconnect...');
      reconnectAttempts++;
      setTimeout(connectWebSocket, 3000);
    };

    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.value.close();
    };
  } catch (error) {
    console.error('WebSocket connection error:', error);
    reconnectAttempts++;
    setTimeout(connectWebSocket, Math.min(1000 * Math.pow(2, reconnectAttempts), 10000));
  }
};

// Add a reactive ref to store waiting fertilizer IDs from backend
const waitingFertilizerIds = ref([]);

// Modify the handleFertilizerProgressUpdate function to explicitly reset dispensing state
const handleFertilizerProgressUpdate = (data) => {
  console.log('Received fertilizer progress update:', data);
  
  // Track individual fertilizer amounts when available
  if (data.fertilizers && Array.isArray(data.fertilizers)) {
    data.fertilizers.forEach(fert => {
      if (fert.id && fert.amount) {
        activeFertilizerAmounts.value[fert.id] = fert.amount;
      }
    });
  }
  
  // For manual dispensing
  if (data.currentFertilizer && data.remainingTime) {
    // Store the initial amount when starting this fertilizer
    if (!activeFertilizerAmounts.value[data.currentFertilizer] && currentDispensingStep.value > 0) {
      // Try to find the amount from our local fertilizer pumps data
      const fertPump = fertilizerPumps.value.find(p => p.id === data.currentFertilizer);
      if (fertPump && fertPump.amount) {
        activeFertilizerAmounts.value[data.currentFertilizer] = fertPump.amount;
      }
    }
  }
  
  if (data.isDispensing) {
    // Set dispensing state to true when we receive an active dispensing update
    isDispensingFertilizers.value = true;
    
    // Find irrigation pump and mark it as controlled by the fertilizer system
    const irrigationPump = actuators.value.find(a => a.type === 'pump' && a.name === 'Irrigation Pump');
    if (irrigationPump) {
      irrigationPump.disabledByFertilizer = true;
      irrigationPump.mode = 'rule';
      irrigationPump.overrideMessage = 'Disabled during fertilizer dispensing';
    }
    
    // Update progress information
    if (data.currentStep !== undefined) currentDispensingStep.value = data.currentStep;
    if (data.totalSteps !== undefined) totalDispensingSteps.value = data.totalSteps;
    
    // Handle countdown timer
    if (data.remainingTime !== undefined) {
      dispensingCountdown.value = data.remainingTime;
      
      // If we weren't already counting down, start the timer display
      if (!dispensingTimerId.value) {
        startDispensingTimer(data.remainingTime);
      }
    }
    
    // Handle auto-dosing specific updates
    if (data.autoDosingMode) {
      autoDosingActive.value = true;
      
      // Check for mixing state with proper validation
      if (data.mixingState) {
        autoDosingStatus.value = 'mixing';
        
        // Ensure we have a valid mixingTimeRemaining
        let validMixingTime = 300; // Default 5 minutes
        
        if (data.mixingTimeRemaining !== undefined) {
          const parsedTime = parseInt(data.mixingTimeRemaining);
          if (!isNaN(parsedTime) && parsedTime > 0) {
            validMixingTime = parsedTime;
          } else {
            console.warn('Invalid mixing time received:', data.mixingTimeRemaining);
          }
        }
        
        mixingCountdown.value = validMixingTime;
        
        // Start mixing timer if not already running and we have a valid time
        if (!mixingTimerId.value && mixingCountdown.value > 0) {
          console.log(`Starting mixing timer with ${mixingCountdown.value} seconds`);
          startMixingTimer(mixingCountdown.value);
        }
      } else {
        // If not in mixing state, make sure we stop any existing mixing timer
        if (autoDosingStatus.value === 'mixing') {
          stopMixingTimer();
        }
        autoDosingStatus.value = data.inDelay ? 'delay' : data.isDispensing ? 'dispensing' : 'waiting';
      }
      
      // Update auto-dosing progress if provided
      if (data.progress !== undefined) {
        autoDosingProgress.value = data.progress;
      }
      
      // Update EC readings if provided
      if (data.currentEC !== undefined) {
        currentEC.value = data.currentEC;
      }
      
      // Update EC gap if provided
      if (data.ecGap !== undefined) {
        // No need to set ecGap directly since it's a computed property
      }
    }
    
    // IMPORTANT CHANGE: Only update the modal if it's ALREADY open
    // but never automatically open it
    if (isModalOpen()) {
      // If modal is already open, ensure it stays updated
      const modalElement = document.getElementById('combinedFertilizerModal');
      if (!modalElement.classList.contains('show')) {
        modalRefs.value.combinedFertilizer = new Modal(modalElement);
        modalRefs.value.combinedFertilizer.show();
      }
    } 
    // If modal isn't open and this is another device's process, just show a toast
    else if (currentDispensingStep.value > 0 && !dispensingInitiator.value) {
      if (typeof window.showToast === 'function') {
        window.showToast(`Fertilizer dispensing in progress: Step ${currentDispensingStep.value} of ${totalDispensingSteps.value}`, 'info');
      }
    }
  } else {
    // Dispensing completed or stopped - EXPLICITLY SET dispensing state to false
    isDispensingFertilizers.value = false;
    stopDispensingTimer();
    dispensingInitiator.value = false; // Reset initiator flag
    
    // Re-enable irrigation pump UI
    const irrigationPump = actuators.value.find(a => a.type === 'pump' && a.name === 'Irrigation Pump');
    if (irrigationPump) {
      irrigationPump.disabledByFertilizer = false;
      if (irrigationPump.previousMode) {
        irrigationPump.mode = irrigationPump.previousMode;
      }
      irrigationPump.overrideMessage = null;
    }
    
    if (data.error) {
      // Show error toast if there was an error
      if (typeof window.showToast === 'function') {
        window.showToast('Fertilizer dispensing error: ' + data.error, 'error');
      }
      dispensingError.value = data.error;
    } else if (data.completed) {
      // Show success message if completed successfully
      if (typeof window.showToast === 'function') {
        window.showToast('Fertilizer dispensing completed successfully', 'success');
      }
      dispensingSuccess.value = true;
      
      // Close modal after short delay if it's open
      setTimeout(() => {
        if (isModalOpen()) {
          closeCombinedFertilizerModal();
        }
      }, 1500);
    } else if (data.stopped) {
      // Show stopped message if manually stopped
      if (typeof window.showToast === 'function') {
        window.showToast('Fertilizer dispensing stopped', 'warning');
      }
    }
    
    // Reset auto-dosing state if it was in auto-dosing mode
    if (data.autoDosingMode) {
      // Only fully reset if this was a stopped or error message
      if (data.stopped || data.error) {
        autoDosingActive.value = false;
        autoDosingStatus.value = null;
      } 
      // If completed, switch to waiting status
      else if (data.completed) {
        autoDosingStatus.value = 'waiting';
      }
    }
    
    // Reset progress counters
    currentDispensingStep.value = data.currentStep || 0;
    
    // Debug log to confirm dispensing state was reset
    console.log('Fertilizer dispensing process ended. isDispensingFertilizers =', isDispensingFertilizers.value);
  }
};

// Helper function to check if the modal is currently open
const isModalOpen = () => {
  const modalElement = document.getElementById('combinedFertilizerModal');
  return modalElement && modalElement.classList.contains('show');
};

// Legend modal control
const showLegendModal = ref(false);
const toggleLegendModal = () => {
  showLegendModal.value = !showLegendModal.value;
};

// Combined fertilizer state
const modalRefs = ref({
  combinedFertilizer: null
})
const fertilizerPumps = ref([])
const isDispensingFertilizers = ref(false)
const fertilizerMode = ref('manual')
const actualWaterVolume = ref(100) // Will be updated from sensor readings
const targetEC = ref(0)    // Default 1.5 mS/cm
const currentEC = ref(null)  // Will be updated from sensor readings

// Add dispensing countdown timer variables
const dispensingCountdown = ref(0)
const dispensingTimerId = ref(null)
const currentDispensingStep = ref(0)
const totalDispensingSteps = ref(0)

// Timing controls - Manual mode
const dispensingDelayHours = ref(0)
const dispensingDelayMinutes = ref(0)
const dispensingDelaySeconds = ref(1)

// Auto mode values - removing fertilizerRatio from here since it's now per pump
const autoCheckIntervalHours = ref(0)
const autoCheckIntervalMinutes = ref(1)
const autoCheckIntervalSeconds = ref(0)
const autoDispensingDelayHours = ref(0)
const autoDispensingDelayMinutes = ref(0)
const autoDispensingDelaySeconds = ref(5)

// Add error state tracking
const dispensingError = ref(null)
const dispensingSuccess = ref(false)

// Add this after your other reactive variables
const isInDispenseDelay = ref(false)

// Convert time components to seconds for calculations
const dispensingDelay = computed(() => {
  return (dispensingDelayHours.value * 3600) + 
         (dispensingDelayMinutes.value * 60) + 
         dispensingDelaySeconds.value;
});

const autoCheckInterval = computed(() => {
  return (autoCheckIntervalHours.value * 3600) + 
         (autoCheckIntervalMinutes.value * 60) + 
         autoCheckIntervalSeconds.value;
});

const autoDispensingDelay = computed(() => {
  return (autoDispensingDelayHours.value * 3600) + 
         (autoDispensingDelayMinutes.value * 60) + 
         autoDispensingDelaySeconds.value;
});

// Helper functions for dose controls
const incrementDose = (pump) => {
  if (pump.amount < 100) {
    pump.amount++;
  }
}

const decrementDose = (pump) => {
  if (pump.amount > 1) {
    pump.amount--;
  }
}

// Function to get the display sequence number for each fertilizer
const getDispenseSequence = (pump) => {
  if (!pump.selected) return '';
  const selectedPumps = fertilizerPumps.value.filter(p => p.selected);
  const index = selectedPumps.findIndex(p => p.id === pump.id);
  return index > -1 ? `#${index + 1}` : '';
};

const selectedFertilizerCount = computed(() => 
  fertilizerPumps.value.filter(pump => pump.selected).length
);

const formatVolume = (volume) => {
  if (volume === null || volume === undefined) return 'N/A';
  if (volume < 1) return `${(volume * 1000).toFixed(0)} mL`;
  return `${volume.toFixed(1)} L`;
};

const isFormValid = computed(() => {
  if (fertilizerMode.value === 'manual') {
    // Check that water volume is valid and at least one fertilizer is selected with valid amount
    const hasValidSelection = fertilizerPumps.value.some(pump => 
      pump.selected && 
      pump.amount > 0
    );
    return actualWaterVolume.value > 0 && hasValidSelection;
  } else {
    // Auto mode validation with more checks
    const hasValidSelection = fertilizerPumps.value.some(pump => 
      pump.selectedAuto
    );
    return actualWaterVolume.value > 0 && 
           targetEC.value > 0 &&
           autoCheckInterval.value > 0 &&
           hasValidSelection;
  }
});

const hasSelectedFertilizers = computed(() => 
  fertilizerPumps.value.some(pump => pump.selected && pump.amount > 0)
);

// Calculate individual fertilizer amount based on water volume and that pump's ratio
const calculatePumpAmount = (pump) => {
  // Use preset amount, but adjust for flow rate
  const baseAmount = 5.0; // Default fixed amount
  
  // If pump has a very low flow rate, we might need to increase the amount
  if (pump.flowRate && pump.flowRate < 30) {
    return Math.min(10, baseAmount * (30 / pump.flowRate)).toFixed(1);
  }
  
  return baseAmount.toFixed(1); // Default amount
};

// Calculate individual EC impact for a specific pump
const calculatePumpECIncrease = (pump) => {
  if (!actualWaterVolume.value || actualWaterVolume.value <= 0) return '0.00';
  
  // Simplified calculation: assuming 1 mL per L increases EC by about 0.1 units
  const impact = (pump.amount * 0.1) / actualWaterVolume.value;
  return impact.toFixed(2);
};

// Fetch sensor data
const fetchLatestReadings = async () => {
  try {
    console.log('Fetching latest sensor readings from:', `${API_URL}/readings/latest`);
    const { data } = await axios.get(`${API_URL}/readings/latest`, {
      timeout: 8000 // Increased timeout for reliability
    });
    
    if (data.success && data.data) {
      // Extract water level and EC from readings
      const readings = data.data.readings;
      if (readings.waterLevel && readings.waterLevel.value !== undefined) {
        // Convert water level percentage to estimated liters (assuming 100% = 100L)
        actualWaterVolume.value = (readings.waterLevel.value / 100) * 100;
        console.log('Updated water volume:', actualWaterVolume.value);
      }
      
      if (readings.ec && readings.ec.value !== undefined) {
        currentEC.value = readings.ec.value;
        console.log('Updated EC value:', currentEC.value);
      }
    }
  } catch (error) {
    console.error('Error fetching sensor readings:', error);
    // Display a more user-friendly message
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.warn('Network error detected. Check your API server connection.');
      if (typeof window.showToast === 'function') {
        window.showToast('Unable to fetch sensor readings. Check server connection.', 'warning');
      }
    }
  }
};

// Modal handling
const openCombinedFertilizerModal = async () => {
  // Reset error and success states
  dispensingError.value = null;
  dispensingSuccess.value = false; 
  
  // Reset and populate fertilizer pumps data
  populateFertilizerPumps();
  
  // Fetch latest sensor readings
  try {
    await fetchLatestReadings();
  } catch (error) {
    console.error('Error initializing fertilizer modal:', error);
  }
  
  // Open modal
  const modalElement = document.getElementById('combinedFertilizerModal');
  if (modalElement) {
    modalRefs.value.combinedFertilizer = new Modal(modalElement);
    modalRefs.value.combinedFertilizer.show();
  }
}

const closeCombinedFertilizerModal = () => {
  if (modalRefs.value.combinedFertilizer) {
    modalRefs.value.combinedFertilizer.hide();
  }
}

// Function to populate fertilizer pumps data - updated to include water and fertilizer amount fields
const populateFertilizerPumps = () => {
  fertilizerPumps.value = actuators.value
    .filter(a => a.type === 'fertilizer-pump')
    .map(pump => {
      return {
        id: pump.id,
        name: pump.name,
        nutrientType: pump.nutrientType || `Fertilizer ${pump.name.slice(-1)}`,
        selected: false,
        selectedAuto: true, // Default selected in auto mode
        amount: 5, // Default amount for manual mode
        flowRate: pump.flowRate || 60, // Store flowRate for calculations
      };
    });
}

// Main action functions
const startFertilizerDispensing = async () => {
  if (fertilizerMode.value === 'manual') {
    // Validate there's at least one fertilizer selected
    const selectedPumps = fertilizerPumps.value.filter(p => p.selected && p.amount > 0);
    if (selectedPumps.length === 0) {
      if (typeof window.showToast === 'function') {
        window.showToast('Please select at least one fertilizer and set amount', 'warning');
      }
      return;
    }
    
    // Store amounts for selected pumps
    selectedPumps.forEach(pump => {
      activeFertilizerAmounts.value[pump.id] = pump.amount;
    });
    
    // Set UI state to dispensing
    isDispensingFertilizers.value = true;
    dispensingError.value = null;
    dispensingSuccess.value = false;
    dispensingInitiator.value = true; // Mark this device as the initiator
    
    try {
      // Prepare data for backend - now including flowRate for accurate dispensing
      const dispensingData = {
        fertilizers: selectedPumps.map(pump => ({
          id: pump.id,
          amount: pump.amount,
          flowRate: pump.flowRate // Include flow rate for calculation
        })),
        dispensingDelay: dispensingDelay.value,
        totalWaterVolume: actualWaterVolume.value
      };
      
      // Send request to backend to handle the dispensing process
      const response = await axios.post(`${API_URL}/actuators/fertilizer/combined`, dispensingData);
      console.log('Fertilizer dispensing initiated:', response.data);
      
      // The dispensing process is now managed by backend
      // Frontend will receive progress updates via WebSocket
    } catch (error) {
      console.error('Error initiating fertilizer dispensing:', error);
      dispensingError.value = error.message || 'Failed to initiate fertilizer dispensing';
      isDispensingFertilizers.value = false;
      dispensingInitiator.value = false; // Reset initiator flag
      
      if (typeof window.showToast === 'function') {
        window.showToast('Failed to initiate fertilizer dispensing: ' + dispensingError.value, 'error');
      }
    }
  } else {
    // Auto dosing - enhanced with more parameters and validation
    const selectedPumps = fertilizerPumps.value.filter(p => p.selectedAuto);
    
    if (selectedPumps.length === 0) {
      if (typeof window.showToast === 'function') {
        window.showToast('Please select at least one fertilizer for auto-dosing', 'warning');
      }
      return;
    }
    
    if (!targetEC.value || targetEC.value <= 0) {
      if (typeof window.showToast === 'function') {
        window.showToast('Please set a valid target EC value', 'warning');
      }
      return;
    }
    
    // Prepare auto-dosing config with fertilizer and water amounts
    // Include flow rates for each fertilizer pump
    const autoDoseConfig = {
      targetEC: targetEC.value,
      checkInterval: autoCheckInterval.value,
      dispensingDelay: autoDispensingDelay.value,
      currentEC: currentEC.value,
      waterVolume: actualWaterVolume.value,
      fertilizers: selectedPumps.map(p => ({
        id: p.id,
        name: p.name,
        priority: p.priority || 1,
        flowRate: p.flowRate || 60 // Include the flow rate for accurate dispensing
      }))
    };
    
    // Log the configuration for debugging
    console.log('Auto-dosing configuration:', autoDoseConfig);
    
    try {
      isDispensingFertilizers.value = true;
      dispensingError.value = null;
      
      const response = await axios.post(`${API_URL}/actuators/fertilizer/auto-dose`, autoDoseConfig);
      
      console.log('Auto-dosing response:', response.data);
      
      if (response.data.success) {
        // Set auto-dosing as active
        autoDosingActive.value = true;
        autoDosingStatus.value = 'waiting';
        
        // Initial status update
        await updateAutoDosingStatus();
        
        // Set up regular status updates
        autoStatusRefreshInterval.value = setInterval(updateAutoDosingStatus, 5000);
        
        // Show toast notification
        if (typeof window.showToast === 'function') {
          window.showToast(`Auto-dosing started. Target EC: ${targetEC.value} mS/cm, Check interval: ${formatTime(autoCheckInterval.value)}`, 'success');
        } else {
          alert(`Auto-dosing started. Target EC: ${targetEC.value} mS/cm`);
        }
        
        // Close modal after successful setup
        closeCombinedFertilizerModal();
      } else {
        throw new Error(response.data.message || 'Unknown error starting auto-dosing');
      }
    } catch (error) {
      console.error('Error setting up auto-dosing:', error);
      dispensingError.value = error.message || 'Failed to start auto-dosing';
      
      if (typeof window.showToast === 'function') {
        window.showToast('Failed to start auto-dosing: ' + dispensingError.value, 'error');
      } else {
        alert('Failed to start auto-dosing: ' + dispensingError.value);
      }
    } finally {
      isDispensingFertilizers.value = false;
    }
  }
};

// Remove the dispenseCombinedFertilizers function as it's now handled by backend
// Instead, we'll rely on WebSocket updates from the backend

// Emergency stop - modified to work with backend-driven process
const emergencyStopDispensing = async () => {
  try {
    // Clear all timers
    stopDispensingTimer();
    
    if (fertilizerMode.value === 'manual') {
      // Send emergency stop request to backend
      await axios.post(`${API_URL}/actuators/fertilizer/combined/stop`);
      
      // Reset UI state
      isDispensingFertilizers.value = false;
      dispensingSuccess.value = false;
      dispensingError.value = 'Process cancelled by user';
      dispensingInitiator.value = false; // Reset initiator flag
      
      // Show notification
      if (typeof window.showToast === 'function') {
        window.showToast('Fertilizer dispensing stopped', 'error');
      } else {
        alert('Fertilizer dispensing stopped');
      }
    } else {
      // Auto-dosing mode stop
      await stopAutoDosing();
      dispensingInitiator.value = false; // Reset initiator flag
    }
  } catch (error) {
    console.error('Error during emergency stop:', error);
    
    // Reset UI state even if there was an error
    isDispensingFertilizers.value = false;
    dispensingInitiator.value = false; // Reset initiator flag
  } finally {
    // Close modal to ensure UI is usable
    closeCombinedFertilizerModal();
  }
};

// Function to format the dispensing timer
const formatDispensingTimer = () => {
  if (dispensingCountdown.value <= 0) return 'Starting next...'
  return formatTime(dispensingCountdown.value)
}

// Function to start a countdown timer for dispensing
const startDispensingTimer = (seconds) => {
  // Clear any existing timer first
  stopDispensingTimer()
  
  dispensingCountdown.value = seconds
  dispensingTimerId.value = setInterval(() => {
    dispensingCountdown.value -= 1;
    if (dispensingCountdown.value <= 0) {
      stopDispensingTimer()
    }
  }, 1000)
}

// Function to stop the dispensing timer
const stopDispensingTimer = () => {
  if (dispensingTimerId.value) {
    clearInterval(dispensingTimerId.value)
    dispensingTimerId.value = null
  }
}

// Format time functions
const formatTime = (seconds) => {
  if (!seconds) return '';
  const wholeSeconds = Math.floor(seconds);
  const hrs = Math.floor(wholeSeconds / 3600);
  const mins = Math.floor((wholeSeconds % 3600) / 60);
  const secs = wholeSeconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatDelayDisplay = () => {
  let parts = [];
  if (dispensingDelayHours.value > 0) {
    parts.push(`${dispensingDelayHours.value}h`);
  }
  if (dispensingDelayMinutes.value > 0) {
    parts.push(`${dispensingDelayMinutes.value}m`);
  }
  if (dispensingDelaySeconds.value > 0 || parts.length === 0) {
    parts.push(`${dispensingDelaySeconds.value}s`);
  }
  return parts.join(' ');
};

// Lifecycle hooks
onMounted(async () => {
  try {
    const { data } = await axios.get(`${API_URL}/actuators/status`);
    if (data.success) {
      actuators.value = data.data.map(actuator => ({
        ...actuator,
        icon: getActuatorIcon(actuator.type, actuator.direction),
        remainingTime: actuator.remainingTime || 0
      }));
    }
  } catch (error) {
    console.error('Error fetching initial actuator status:', error);
  }
  
  connectWebSocket();
  populateFertilizerPumps();
  
  // Check if auto-dosing is already running
  await initializeAutoDosingState();
  
  // Set up a regular check for auto-dosing status to handle potential
  // disconnections or background process changes
  const autoDosingMonitor = setInterval(async () => {
    // Only check if we don't already think auto-dosing is active
    if (!autoDosingActive.value) {
      await initializeAutoDosingState();
    }
  }, 30000); // Check every 30 seconds
  
  // Store for cleanup
  window.autoDosingMonitor = autoDosingMonitor;
})

// Update onUnmounted to clean up auto-dosing timers and the new monitor
onUnmounted(() => {
  if (ws.value) {
    ws.value.close();
  }
  
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  
  // Clean up dispensing timer
  stopDispensingTimer();
  
  // Clear auto-mode cleanup interval if it exists
  if (window.autoModeCleanupId) {
    clearInterval(window.autoModeCleanupId);
    window.autoModeCleanupId = null;
  }
  
  // Clean up auto-dosing timers
  if (nextCheckTimerId.value) {
    clearInterval(nextCheckTimerId.value);
  }
  
  if (autoStatusRefreshInterval.value) {
    clearInterval(autoStatusRefreshInterval.value);
  }
  
  // Clear auto-dosing monitor
  if (window.autoDosingMonitor) {
    clearInterval(window.autoDosingMonitor);
    window.autoDosingMonitor = null;
  }
  
  // Clean up popovers
  if (window.actuatorPopoverList) {
    window.actuatorPopoverList.forEach(popover => {
      if (popover && typeof popover.dispose === 'function') {
        popover.dispose();
      }
    });
    window.actuatorPopoverList = null;
  }
  
  // Clean up combined fertilizer modal
  if (modalRefs.value.combinedFertilizer) {
    try {
      modalRefs.value.combinedFertilizer.dispose();
    } catch (error) {
      console.warn('Error disposing combined fertilizer modal:', error);
    }
  }
  // Reset dispensing state
  dispensingInitiator.value = false;
});

// Helper functions for UI display
const getModeIcon = (mode) => {
  switch (mode) {
    case 'auto': return 'fas fa-clock';
    case 'rule': return 'fas fa-robot';
    default: return 'fas fa-hand';
  }
};

const getModeClass = (actuator) => {
  if (actuator.overrideMode) {
    return 'rule';
  }
  return actuator.mode;
};

const getNextRunCountdown = (actuator) => {
  if (!actuator.nextScheduledRun) return 0;
  const now = Date.now();
  const nextRun = typeof actuator.nextScheduledRun === 'number' 
    ? actuator.nextScheduledRun 
    : Date.parse(actuator.nextScheduledRun);
  return Math.max(0, Math.floor((nextRun - now) / 1000));
};

const isScheduledToday = (actuator) => {
  if (!actuator.schedule || !actuator.schedule.enabled) return false;
  if (!actuator.schedule.activeDays || actuator.schedule.activeDays.length === 0) return false;
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  return actuator.schedule.activeDays.includes(currentDay);
};

const getStatusClass = (actuator) => {
  if (actuator.type === 'fertilizer-pump' || actuator.type === 'ph-pump') {
    // For disabled pumps
    if (actuator.enabled === false || actuator.isActive === false) {
      return 'status-disabled';
    }
    // For active pumps
    else if (actuator.status === 'active') {
      return 'status-active';
    }
    // For idle but enabled pumps
    else {
      return 'status-idle';
    }
  }
  // For other actuator types
  return `status-${actuator.status}`;
};

const isPumpActive = (actuator) => {
  return (actuator.type === 'fertilizer-pump' || actuator.type === 'ph-pump') && 
         actuator.status === 'active';
};

// Set default values when switching to auto mode
watch(() => fertilizerMode.value, (newMode) => {
  if (newMode === 'auto') {
    // Default values for auto mode
    if (autoCheckIntervalHours.value === 0 && 
        autoCheckIntervalMinutes.value === 0 && 
        autoCheckIntervalSeconds.value === 0) {
      autoCheckIntervalMinutes.value = 15;
    }
    
    if (autoDispensingDelayHours.value === 0 && 
        autoDispensingDelayMinutes.value === 0 && 
        autoDispensingDelaySeconds.value === 0) {
      autoDispensingDelaySeconds.value = 5;
    }
  }
});

// Auto-update amount when ratio changes
watch(() => fertilizerPumps.value, (newPumps) => {
  newPumps.forEach(pump => {
    // Update amount if ratio components change
    watch(() => [pump.fertilizerAmount, pump.waterAmount], () => {
      // Calculate a reasonable amount based on ratio and water volume
      if (pump.fertilizerAmount && pump.waterAmount) {
        // Example calculation: Keep amount proportional to ratio
        const calculatedAmount = Math.min(100, Math.max(1, 
          Math.round(5 * (pump.fertilizerAmount / pump.waterAmount))
        ));
        // Only update if significantly different to avoid infinite loop
        if (Math.abs(pump.amount - calculatedAmount) > 1) {
          pump.amount = calculatedAmount;
        }
      }
    }, { deep: true });
  });
}, { deep: true });

// Update the isWaitingForDispensing function to check dispensingInitiator flag
const isWaitingForDispensing = (actuator) => {
  // Don't show waiting timer if not dispensing or not a fertilizer pump
  if (!isDispensingFertilizers.value || actuator.type !== 'fertilizer-pump') {
    return false;
  }
  
  // Check if the actuator's ID is in the waiting fertilizers list from the backend
  return waitingFertilizerIds.value.includes(actuator.id);
};

// Add these variables to the <script setup> section after the existing state variables

// Auto-dosing status tracking
const autoDosingActive = ref(false)
const autoDosingStatus = ref(null) // 'waiting', 'checking', 'dispensing', 'delay'
const autoDosingProgress = ref(0)
const nextCheckCountdown = ref(0)
const delayCountdown = ref(0)
const nextCheckTimerId = ref(null)
const currentAutoStep = ref(0)
const totalAutoSteps = ref(0)
const autoStatusRefreshInterval = ref(null)

// Computed properties for auto-dosing status display
const autoDosingStatusClass = computed(() => {
  switch(autoDosingStatus.value) {
    case 'waiting': return 'status-waiting';
    case 'checking': return 'status-checking';
    case 'dispensing': return 'status-dispensing';
    case 'delay': return 'status-delay';
    case 'mixing': return 'status-mixing';
    default: return '';
  }
})

const autoDosingStatusText = computed(() => {
  switch(autoDosingStatus.value) {
    case 'waiting': return 'Monitoring';
    case 'checking': return 'Checking EC';
    case 'dispensing': return 'Dispensing';
    case 'delay': return 'Delay';
    case 'mixing': return 'Mixing';
    default: return 'Inactive';
  }
})

// Function to stop auto-dosing
const stopAutoDosing = async () => {
  try {
    if (typeof window.showToast === 'function') {
      window.showToast('Stopping auto-dosing...', 'info');
    }
    
    await axios.post(`${API_URL}/actuators/fertilizer/auto-dose/stop`);
    
    // Reset state variables
    autoDosingActive.value = false;
    autoDosingStatus.value = null;
    
    // Clear any active timers
    if (nextCheckTimerId.value) {
      clearInterval(nextCheckTimerId.value);
      nextCheckTimerId.value = null;
    }
    
    if (autoStatusRefreshInterval.value) {
      clearInterval(autoStatusRefreshInterval.value);
      autoStatusRefreshInterval.value = null;
    }
    
    if (typeof window.showToast === 'function') {
      window.showToast('Auto-dosing stopped successfully', 'success');
    }
  } catch (error) {
    console.error('Error stopping auto-dosing:', error);
    if (typeof window.showToast === 'function') {
      window.showToast('Failed to stop auto-dosing: ' + error.message, 'error');
    }
  }
}

// Function to update auto-dosing status
const updateAutoDosingStatus = async () => {
  if (!autoDosingActive.value) return;
  
  try {
    const response = await axios.get(`${API_URL}/actuators/fertilizer/auto-dose/status`);
    
    if (response.data.success && response.data.data) {
      const statusData = response.data.data;
      
      // If auto-dosing is no longer active, reset our state
      if (!statusData.active) {
        autoDosingActive.value = false;
        autoDosingStatus.value = null;
        
        if (nextCheckTimerId.value) {
          clearInterval(nextCheckTimerId.value);
          nextCheckTimerId.value = null;
        }
        
        return;
      }
      
      // Update current EC if available in the status
      if (statusData.currentEC) {
        currentEC.value = statusData.currentEC;
      }
      
      // Update target EC if available (in case it was changed on the backend)
      if (statusData.targetEC) {
        targetEC.value = statusData.targetEC;
      }
      
      // Calculate progress based on how close current EC is to target
      if (currentEC.value !== null && statusData.targetEC) {
        const progressPercentage = Math.min(100, Math.max(0, 
          (currentEC.value / statusData.targetEC) * 100
        ));
        autoDosingProgress.value = progressPercentage;
      }
      
      // Check for mixing phase with improved validation
      if (statusData.inMixingPhase) {
        autoDosingStatus.value = 'mixing';
        
        // Calculate mixing countdown with validation
        if (statusData.mixingEndTime) {
          const now = Date.now();
          const mixingEnd = new Date(statusData.mixingEndTime).getTime();
          const calculatedCountdown = Math.max(0, Math.round((mixingEnd - now) / 1000));
          
          // Only update if we have a reasonable value
          if (calculatedCountdown > 0 && calculatedCountdown < 3600) { // Max 1 hour as sanity check
            mixingCountdown.value = calculatedCountdown;
          }
          
          // Start mixing timer if not already running and we have a valid time
          if (!mixingTimerId.value && mixingCountdown.value > 0) {
            console.log(`Starting mixing timer with ${mixingCountdown.value} seconds`);
            startMixingTimer(mixingCountdown.value);
          }
        } else if (statusData.mixingTimeRemaining) {
          // If we have explicit remaining time but no end time
          const parsedTime = parseInt(statusData.mixingTimeRemaining);
          if (!isNaN(parsedTime) && parsedTime > 0) {
            mixingCountdown.value = parsedTime;
            if (!mixingTimerId.value) {
              startMixingTimer(parsedTime);
            }
          }
        }
      } else {
        // If not in mixing phase but timer is running, stop it
        if (autoDosingStatus.value === 'mixing') {
          stopMixingTimer();
        }
        
        // Determine status based on last check and last dispensing times
        const now = Date.now();
        
        // Detect if we're currently dispensing or in a delay period
        if (statusData.lastDispensing) {
          const lastDispenseTime = new Date(statusData.lastDispensing).getTime();
          const timeSinceDispense = (now - lastDispenseTime) / 1000;
          
          if (statusData.recentlyActive && statusData.recentlyActive.length > 0) {
            // Currently dispensing
            autoDosingStatus.value = 'dispensing';
            currentAutoStep.value = statusData.currentStep || 1;
            totalAutoSteps.value = statusData.totalSteps || statusData.recentlyActive.length;
          } else if (timeSinceDispense < 60) { // Within a minute of last dispensing
            // In delay period after dispensing
            autoDosingStatus.value = 'delay';
            delayCountdown.value = Math.max(0, statusData.dispensingDelay - timeSinceDispense);
          } else {
            // Waiting for next check
            autoDosingStatus.value = 'waiting';
          }
        } else {
          // Waiting for first check or between checks
          autoDosingStatus.value = 'waiting';
        }
      }
      
      // Update next check countdown
      if (statusData.nextCheckTime) {
        const now = Date.now();
        const nextCheckTime = new Date(statusData.nextCheckTime).getTime();
        nextCheckCountdown.value = Math.max(0, Math.round((nextCheckTime - now) / 1000));
      } else if (statusData.lastCheck && statusData.checkInterval) {
        const lastCheckTime = new Date(statusData.lastCheck).getTime();
        const nextCheckTime = lastCheckTime + (statusData.checkInterval * 1000);
        nextCheckCountdown.value = Math.max(0, Math.round((nextCheckTime - now) / 1000));
      }
    }
  } catch (error) {
    console.warn('Error updating auto-dosing status:', error);
  }
}

// Add this new function to initialize auto-dosing state from backend
const initializeAutoDosingState = async () => {
  try {
    console.log('Checking if auto-dosing is active...');
    const response = await axios.get(`${API_URL}/actuators/fertilizer/auto-dose/status`);
    
    if (response.data.success && response.data.data) {
      const statusData = response.data.data;
      
      // If auto-dosing is active on the backend, update UI state
      if (statusData.active) {
        console.log('Auto-dosing is active, restoring UI state');
        autoDosingActive.value = true;
        targetEC.value = statusData.targetEC || targetEC.value;
        
        if (statusData.currentEC) {
          currentEC.value = statusData.currentEC;
        }
        
        // Set initial status to waiting (default state)
        autoDosingStatus.value = 'waiting';
        
        // Start the status update interval
        if (autoStatusRefreshInterval.value) {
          clearInterval(autoStatusRefreshInterval.value);
        }
        autoStatusRefreshInterval.value = setInterval(updateAutoDosingStatus, 5000);
        
        // IMPORTANT CHANGE: Don't auto-open modal anymore
        // Show toast notification instead
        if (typeof window.showToast === 'function') {
          window.showToast('Auto-dosing is active. Click Combined Fertilizer to view status.', 'info');
        }
        
        console.log('Auto-dosing UI state restored');
      }
    }
  } catch (error) {
    console.error('Error checking auto-dosing state:', error);
  }
};

// Function to open modal in auto-dosing mode
const openAutoDosingModal = () => {
  fertilizerMode.value = 'auto';
  
  // Open modal if not already open
  const modalElement = document.getElementById('combinedFertilizerModal');
  if (modalElement && !modalElement.classList.contains('show')) {
    modalRefs.value.combinedFertilizer = new Modal(modalElement);
    modalRefs.value.combinedFertilizer.show();
  }
};

// Add a flag to track if this device initiated the dispensing
const dispensingInitiator = ref(false);

// Add this computed property after your other computed properties
const formattedEC = computed(() => {
  if (currentEC.value === null || currentEC.value === undefined) return 'N/A';
  
  // Convert to number to ensure proper handling
  let ecValue = Number(currentEC.value);
  
  // Check if the value needs conversion from μS/cm to mS/cm
  if (ecValue > 100) {
    ecValue = ecValue / 1000;
  }
  
  // Return with 2 decimal places
  return ecValue.toFixed(2) + ' mS/cm';
});

// Fix the EC gap computation to properly handle unit conversion
const ecGap = computed(() => {
  if (currentEC.value === null || targetEC.value === null) return null;
  
  // Ensure both values are numbers
  let current = Number(currentEC.value);
  const target = Number(targetEC.value);
  
  // Convert current EC from μS/cm to mS/cm if needed
  if (current > 100) {
    current = current / 1000;
  }
  
  // Calculate the difference (target - current)
  return target - current;
});

// Max EC scale for the visual range indicator
const maxEcScale = computed(() => {
  // Set scale to 1.5x target EC or at least 5.0
  return Math.max(5.0, targetEC.value * 1.5);
});

// Add mixing state variables
const mixingCountdown = ref(0);
const mixingTimerId = ref(null);

// Add function to start a mixing countdown timer
const startMixingTimer = (seconds) => {
  // Clear any existing timer first
  stopMixingTimer();
  
  // Make sure we have a valid number for the countdown
  let validSeconds;
  
  if (typeof seconds === 'string') {
    validSeconds = parseInt(seconds, 10);
  } else if (typeof seconds === 'number') {
    validSeconds = seconds;
  } else {
    validSeconds = 300; // Default 5 minutes
  }
  
  // Apply validation and constraints
  if (isNaN(validSeconds) || validSeconds < 0) {
       console.warn(`Invalid mixing time provided (${seconds}), using default`);
    validSeconds = 300; // Default to 5 minutes if invalid
   } else {
    // Cap at 1 hour to prevent unreasonable values
    validSeconds = Math.min(3600, Math.floor(validSeconds));
  }
  
  console.log(`Starting mixing timer with ${validSeconds} seconds`);
  
  mixingCountdown.value = validSeconds;
  mixingTimerId.value = setInterval(() => {
    if (mixingCountdown.value <= 0) {
           stopMixingTimer();
      // Check auto-dosing status after timer ends
      updateAutoDosingStatus();
    } else {
      mixingCountdown.value -= 1;
    }
  }, 1000);
};

const stopMixingTimer = () => {
  if (mixingTimerId.value) {
    clearInterval(mixingTimerId.value);
    mixingTimerId.value = null;
  }
};

// Update onUnmounted to clean up the mixing timer
onUnmounted(() => {
  // ...existing cleanup code...
  
  stopMixingTimer();
});

// Add new data structure to track active fertilizer amounts
const activeFertilizerAmounts = ref({});

// Add function to get active amount for a fertilizer pump
const getActiveFertilizerAmount = (pumpId) => {
  // First check from WebSocket tracked amounts
  if (activeFertilizerAmounts.value[pumpId]) {
    return activeFertilizerAmounts.value[pumpId];
  }
  
  // Then check from local configuration if in manual mode and this pump is selected
  if (fertilizerMode.value === 'manual') {
    const pump = fertilizerPumps.value.find(p => p.id === pumpId && p.selected);
    if (pump && pump.amount) {
      return pump.amount;
    }
  }
  
  // For auto mode, show calculated amount
  if (fertilizerMode.value === 'auto' && autoDosingActive.value) {
    const pump = fertilizerPumps.value.find(p => p.id === pumpId && p.selectedAuto);
    if (pump) {
      return calculatePumpAmount(pump);
    }
  }
  
  return null;
};


// Add function to calculate time based on pump flow rate for auto-dosing
const calculateAutoDispenseTime = (pump) => {
  // Use a standard auto-dose amount of 5ml for estimation
  const estimatedAmount = 5.0;
  
  if (!pump.flowRate || pump.flowRate <= 0) {
    return "unknown";
  }
  
  // Calculate time in seconds: amount (ml) / flow rate (ml/min) * 60 seconds
  const flowRatePerSecond = pump.flowRate / 60;
  const timeSeconds = Math.max(3, estimatedAmount / flowRatePerSecond);
  
  // Format the output based on duration
  if (timeSeconds < 60) {
    return `~${Math.ceil(timeSeconds)}s`;
  } else {
    const minutes = Math.floor(timeSeconds / 60);
    const seconds = Math.ceil(timeSeconds % 60);
    return `~${minutes}m ${seconds}s`;
  }
};

</script>

<style scoped>
/* ======= BASE STYLES ======= */
.actuators-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  padding: 0.5rem;
}

.actuator-card {
  position: relative;
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.actuator-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  min-height: 80px;
}

.actuator-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

/* ======= STATUS INDICATORS ======= */
.mode-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.9rem;
}

.mode-badge.auto {
  background: #52b788;
}

.mode-badge.manual {
  background: var(--bs-primary);
}

.mode-badge.rule {
  background: #6c757d;
  animation: pulse 2s infinite;
}

.status-bullet {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-active { background-color: #52b788; }
.status-idle { background-color: #FFA500; }
.status-paused { background-color: #4361ee; }
.status-disabled { background-color: #6c757d; }

.status-label {
  font-size: 0.75rem;
  background-color: #52b788;
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: auto;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 0.7; }
  50% { opacity: 1; }
  100% { opacity: 0.7; }
}

/* ======= ICON STYLES ======= */
.actuator-icon {
  font-size: 1.4rem;
  width: 28px;
  text-align: center;
  transition: all 0.3s ease;
}

[data-actuator-type="chiller"] .actuator-icon {
  color: #00b4d8;
}

[data-actuator-type="fan"] .actuator-icon {
  color: #4361ee;
}

[data-actuator-type="sensor-pump"] .actuator-icon {
  color: #7209b7;
}

[data-actuator-type="ph-pump"] .actuator-icon {
  color: #f72585;
}

.status-idle .actuator-icon {
  opacity: 0.5;
}

/* ======= TIMER DISPLAY ======= */
.timer-display {
  margin-top: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.timer-label {
  font-weight: 500;
  color: var(--text-color);
  margin-right: 0.25rem;
}

.timer-value {
  font-family: monospace;
  font-weight: 500;
}

/* ======= FERTILIZER ITEMS ======= */
.fertilizer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.fertilizer-item {
  background: var(--glass-effect, rgba(240, 240, 240, 0.8));
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.fertilizer-item.selected {
  border-color: #4361ee;
  box-shadow: 0 4px 8px rgba(67, 97, 238, 0.15);
  transform: translateY(-2px);
}

.fertilizer-header {
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.fertilizer-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(67, 97, 238, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4361ee;
  font-size: 1rem;
}

.fertilizer-item.selected .fertilizer-icon {
  background: #4361ee;
  color: white;
}

.fertilizer-type {
  font-weight: 600;
  flex: 1;
}

.fertilizer-details {
  padding: 0 1rem 1rem;
  position: relative;
  border-top: 1px dashed var(--border-color);
  margin-top: 0.5rem;
  padding-top: 1rem;
}

/* ======= DOSING CONTROLS ======= */
.dose-control label {
  display: block;
  font-size: 0.85rem;
  color: var(--text-color-secondary);
  margin-bottom: 0.5rem;
}

.dose-input-group {
  display: flex;
  align-items: center;
  height: 38px;
}

.dose-input {
  width: 60px;
  height: 38px;
  text-align: center;
  border: 1px solid var(--border-color);
  border-radius: 0;
  font-weight: 600;
}

.dose-input:focus {
  outline: none;
  border-color: #4361ee;
}

.dose-btn {
  width: 38px;
  height: 38px;
  background: var(--bg-muted, #f0f0f0);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.2rem;
  cursor: pointer;
  user-select: none;
}

.dose-btn.minus {
  border-radius: 6px 0 0 6px;
  border-right: none;
}

.dose-btn.plus {
  border-radius: 0 6px 6px 0;
  border-left: none;
}

.dose-btn:hover {
  background: #4361ee;
  color: white;
}

/* ======= RATIO CONTROLS ======= */
.ratio-control label {
  display: block;
  font-size: 0.85rem;
  color: var(--text-color-secondary);
  margin-bottom: 0.5rem;
}

.ratio-input-group {
  display: flex;
  align-items: center;
  margin-bottom: 0.25rem;
}

.ratio-input-group .form-control {
  flex: 1;
  text-align: center;
  font-weight: 500;
}

.ratio-divider {
  background: var(--glass-effect);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  color: var(--text-color-secondary);
  font-size: 0.8rem;
}

.ratio-per {
  font-weight: 500;
  color: var(--text-color-secondary);
}

/* ======= EC IMPACT ======= */
.ec-impact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.85rem;
}

.impact-label {
  color: var(--text-color-secondary);
}

.impact-value {
  font-weight: 600;
  color: #4361ee;
  background: rgba(67, 97, 238, 0.1);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

/* ======= TOGGLES & BADGES ======= */
.toggle-switch {
  position: relative;
  width: 46px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--text-color-secondary);
  transition: .4s;
  border-radius: 34px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: #4361ee;
}

input:checked + .toggle-slider:before {
  transform: translateX(22px);
}

.sequence-number {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}

.sequence-badge {
  background-color: #4361ee;
  color: white;
  font-weight: 600;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
}

/* ======= MODAL STYLES ======= */
.legend-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.legend-modal-content {
  background-color: var(--card-bg);
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.legend-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.legend-modal-header h5 {
  margin: 0;
  font-weight: 600;
}

.legend-modal-close {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-muted);
  padding: 0;
  line-height: 1;
  transition: color 0.2s ease;
}

.legend-modal-close:hover {
  color: var(--text-color);
}

.legend-modal-body {
  padding: 1.5rem;
}

.status-legend {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.legend-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.legend-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: inline-block;
  margin-top: 4px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.legend-dot.status-active { background-color: #52b788; }
.legend-dot.status-idle { background-color: #FFA500; }
.legend-dot.status-paused { background-color: #4361ee; }
.legend-dot.status-disabled { background-color: #6c757d; }

.legend-description {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-top: 0.25rem;
}

/* ======= DISPLAYS & INDICATORS ======= */
.water-level-display, .ec-level-display {
  padding: 0.5rem 1rem;
  background: var(--glass-effect);
  border-radius: 8px;
  display: flex;
  align-items: center;
  font-weight: 500;
  color: var(--text-color);
}

.water-level-display i, .ec-level-display i {
  color: #4361ee;
  font-size: 1.2rem;
}

.water-volume, .ec-value {
  font-size: 1.1rem;
}

.help-icon {
  cursor: pointer;
  color: var(--text-muted);
  font-size: 1.2rem;
  transition: color 0.3s ease;
  margin-left: 0.5rem;
}

.help-icon:hover {
  color: var(--accent-color);
  transform: scale(1.1);
}

.dispensing-order {
  color: var(--text-color-secondary);
  font-size: 0.85rem;
  padding: 0.5rem;
  background: var(--glass-effect);
  border-radius: 6px;
}

.alert-info {
  background: var(--glass-effect);
  border-left: 4px solid var(--accent-color);
  color: var(--text-color);
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.alert-info strong {
  color: var(--accent-color);
  font-size: 1.1em;
}

/* ======= RESPONSIVE STYLES ======= */
@media (max-width: 768px) {
  .actuators-grid,
  .fertilizer-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  
  .actuator-content {
    padding: 0.75rem;
  }
  
  .timer-display {
    font-size: 0.8rem;
    padding: 0.2rem 0.5rem;
  }
  
  .dose-input {
    width: 50px;
  }
}

@media (max-width: 576px) {
  .ratio-input-group {
    flex-wrap: wrap;
  }
  
  .ratio-input-group .form-control {
    min-width: 70px;
  }
}

/* Styles for auto-dosing status display */
.auto-dosing-status {
  background: var(--glass-effect, rgba(240, 240, 240, 0.8));
  border-radius: 12px;
  padding: 1rem;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
}

.status-title {
  margin-bottom: 0.75rem;
  font-weight: 600;
}

.status-badge {
  font-size: 0.8rem;
  padding: 0.2rem 0.75rem;
  border-radius: 1rem;
  font-weight: 500;
}

.status-waiting {
  background-color: #4361ee;
  color: white;
}

.status-checking {
  background-color: #4cc9f0;
  color: white;
}

.status-dispensing {
  background-color: #52b788;
  color: white;
}

.status-delay {
  background-color: #ff9e00;
  color: white;
}

.auto-status-details .alert {
  margin-bottom: 0;
}

:deep(.dark-mode) .auto-dosing-status {
  background: rgba(255, 255, 255, 0.05);
}

:deep(.dark-mode) .status-badge {
  color: #1a1a2e;
}

:deep(.dark-mode) .status-waiting {
  background-color: #90e0ef;
}

:deep(.dark-mode) .status-checking {
  background-color: #48cae4;
}

:deep(.dark-mode) .status-dispensing {
  background-color: #52b788;
}

:deep(.dark-mode) .status-delay {
  background-color: #fca311;
}

/* ======= EMERGENCY CONTROLS ======= */
.emergency-controls {
  margin-top: 1rem;
}

.emergency-buttons {
  display: flex;
  align-items: center;
}

.emergency-buttons .btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.alert {
  margin-bottom: 0;
  padding: 0.75rem;
  border-radius: 8px;
}

.alert-warning {
  border-left: 4px solid #ffc107;
}

/* Additional responsive styling for emergency controls */
@media (max-width: 576px) {
  .emergency-controls .alert {
    flex-direction: column;
  }
  
  .emergency-buttons {
    margin-top: 0.5rem;
    width: 100%;
    justify-content: flex-end;
  }
}

/* Add this to the <style> section */
.dispensing-disabled {
  opacity: 0.7;
  pointer-events: none;
}

.dispensing-disabled .actuator-content {
  cursor: not-allowed !important;
}

.dispensing-disabled::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  z-index: 1;
}

.dispensing-disabled .status-bullet {
  position: relative;
  z-index: 2;
}

:deep(.dark-mode) .dispensing-disabled::after {
  background: rgba(255, 255, 255, 0.05);
}

/* Add a class for waiting fertilizer styling without timer */
.waiting-fertilizer {
  background-color: rgba(67, 97, 238, 0.05);
}

.status-label.waiting {
  background-color: #4361ee;
  animation: pulse 1.5s infinite;
}

/* EC Range Indicator Styles */
.ec-range-indicator {
  margin: 1rem 0;
  padding: 0.5rem;
}

.range-bar {
  height: 24px;
  background-color: #f0f0f0;
  border-radius: 12px;
  position: relative;
  margin-bottom: 0.75rem;
}

.target-range {
  position: absolute;
  height: 100%;
  background-color: rgba(82, 183, 136, 0.3);
  border: 1px solid #52b788;
  top: 0;
  border-radius: 12px;
  z-index: 1;
}

.current-marker {
  position: absolute;
  width: 12px;
  height: 24px;
  background-color: #4361ee;
  border-radius: 2px;
  top: 0;
  transform: translateX(-50%);
  z-index: 2;
  transition: left 0.5s ease;
}

.current-marker.too-low {
  background-color: #dc3545;
}

.current-marker.too-high {
  background-color: #ffc107;
}

.current-marker.in-range {
  background-color: #52b788;
}

.scale-markers {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}

.scale-mark {
  position: absolute;
  height: 8px;
  width: 1px;
  background-color: #aaa;
  bottom: 0;
  transform: translateX(-50%);
}

.mark-value {
  position: absolute;
  bottom: -18px;
  transform: translateX(-50%);
  font-size: 0.7rem;
  color: #666;
}

.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #666;
}

.range-label.target {
  color: #52b788;
  font-weight: bold;
}

.range-label.low {
  color: #dc3545;
}

.range-label.high {
  color: #ffc107;
}

/* Dark mode support */
:deep(.dark-mode) .range-bar {
  background-color: #2c2c2c;
}

:deep(.dark-mode) .target-range {
  background-color: rgba(82, 183, 136, 0.2);
}

:deep(.dark-mode) .mark-value,
:deep(.dark-mode) .range-labels {
  color: #aaa;
}

/* Add styles for dose amount display */
.dose-amount {
  background-color: #e0f2f1;
  color: #00796b;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 8px;
  border: 1px solid #b2dfdb;
}

:deep(.dark-mode) .dose-amount {
  background-color: rgba(0, 121, 107, 0.2);
  color: #4db6ac;
  border-color: #00796b;
}

/* Add styling for the auto-dose info box */
.auto-dose-info {
  background-color: rgba(67, 97, 238, 0.1);
  border-radius: 6px;
  padding: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-color-secondary);
  display: flex;
  align-items: center;
}

.auto-dose-info i {
  color: #4361ee;
  font-size: 1rem;
}

:deep(.dark-mode) .auto-dose-info {
  background-color: rgba(67, 97, 238, 0.15);
}

/* Add enhanced styles for the gap display */
.gap-display {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

</style>
