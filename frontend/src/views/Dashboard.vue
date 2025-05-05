<template>
  <div class="container-fluid py-4">
    <h1 class="text-center mb-4">Dashboard</h1>
    <div class="row">
      <SensorReadings />
      <ActuatorControls />
    </div>
    <div class="row g-4 mb-4">
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-header">
            <h5 class="chart-title">
              <i class="fas fa-flask icon-animate me-2"></i>
              pH & EC Reading Patterns
            </h5>
            <div class="chart-actions">
              <button 
                class="btn btn-sm btn-outline-secondary" 
                @click="fetchChartData"
                title="Refresh"
              >
                <i class="fas fa-sync-alt"></i>
              </button>
              <button 
                class="btn btn-sm btn-outline-secondary" 
                @click="downloadPhEcData"
                title="Download"
              >
                <i class="fas fa-download"></i>
              </button>
            </div>
          </div>
          <div class="chart-body">
            <canvas id="phEcChart"></canvas>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-header">
            <h5 class="chart-title">
              <i class="fas fa-thermometer-half icon-animate me-2"></i>
              Environmental Data
            </h5>
            <div class="chart-actions">
              <button 
                class="btn btn-sm btn-outline-secondary" 
                @click="fetchChartData"
                title="Refresh"
              >
                <i class="fas fa-sync-alt"></i>
              </button>
              <button 
                class="btn btn-sm btn-outline-secondary" 
                @click="downloadEnvData"
                title="Download"
              >
              </button>
            </div>
          </div>
          <div class="chart-body">
            <canvas id="envChart"></canvas>
          </div>
        </div>
      </div>
    </div>
    <div class="row">
      <GrowthCalendar />
      <PlantStatus />
    </div>
    
    <div 
      class="modal fade" 
      id="actuatorModal" 
      tabindex="-1" 
      aria-labelledby="actuatorModalLabel" 
      aria-hidden="true"
    >
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="actuatorModalLabel">
              <i :class="selectedActuator?.icon"></i>
              {{ selectedActuator?.name }} Control
            </h5>
            <button 
  type="button" 
  class="btn-close" 
  data-bs-dismiss="modal"
  aria-label="Close"
  @click="selectedActuator = null"
