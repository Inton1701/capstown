<template>
  <div class="col-12 col-md-6 mb-4">
    <div class="card h-100 sensor-card">
      <div class="card-header d-flex align-items-center justify-content-between">
        <h5 class="mb-0">
          <i class="fas fa-microchip icon-animate me-2"></i> 
          Sensor Readings
        </h5>
        <div class="header-actions">
          <span v-if="isLoading" class="loading-indicator">
            <i class="fas fa-spinner fa-spin"></i>
          </span>
          <button 
            class="btn btn-sm btn-outline-primary ms-2"
            @click="updateSensorValues"
            :disabled="isLoading"
          >
            <i class="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>
      
      <div class="card-body">
        <div v-if="error" class="alert alert-danger">
          <i class="fas fa-exclamation-triangle me-2"></i>
          {{ error }}
        </div>
        
        <div v-else-if="!sensors.some(s => s.value !== '0')" class="alert alert-info">
          <i class="fas fa-info-circle me-2"></i>
          Waiting for sensor data...
        </div>
        
        <div v-else class="sensor-grid">
          <div 
            v-for="sensor in sensors" 
            :key="sensor.name"
            class="sensor-item"
          >
            <div class="sensor-header">
              <i :class="[sensor.icon, `status-${sensor.status}`]"></i>
              <span class="sensor-name">{{ sensor.name }}</span>
            </div>
            <div class="sensor-data">
              <div class="sensor-value-container">
                <span 
                  class="sensor-value" 
                  :data-length="sensor.value.toString().length"
                >
                  {{ sensor.value }}
                </span>
                <span class="sensor-unit">{{ sensor.unit }}</span>
              </div>
              <i :class="[statusIcons[sensor.status], `status-${sensor.status}`]"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import axios from 'axios';

const API_URL = process.env.VUE_APP_API_URL;
const DEBUG = true;

const sensors = ref([
    { name: 'EC', icon: 'fas fa-bolt', value: '0', unit: 'mS/cm', status: 'optimal' },
    { name: 'pH', icon: 'fas fa-flask', value: '0', unit: 'pH', status: 'optimal' },
    { name: 'Water Temp', icon: 'fas fa-thermometer-half', value: '0', unit: '°C', status: 'optimal' },
    { name: 'Air Temp', icon: 'fas fa-temperature-high', value: '0', unit: '°C', status: 'optimal' },
    { name: 'Humidity', icon: 'fas fa-tint', value: '0', unit: '%', status: 'optimal' },
    { name: 'Water Level', icon: 'fas fa-water', value: '0', unit: 'cm', status: 'optimal' }
]);

const statusIcons = {
    optimal: 'fas fa-check-circle',
    warning: 'fas fa-exclamation-circle',
    critical: 'fas fa-times-circle'
};

const isLoading = ref(false);
const error = ref(null);
const updateInterval = ref(null);

const getSensorStatus = (name, value) => {
    const thresholds = {
        EC: { min: 1.0, max: 2.5 },
        pH: { min: 5.5, max: 7.5 },
        'Water Temp': { min: 20, max: 26 },
        'Air Temp': { min: 20, max: 30 },
        Humidity: { min: 50, max: 80 },
        'Water Level': { min: 5, max: 50 }
    };
    const range = thresholds[name];
    if (!range) return 'optimal';

    const numValue = parseFloat(value);
    if (numValue < range.min || numValue > range.max) return 'critical';
    if (numValue < range.min + 0.5 || numValue > range.max - 0.5) return 'warning';
    return 'optimal';
};

const updateSensorValues = async () => {
    if (isLoading.value) return;
    
    isLoading.value = true;
    error.value = null;
    
    try {
        const response = await axios.get(`${API_URL}/readings/latest`);
       

        if (response.data?.data?.readings) {
            const readings = response.data.data.readings;
            sensors.value = sensors.value.map(sensor => {
                let newValue = '0';
                let reading = null;
                switch(sensor.name) {
                    case 'EC': 
                        reading = readings.ec; 
                        if (reading && reading.value !== undefined) {
                            let rawValue = parseFloat(reading.value);
                            
                            // Convert μS/cm to mS/cm if value is large 
                            if (rawValue > 100) {
                                if (DEBUG)
                                rawValue = rawValue / 1000;
                            }
                            
                            newValue = rawValue.toFixed(2);
                        }
                        break;
                    case 'pH': reading = readings.ph; break;
                    case 'Water Temp': reading = readings.waterTemp; break;
                    case 'Air Temp': reading = readings.airTemp; break;
                    case 'Humidity': reading = readings.humidity; break;
                    case 'Water Level': reading = readings.waterLevel; break;
                }
                
                // Process non-EC sensors normally
                if (sensor.name !== 'EC' && reading && reading.value !== undefined) {
                    newValue = parseFloat(reading.value).toFixed(2);
                }
                
                return {
                    ...sensor,
                    value: newValue,
                    status: getSensorStatus(sensor.name, newValue)
                };
            });
        } else {
            error.value = 'No sensor data available';
            if (DEBUG) console.warn('No sensor readings found:', response.data);
        }
    } catch (err) {
        error.value = 'Failed to fetch sensor data';
        console.error('Fetch Error:', err);
    } finally {
        isLoading.value = false;
    }
};

