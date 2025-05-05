<template>
  <div class="container-fluid py-4">
    <!-- Add page header -->
    <div class="page-header mb-4">
      <h2><i class="fas fa-chart-line me-2"></i>Historical Data</h2>
      <p class="text-muted">View and analyze historical sensor readings</p>
    </div>

    <div class="row">
      <!-- Enhanced Date Range Selector -->
      <div class="col-12 mb-4">
        <div class="card filter-card">
          <div class="card-body">
            <div class="d-flex flex-wrap gap-3 align-items-center justify-content-between">
              <div class="d-flex gap-3 align-items-center">
                <div class="date-input">
                  <label class="form-label">From</label>
                  <div class="input-group">
                    <span class="input-group-text"><i class="fas fa-calendar"></i></span>
                    <input type="date" class="form-control" v-model="dateRange.from">
                  </div>
                </div>
                <div class="date-input">
                  <label class="form-label">To</label>
                  <div class="input-group">
                    <span class="input-group-text"><i class="fas fa-calendar"></i></span>
                    <input type="date" class="form-control" v-model="dateRange.to">
                  </div>
                </div>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-outline-secondary" @click="setQuickDate('week')">Last Week</button>
                <button class="btn btn-outline-secondary" @click="setQuickDate('month')">Last Month</button>
                <button class="btn btn-primary" @click="fetchHistoricalData">
                  <i class="fas fa-sync-alt me-2"></i>Update
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Enhanced Charts Section -->
      <div class="col-12 mb-4">
        <div class="card chart-card">
          <div class="card-header">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <h5 class="mb-0">Sensor Readings History</h5>
              <div class="chart-controls">
                <div class="btn-group">
                  <button 
                    v-for="chart in availableCharts" 
                    :key="chart.id"
                    class="btn btn-outline-primary"
                    :class="{ active: selectedChart === chart.id }"
                    @click="selectedChart = chart.id"
                  >
                    <i :class="chart.icon"></i>
                    {{ chart.name }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="card-body">
            <div class="chart-container" :class="{ 'loading': isLoading }">
              <div v-if="isLoading" class="chart-overlay">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>
              <canvas ref="chartCanvas"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Enhanced Data Table -->
      <div class="col-12">
        <div class="card table-card">
          <div class="card-header">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div class="d-flex align-items-center gap-2">
                <h5 class="mb-0">Detailed Records</h5>
                <span class="badge bg-primary">{{ historicalData.length }} entries</span>
              </div>
              <div class="table-controls">
                <button class="btn btn-success" @click="exportToCSV">
                  <i class="fas fa-file-export me-2"></i>Export CSV
                </button>
              </div>
            </div>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>pH Level</th>
                    <th>EC (mS/cm)</th>
                    <th>Water Temp (°C)</th>
                    <th>Air Temp (°C)</th>
                    <th>Humidity (%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="isLoading">
                    <td colspan="6" class="text-center py-4">
                      <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                      </div>
                    </td>
                  </tr>
                  <tr v-else-if="historicalData.length === 0">
                    <td colspan="6" class="text-center py-4">
                      <i class="fas fa-database me-2"></i>No data available
                    </td>
                  </tr>
                  <tr v-else v-for="record in historicalData" 
                      :key="record.timestamp"
                      :class="{ 'warning': isOutOfRange(record) }">
                    <td>{{ formatDate(record.timestamp) }}</td>
                    <td>{{ record.ph.toFixed(2) }}</td>
                    <td>{{ record.ec.toFixed(2) }}</td>
                    <td>{{ record.waterTemp.toFixed(1) }}</td>
                    <td>{{ record.airTemp.toFixed(1) }}</td>
                    <td>{{ record.humidity.toFixed(1) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import Chart from 'chart.js/auto'

// State
const dateRange = ref({
  from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  to: new Date().toISOString().split('T')[0]
})

const isLoading = ref(false)

const availableCharts = [
  { id: 'ph-ec', name: 'pH & EC', icon: 'fas fa-flask' },
  { id: 'temp', name: 'Temperature', icon: 'fas fa-thermometer-half' },
  { id: 'humidity', name: 'Humidity', icon: 'fas fa-tint' }
]

const selectedChart = ref('ph-ec')
const chartCanvas = ref(null)
const historicalData = ref([])
let chart = null

// Add dummy data generator
const generateDummyData = (startDate, endDate) => {
  const data = []
  const current = new Date(startDate)
  const end = new Date(endDate)
  
  while (current <= end) {
    // Generate random values within realistic ranges
    const record = {
      timestamp: new Date(current).toISOString(),
      ph: 5.5 + Math.random() * 2.5, // Range: 5.5-8.0
      ec: 1.0 + Math.random() * 2.0, // Range: 1.0-3.0
      waterTemp: 18 + Math.random() * 8, // Range: 18-26°C
      airTemp: 20 + Math.random() * 10, // Range: 20-30°C
      humidity: 50 + Math.random() * 40, // Range: 50-90%
    }
    data.push(record)
    
    // Add data points every hour
    current.setHours(current.getHours() + 1)
  }
  
  return data
}

// Methods
const fetchHistoricalData = async () => {
  isLoading.value = true
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Generate dummy data instead of fetching from API
    historicalData.value = generateDummyData(
      new Date(dateRange.value.from), 
      new Date(dateRange.value.to)
    )
    
    updateChart()
  } catch (error) {
    console.error('Error fetching historical data:', error)
  } finally {
    isLoading.value = false
  }
}

// Update updateChart function
const updateChart = () => {
  if (chart) chart.destroy()
  
  const ctx = chartCanvas.value.getContext('2d')
  const data = prepareChartData()
  
  // Use direct color values instead of CSS variables
  const isDark = document.documentElement.classList.contains('dark-mode')
  const textColor = isDark ? '#ffffff' : '#2d3047'
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
  
  chart = new Chart(ctx, {
    type: 'line',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        x: {
          grid: {
            color: gridColor,
            borderColor: borderColor
          },
          ticks: {
            color: textColor,
            font: {
              size: 12,
              weight: '500'
            }
          }
        },
        y: {
          beginAtZero: false,
          grid: {
            color: gridColor,
            borderColor: borderColor
          },
          ticks: {
            color: textColor,
            font: {
              size: 12,
              weight: '500'
            }
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: textColor,
            font: {
              size: 13,
              weight: '600'
            },
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: isDark ? '#000000' : '#ffffff',
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: borderColor,
          borderWidth: 1,
          padding: 12,
          titleFont: {
            size: 14,
            weight: '600'
          },
          bodyFont: {
            size: 13
          },
          displayColors: true
        }
      }
    }
  })
}

// Update prepareChartData function with dark mode aware colors
const prepareChartData = () => {
  const timestamps = historicalData.value.map(record => formatDate(record.timestamp))
  const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark'
  
  const chartColors = {
    ph: isDark ? '#40916c' : '#2d6a4f',
    ec: isDark ? '#0096c7' : '#0077b6',
    waterTemp: isDark ? '#48cae4' : '#0096c7',
    airTemp: isDark ? '#ff595e' : '#ef476f',
    humidity: isDark ? '#118ab2' : '#073b4c'
  }
  
  switch (selectedChart.value) {
    case 'ph-ec':
      return {
        labels: timestamps,
        datasets: [
          {
            label: 'pH Level',
            data: historicalData.value.map(record => record.ph),
            borderColor: chartColors.ph,
            backgroundColor: chartColors.ph + '20',
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 2,
            pointHoverRadius: 5
          },
          {
            label: 'EC (mS/cm)',
            data: historicalData.value.map(record => record.ec),
            borderColor: chartColors.ec,
            backgroundColor: chartColors.ec + '20',
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 2,
            pointHoverRadius: 5
          }
        ]
      }
    case 'temp':
      return {
        labels: timestamps,
        datasets: [
          {
            label: 'Water Temperature (°C)',
            data: historicalData.value.map(record => record.waterTemp),
            borderColor: chartColors.waterTemp,
            backgroundColor: chartColors.waterTemp + '20',
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 2,
            pointHoverRadius: 5
          },
          {
            label: 'Air Temperature (°C)',
            data: historicalData.value.map(record => record.airTemp),
            borderColor: chartColors.airTemp,
            backgroundColor: chartColors.airTemp + '20',
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 2,
            pointHoverRadius: 5
          }
        ]
      }
    case 'humidity':
      return {
        labels: timestamps,
        datasets: [
          {
            label: 'Humidity (%)',
            data: historicalData.value.map(record => record.humidity),
            borderColor: chartColors.humidity,
            backgroundColor: chartColors.humidity + '20',
            borderWidth: 2,
            tension: 0.1,
            fill: true,
            pointRadius: 2,
            pointHoverRadius: 5
          }
        ]
      }
    default:
      return { labels: [], datasets: [] }
  }
}

// Add theme change watcher
watch(() => document.documentElement.getAttribute('data-bs-theme'), (newTheme) => {
  if (chart) {
    updateChart()
  }
})

const formatDate = (timestamp) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  }).format(new Date(timestamp))
}

