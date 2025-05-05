<template>
  <div class="col-md-6 mb-4">
    <div class="h-100 card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0"><i class="fas fa-seedling me-1"></i> Growth Calendar</h5>
        <div class="calendar-controls">
          <button class="btn btn-sm btn-outline-secondary me-2" @click="previousMonth">
            <i class="fas fa-chevron-left"></i>
          </button>
          <span class="month-display">{{ currentMonthYear }}</span>
          <button class="btn btn-sm btn-outline-secondary ms-2" @click="nextMonth">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
      <div class="card-body d-flex flex-column">
        <div class="calendar flex-grow-1">
          <div v-for="day in weekDays" :key="day" class="calendar-header">{{ day }}</div>
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            :class="getDayClasses(day)"
            @click="toggleGrowthDay(day)"
          >
            <span class="day-number">{{ day.dayNumber }}</span>
            <span v-if="day.growthDay" class="growth-indicator">
              Day {{ day.growthDay }}
            </span>
          </div>
        </div>
        <div class="calendar-footer mt-auto">
          <div class="growth-info">
            <span class="growth-stage">Growth Stage: {{ currentStage }}</span>
            <span class="days-count">Days: {{ totalGrowthDays }}</span>
          </div>
          <div class="harvest-estimation mt-2" v-if="harvestEstimation">
            <div class="harvest-info">
              <i class="fas fa-calendar-check text-success me-2"></i>
              <span>Estimated Harvest: {{ formatDate(harvestEstimation.date) }}</span>
            </div>
            <div class="harvest-progress">
              <div class="progress" style="height: 8px;">
                <div class="progress-bar bg-success" 
                     :style="{ width: `${harvestEstimation.progress}%` }"
                     :title="`${harvestEstimation.progress}% complete`">
                </div>
              </div>
              <small class="text-muted">
                {{ harvestEstimation.daysLeft }} days remaining
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Add this modal before closing the root div -->
  <div class="modal fade" id="growthAnalysisModal" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            Growth Analysis - {{ selectedDate ? formatDate(selectedDate) : '' }}
          </h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <!-- Environmental Data -->
          <div class="analysis-section mb-4">
            <h6 class="section-title">Environmental Conditions</h6>
            <div class="row g-3">
              <div class="col-6">
                <div class="data-card">
                  <i class="fas fa-temperature-high"></i>
                  <div class="data-content">
                    <label>Temperature</label>
                    <span>{{ environmentalData.temperature }}°C</span>
                  </div>
                </div>
              </div>
              <div class="col-6">
                <div class="data-card">
                  <i class="fas fa-tint"></i>
                  <div class="data-content">
                    <label>Humidity</label>
                    <span>{{ environmentalData.humidity }}%</span>
                  </div>
                </div>
              </div>
              <div class="col-6">
                <div class="data-card">
                  <i class="fas fa-flask"></i>
                  <div class="data-content">
                    <label>pH Level</label>
                    <span>{{ environmentalData.ph }}</span>
                  </div>
                </div>
              </div>
              <div class="col-6">
                <div class="data-card">
                  <i class="fas fa-bolt"></i>
                  <div class="data-content">
                    <label>EC Level</label>
                    <span>{{ environmentalData.ec }} mS/cm</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- System Activity -->
          <div class="analysis-section mb-4">
            <h6 class="section-title">System Activity</h6>
            <div class="activity-timeline">
              <div class="activity-item" v-for="activity in systemActivity" :key="activity.time">
                <span class="activity-time">{{ activity.time }}</span>
                <span class="activity-description">{{ activity.description }}</span>
              </div>
            </div>
          </div>

          <!-- Growth Analysis -->
          <div class="analysis-section">
            <h6 class="section-title">Growth Analysis</h6>
            <div class="growth-metrics">
              <div class="metric-item">
                <label>Growth Stage</label>
                <span>{{ growthAnalysis.stage }}</span>
              </div>
              <div class="metric-item">
                <label>Est. Plant Height</label>
                <span>{{ growthAnalysis.height }} cm</span>
              </div>
              <div class="metric-item">
                <label>Growth Rate</label>
                <span>{{ growthAnalysis.growthRate }} cm/day</span>
              </div>
              <div class="metric-item">
                <label>Health Status</label>
                <span :class="'health-' + growthAnalysis.healthStatus.toLowerCase()">
                  {{ growthAnalysis.healthStatus }}
                </span>
              </div>
            </div>
          </div>

          <!-- Estimated Dates -->
          <div class="analysis-section mt-4">
            <h6 class="section-title">Important Dates</h6>
            <div class="dates-timeline">
              <div v-for="(date, stage) in estimatedDates" :key="stage" class="date-item">
                <label>{{ stage }}</label>
                <span>{{ formatDate(date) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Modal } from 'bootstrap'

const currentDate = ref(new Date())
const plantStartDate = ref(null)
const growthDays = ref(new Set())
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const currentMonthYear = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

const totalGrowthDays = computed(() => growthDays.value.size)

const currentStage = computed(() => {
  const days = totalGrowthDays.value
  if (days < 7) return 'Seedling'
  if (days < 14) return 'Early Growth'
  if (days < 28) return 'Vegetative'
  if (days < 42) return 'Early Flowering'
  return 'Late Flowering'
})

const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const days = []

  // Add empty days for padding
  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push({ dayNumber: '', isEmpty: true })
  }

  // Add actual days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(year, month, i)
    const dateString = date.toISOString().split('T')[0]
    days.push({
      dayNumber: i,
      date: dateString,
      growthDay: growthDays.value.has(dateString) ? 
        calculateGrowthDay(dateString) : null
    })
  }

  return days
})