></button>
          </div>
          <div class="modal-body p-0">
            <ActuatorControlModal
              v-if="selectedActuator"
              :actuator="selectedActuator"
              @close="closeModal"
              @save="saveActuatorSettings"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="phPumpModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">pH Pump Control</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <PhPumpControlModal
              v-if="selectedActuator"
              :actuator="selectedActuator"
              @close="closeModal('phPumpModal')"
              @save="saveActuatorSettings"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="fertilizerPumpModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Fertilizer Pump Control</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <FertilizerPumpControlModal
              v-if="selectedActuator"
              :key="`fertilizer-${selectedActuator?.id}`"
              :actuator="selectedActuator"
              @save="saveActuatorSettings"
              @close="closeModal"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="sensorPumpModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="fas fa-microscope me-2"></i>
              Sensor Pump Control
            </h5>
            <button 
              type="button" 
              class="btn-close"
              @click="closeModal('sensorPump')"
              aria-label="Close"
            ></button>
          </div>
          <div class="modal-body">
            <div class="pump-control text-center">
              <div class="status-display mb-3">
                <span class="status-label">Status:</span>
                <span class="status-value" :class="{ 'active': selectedActuator?.status === 'active' }">
                  {{ selectedActuator?.status === 'active' ? 'Running' : 'Stopped' }}
                </span>
              </div>

              <button 
                class="btn-power"
                :class="{ 'active': selectedActuator?.status === 'active' }"
                @click="toggleSensorPump"
              >
                <i class="fas fa-power-off me-2"></i>
                {{ selectedActuator?.status === 'active' ? 'Turn Off' : 'Turn On' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Replace all existing modals with these updated versions -->
    <div class="modal fade" id="actuatorModal" data-bs-backdrop="static" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i :class="selectedActuator?.icon"></i>
              {{ selectedActuator?.name }} Control
            </h5>
            <button type="button" class="btn-close" @click="() => closeModal('actuator')" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <ActuatorControlModal
              v-if="selectedActuator"
              :actuator="selectedActuator"
              @save="saveActuatorSettings"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="phPumpModal" data-bs-backdrop="static" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">pH Pump Control</h5>
            <button type="button" class="btn-close" @click="() => closeModal('phPump')"></button>
          </div>
          <div class="modal-body">
            <PhPumpControlModal
              v-if="selectedActuator"
              :actuator="selectedActuator"
              @save="saveActuatorSettings"
              @close="() => closeModal('phPump')"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="fertilizerPumpModal" data-bs-backdrop="static" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Fertilizer Pump Control</h5>
            <button type="button" class="btn-close" @click="() => closeModal('fertilizerPump')"></button>
          </div>
          <div class="modal-body">
            <FertilizerPumpControlModal
              v-if="selectedActuator"
              :key="`fertilizer-${selectedActuator?.id}`"
              :actuator="selectedActuator"
              @save="saveActuatorSettings"
              @close="() => closeModal('fertilizerPump')"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="sensorPumpModal" data-bs-backdrop="static" tabindex="-1">
      <!-- ... -->
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, provide, onUnmounted, nextTick } from 'vue'
import { Modal } from 'bootstrap'
import axios from 'axios'
import { Chart } from 'chart.js/auto'

// Component imports
import SensorReadings from '@/components/SensorReadings.vue'
import ActuatorControls from '@/components/ActuatorControls.vue'
import GrowthCalendar from '@/components/GrowthCalendar.vue'
import PlantStatus from '@/components/PlantStatus.vue'
import ActuatorControlModal from '@/components/modals/ActuatorControlModal.vue'
import PhPumpControlModal from '@/components/modals/PhPumpControlModal.vue'
import FertilizerPumpControlModal from '@/components/modals/FertilizerPumpControlModal.vue'
import SensorPumpControlModal from '@/components/modals/SensorPumpControlModal.vue'

// Constants
const API_URL = process.env.VUE_APP_API_URL;

// State management
const state = {
  charts: {
    phEc: ref(null),
    env: ref(null),
    data: {
      phEc: ref({
        labels: [],
        datasets: [
          {
            label: 'pH Level',
            data: [],
            borderColor: '#40916c',
            backgroundColor: 'rgba(64, 145, 108, 0.1)'
          },
          {
            label: 'EC (mS/cm)',
            data: [],
            borderColor: '#0096c7',
            backgroundColor: 'rgba(0, 150, 199, 0.1)'
          }
        ]
      }),
      env: ref({
        labels: [],
        datasets: [
          {
            label: 'Air Temp (°C)',
            data: [],
            borderColor: '#ef476f',
            backgroundColor: 'rgba(239, 71, 111, 0.1)'
          },
          {
            label: 'Water Temp (°C)',
            data: [],
            borderColor: '#118ab2',
            backgroundColor: 'rgba(17, 138, 178, 0.1)'
          },
          {
            label: 'Humidity (%)',
            data: [],
            borderColor: '#06d6a0',
            backgroundColor: 'rgba(6, 214, 160, 0.1)'
          }
        ]
      })
    }
  },
  sensorPump: {
    lastReading: null
  }
}

const actuatorModalRef = ref(null)
const selectedActuator = ref(null)

// Chart configurations
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
    },
    subtitle: {
      display: false // Disable subtitle to prevent fullSize error
    }
  },
  scales: {
    x: {
      grid: {
        display: true
      }
    },
    y: {
      beginAtZero: true
    }
  }
}

// Helper Functions
const formatDate = (date) => date.toISOString().split('.')[0] + 'Z'

