<template>
  <div class="col-md-6 mb-4">
    <div class="card h-100">
      <div class="card-header">
        <div class="d-flex justify-content-between align-items-center">
          <h5 class="mb-0">
            <i class="fas fa-cog me-2"></i>
            {{ title }}
          </h5>
          
          <!-- Control buttons group -->
          <div class="controls-group">
            <!-- Action buttons -->
            <div class="action-buttons">
         
              
              <button 
                v-if="showTest"
                class="btn-control"
                :class="{ 
                  'running': isTestRunning,
                  'success': testResult?.status === 'success',
                  'error': testResult?.status === 'error'
                }"
                @click="runTest"
                :disabled="isTestRunning"
                title="Test"
              >
                <i class="fas" :class="getTestIcon"></i>
              </button>
            </div>

            <!-- Mode toggle -->
            <div class="mode-toggle">
              <button 
                class="btn-mode"
                :class="{ active: mode === 'auto' }"
                @click="mode = 'auto'"
              >
                <i class="fas fa-clock"></i>
                <span>Auto</span>
              </button>
              <button 
                class="btn-mode"
                :class="{ active: mode === 'manual' }"
                @click="mode = 'manual'"
              >
                <i class="fas fa-hand-pointer"></i>
                <span>Manual</span>
              </button>
            </div>

           
          </div>
        </div>
      </div>

      <div class="card-body">
        <!-- Auto mode content -->
        <div v-if="mode === 'auto'" class="schedule-container">
          <!-- Enable/Disable Switch -->
          <div class="setting-group mb-4">
            <div class="d-flex justify-content-between align-items-center">
              <label class="setting-label" :for="`${idPrefix}-switch`">
                <i class="fas fa-power-off me-2"></i>Enable Schedule
              </label>
              <label class="switch">
                <input 
                  type="checkbox"
                  v-model="isEnabled"
                  :id="`${idPrefix}-switch`"
                >
                <span class="slider round"></span>
              </label>
            </div>
          </div>

          <!-- Monitoring specific content -->
          <template v-if="type === 'monitoring'">
            <!-- Frequency Selection -->
            <div class="setting-group mb-4">
              <label class="setting-label">
                <i class="fas fa-calendar me-2"></i>Frequency
              </label>
              <select v-model="monitoringSchedule.frequency" class="form-select">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <!-- Time Selection -->
            <div class="setting-group mb-4">
              <label class="setting-label">
                <i class="fas fa-clock me-2"></i>Check Time
              </label>
              <div class="time-input-group">
                <div class="time-unit">
                  <select v-model="monitoringSchedule.time.hours" class="time-input">
                    <option v-for="h in 12" :key="h" :value="h">
                      {{ h.toString().padStart(2, '0') }}
                    </option>
                  </select>
                  <span class="unit-label">hr</span>
                </div>
                <span class="time-separator">:</span>
                <div class="time-unit">
                  <select v-model="monitoringSchedule.time.minutes" class="time-input">
                    <option v-for="m in 60" :key="m-1" :value="m-1">
                      {{ (m-1).toString().padStart(2, '0') }}
                    </option>
                  </select>
                  <span class="unit-label">min</span>
                </div>
                <div class="time-unit">
                  <select v-model="monitoringSchedule.time.period" class="time-input">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                  <span class="unit-label">am/pm</span>
                </div>
              </div>
            </div>

            <!-- Next Check Display -->
            <div v-if="isEnabled" class="next-check-display">
              <i class="fas fa-clock me-2"></i>
              Next check: {{ formatNextCheck }}
            </div>
          </template>

          <!-- Regular actuator content -->
          <template v-else-if="showIntervalAndDuration">
            <div class="setting-group mb-4">
              <label class="setting-label">
                <i class="fas fa-clock me-2"></i>Interval
              </label>
              <div class="time-input-group">
                <!-- Time inputs for hours, minutes, seconds -->
                <div class="time-unit">
                  <input 
                    v-model="interval.hours" 
                    type="number" 
                    min="0" 
                    max="23" 
                    class="time-input"
                  >
                  <span class="unit-label">hr</span>
                </div>
                <span class="time-separator">:</span>
                <div class="time-unit">
                  <input 
                    v-model="interval.minutes" 
                    type="number" 
                    min="0" 
                    max="59" 
                    class="time-input"
                  >
                  <span class="unit-label">min</span>
                </div>
                <span class="time-separator">:</span>
                <div class="time-unit">
                  <input 
                    v-model="interval.seconds" 
                    type="number" 
                    min="0" 
                    max="59" 
                    class="time-input"
                  >
                  <span class="unit-label">sec</span>
                </div>
              </div>
            </div>

            <!-- Duration inputs -->
            <div class="setting-group mb-4">
              <label class="setting-label">
                <i class="fas fa-hourglass-half me-2"></i>Duration
              </label>
              <div class="time-input-group">
                <div class="time-unit">
                  <input 
                    v-model="duration.hours" 
                    type="number" 
                    min="0" 
                    max="23" 
                    class="time-input"
                  >
                  <span class="unit-label">hr</span>
                </div>
                <span class="time-separator">:</span>
                <div class="time-unit">
                  <input 
                    v-model="duration.minutes" 
                    type="number" 
                    min="0" 
                    max="59" 
                    class="time-input"
                  >
                  <span class="unit-label">min</span>
                </div>
                <span class="time-separator">:</span>
                <div class="time-unit">
                  <input 
                    v-model="duration.seconds" 
                    type="number" 
                    min="0" 
                    max="59" 
                    class="time-input"
                  >
                  <span class="unit-label">sec</span>
                </div>
              </div>
            </div>

            <!-- Days Selection -->
            <div class="days-selection">
              <label class="setting-label">
                <i class="fas fa-calendar-week me-2"></i>Active Days
              </label>
              <div class="days-grid">
                <template v-for="day in days" :key="day">
                  <input
                    type="checkbox"
                    class="btn-check"
                    :id="`${idPrefix}-${day}`"
                    v-model="selectedDays"
                    :value="day"
                  >
                  <label
                    class="day-btn"
                    :class="{ active: selectedDays.includes(day) }"
                    :for="`${idPrefix}-${day}`"
                  >
                    {{ day.slice(0, 3) }}
                  </label>
                </template>
              </div>
            </div>
          </template>

          <!-- pH solution content -->
          <template v-else>
            <div class="setting-group mb-4">
              <label class="setting-label">
                <i class="fas fa-clock me-2"></i>Release Time
              </label>
              <div class="time-input-group">
                <div class="time-unit">
                  <select v-model="phSolutionSchedule.time.hours" class="time-input">
                    <option v-for="h in 12" :key="h" :value="h">
                      {{ h.toString().padStart(2, '0') }}
                    </option>
                  </select>
                  <span class="unit-label">hr</span>
                </div>
                <span class="time-separator">:</span>
                <div class="time-unit">
                  <select v-model="phSolutionSchedule.time.minutes" class="time-input">
                    <option v-for="m in 60" :key="m-1" :value="m-1">
                      {{ (m-1).toString().padStart(2, '0') }}
                    </option>
                  </select>
                  <span class="unit-label">min</span>
                </div>
                <div class="time-unit">
                  <select v-model="phSolutionSchedule.time.period" class="time-input">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Solution amount input -->
            <div class="setting-group mb-4">
              <label class="setting-label">
                <i class="fas fa-flask me-2"></i>Solution Amount
              </label>
              <div class="solution-input-group">
                <input 
                  v-model="phSolutionSchedule.amount"
                  type="number"
                  min="0"
                  step="0.1"
                  class="form-control"
                  placeholder="Enter amount"
                >
                <span class="input-group-text">mL</span>
              </div>
            </div>
          </template>
        </div>

        <!-- Manual mode content -->
        <div v-else class="manual-container">
          <div class="manual-controls">
            <!-- Monitoring specific manual content -->
            <template v-if="type === 'monitoring'">
              <button 
                class="btn-manual"
                :class="{ active: isManualActive }"
                @click="toggleManual"
              >
                <i class="fas" :class="isManualActive ? 'fa-stop' : 'fa-play'"></i>
                {{ isManualActive ? 'Stop Scan' : 'Start Scan' }}
              </button>
            </template>
            <!-- Regular actuator manual content -->
            <template v-else>
              <div class="setting-group">
                <label class="setting-label">
                  <i class="fas fa-hourglass-half me-2"></i>Duration
                </label>
                <div class="time-input-group">
                  <!-- Same duration inputs as auto mode -->
                  <div class="time-unit">
                    <input 
                      v-model="duration.hours" 
                      type="number" 
                      min="0" 
                      max="23" 
                      class="time-input"
                      :disabled="isManualActive"
                    >
                    <span class="unit-label">hr</span>
                  </div>
                  <span class="time-separator">:</span>
                  <div class="time-unit">
                    <input 
                      v-model="duration.minutes" 
                      type="number" 
                      min="0" 
                      max="59" 
                      class="time-input"
                      :disabled="isManualActive"
                    >
                    <span class="unit-label">min</span>
                  </div>
                  <span class="time-separator">:</span>
                  <div class="time-unit">
                    <input 
                      v-model="duration.seconds" 
                      type="number" 
                      min="0" 
                      max="59" 
                      class="time-input"
                      :disabled="isManualActive"
                    >
                    <span class="unit-label">sec</span>
                  </div>
                </div>
              </div>

              <!-- Start/Stop button with timer -->
              <button 
                class="btn-manual text-center"
                :class="{ active: isManualActive }"
                @click="toggleManual"
              >
                <i class="fas" :class="isManualActive ? 'fa-stop' : 'fa-play'"></i>
                {{ isManualActive ? 'Stop' : 'Start' }}
                <span v-if="isManualActive" class="time-remaining">
                  {{ formattedTime }}
                </span>
              </button>
            </template>
          </div>
        </div>

        <!-- Test Results -->
        <div v-if="testResult" 
             class="test-results"
             :class="testResult.status">
          <div class="test-progress">
            <div class="progress-bar" :style="{ width: `${testResult.progress}%` }"></div>
          </div>
          <div class="test-message">
            {{ testResult.message }}
          </div>
        </div>

        <!-- Move the edit controls to the bottom -->
        <div v-if="mode === 'auto'" class="edit-controls">
          <button 
            class="btn-edit"
            :class="{ 'btn-save': isEditing }"
            @click="isEditing ? handleSave() : handleEdit()"
          >
            <i :class="isEditing ? 'fas fa-save' : 'fas fa-edit'"></i>
            {{ isEditing ? 'Save' : 'Edit' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'

const props = defineProps({
  title: String,
  idPrefix: String,
  type: {
    type: String,
    default: 'pump',
    validator: (value) => ['pump', 'aerator', 'monitoring', 'ph-up', 'ph-down'].includes(value)
  },
  showTest: {
    type: Boolean,
    default: false
  }
})

// Basic state
const isEnabled = ref(false)
const mode = ref('auto')
const isEditing = ref(false)
const isManualActive = ref(false)
const interval = ref({ hours: 0, minutes: 0, seconds: 0 })
const duration = ref({ hours: 0, minutes: 0, seconds: 0 })
const days = ref(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
const selectedDays = ref([])

// Timer state
const timer = ref(null)
const remainingTime = ref(0)

// Test state
const isTestRunning = ref(false)
const testResult = ref(null)

// Monitoring state
const monitoringSchedule = ref({
  frequency: 'daily',
  time: {
    hours: 8,
    minutes: 0,
    period: 'AM'
  }
})

// Add solution amount ref
const solutionAmount = ref(0)

// Add computed property to check if it's a pH solution
const isPHSolution = computed(() => {
  return props.type === 'ph-up' || props.type === 'ph-down'
})

// Update the computed property
const showIntervalAndDuration = computed(() => {
  return !isPHSolution.value && props.type !== 'monitoring'
})

// Add ref for pH solution schedule
const phSolutionSchedule = ref({
  time: {
    hours: 8,
    minutes: 0,
    period: 'AM'
  },
  amount: 0 // mL of solution to release
})

// Computed properties
const formattedTime = computed(() => {
  const hrs = Math.floor(remainingTime.value / 3600)
  const mins = Math.floor((remainingTime.value % 3600) / 60)
  const secs = remainingTime.value % 60
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
})

const getTestIcon = computed(() => {
  if (isTestRunning.value) return 'fa-spinner fa-spin'
  if (testResult.value?.status === 'success') return 'fa-check'
  if (testResult.value?.status === 'error') return 'fa-exclamation-circle'
  return 'fa-vial'
})

const formatNextCheck = computed(() => {
  if (!isEnabled.value) return 'Schedule inactive'
  const next = getNextCheckTime()
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(next)
})

// Methods
const handleEdit = () => {
  isEditing.value = true
}

const handleSave = () => {
  isEditing.value = false
  // Add your save logic here
}

const toggleManual = () => {
  if (mode.value === 'manual') {
    isManualActive.value = !isManualActive.value
    if (isManualActive.value) {
      startTimer()
    } else {
      stopTimer()
    }
  }
}

const startTimer = () => {
  const totalSeconds = 
    (duration.value.hours * 3600) + 
    (duration.value.minutes * 60) + 
    duration.value.seconds
  
  if (totalSeconds === 0) return
  
  remainingTime.value = totalSeconds
  timer.value = setInterval(() => {
    if (remainingTime.value > 0) {
      remainingTime.value--
    } else {
      stopTimer()
      isManualActive.value = false
    }
  }, 1000)
}

const stopTimer = () => {
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
  remainingTime.value = 0
}

const runTest = async () => {
  if (isTestRunning.value) return
  
  isTestRunning.value = true
  testResult.value = null
  
  try {
    let progress = 0
    const testSteps = [
      'Initializing system...',
      'Testing power output...',
      'Checking flow rate...',
      'Verifying sensors...',
      'Validating response time...'
    ]
    
    for (const step of testSteps) {
      testResult.value = { status: 'running', message: step, progress: progress }
      await new Promise(resolve => setTimeout(resolve, 1000))
      progress += 20
    }
    
    testResult.value = {
      status: Math.random() > 0.2 ? 'success' : 'error',
      message: testResult.value.status === 'success' ? 
        'Test completed successfully' : 
        'Test failed: Check connections',
      progress: 100
    }
  } catch (error) {
    testResult.value = {
      status: 'error',
      message: 'Test failed: ' + error.message,
      progress: 100
    }
  } finally {
    isTestRunning.value = false
  }
}

function getNextCheckTime() {
  const now = new Date()
  const schedule = monitoringSchedule.value
  
  let hours = schedule.time.hours
  if (schedule.time.period === 'PM' && hours !== 12) hours += 12
  if (schedule.time.period === 'AM' && hours === 12) hours = 0
  
  const next = new Date(now)
  next.setHours(hours, schedule.time.minutes, 0, 0)
  
  if (next <= now) {
    switch (schedule.frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1)
        break
      case 'weekly':
        next.setDate(next.getDate() + 7)
        break
      case 'monthly':
        next.setMonth(next.getMonth() + 1)
        next.setDate(1)
        break
    }
  }
  
  return next
}

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped>
/* Control buttons and mode toggle */
.controls-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-control {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: var(--glass-effect);
  color: var(--text-color);
  transition: all 0.3s ease;
}

.btn-control:hover:not(:disabled) {
  background: var(--card-header);
  color: white;
  transform: translateY(-1px);
}

.btn-control:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-control.active {
  background: var(--accent-color);
  color: white;
}

.mode-toggle {
  display: flex;
  gap: 0.25rem;
  background: var(--card-bg);
  padding: 0.25rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.btn-mode {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--card-bg);
  color: var(--text-color);
  transition: all 0.3s ease;
  font-size: 0.9rem;
}

.btn-mode:hover {
  background: var(--glass-effect);
  transform: translateY(-1px);
}

.btn-mode.active {
  background: var(--accent-color);
  color: white;

}

/* Schedule container and settings */
.schedule-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.setting-label {
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Time inputs */
.time-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--glass-effect);
  padding: 0.75rem;
  border-radius: 8px;
}

.time-unit {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.time-input {
  width: 50px;
  height: 36px;
  text-align: center;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-color);
  font-size: 1.1rem;
  font-weight: 600;
}

.unit-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.time-separator {
  font-weight: bold;
  color: var(--text-color);
  margin-top: -1rem;
}

/* Days selection */
.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.day-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-color);
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.day-btn.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

