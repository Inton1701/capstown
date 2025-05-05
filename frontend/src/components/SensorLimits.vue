<template>
  <div class="col-md-6">
    <div class="card h-100">
      <div class="card-header d-flex align-items-center">
        <i class="fas fa-sliders-h me-2"></i>
        <h5 class="mb-0">Sensor Limits</h5>
      </div>
      <div class="card-body">
        <div class="limits-grid">
          <div v-for="sensor in sensors" 
               :key="sensor.name" 
               class="limit-card"
               :class="{ 'warning': isOutOfRange(sensor) }">
            <div class="limit-header">
              <div class="sensor-info">
                <i :class="[sensor.icon, 'sensor-icon']"></i>
                <span class="sensor-name">{{ sensor.name }}</span>
              </div>
              <div class="notify-switch">
                <button class="btn-notify" @click="sensor.notify = !sensor.notify">
                  <i :class="[
                    'fas',
                    sensor.notify ? 'fa-bell' : 'fa-bell-slash',
                    sensor.notify ? 'active' : ''
                  ]"></i>
                </button>
              </div>
            </div>

            <div class="limit-controls">
              <div class="limit-input">
                <label>Min</label>
                <div class="control-group">
                  <input type="number" 
                         v-model="sensor.min" 
                         :step="sensor.step"
                         :readonly="!sensor.isEditing"
                         class="limit-value">
                </div>
              </div>

              <div class="limit-input">
                <label>Max</label>
                <div class="control-group">
                  <input type="number" 
                         v-model="sensor.max" 
                         :step="sensor.step"
                         :readonly="!sensor.isEditing"
                         class="limit-value">
                </div>
              </div>
            </div>

            <div class="edit-controls">
              <button @click="toggleEdit(sensor)" 
                      class="btn-edit"
                      :class="{ 'btn-save': sensor.isEditing }">
                <i :class="sensor.isEditing ? 'fas fa-save' : 'fas fa-edit'"></i>
                {{ sensor.isEditing ? 'Save' : 'Edit' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const sensors = ref([
  {
    name: 'pH Levels',
    icon: 'fas fa-flask',
    min: 5.5,
    max: 6.5,
    step: 0.1,
    notify: true,
    isEditing: false
  },
  {
    name: 'Electronic Conductivity',
    icon: 'fas fa-bolt',
    min: 1.2,
    max: 2.0,
    step: 0.1,
    notify: true,
    isEditing: false
  },
  {
    name: 'Water Level',
    icon: 'fas fa-water',
    min: 30,
    max: 100,
    step: 1,
    notify: true,
    isEditing: false
  },
  {
    name: 'Air Temperature',
    icon: 'fas fa-temperature-high',
    min: 20,
    max: 30,
    step: 1,
    notify: true,
    isEditing: false
  },
  {
    name: 'Humidity',
    icon: 'fas fa-tint',
    min: 50,
    max: 70,
    step: 1,
    notify: true,
    isEditing: false
  }
])

const toggleEdit = (sensor) => {
  sensor.isEditing = !sensor.isEditing
}

const adjustValue = (sensor, type, step) => {
  sensor[type] = Number((sensor[type] + step).toFixed(1))
}

const isOutOfRange = (sensor) => {
  return sensor.min >= sensor.max
}
</script>

<style scoped>
.limits-grid {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.limit-card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 4px 6px -1px var(--glass-effect);
  transition: all 0.3s ease;
}

.limit-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 12px -2px var(--glass-effect);
}

.limit-card.warning {
  border: 2px solid var(--warning-color);
  animation: pulse 2s infinite;
}

.limit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.sensor-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sensor-icon {
  font-size: 1.5rem;
  width: 32px;
  text-align: center;
}

.sensor-name {
  font-weight: 600;
  color: var(--text-color);
}

.limit-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.limit-input {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.limit-input label {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.control-group {
  display: flex;
  width: 100%;
}

.control-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: var(--card-header);
  color: white;
  font-size: 1.25rem;
  cursor: pointer;
  transition: opacity 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-btn:hover {
  opacity: 0.9;
}

.limit-value {
  width: 100%;
  height: 36px;
  text-align: center;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text-color);
  font-weight: 600;
  transition: all 0.3s ease;
}

.limit-value:read-only {
  background: var(--glass-effect);
  cursor: not-allowed;
}

.limit-value:not(:read-only) {
  background: var(--card-bg);
  cursor: text;
  border-color: var(--accent-color);
}

/* Custom Switch Styles */
.switch {
  position: relative;
  display: inline-block;
  width: 46px;
  height: 24px;
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
  background-color: var(--text-color-secondary);
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
}

.switch input:checked + .slider {
  background-color: var(--success-color);
}

.switch input:checked + .slider:before {
  transform: translateX(26px);
}

.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(255, 209, 102, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(255, 209, 102, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 209, 102, 0); }
}

.edit-controls {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.btn-edit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  background: var(--card-header);
  color: white;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-edit:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-edit.btn-save {
  background: var(--success-color);
}

.notify-switch {
  display: flex;
  align-items: center;
}

.btn-notify {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  font-size: 1.2rem;
  color: var(--text-color-secondary);
  transition: all 0.3s ease;
  border-radius: 50%;
}

.btn-notify:hover {
  background: var(--glass-effect);
  transform: scale(1.1);
}

.btn-notify i.active {
  color: var(--success-color);
}

@media (max-width: 768px) {
  .limits-grid {
    grid-template-columns: 1fr;
  }
  
  .limit-controls {
    gap: 1rem;
  }
  
  .btn-edit {
    width: 100%;
    justify-content: center;
  }
}
</style>