<template>
  <button 
    v-if="!isHomePage"
    class="floating-home-btn"
    @click="goHome"
    title="Go to Home"
  >
    <i class="fas fa-home"></i>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const isHomePage = computed(() => route.path === '/')

const goHome = () => {
  router.push('/')
}
</script>

<style scoped>
.floating-home-btn {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent-color);
  color: white;
  border: none;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 1000;
}

.floating-home-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
}
</style>