<template>
  <div class="chart-wrapper">
    <Line
      :data="chartData"
      :options="chartOptions"
    />
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Line } from 'vue-chartjs'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

const props = defineProps({
  data: {
    type: Object,
    required: true
  },
  title: {
    type: String,
    default: ''
  }
})

const chartData = computed(() => ({
  labels: props.data.labels,
  datasets: props.data.datasets.map(dataset => ({
    ...dataset,
    borderWidth: 2,
    tension: 0.4,
    fill: true
  }))
}))

const chartOptions = computed(() => {
  const isDark = document.documentElement.classList.contains('dark-mode')
  const textColor = isDark ? '#ffffff' : '#2d3047'
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
        },
        ticks: {
          color: textColor
        }
      },
      y: {
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
        },
        ticks: {
          color: textColor
        }
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: textColor,
          font: {
            size: 12,
            weight: '500'
          }
        }
      },
      title: {
        display: !!props.title,
        text: props.title,
        color: textColor,
        font: {
          size: 16,
          weight: '600'
        }
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
        borderWidth: 1,
        padding: 10
      }
    }
  }
})

// Watch for theme changes
watch(
  () => document.documentElement.classList.contains('dark-mode'),
  () => {
    ChartJS.defaults.color = document.documentElement.classList.contains('dark-mode') 
      ? '#ffffff' 
      : '#2d3047'
  }
)
</script>

<style scoped>
.chart-wrapper {
  position: relative;
  height: 400px;
  width: 100%;
}
</style>