const updateCharts = (readings) => {
  const labels = readings.map(reading => new Date(reading.timestamp).toLocaleTimeString())

  updateChartData('phEc', labels, readings)
  updateChartData('env', labels, readings)
  
  updateChartInstances()
}

const updateChartData = (chartType, labels, readings) => {
  state.charts.data[chartType].value = {
    labels,
    datasets: state.charts.data[chartType].value.datasets.map((dataset, index) => ({
      ...dataset,
      data: readings.map(r => {
        switch(chartType) {
          case 'phEc': return index === 0 ? r.ph : r.ec
          case 'env': return index === 0 ? r.airTemp : index === 1 ? r.waterTemp : r.humidity
          default: return 0
        }
      })
    }))
  }
}

const updateChartInstances = () => {
  ['phEc', 'env'].forEach(type => {
    if (state.charts[type].value) {
      state.charts[type].value.data = state.charts.data[type].value
      state.charts[type].value.update('none')
    }
  })
}

// Add this to your helper functions section
const formatDateTime = (date) => {
  if (!date) return 'Never';
  return new Date(date).toLocaleString();
};

// API Functions
const fetchChartData = async () => {
  try {
    console.log('Fetching chart data from:', `${API_URL}/readings/history`);
    const endTime = new Date();
    const startTime = new Date(endTime - 24 * 60 * 60 * 1000);
    
    const { data } = await axios.get(`${API_URL}/readings/history`, {
      params: {
        from: formatDate(startTime),
        to: formatDate(endTime)
      },
      timeout: 5000 // Add a timeout to prevent long-hanging requests
    });

    if (data?.success) {
      updateCharts(data.data || []);
    }
  } catch (error) {
    console.error('Error fetching chart data:', error);
    // Check if this is a network error
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.warn('Network error detected. Check your API server and connection.');
      // You could display a user-friendly notification here
    }
  }
};

const actuators = ref([])

const fetchActuatorStatus = async () => {
  try {
    console.log('Fetching actuator status from API');
    const { data } = await axios.get(`${API_URL}/actuators/status`);
    if (data.success) {
      // Log fertilizer pumps for debugging
      const fertilizerPumps = data.data.filter(a => a.type === 'fertilizer-pump');
      console.log('Fetched fertilizer pumps:', fertilizerPumps.map(p => ({
        id: p.id, 
        name: p.name,
        nutrientType: p.nutrientType,
        flowRate: p.flowRate
      })));
      
      // Update the local state with the new data
      actuators.value = data.data.map(actuator => ({
        ...actuator,
        icon: getActuatorIcon(actuator.type, actuator.direction),
        schedule: actuator.schedule || {
          enabled: false,
          activeDays: [],
          interval: { hours: 0, minutes: 0, seconds: 0 },
          duration: { hours: 0, minutes: 0, seconds: 0 }
        }
      }));
      console.log('Actuator status updated in local state');
    }
  } catch (error) {
    console.error('Error fetching actuator status:', error);
  }
};

// Modal Functions
const modalRefs = ref({
  actuator: null,
  phPump: null,
  fertilizerPump: null,
  sensorPump: null
})

const openModal = async (type, actuator) => {
  if (!actuator) return;
  
  // Close any existing modal first
  closeModal(type);
  
  selectedActuator.value = { ...actuator };
  
  await nextTick();
  const modalId = `${type}Modal`;
  const modalElement = document.getElementById(modalId);
  
  if (modalElement) {
    // Create new modal instance
    const modal = new Modal(modalElement, {
      backdrop: 'static',
      keyboard: false
    });
    modal.show();
    
    // Cleanup handler
    modalElement.addEventListener('hidden.bs.modal', () => {
      modal.dispose();
      selectedActuator.value = null;
    }, { once: true });
  }
};

