<template>
  <div class="container-fluid py-4">
    <h1 class="text-center mb-4">Sensor Management</h1>
    <div class="row">
      <SensorLimits />
      <AutomationRules />
    </div>
  </div>
</template>

<script setup>
import SensorLimits from '@/components/SensorLimits.vue'
import AutomationRules from '@/components/AutomationRules.vue'
</script>