function calculateGrowthDay(dateString) {
  if (!plantStartDate.value) return null
  const dayDiff = Math.floor(
    (new Date(dateString) - new Date(plantStartDate.value)) / (1000 * 60 * 60 * 24)
  ) + 1
  return dayDiff > 0 ? dayDiff : null
}

const selectedDate = ref(null)
let analysisModal = null

const environmentalData = ref({
  temperature: 25.5,
  humidity: 65,
  ph: 6.2,
  ec: 1.8
})

const systemActivity = ref([
  { time: '08:00', description: 'Water pump active - 15 minutes' },
  { time: '12:00', description: 'Nutrient dosing - 100ml' },
  { time: '16:00', description: 'Water pump active - 15 minutes' },
  { time: '20:00', description: 'pH adjustment - 50ml' }
])

const growthAnalysis = ref({
  stage: 'Vegetative',
  height: 45,
  growthRate: 2.5,
  healthStatus: 'Excellent'
})

const estimatedDates = computed(() => {
  if (!plantStartDate.value) return {}
  
  const start = new Date(plantStartDate.value)
  return {
    'Germination': new Date(start.getTime() + (3 * 24 * 60 * 60 * 1000)),
    'Seedling': new Date(start.getTime() + (7 * 24 * 60 * 60 * 1000)),
    'Vegetative': new Date(start.getTime() + (21 * 24 * 60 * 60 * 1000)),
    'Flowering': new Date(start.getTime() + (35 * 24 * 60 * 60 * 1000)),
    'Harvest': new Date(start.getTime() + (60 * 24 * 60 * 60 * 1000))
  }
})

// Add after other computed properties
const harvestEstimation = computed(() => {
  if (!plantStartDate.value) return null
  
  const start = new Date(plantStartDate.value)
  const harvestDate = new Date(start.getTime() + (60 * 24 * 60 * 60 * 1000)) // 60 days cycle
  const today = new Date()
  
  // Calculate days left and progress
  const totalDays = 60
  const daysElapsed = Math.floor((today - start) / (1000 * 60 * 60 * 24))
  const daysLeft = Math.max(0, totalDays - daysElapsed)
  const progress = Math.min(100, Math.round((daysElapsed / totalDays) * 100))
  
  return {
    date: harvestDate,
    daysLeft,
    progress
  }
})

function toggleGrowthDay(day) {
  if (day.isEmpty || !day.date) return

  if (!plantStartDate.value) {
    plantStartDate.value = day.date
    growthDays.value.add(day.date)
  } else {
    if (growthDays.value.has(day.date)) {
      growthDays.value.delete(day.date)
      if (day.date === plantStartDate.value) {
        plantStartDate.value = null
      }
    } else {
      growthDays.value.add(day.date)
    }
  }
  
  // Show analysis modal
  selectedDate.value = day.date
  analysisModal?.show()
}

function previousMonth() {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() - 1
  )
}


function nextMonth() {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1
  )
}

function getDayClasses(day) {
  return {
    'calendar-day': true,
    'empty': day.isEmpty,
    'active': !day.isEmpty && growthDays.value.has(day.date),
    'start-day': !day.isEmpty && day.date === plantStartDate.value
  }
}