const closeModal = (type) => {
  const modalId = `${type}Modal`;
  const modalElement = document.getElementById(modalId);
  
  if (modalElement) {
    const modal = Modal.getInstance(modalElement);
    if (modal) {
      modal.hide();
      // Cleanup DOM after hide
      modalElement.addEventListener('hidden.bs.modal', () => {
        modal.dispose();
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.classList.remove('modal-open');
      }, { once: true });
    }
    selectedActuator.value = null;
  }
}

const saveActuatorSettings = async (settings) => {
  try {
    console.log('\n==== DASHBOARD SAVE ACTUATOR SETTINGS ====');
    console.log('Settings to save:', settings);
    
    // Ensure type field is present
    if (!settings.type) {
      settings.type = selectedActuator.value?.type;
      console.log('Added missing type:', settings.type);
    }
    
    // Special handling for fertilizer pumps to ensure nutrientType is included
    if (settings.type === 'fertilizer-pump') {
      console.log('Processing fertilizer pump settings');
      if (!settings.nutrientType && settings.nutrientType !== '') {
        // Use the value from selectedActuator if available
        settings.nutrientType = selectedActuator.value?.nutrientType || '';
        console.log('Added missing nutrientType:', settings.nutrientType);
      }
    }
    
    console.log('Final request payload:', settings);
    
    const response = await axios.put(
      `${API_URL}/actuators/${settings.id}/settings`,
      settings
    );

    if (response.data.success) {
      console.log('✅ Settings saved successfully:', response.data.data);
      
      // Update local state
      const index = actuators.value.findIndex(a => a.id === settings.id);
      if (index !== -1) {
        console.log('Updating local actuator state at index:', index);
        
        // Create a new object with all existing properties and the updates
        actuators.value[index] = {
          ...actuators.value[index],
          ...response.data.data,
          icon: getActuatorIcon(response.data.data.type, response.data.data.direction)
        };
        
        console.log('Updated actuator in local state:', actuators.value[index]);
      } else {
        console.warn('⚠️ Actuator not found in local state array after save');
      }
      
      // Refresh actuator status to ensure UI is updated
      console.log('Refreshing actuator status from server');
      await fetchActuatorStatus();
      
      // Close modal if not in test mode
      if (!settings.testMode) {
        // Determine modal type
        const modalType = settings.type === 'pump' ? 'actuator' : 
                          settings.type.includes('-pump') ? settings.type.replace('-pump', 'Pump') : 'actuator';
        
        console.log('Closing modal:', modalType.toLowerCase());
        closeModal(modalType.toLowerCase());
      }
      console.log('==========================================\n');
    } else {
      console.error('❌ API returned success: false', response.data);
      alert('Failed to save settings. Server returned an error.');
    }
  } catch (error) {
    console.error('❌ Error saving actuator settings:', error);
    alert('Failed to save settings. Please try again.');
  }
};

// Replace all existing provide functions with these
provide('openActuatorModal', (actuator) => openModal('actuator', actuator));
provide('openPhPumpModal', (actuator) => openModal('phPump', actuator));
provide('openFertilizerPumpModal', (actuator) => openModal('fertilizerPump', actuator));
provide('openSensorPumpModal', (actuator) => openModal('sensorPump', actuator));

// Lifecycle Hooks
const intervals = ref({})

onMounted(async () => {
  try {
    console.log('Dashboard mounted, API URL:', API_URL);
    
    try {
      await fetchActuatorStatus();
      console.log('Successfully fetched actuator status');
    } catch (statusError) {
      console.error('Failed to fetch actuator status:', statusError);
    }
    
    try {
      await fetchChartData();
      console.log('Successfully fetched chart data');
    } catch (chartError) {
      console.error('Failed to fetch chart data:', chartError);
    }

    // Store intervals for cleanup with error handling
    intervals.value = {
      status: setInterval(() => {
        fetchActuatorStatus().catch(e => console.error('Error in status interval:', e));
      }, 5000),
      chart: setInterval(() => {
        fetchChartData().catch(e => console.error('Error in chart interval:', e));
      }, 10000) // Changed to 10 seconds to reduce server load
    };

    // Initialize charts
    const chartElements = {
      phEc: document.getElementById('phEcChart'),
      env: document.getElementById('envChart')
    };

    if (chartElements.phEc && chartElements.env) {
      console.log('Initializing charts...');
      const chartInstances = initializeCharts(chartElements);
      console.log('Charts initialized:', chartInstances ? 'Success' : 'Failed');
    } else {
      console.warn('Chart elements not found in DOM');
    }
  } catch (error) {
    console.error('Error during dashboard initialization:', error);
  }
})

