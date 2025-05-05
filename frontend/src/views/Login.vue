<template>
  <div class="login-container" :class="{ 'dark-mode': theme.isDark }">
    <div class="login-card">
      <div class="login-header">
        <img src="@/assets/ecoponicslogo.png" alt="Ecoponics Logo" class="login-logo" />
        <h1>ECOPONICS</h1>
      </div>

      <div class="login-tabs">
        <button
          :class="['tab-btn', { active: activeTab === 'pattern' }]"
          @click="activeTab = 'pattern'"
        >
          <i class="fas fa-draw-polygon"></i> Pattern
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'pin' }]"
          @click="activeTab = 'pin'; pin = ''"
        >
          <i class="fas fa-key"></i> PIN
        </button>
      </div>

      <!-- Pattern Lock -->
      <div v-if="activeTab === 'pattern'" class="pattern-container">
        <div class="pattern-instruction">{{ patternError || 'Draw your pattern to unlock' }}</div>

        <div
          class="pattern-grid"
          @mousedown="startDrawing"
          @mousemove="draw"
          @mouseup="endDrawing"
          @touchstart.prevent="startDrawing"
          @touchmove.prevent="draw"
          @touchend.prevent="endDrawing"
        >
          <!-- Dots -->
          <div
            v-for="dot in 9"
            :key="dot"
            class="pattern-dot"
            :class="{ active: selectedDots.includes(dot) }"
            :data-dot="dot"
          >
            <div class="dot-center"></div>
          </div>

          <!-- Line Connections -->
          <svg class="pattern-lines">
            <line
              v-for="(line, index) in linePaths"
              :key="index"
              :x1="line.x1"
              :y1="line.y1"
              :x2="line.x2"
              :y2="line.y2"
              :stroke="patternError ? '#ff4444' : '#4CAF50'"
              stroke-width="4"
              stroke-linecap="round"
            />
          </svg>
        </div>
      </div>

      <!-- PIN Input -->
      <div v-else class="pin-container">
        <div class="pin-display">
          <span
            v-for="(_, index) in 4"
            :key="index"
            class="pin-digit"
            :class="{ filled: pin.length > index }"
          ></span>
        </div>
        <div class="pin-pad">
          <button
            v-for="num in [1, 2, 3, 4, 5, 6, 7, 8, 9, 'clear', 0, 'enter']"
            :key="num"
            class="pin-button"
            @click="handlePinInput(num)"
            :disabled="(num === 'enter' && pin.length !== 4) || (num === 'clear' && !pin.length)"
          >
            <template v-if="num === 'clear'">
              <i class="fas fa-arrow-left"></i>
            </template>
            <template v-else-if="num === 'enter'">
              <i class="fas fa-check"></i>
            </template>
            <template v-else>
              {{ num }}
            </template>
          </button>
        </div>
        <p v-if="pinError" class="error-message">{{ pinError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '@/store/theme'

const router = useRouter()
const theme = useThemeStore()

// State Management
const activeTab = ref('pattern')
const selectedDots = ref([])
const isDrawing = ref(false)
const patternError = ref('')
const correctPattern = [1, 2, 3, 6, 9] // Correct pattern
const dotPositions = ref([])
const linePaths = ref([])

// PIN Code State
const pin = ref('')
const pinError = ref('')
const correctPin = '1234'

// Start Drawing (Capture Dot Positions)
const startDrawing = (e) => {
  resetPattern()
  isDrawing.value = true
  captureDotPositions(e.currentTarget)
}

// Capture Dot Positions
const captureDotPositions = (grid) => {
  const dots = grid.querySelectorAll('.pattern-dot')
  dotPositions.value = Array.from(dots).map((dot) => {
    const { left, top, width, height } = dot.getBoundingClientRect()
    return { dot: parseInt(dot.dataset.dot), x: left + width / 2, y: top + height / 2 }
  })
}

// Handle Drawing
const draw = (e) => {
  if (!isDrawing.value) return

  const { clientX, clientY } = e.touches ? e.touches[0] : e
  const closestDot = findClosestDot(clientX, clientY)

  if (closestDot && !selectedDots.value.includes(closestDot.dot)) {
    if (selectedDots.value.length > 0) {
      const prevDot = dotPositions.value.find(
        (dot) => dot.dot === selectedDots.value.at(-1)
      )
      linePaths.value.push({
        x1: prevDot.x,
        y1: prevDot.y,
        x2: closestDot.x,
        y2: closestDot.y
      })
    }
    selectedDots.value.push(closestDot.dot)
  }
}

// Find Closest Dot
const findClosestDot = (x, y) => {
  return dotPositions.value.find((dot) => {
    const dx = dot.x - x
    const dy = dot.y - y
    return Math.sqrt(dx * dx + dy * dy) < 30
  })
}

// Update the endDrawing function
const endDrawing = () => {
  isDrawing.value = false
  if (selectedDots.value.join('') === correctPattern.join('')) {
    // Set authentication state before redirect
    localStorage.setItem('isAuthenticated', 'true')
    router.push('/home')  // Changed from '/dashboard' to '/home'
  } else {
    patternError.value = 'Invalid pattern'
    setTimeout(resetPattern, 1500)
  }
}

// Reset Pattern
const resetPattern = () => {
  selectedDots.value = []
  linePaths.value = []
  patternError.value = ''
}

// Update the handlePinInput function
const handlePinInput = (value) => {
  pinError.value = ''
  if (value === 'clear') {
    pin.value = pin.value.slice(0, -1)
  } else if (value === 'enter') {
    if (pin.value === correctPin) {
      // Set authentication state before redirect
      localStorage.setItem('isAuthenticated', 'true')
      router.push('/home')  // Changed from '/dashboard' to '/home'
    } else {
      pinError.value = 'Invalid PIN'
      setTimeout(() => (pinError.value = ''), 1500)
    }
  } else if (pin.value.length < 4) {
    pin.value += value
  }
}
</script>

  <style scoped>
  .login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;

    padding: 1rem;
  }
  
  .login-card {

    border-radius: 20px;
    padding: 2rem;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    width: 100%;
    max-width: 400px;
  }
  
  .login-header {
    text-align: center;
    margin-bottom: 2rem;
  }
  
  .login-logo {
    width: 80px;
    height: 80px;
    margin-bottom: 1rem;
  }
  
  .login-tabs {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .tab-btn {
    flex: 1;
    padding: 1rem;
    border: none;
    border-radius: 10px;
    background: #f0f0f0;
    color: #666;
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }
  
  .tab-btn.active {
    background: #4CAF50;
    color: white;
    box-shadow: 0 4px 6px rgba(76, 175, 80, 0.2);
  }
  
  /* Pattern Lock Styles */
  .pattern-container {
    position: relative;
    width: 100%;
    max-width: 320px;
    margin: 20px auto;
  }
  
  .pattern-instruction {
    text-align: center;
    color: #666;
    margin-bottom: 25px;
    font-size: 0.95rem;
    min-height: 20px;
  }
  
  .pattern-grid {
    position: relative;
    width: 300px;
    height: 300px;
    margin: 0 auto;
    background: transparent;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 30px;
    padding: 20px;
    touch-action: none;
  }
  
  .pattern-dot {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .pattern-dot .dot-center {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #e0e0e0;
    transition: all 0.2s ease;
  }
  
  .pattern-dot.active .dot-center {
    background: #4CAF50;
    transform: scale(1.4);
    box-shadow: 0 0 15px rgba(76, 175, 80, 0.3);
  }
  
  .pattern-dot.error.active .dot-center {
    background: #ff4444;
    box-shadow: 0 0 15px rgba(255, 68, 68, 0.3);
  }
  
  .pattern-lines {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  
  /* PIN Code Styles */
  .pin-container {
    text-align: center;
  }
  
  .pin-display {
    display: flex;
    gap: 20px;
    margin: 25px 0;
    justify-content: center;
  }
  
  .pin-digit {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #e0e0e0;
    transition: all 0.2s ease;
  }
  
  .pin-digit.filled {
    background: #4CAF50;
    transform: scale(1.2);
  }
  
  .pin-pad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
    max-width: 280px;
    margin: 0 auto;
  }
  
  .pin-button {
    aspect-ratio: 1;
    border: none;
    border-radius: 50%;
    background: #f8f8f8;
    font-size: 1.3rem;
    color: #333;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  
  .pin-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .pin-button:not(:disabled):hover {
    background: #4CAF50;
    color: white;
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(76, 175, 80, 0.2);
  }
  
  .error-message {
    color: #ff4444;
    margin-top: 15px;
    font-size: 0.9rem;
    animation: shake 0.4s ease;
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
  </style>