function formatDate(dateString) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

onMounted(() => {
  import('bootstrap').then(({ Modal }) => {
    analysisModal = new Modal(document.getElementById('growthAnalysisModal'))
  })
})


const analysisModalRef = ref(null)

onMounted(async () => {
  const modalElement = document.getElementById('growthAnalysisModal')
  if (modalElement) {
    analysisModalRef.value = new Modal(modalElement, {
      backdrop: 'static',
      keyboard: false
    })
  }
})

const openAnalysisModal = () => {
  analysisModalRef.value?.show()
}

// Clean up
onUnmounted(() => {
  analysisModalRef.value?.dispose()
})
</script>

<style scoped>
.calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  padding: 10px;
  flex: 1;
  min-height: 0; /* Prevent overflow */
}

.calendar-header {
  text-align: center;
  font-weight: bold;
  color: var(--text-color-secondary);
  padding: 8px;
}

.calendar-day {
  min-height: 50px; /* Reduced fixed height */
  height: auto;    /* Allow flexible height */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--card-bg);
  cursor: pointer;
  transition: all 0.3s ease;
}

.calendar-day:hover:not(.empty) {
  background-color: var(--glass-effect);
  transform: scale(1.05);
}

.calendar-day.empty {
  background-color: transparent;
  border: none;
  cursor: default;
}

.calendar-day.active {
  background-color: var(--success-color);
  color: white;
}

.calendar-day.start-day {
  border: 2px solid var(--accent-color);
}

.day-number {
  font-size: 1.1rem;
  font-weight: 500;
}

.growth-indicator {
  font-size: 0.8rem;
  margin-top: 2px;
}

.calendar-footer {
  border-top: 1px solid var(--border-color);
  padding-top: 1rem;
}

.growth-info {
  display: flex;
  justify-content: space-between;
  color: var(--text-color);
}

.growth-stage {
  font-weight: 500;
}

.calendar-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.calendar-controls button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: var(--text-color);
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  transition: all 0.2s ease;
}

.calendar-controls button:hover {
  background-color: var(--glass-effect);
  color: var(--accent-color);
  border-color: var(--accent-color);
}

.month-display {
  min-width: 140px;
  text-align: center;
  color: white;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
}

.card-body {
  height: 100%;
  display: flex;
  flex-direction: column;
}

@media (max-width: 768px) {
  .calendar-day {
    min-height: 50px;
    font-size: 0.9rem;
  }

  .growth-indicator {
    font-size: 0.7rem;
  }
}

.analysis-section {
  margin-bottom: 1.5rem;
}

.section-title {
  margin-bottom: 1rem;
  color: var(--text-color);
  font-weight: 600;
}

.data-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--glass-effect);
  border-radius: 8px;
}

.data-card i {
  font-size: 1.5rem;
  color: var(--accent-color);
}

.data-content {
  display: flex;
  flex-direction: column;
}

.data-content label {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

.activity-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.activity-item {
  display: flex;
  gap: 1rem;
  padding: 0.5rem;
  background: var(--glass-effect);
  border-radius: 4px;
}

.activity-time {
  font-family: monospace;
  color: var(--accent-color);
}

.growth-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.metric-item {
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  background: var(--glass-effect);
  border-radius: 4px;
}

.dates-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.date-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  background: var(--glass-effect);
  border-radius: 4px;
}

.health-excellent { color: var(--success-color); }
.health-good { color: var(--bs-primary); }
.health-fair { color: var(--warning-color); }
.health-poor { color: var(--danger-color); }

/* Add after existing styles */
.harvest-estimation {
  border-top: 1px solid var(--border-color);
  padding-top: 0.75rem;
  margin-top: 0.75rem;
}

.harvest-info {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  color: var(--text-color);
}

.harvest-progress {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.progress {
  background-color: var(--glass-effect);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar {
  transition: width 0.6s ease;
}

.text-muted {
  font-size: 0.8rem;
  text-align: right;
}

/* Update dark mode specific styles */
:root[data-bs-theme="dark"] .calendar-controls button {
  background-color: var(--bs-gray-800);
  border-color: var(--bs-gray-700);
  color: var(--bs-gray-200);
}

:root[data-bs-theme="dark"] .calendar-controls button:hover {
  background-color: var(--bs-gray-700);
  border-color: var(--accent-color);
  color: var(--accent-color);
}
</style>