// Add to your provide setup in Dashboard.vue or App.vue
provide('openPhPumpModal', (actuator) => {
  selectedActuator.value = actuator;
  const modal = new Modal(document.getElementById('phPumpModal'));
  modal.show();
});

provide('openFertilizerPumpModal', (actuator) => {
  selectedActuator.value = actuator;
  const modal = new Modal(document.getElementById('fertilizerPumpModal'));
  modal.show();
});

provide('openSensorPumpModal', async (actuator) => {
  selectedActuator.value = { ...actuator }
  await nextTick()
  const modalElement = document.getElementById('sensorPumpModal')
  if (modalElement) {
    modalRefs.value.sensorPump = new Modal(modalElement)
    modalRefs.value.sensorPump.show()
  }
})

// Update the modal provide functions
provide('openPhPumpModal', async (actuator) => {
  selectedActuator.value = { ...actuator };
  await nextTick();
  const modalElement = document.getElementById('phPumpModal');
  if (modalElement) {
    modalRefs.value.phPump = new Modal(modalElement);
    modalRefs.value.phPump.show();
  }
});

provide('openFertilizerPumpModal', async (actuator) => {
  if (!actuator) return;
  
  console.log('Opening fertilizer pump modal with actuator:', actuator);
  
  // Create a deep copy with all fields to avoid reference issues
  selectedActuator.value = { 
    ...actuator,
    flowRate: Number(actuator.flowRate || 0),
    nutrientType: actuator.nutrientType || '',  // Ensure default value
    status: actuator.status || 'idle'
  };
  
  console.log('Selected actuator set to:', selectedActuator.value);
  
  await nextTick();
  const modalElement = document.getElementById('fertilizerPumpModal');
  if (modalElement) {
    const modal = new Modal(modalElement);
    modalRefs.value.fertilizerPump = modal;
    modal.show();
  }
});

provide('openActuatorModal', async (actuator) => {
  selectedActuator.value = { ...actuator };
  await nextTick();
  const modalElement = document.getElementById('actuatorModal');
  if (modalElement) {
    modalRefs.value.actuator = new Modal(modalElement);
    modalRefs.value.actuator.show();
  }
});

// Add this function to your script setup
const toggleSensorPump = async () => {
  const newStatus = selectedActuator.value.status === 'active' ? 'idle' : 'active'
  try {
    const response = await axios.put(`${API_URL}/actuators/${selectedActuator.value.id}/status`, {
      status: newStatus
    })
    
    if (response.data.success) {
      const index = actuators.value.findIndex(a => a.id === selectedActuator.value.id)
      if (index !== -1) {
        actuators.value[index].status = newStatus
        selectedActuator.value.status = newStatus
      }
    }
  } catch (error) {
    console.error('Failed to toggle sensor pump:', error)
  }
};

