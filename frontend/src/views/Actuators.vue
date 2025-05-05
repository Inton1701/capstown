<template>
  <div class="container-fluid py-4">
    <h1 class="text-center mb-4">System Controls</h1>



    <!-- System Controls -->
    <div class="row mb-4">
      <div class="col-12">
        <h4 class="section-title">
          <i class="fas fa-cogs me-2"></i>System Controls
        </h4>
        <div class="row g-4">
          <ScheduleCard title="Water Pump" id-prefix="water" type="pump" />
          <ScheduleCard title="Aerator" id-prefix="aerator" type="aerator" />
        </div>
      </div>
    </div>

    <!-- Monitoring Schedule -->
    <div class="row g-4">
      <ScheduleCard
        title="Plant Monitoring Schedule"
        id-prefix="monitoring"
        type="monitoring"
        :is-editing="isEditing"
        :showTest="true"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ScheduleCard from '@/components/ScheduleCard.vue'

// Monitoring schedule state
const isEditing = ref(false)

const monitoringSchedule = ref({
  enabled: true,
  mode: 'auto',
  frequency: 'daily',
  time: {
    hours: 8,
    minutes: 0,
    period: 'AM'
  }
})



// Format next check time
const formatNextCheck = computed(() => {
  if (!monitoringSchedule.value.enabled) return 'Schedule inactive'
  
  const next = getNextCheckTime()
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(next)
})

// Calculate next check time
function getNextCheckTime() {
  const now = new Date()
  const schedule = monitoringSchedule.value
  
  // Convert to 24-hour format
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
        next.setDate(next.getDate() + ((7 - next.getDay() + 1) % 7 || 7))
        break
      case 'monthly':
        next.setMonth(next.getMonth() + 1)
        next.setDate(1)
        break
    }
  }
  
  return next
}
</script>

<style scoped>
.section-title {
  font-size: 1.25rem;
  color: var(--text-color);
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border-color);
}

.section-title i {
  color: var(--accent-color);
}

.monitoring-schedule-card {
  background: var(--card-bg);
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.schedule-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.schedule-label {
  font-size: 0.9rem;
  color: var(--text-color-secondary);
  font-weight: 500;
}

.time-picker {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--glass-effect);
  padding: 0.75rem;
  border-radius: 6px;
}

.time-select, .period-select {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.375rem;
  color: var(--text-color);
}

.time-select {
  width: 60px;
  text-align: center;
}

.period-select {
  width: 70px;
}

.schedule-status {
  background: var(--glass-effect);
  padding: 1rem;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: var(--text-color-secondary);
}

.status-badge.active {
  color: var(--success-color);
}

.next-check {
  font-size: 0.9rem;
  color: var(--text-color-secondary);
}

@media (max-width: 768px) {
  .schedule-group {
    margin-bottom: 1rem;
  }
  
  .time-picker {
    flex-wrap: wrap;
  }
}

.schedule-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.time-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--glass-effect);
  padding: 0.75rem;
  border-radius: 8px;
}

.time-input, .period-input {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.375rem;
  color: var(--text-color);
  text-align: center;
}

.time-input {
  width: 60px;
}

.period-input {
  width: 70px;
}

.time-separator {
  color: var(--text-color);
  font-weight: bold;
}

.next-check-display {
  padding: 0.75rem;
  background: var(--glass-effect);
  border-radius: 8px;
  font-size: 0.9rem;
  color: var(--text-color-secondary);
  display: flex;
  align-items: center;
}

@media (max-width: 768px) {
  .time-input-group {
    flex-wrap: wrap;
  }
}

.control-actions {
  display: flex;
  align-items: center;
}

.mode-switch {
  display: flex;
  gap: 0.25rem;
}

.mode-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var (--text-color);
  border-radius: 4px;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.mode-btn.active {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.btn-edit, .btn-save {
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
}

.btn-edit {
  background: var(--glass-effect);
  color: var(--text-color);
}

.btn-save {
  background: var(--success-color);
  color: white;
}

/* Custom switch styling */
.custom-switch .form-check-input {
  width: 3rem;
  height: 1.5rem;
  background-color: var(--card-bg);
  border-color: var(--border-color);
  cursor: pointer;
}

.custom-switch .form-check-input:checked {
  background-color: var(--accent-color);
  border-color: var(--accent-color);
}

.custom-switch .form-check-input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 0.2rem rgba(var(--accent-color-rgb), 0.25);
}

/* Dark mode adjustments */
:root[data-theme="dark"] .custom-switch .form-check-input {
  background-color: var(--card-header);
  border-color: var(--border-color);
}

:root[data-theme="dark"] .custom-switch .form-check-input:checked {
  background-color: var(--accent-color);
  border-color: var(--accent-color);
}

/* Disabled state */
.form-check-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>