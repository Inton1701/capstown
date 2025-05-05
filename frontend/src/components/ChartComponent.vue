<template>
  <div class="chart-card">
    <div class="chart-card-header">
      <h5 class="chart-title">
        <i :class="icon" class="icon-animate me-2"></i>{{ title }}
        <span v-if="isLoading" class="ms-2">
          <i class="fas fa-spinner fa-spin"></i>
        </span>
      </h5>
      <div class="chart-actions">
        <button 
          class="btn btn-sm btn-outline-secondary" 
          @click="refreshChart" 
          :disabled="isLoading"
          data-bs-toggle="tooltip" 
          title="Refresh"
        >
          <i class="fas fa-sync-alt"></i>
        </button>
        <button 
          class="btn btn-sm btn-outline-secondary" 
          @click="$emit('download')" 
          data-bs-toggle="tooltip" 
          title="Download"
        >
          <i class="fas fa-download"></i>
        </button>
      </div>
    </div>
    <div class="chart-body">
      <div v-if="error" class="alert alert-danger">
        {{ error }}
      </div>
      <canvas ref="chartEl" v-show="!error"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
import Chart from 'chart.js/auto'
import { useThemeStore } from '@/store/theme'
import axios from 'axios'

const API_URL = 'http://localhost:5000/api'
const props = defineProps({
  title: String,
  icon: {
    type: String,
    default: 'fas fa-chart-line'
  },
  type: {
    type: String,
    default: 'line'
  },
  sensorType: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['refresh', 'download'])
const theme = useThemeStore()
const chartEl = ref(null)
const isLoading = ref(false)
const error = ref(null)
let chart = null

const fetchHistoricalData = async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    const endTime = new Date();
    const startTime = new Date(endTime - 24 * 60 * 60 * 1000);
    
    console.log('Fetching data for sensor type:', props.sensorType); // Debug log

    const response = await axios.get(`${API_URL}/readings/history`, {
      params: {
        from: startTime.toISOString(),
        to: endTime.toISOString()
      }
    });

    console.log('API Response:', response.data); // Debug log

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Failed to fetch data');
    }

    const readings = response.data.data || [];
    
    if (readings.length === 0) {
      error.value = 'No data available for the selected period';
      return;
    }

    // Safety check for sensorType
    if (!props.sensorType) {
      throw new Error('Sensor type is required');
    }

    const sensorKey = props.sensorType.toLowerCase();
    console.log('Looking for sensor key:', sensorKey); // Debug log

    // Process and validate the data with null checks
    const validReadings = readings.filter(reading => {
      if (!reading?.readings) {
        console.log('Invalid reading structure:', reading); // Debug log
        return false;
      }
      
      const sensorData = reading.readings[sensorKey];
      if (!sensorData?.value) {
        console.log('Missing sensor value for:', sensorKey); // Debug log
        return false;
      }

      return true;
    });

    console.log('Valid readings:', validReadings.length); // Debug log

    if (validReadings.length === 0) {
      error.value = `No valid readings found for ${props.sensorType}`;
      return;
    }

    const chartData = {
      labels: validReadings.map(reading => 
        new Date(reading.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      ),
      datasets: [{
        label: props.title,
        data: validReadings.map(reading => reading.readings[sensorKey].value),
        borderColor: theme.isDark ? '#90caf9' : '#1976d2',
        backgroundColor: theme.isDark ? 'rgba(144, 202, 249, 0.2)' : 'rgba(25, 118, 210, 0.2)',
        tension: 0.4,
        fill: true
      }]
    };

    if (chart) {
      chart.data = chartData;
      chart.update('none');
    } else if (chartEl.value) {
      chart = new Chart(chartEl.value, {
        ...getChartConfig(),
        data: chartData
      });
    }
  } catch (err) {
    console.error('Chart Error:', err);
    error.value = err.message || 'Failed to load chart data';
  } finally {
    isLoading.value = false;
  }
};

const refreshChart = async () => {
  await fetchHistoricalData()
}

const getChartConfig = () => ({
  type: props.type,
  data: props.data,
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        grid: {
          color: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: theme.isDark ? '#ffffff' : '#2d3047',
          font: { size: 12 }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: theme.isDark ? '#ffffff' : '#2d3047',
          font: { size: 12 }
        }
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: theme.isDark ? '#ffffff' : '#2d3047',
          font: { size: 12 },
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: theme.isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        titleColor: theme.isDark ? '#ffffff' : '#2d3047',
        bodyColor: theme.isDark ? '#ffffff' : '#2d3047',
        padding: 10,
        borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
        borderWidth: 1
      }
    }
  }
})

onMounted(() => {
  fetchHistoricalData();
  const updateInterval = setInterval(fetchHistoricalData, 30000); // Update every 30 seconds
  
  onUnmounted(() => {
    if (updateInterval) clearInterval(updateInterval);
    if (chart) chart.destroy();
  });
});

// Add error handling for theme changes
watch(() => theme.isDark, () => {
  if (chart) {
    const config = getChartConfig();
    chart.options = config.options;
    chart.update('none');
  }
});
</script>

<style scoped>
.chart-card {
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  height: 100%;
  overflow: hidden;
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
  font-size: 1.1rem;
  font-weight: 600;
}

.chart-actions {
  display: flex;
  gap: 0.5rem;
}

.chart-body {
  padding: 1rem;
  height: 400px;
  position: relative;
}

.icon-animate {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}
</style>