// Update the onUnmounted cleanup
onUnmounted(() => {
  // Clear intervals safely
  if (intervals.value) {
    Object.values(intervals.value).forEach(interval => {
      if (interval) clearInterval(interval);
    });
  }
  
  // Clear charts
  Object.values(state.charts).forEach(chart => {
    if (chart.value) {
      chart.value.destroy();
    }
  });

  // Clean up modal instances safely
  ['actuatorModal', 'phPumpModal', 'fertilizerPumpModal', 'sensorPumpModal'].forEach(modalId => {
    try {
      const modalElement = document.getElementById(modalId);
      if (modalElement) {
        const modal = Modal.getInstance(modalElement);
        // Only call dispose if modal exists and has the dispose method
        if (modal && typeof modal.dispose === 'function') {
          try {
            modal.hide();
            modal.dispose();
          } catch (error) {
            console.warn(`Modal ${modalId} already disposed:`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`Error cleaning up modal ${modalId}:`, error);
    }
  });

  // Clean up any remaining backdrops
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
  
  // Reset state
  selectedActuator.value = null;
});

// Add to Dashboard.vue script setup section
onUnmounted(() => {
  // Clean up any remaining modals
  Object.keys(modalRefs.value).forEach(type => {
    // Only call dispose if modal exists and has the dispose method
    if (modalRefs.value[type] && typeof modalRefs.value[type].dispose === 'function') {
      try {
        modalRefs.value[type].dispose();
      } catch (error) {
        console.warn(`Error disposing modal of type ${type}:`, error);
      }
    }
  });
  
  // Remove any remaining backdrops
  document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
  
  // Reset body classes
  document.body.classList.remove('modal-open');
});

// Update chart initialization
const initializeCharts = (chartElements) => {
  try {
    // Define charts object first before using it
    const charts = {};
    
    // Initialize pH and EC chart
    if (chartElements.phEc) {
      charts.phEc = new Chart(chartElements.phEc, {
        type: 'line',
        data: state.charts.data.phEc.value,
        options: chartOptions
      });
      
      // Store chart instance in state
      state.charts.phEc.value = charts.phEc;
    }
    
    // Initialize environmental chart
    if (chartElements.env) {
      charts.env = new Chart(chartElements.env, {
        type: 'line',
        data: state.charts.data.env.value,
        options: chartOptions
      });
      
      // Store chart instance in state
      state.charts.env.value = charts.env;
    }
    
    // Return the charts object
    return charts;
  } catch (error) {
    console.error('Error initializing charts:', error);
  }
}

// Add helper function for icon mapping
const getActuatorIcon = (type, direction) => {
  const iconMap = {
    'chiller': 'fas fa-snowflake',
    'fan': 'fas fa-fan',
    'pump': 'fas fa-tint',
    'sensor-pump': 'fas fa-microscope',
    'fertilizer-pump': 'fas fa-flask',
    'ph-pump': direction === 'up' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'
  }
  return iconMap[type] || 'fas fa-cog'
}

</script>

<style scoped>
.modal-body {
  max-height: 70vh;
  overflow-y: auto;
}

.manual-controls,
.auto-controls {
  padding-top: 1rem;
  border-top: 1px solid var(--bs-border-color);
}

.alert {
  margin-bottom: 1rem;
}

/* Add to existing styles */
.weekday-selector {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.weekday-selector .btn {
  flex: 1;
  min-width: 3rem;
  padding: 0.375rem 0.5rem;
}

.input-group {
  display: flex;
  align-items: center;
}

.input-group .form-control {
  text-align: center;
  padding: 0.375rem;
}

.input-group .input-group-text {
  padding: 0.375rem 0.5rem;
  background-color: var(--bs-gray-200);
}

.dark-mode .input-group .input-group-text {
  background-color: var(--bs-gray-700);
  color: var(--bs-light);
}

.btn-group {
  width: 100%;
}

.btn-group .btn {
  flex: 1;
}

/* Add these to your existing styles */
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
  border-radius: 34px;
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
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--accent-color);
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.manual-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  align-items: center;
  margin-top: 2rem;
}

.btn-manual.warning {
  background: var(--warning-color);
}

.btn-manual.danger {
  background: var(--danger-color);
}

.time-remaining {
  font-family: monospace;
  font-size: 1.2rem;
  padding: 0.5rem 1rem;
  background: var(--glass-effect);
  border-radius: 4px;
}

.badge {
  font-family: monospace;
  font-size: 1.2rem;
}

.input-group .form-control:disabled {
  background-color: var(--bs-gray-200);
  opacity: 0.8;
}

.dark-mode .input-group .form-control:disabled {
  background-color: var(--bs-gray-700);
  opacity: 0.8;
}

/* Add to your existing <style scoped> section */
.chart-card {
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  height: 100%;
  overflow: hidden;
}

.chart-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.chart-card-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--card-header);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-title {
  margin: 0;

  font-weight: 600;
  font-size: 1.1rem;
}

.chart-actions {
  display: flex;
  gap: 0.5rem;
}

.chart-actions .btn {
  padding: 0.25rem 0.5rem;
  color: var(--text-color);
  border-color: var(--border-color);
}

.chart-actions .btn:hover {
  background: var(--glass-effect);
}

.chart-body {
  padding: 1rem;
  height: 400px;
  position: relative;
}

/* Dark mode adjustments */
:deep(.dark-mode) .chart-card {
  background: var(--card-bg);
  border-color: var(--border-color);
}

:deep(.dark-mode) .chart-card-header {
  background: var(--card-header);
  border-color: var(--border-color);
}

:deep(.dark-mode) .chart-title {
  color: #ffffff;
}

h5, .chart-action, i{
  color: #ffffff;
}
:deep(.dark-mode) .chart-actions .btn {
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.2);
}

