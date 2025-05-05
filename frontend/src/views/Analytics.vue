<template>
  <div class="container-fluid py-4">
    <div class="page-header mb-4">
      <h2><i class="fas fa-chart-bar me-2"></i>System Analytics</h2>
      <p class="text-muted">Monitor and analyze system performance metrics</p>
    </div>

    <!-- Analytics Cards Row -->
    <div class="row g-4 mb-4">
      <div class="col-md-3">
        <div class="analytics-card">
          <div class="analytics-icon bg-success-subtle">
            <i class="fas fa-leaf"></i>
          </div>
          <div class="analytics-content">
            <h3>{{ stats.plantCount }}</h3>
            <p>Total Plants</p>
          </div>
          <div class="trend up">
            <i class="fas fa-arrow-up"></i>
            {{ stats.plantGrowth }}%
          </div>
        </div>
      </div>

      <div class="col-md-3">
        <div class="analytics-card">
          <div class="analytics-icon bg-primary-subtle">
            <i class="fas fa-tint"></i>
          </div>
          <div class="analytics-content">
            <h3>{{ stats.waterUsage }}L</h3>
            <p>Water Usage</p>
          </div>
          <div class="trend down">
            <i class="fas fa-arrow-down"></i>
            {{ stats.waterSavings }}%
          </div>
        </div>
      </div>

      <div class="col-md-3">
        <div class="analytics-card">
          <div class="analytics-icon bg-warning-subtle">
            <i class="fas fa-bolt"></i>
          </div>
          <div class="analytics-content">
            <h3>{{ stats.energy }}kWh</h3>
            <p>Energy Usage</p>
          </div>
          <div class="trend down">
            <i class="fas fa-arrow-down"></i>
            {{ stats.energySavings }}%
          </div>
        </div>
      </div>

      <div class="col-md-3">
        <div class="analytics-card">
          <div class="analytics-icon bg-info-subtle">
            <i class="fas fa-clock"></i>
          </div>
          <div class="analytics-content">
            <h3>{{ stats.uptime }}%</h3>
            <p>System Uptime</p>
          </div>
          <div class="trend up">
            <i class="fas fa-arrow-up"></i>
            {{ stats.uptimeChange }}%
          </div>
        </div>
      </div>
    </div>

    <!-- Main Analytics Charts -->
    <div class="row g-4">
      <!-- System Performance -->
      <div class="col-md-8">
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">System Performance</h5>
            <div class="btn-group">
              <button 
                v-for="period in timePeriods" 
                :key="period"
                class="btn btn-outline-secondary btn-sm"
                :class="{ active: selectedPeriod === period }"
                @click="selectedPeriod = period"
              >
                {{ period }}
              </button>
            </div>
          </div>
          <div class="card-body">
            <canvas ref="performanceChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Resource Usage -->
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-header">
            <h5 class="mb-0">Resource Usage</h5>
          </div>
          <div class="card-body">
            <canvas ref="resourceChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Alerts and Events -->
      <div class="col-12">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">System Events</h5>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="event in events" :key="event.id">
                    <td>{{ formatDate(event.timestamp) }}</td>
                    <td>
                      <i :class="event.icon" class="me-2"></i>
                      {{ event.description }}
                    </td>
                    <td>
                      <span class="badge" :class="'bg-' + event.category">
                        {{ event.category }}
                      </span>
                    </td>
                    <td>
                      <span :class="'status-' + event.status">
                        {{ event.status }}
                      </span>
                    </td>
                    <td>
                      <button class="btn btn-sm btn-link" @click="viewEventDetails(event)">
                        View Details
                      </button>
                    </td>
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

const performanceChart = ref(null)
const resourceChart = ref(null)
const selectedPeriod = ref('Week')
const timePeriods = ['Day', 'Week', 'Month', 'Year']

// Dummy data
const stats = ref({
  plantCount: 24,
  plantGrowth: 15,
  waterUsage: 450,
  waterSavings: 12,
  energy: 325,
  energySavings: 8,
  uptime: 99.9,
  uptimeChange: 0.5
})

const events = ref([
  {
    id: 1,
    timestamp: new Date(),
    description: 'pH levels normalized',
    category: 'success',
    status: 'resolved',
    icon: 'fas fa-check-circle text-success'
  },
  {
    id: 2,
    timestamp: new Date(Date.now() - 3600000),
    description: 'High EC detected',
    category: 'warning',
    status: 'monitoring',
    icon: 'fas fa-exclamation-triangle text-warning'
  }
])

// Chart initialization
const initCharts = () => {
  const isDark = document.documentElement.classList.contains('dark-mode')
  const textColor = isDark ? '#ffffff' : '#2d3047'

  // Performance Chart
  const perfCtx = performanceChart.value.getContext('2d')
  new Chart(perfCtx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'System Performance',
        data: [95, 93, 97, 94, 96, 98, 97],
        borderColor: '#40916c',
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: {
            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
          },
          ticks: {
            color: textColor
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: textColor
          }
        }
      }
    }
  })

  // Resource Usage Chart
  const resCtx = resourceChart.value.getContext('2d')
  new Chart(resCtx, {
    type: 'doughnut',
    data: {
      labels: ['Water', 'Energy', 'Nutrients'],
      datasets: [{
        data: [45, 32, 23],
        backgroundColor: ['#0096c7', '#40916c', '#ff595e']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor
          }
        }
      }
    }
  })
}

const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(date)
}

const viewEventDetails = (event) => {
  console.log('View details for event:', event)
}

onMounted(() => {
  initCharts()
})
</script>

<style scoped>
.analytics-card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.analytics-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.analytics-content {
  flex: 1;
}

.analytics-content h3 {
  font-size: 1.5rem;
  margin: 0;
  font-weight: 600;
}

.analytics-content p {
  margin: 0;
  color: var(--text-color-secondary);
  font-size: 0.9rem;
}

.trend {
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.trend.up {
  color: var(--success-color);
}

.trend.down {
  color: var(--danger-color);
}

.status-resolved {
  color: var(--success-color);
}

.status-monitoring {
  color: var(--warning-color);
}

.status-error {
  color: var(--danger-color);
}

/* Dark mode adjustments */
:deep(.dark-mode) .analytics-card {
  background: var(--card-bg);
}

:deep(.dark-mode) .analytics-icon {
  background: var(--glass-effect);
}

:deep(.dark-mode) .table {
  color: var(--text-color);
}

:deep(.dark-mode) .btn-outline-secondary {
  color: var(--text-color);
  border-color: var(--border-color);
}

:deep(.dark-mode) .btn-outline-secondary:hover,
:deep(.dark-mode) .btn-outline-secondary.active {
  background: var(--card-header);
  border-color: var(--card-header);
  color: white;
}
</style>