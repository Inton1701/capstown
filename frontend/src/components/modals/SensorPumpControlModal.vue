<template>
    <div class="sensor-pump-config">
      <div class="info-alert mb-4">
        <i class="fas fa-info-circle me-2"></i>
        <span>Control sensor pump operation for water sampling</span>
      </div>
  
      <div class="power-control">
        <div class="status-display">
          <span class="status-label">Status:</span>
          <span class="status-value" :class="{ 'active': actuator.status === 'active' }">
            {{ actuator.status === 'active' ? 'Running' : 'Stopped' }}
          </span>
        </div>
  
        <button 
          class="btn-power"
          :class="{ 'active': actuator.status === 'active' }"
          @click="togglePower"
        >
          <i class="fas fa-power-off me-2"></i>
          {{ actuator.status === 'active' ? 'Turn Off' : 'Turn On' }}
        </button>
      </div>
    </div>
  </template>
  
  <script setup>
  const props = defineProps({
    actuator: {
      type: Object,
      required: true
    }
  })
  
  const emit = defineEmits(['save', 'close'])
  
  const togglePower = () => {
  const newStatus = props.actuator.status === 'active' ? 'idle' : 'active';
  const currentTime = Date.now();

  emit('save', {
    ...props.actuator,
    status: newStatus,
    mode: 'manual', // This ensures the sensor pump is in manual mode
    lastRun: newStatus === 'active' ? currentTime : props.actuator.lastRun,
    elapsedTime: 0,
    nextScheduledRun: null
  });
};

  </script>
  
  <style scoped>
  .sensor-pump-config {
    padding: 1.5rem;
  }
  
  .info-alert {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--bg-muted, #f8f9fa);
    border-radius: 8px;
    color: var(--text-muted, #6c757d);
  }
  
  .power-control {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
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
    background: var(--danger-color, #e74c3c);
  }
  
  .btn-power:hover {
    opacity: 0.9;
  }
  
  .status-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.1rem;
  }
  
  .status-label {
    font-weight: 500;
  }
  
  .status-value {
    color: var(--danger-color, #e74c3c);
  }
  
  .status-value.active {
    color: var(--success-color, #2ecc71);
  }
  </style>