:deep(.dark-mode) .chart-actions .btn:hover {
  background: var(--glass-effect);
}

/* Add these to your existing styles */
.modal-header {
  background: var(--card-header);
  color: white;
}

.modal-body {
  max-height: 70vh;
  overflow-y: auto;
  padding: 1.5rem;
}

.modal-content {
  background: var(--card-bg);
  border: none;
  border-radius: 12px;
}

/* Dark mode adjustments */
:deep(.dark-mode) .modal-content {
  background: var(--card-bg-dark);
}

:deep(.dark-mode) .modal-header {
  border-bottom-color: var(--border-color-dark);
}

/* Add these styles for sensor pump specific styling */
.modal-dialog {
  max-width: 500px;
}

.modal-body {
  padding: 1.5rem;
}

[data-actuator-type="sensor-pump"] .status-bullet {
  border-color: var(--info-color);
}

[data-actuator-type="sensor-pump"] .mode-badge {
  background-color: var(--info-color);
}

/* Add to your existing styles */
.info-alert {
  background: var(--bg-muted);
  color: var(--text-muted);
  padding: 0.75rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
}

.monitoring-stats {
  background: var(--bg-element);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
}

.stats-header {
  font-weight: 500;
  margin-bottom: 1rem;
  color: var(--text-color);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.stat-value {
  font-family: monospace;
  font-size: 1rem;
  color: var(--text-color);
}

/* Dark mode adjustments */
:deep(.dark-mode) .monitoring-stats {
  background: var(--bg-element-dark);
  border-color: var(--border-color-dark);
}

:deep(.dark-mode) .stat-value {
  color: var(--text-light);
}

/* Add these styles to your <style scoped> section */
.pump-control {
  padding: 2rem;
  text-align: center;
}

.status-display {
  margin-bottom: 1.5rem;
}

.status-label {
  font-weight: 500;
  margin-right: 0.5rem;
}

.status-value {
  color: var(--danger-color, #e74c3c);
}

.status-value.active {
  color: var(--success-color, #2ecc71);
}

.btn-power {
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  background: var(--success-color, #2ecc71);
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 200px;
}

.btn-power.active {
  background: var (--danger-color, #e74c3c);
}

.last-reading {
  border-top: 1px solid var(--border-color);
  padding-top: 1rem;
  margin-top: 1rem;
}

.info-label {
  font-size: 0.9rem;
  color: var (--text-muted);
  margin-bottom: 0.25rem;
}

.info-value {
  font-family: monospace;
  font-size: 1.1rem;
}
</style>