const exportToCSV = () => {
  const headers = ['Timestamp,pH,EC,Water Temp,Air Temp,Humidity\n']
  const rows = historicalData.value.map(record => {
    return `${record.timestamp},${record.ph},${record.ec},${record.waterTemp},${record.airTemp},${record.humidity}`
  })
  
  const csvContent = headers.concat(rows).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `hydroponics-data-${dateRange.value.from}-to-${dateRange.value.to}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const setQuickDate = (period) => {
  const today = new Date()
  const from = new Date()
  
  switch(period) {
    case 'week':
      from.setDate(today.getDate() - 7)
      break
    case 'month':
      from.setMonth(today.getMonth() - 1)
      break
  }
  
  dateRange.value.from = from.toISOString().split('T')[0]
  dateRange.value.to = today.toISOString().split('T')[0]
  fetchHistoricalData()
}

const isOutOfRange = (record) => {
  return record.ph < 5.5 || record.ph > 7.5 || 
         record.ec < 1.0 || record.ec > 3.0 ||
         record.waterTemp < 18 || record.waterTemp > 26
}

// Watchers & Lifecycle
watch(selectedChart, updateChart)

// Update the watcher to use classList
watch(
  () => document.documentElement.classList.contains('dark-mode'),
  () => {
    if (chart) {
      updateChart()
    }
  }
)

onMounted(() => {
  fetchHistoricalData()
})
</script>


  <style scoped>
  /* Base styles */
  .chart-container {
    height: 400px;
    position: relative;
  }
  
  .table th {
    position: sticky;
    top: 0;
    background: var(--card-bg);
    z-index: 1;
    padding: 1rem;
  }
  
  .table td {
    padding: 1rem;
    vertical-align: middle;
  }
  
  .table-responsive {
    max-height: 400px;
    overflow-y: auto;
  }
  
  /* Dark mode overrides */
  :deep(.dark-mode) {
    color: #ffffff;
  }
  
  :deep(.dark-mode) .card,
  :deep(.dark-mode) .table,
  :deep(.dark-mode) .form-control,
  :deep(.dark-mode) .input-group-text {
    color: #ffffff;
  }
  
  :deep(.dark-mode) .table th {
    background: var(--card-header);
    color: #ffffff;
  }
  
  :deep(.dark-mode) .table td {
    background: var(--card-bg);
    border-color: var(--border-color);
  }
  
  :deep(.dark-mode) .text-muted {
    color: var(--text-color-secondary) !important;
  }
  
  :deep(.dark-mode) .btn-outline-secondary {
    border-color: var(--border-color);
    color: #ffffff;
  }
  
  :deep(.dark-mode) .chart-overlay {
    background: rgba(0, 0, 0, 0.8);
  }
  
  :deep(.dark-mode) .table-hover tbody tr:hover {
    background-color: var(--glass-effect);
  }
  
  :deep(.dark-mode) .badge {
    background-color: var(--card-header) !important;
  }
  
  :deep(.dark-mode) .table tr.warning {
    background-color: rgba(255, 193, 7, 0.15);
  }
  
  /* Component styles */
  .page-header {
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 1rem;
  }
  
  .filter-card,
  .chart-card,
  .table-card {
    border-radius: 12px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    overflow: hidden;
  }
  
  .date-input {
    min-width: 200px;
  }
  
  .chart-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .table {
    margin-bottom: 0;
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .date-input {
      min-width: 100%;
    }
    
    .chart-controls {
      width: 100%;
    }
    
    .btn-group {
      display: grid;
      width: 100%;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    }
  }
  
  /* Transitions */
  .chart-container,
  .table,
  .table th,
  .table td {
    transition: all 0.3s ease;
  }
  
  /* Scrollbars */
  .table-responsive::-webkit-scrollbar {
    width: 8px;
  }
  
  .table-responsive::-webkit-scrollbar-track {
    background: var(--card-bg);
  }
  
  .table-responsive::-webkit-scrollbar-thumb {
    background-color: var(--border-color);
    border-radius: 4px;
  }
  
  .table-responsive::-webkit-scrollbar-thumb:hover {
    background-color: var(--text-color-secondary);
  }

/* Complete transitions */
.chart-container,
.table,
.table th,
.table td {
  transition: all 0.3s ease;
}

/* Dark mode fixes */
:deep(.dark-mode) {
  --text-color: #ffffff;
  --chart-grid: rgba(255, 255, 255, 0.1);
  --chart-border: rgba(255, 255, 255, 0.2);
}

:deep(.dark-mode) .card {
  background: var(--card-bg);
  border-color: var(--border-color);
}

:deep(.dark-mode) .card-header {
  background: var(--card-header);
  border-bottom-color: var(--border-color);
}

:deep(.dark-mode) .form-control,
:deep(.dark-mode) .input-group-text {
  background-color: var(--card-bg);
  border-color: var(--border-color);
  color: var(--text-color);
}

:deep(.dark-mode) .btn-outline-primary,
:deep(.dark-mode) .btn-outline-secondary {
  color: var(--text-color);
  border-color: var(--border-color);
}

:deep(.dark-mode) .btn-outline-primary:hover,
:deep(.dark-mode) .btn-outline-primary.active {
  background: var(--card-header);
  border-color: var(--card-header);
  color: white;
}

:deep(.dark-mode) .btn-primary {
  background: var(--card-header);
  border-color: transparent;
}

:deep(.dark-mode) .table {
  color: var(--text-color);
}

:deep(.dark-mode) .table th {
  background: var(--card-header);
  color: var(--text-color);
  border-bottom: 2px solid var(--border-color);
}

:deep(.dark-mode) .table td {
  border-color: var(--border-color);
}

:deep(.dark-mode) .table-hover tbody tr:hover {
  background-color: var(--glass-effect);
}

:deep(.dark-mode) .chart-overlay {
  background: rgba(0, 0, 0, 0.8);
}

:deep(.dark-mode) .spinner-border {
  border-color: var(--text-color);
  border-right-color: transparent;
}

/* Enhance scrollbars for dark mode */
:deep(.dark-mode) .table-responsive::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

:deep(.dark-mode) .table-responsive::-webkit-scrollbar-track {
  background: var(--card-bg);
}

:deep(.dark-mode) .table-responsive::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

:deep(.dark-mode) .table-responsive::-webkit-scrollbar-thumb:hover {
  background: var(--text-color-secondary);
}

/* Add smooth transitions for all theme changes */
.card,
.btn,
.form-control,
.input-group-text,
.table,
.chart-container {
  transition: all 0.3s ease;
}

/* Warning state in dark mode */
:deep(.dark-mode) .table tr.warning {
  background-color: rgba(255, 193, 7, 0.15);
}

:deep(.dark-mode) .table tr.warning:hover {
  background-color: rgba(255, 193, 7, 0.25);
}

/* Badge styling in dark mode */
:deep(.dark-mode) .badge {
  background-color: var(--card-header) !important;
  color: var(--text-color);
}
  </style>