/* Manual mode */
.manual-container {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.manual-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  width: 100%;
}

.btn-manual {
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  background: var(--card-header);
  color: white;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  transition: all 0.3s ease;
  margin: 0 auto;
}

.btn-manual:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.btn-manual.active {
  background: var(--danger-color);
}

.time-remaining {
  font-family: monospace;
  background: rgba(255, 255, 255, 0.2);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin-left: 0.5rem;
}

/* Test results */
.test-results {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 8px;
  background: var(--glass-effect);
  animation: slideDown 0.3s ease;
}

.test-results.error {
  border-left: 4px solid var(--danger-color);
}

.test-results.success {
  border-left: 4px solid var(--success-color);
}

.test-progress {
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  margin-bottom: 1rem;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--accent-color);
  transition: width 0.3s ease;
}

.test-message {
  font-size: 0.9rem;
  color: var(--text-color);
}

/* Form elements */
.form-check-input {
  width: 3rem;
  height: 1.5rem;
  cursor: pointer;
}

/* Add new styles */
.solution-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 200px;
}

.solution-input-group input {
  text-align: right;
  height: 36px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-color);
  font-size: 1.1rem;
  font-weight: 600;
}

.solution-input-group .input-group-text {
  background: var(--glass-effect);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  border-radius: 6px;
  padding: 0.5rem 1rem;
}

/* Animations */
@keyframes slideDown {
  from { 
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Edit controls */
.edit-controls {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.btn-edit {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  background: var( --card-header-dark); /* Google Blue */
  color: white;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 120px;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(26, 115, 232, 0.2);
}

.btn-edit:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(26, 115, 232, 0.3);
}

.btn-edit.btn-save {
  background: var(--btn-control-light); /* Google Green */
  box-shadow: 0 2px 4px rgba(52, 168, 83, 0.2);
}

.btn-edit.btn-save:hover {
  box-shadow: 0 4px 8px rgba(52, 168, 83, 0.3);
}

/* Responsive styles */
@media (max-width: 768px) {
  .controls-group {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }

  .action-buttons {
    justify-content: center;
  }

  .mode-toggle {
    width: 100%;
  }

  .btn-mode {
    flex: 1;
    justify-content: center;
  }

  .days-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .time-input-group {
    flex-wrap: wrap;
  }

  .time-unit {
    flex: 1;
    min-width: 80px;
  }

  .edit-controls {
    justify-content: stretch;
  }
  
  .btn-edit {
    width: 100%;
    justify-content: center;
  }
}
</style>