onMounted(() => {
    // Initial fetch
    updateSensorValues();
    
    // Set up regular polling for sensor data
    updateInterval.value = setInterval(updateSensorValues, 5000);
});

onUnmounted(() => {
    if (updateInterval.value) {
        clearInterval(updateInterval.value);
        updateInterval.value = null;
    }
});
</script>

<style scoped>
.sensor-card {
  transition: all 0.3s ease;
}

.card-header {
  padding: 1rem 1.5rem;
}

.card-header h5 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
}

.loading-indicator {
  color: var(--accent-color);
}

.sensor-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr); /* Always show 2 columns */
  gap: 1.5rem;
  padding: 0.5rem;
  max-width: 1200px; /* Prevent too wide layout */
  margin: 0 auto; /* Center the grid */
}

.sensor-item {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  min-width: 0;
  overflow: hidden;
  width: 100%;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sensor-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.sensor-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.sensor-header i {
  font-size: 1.25rem;
}

.sensor-name {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 2rem); /* Account for icon */
}

sensor-data {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  flex-grow: 1;
}

.sensor-value-container {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  flex: 1;
  min-height: 3.5rem; /* Ensure consistent height for all containers */
}

.sensor-value {
  font-size: 2.5rem; /* Fixed base size */
  font-weight: 700;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.1;
  letter-spacing: -0.02em;
  transition: font-size 0.3s ease;
}

.sensor-unit {
  font-size: 1rem;
  color: var(--text-color-secondary);
  white-space: nowrap;
  margin-left: 0.25rem;
  font-weight: 500;
  align-self: flex-start;
  margin-top: 0.75rem; /* Align with the top of the value */
}

/* Status colors */
.status-optimal {
  color: var(--success-color);
}

.status-warning {
  color: var(--warning-color);
}

.status-critical {
  color: var(--danger-color);
}

/* Animations */
.icon-animate {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .sensor-grid {
    gap: 1rem;
  }
  
  .sensor-item {
    padding: 1.25rem;
  }
  
  .sensor-value {
    font-size: 2.25rem;
  }
  
  .sensor-value[data-length="3"] {
    font-size: 2rem;
  }
  
  .sensor-value[data-length="4"] {
    font-size: 1.75rem;
  }
  
  .sensor-value[data-length="5"] {
    font-size: 1.5rem;
  }
}

@media (max-width: 768px) {
  .card-header h5 {
    font-size: 1.125rem;
  }
  
  .sensor-grid {
    gap: 0.75rem;
  }
  
  .sensor-header i {
    font-size: 1rem;
  }
  
  .sensor-name {
    font-size: 0.875rem;
  }
  
  .sensor-value-container {
    min-height: 3rem;
  }
  
  .sensor-value {
    font-size: 2rem;
  }
  
  .sensor-value[data-length="3"] {
    font-size: 1.75rem;
  }
  
  .sensor-value[data-length="4"] {
    font-size: 1.5rem;
  }
  
  .sensor-value[data-length="5"] {
    font-size: 1.25rem;
  }
  
  .sensor-unit {
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }
}

@media (max-width: 576px) {
  .sensor-grid {
    gap: 0.5rem;
  }
  
  .sensor-item {
    padding: 0.875rem;
  }
  
  .sensor-name {
    font-size: 0.75rem;
  }
  
  .sensor-value-container {
    min-height: 2.5rem;
  }
  
  .sensor-value {
    font-size: 1.75rem;
  }
  
  .sensor-value[data-length="3"] {
    font-size: 1.5rem;
  }
  
  .sensor-value[data-length="4"] {
    font-size: 1.25rem;
  }
  
  .sensor-value[data-length="5"] {
    font-size: 1.125rem;
  }
  
  .sensor-unit {
    font-size: 0.75rem;
    margin-top: 0.375rem;
  }
}

/* Dark mode adjustments */
:deep(.dark-mode) .sensor-item {
  background: var(--card-bg-dark);
}

/* Add this for better text scaling */
@supports (font-size: clamp(1rem, 2vw, 3rem)) {
  .sensor-value {
    transition: font-size 0.3s ease;
  }
  
  .sensor-value[data-length="3"] {
    font-size: clamp(2.25rem, 4.5vw, 2.75rem);
  }
  
  .sensor-value[data-length="4"] {
    font-size: clamp(2rem, 4vw, 2.5rem);
  }
  
  .sensor-value[data-length="5"] {
    font-size: clamp(1.75rem, 3.5vw, 2.25rem);
  }
}
</style>
