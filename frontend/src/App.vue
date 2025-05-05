<template>
  <!-- <LoadingScreen 
    v-if="isLoading" 
    :progress="loadingProgress"
    @complete="onLoadingComplete" 
  /> -->
  <div  :class="{ 'dark-mode': theme.isDark }" class="app-container">
    <router-view />
    <div class="floating-menu" ref="floatingMenu" :style="menuPosition">
      <button class="floating-menu-trigger" @click="toggleMenu">
        <i class="fas fa-ellipsis-v"></i>
      </button>
      
      <div class="floating-menu-items" :class="{ 'is-open': isMenuOpen }">
        <router-link to="/" class="menu-item" title="Home">
          <i class="fas fa-home"></i>
        </router-link>
        <button class="menu-item" @click="toggleNotifications" title="Notifications">
          <i class="fas fa-bell"></i>
          <span v-if="notifications.length" class="notification-badge">
            {{ notifications.length }}
          </span>
        </button>
        <router-link to="/settings" class="menu-item" title="Settings">
          <i class="fas fa-cog"></i>
        </router-link>
        <button class="menu-item" @click="theme.toggleTheme" title="Theme">
          <i :class="themeIcon"></i>
        </button>
        <button class="menu-item" @click="confirmLogout" title="Logout">
          <i class="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </div>

    <!-- Add Notifications Panel -->
    <div class="notifications-panel" :class="{ 'is-open': showNotifications }">
      <div class="notifications-header">
        <h5 class="mb-0">Notifications</h5>
        <button class="btn-close" @click="toggleNotifications"></button>
      </div>
      <div class="notifications-list">
        <div v-if="notifications.length === 0" class="text-center text-muted py-3">
          No notifications
        </div>
        <div v-else v-for="notification in notifications" 
             :key="notification.id" 
             class="notification-item"
             :class="{ 'unread': !notification.read }">
          <div class="notification-icon">
            <i :class="notification.icon"></i>
          </div>
          <div class="notification-content">
            <div class="notification-title">{{ notification.title }}</div>
            <div class="notification-message">{{ notification.message }}</div>
            <div class="notification-time">{{ notification.time }}</div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showLogoutConfirm" class="confirmation-dialog">
      <div class="confirmation-content">
        <h3>Confirm Logout</h3>
        <p>Are you sure you want to logout?</p>
        <div class="confirmation-buttons">
          <button @click="handleLogout" class="confirm-btn">Yes</button>
          <button @click="showLogoutConfirm = false" class="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Global toast notification system -->
    <div class="global-toast-container" v-if="toast.show">
      <div class="global-toast-message" :class="toast.type">
        <div class="global-toast-icon">
          <i :class="getToastIcon(toast.type)"></i>
        </div>
        <div class="global-toast-content">{{ toast.message }}</div>
        <button class="global-toast-close" @click="toast.show = false">&times;</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useThemeStore } from '@/store/theme'
import { useRouter } from 'vue-router'

const theme = useThemeStore()
const isLoading = ref(true)
const loadingProgress = ref(0)

const onLoadingComplete = async () => {
  try {
    await Promise.all([
      // Add any initial data fetching here
    ])
    setTimeout(() => {
      isLoading.value = false
    }, 500)
  } catch (error) {
    console.error('Error during initialization:', error)
    isLoading.value = false
  }
}

const updateLoadingProgress = (progress) => {
  loadingProgress.value = progress
}

onMounted(async () => {
  try {
    await new Promise(resolve => setTimeout(resolve, 100))
    updateLoadingProgress(100)
  } catch (error) {
    console.error('Error during app initialization:', error)
    isLoading.value = false
  }
})

// Add notifications data
const notifications = ref([
  {
    id: 1,
    title: 'pH Level Alert',
    message: 'pH level is above normal range (7.2)',
    icon: 'fas fa-exclamation-triangle text-warning',
    time: '2 minutes ago',
    read: false
  },
  {
    id: 2,
    title: 'Water Temperature',
    message: 'Water temperature is optimal (23°C)',
    icon: 'fas fa-thermometer-half text-success',
    time: '15 minutes ago',
    read: true
  },
  {
    id: 3,
    title: 'System Update',
    message: 'New system update available',
    icon: 'fas fa-sync text-info',
    time: '1 hour ago',
    read: false
  }
])

const showNotifications = ref(false)

// Update toggleNotifications function
const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
}

// ... rest of your existing script code ...
const themeIcon = computed(() => theme.isDark ? 'fas fa-sun' : 'fas fa-moon')

const notificationCount = ref(0)
const hasUnreadNotifications = ref(false)
const isMenuOpen = ref(false)
const floatingMenu = ref(null)
const menuPosition = ref({
  bottom: '2rem',
  right: '2rem'
})

let isDragging = false
let startX = 0
let startY = 0
let startPositionX = 0
let startPositionY = 0

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const startDrag = (e) => {
  if (e.target.closest('.menu-item')) return
  isDragging = true
  startX = e.clientX || e.touches[0].clientX
  startY = e.clientY || e.touches[0].clientY
  
  const rect = floatingMenu.value.getBoundingClientRect()
  startPositionX = rect.right
  startPositionY = rect.bottom
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('touchmove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchend', stopDrag)
}

const onDrag = (e) => {
  if (!isDragging) return
  
  const clientX = e.clientX || e.touches[0].clientX
  const clientY = e.clientY || e.touches[0].clientY
  
  const deltaX = clientX - startX
  const deltaY = clientY - startY
  
  const newRight = Math.max(10, Math.min(window.innerWidth - 66, startPositionX + deltaX))
  const newBottom = Math.max(10, Math.min(window.innerHeight - 66, startPositionY + deltaY))
  
  menuPosition.value = {
    right: `${window.innerWidth - newRight}px`,
    bottom: `${window.innerHeight - newBottom}px`
  }
}

const stopDrag = () => {
  isDragging = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchend', stopDrag)
}

onMounted(() => {
  const trigger = floatingMenu.value.querySelector('.floating-menu-trigger')
  trigger.addEventListener('mousedown', startDrag)
  trigger.addEventListener('touchstart', startDrag)
})

onUnmounted(() => {
  const trigger = floatingMenu.value?.querySelector('.floating-menu-trigger')
  trigger?.removeEventListener('mousedown', startDrag)
  trigger?.removeEventListener('touchstart', startDrag)
})

const router = useRouter()
const showLogoutConfirm = ref(false)

const confirmLogout = () => {
  isMenuOpen.value = false
  showLogoutConfirm.value = true
}

const handleLogout = () => {
  localStorage.removeItem('isAuthenticated')
  showLogoutConfirm.value = false
  router.push('/login')
}

// Toast notification system
const toast = ref({
  show: false,
  message: '',
  type: 'info', // 'success', 'error', 'warning', 'info'
  timeout: null
});

// Function to show toast messages
const showToast = (message, type = 'info', duration = 3000) => {
  // Clear any existing timeout
  if (toast.value.timeout) {
    clearTimeout(toast.value.timeout);
  }
  
  // Set toast properties
  toast.value.message = message;
  toast.value.type = type;
  toast.value.show = true;
  
  // Auto-hide after duration
  toast.value.timeout = setTimeout(() => {
    toast.value.show = false;
  }, duration);
};

// Get icon for toast type
const getToastIcon = (type) => {
  switch (type) {
    case 'success': return 'fas fa-check-circle';
    case 'error': return 'fas fa-exclamation-circle';
    case 'warning': return 'fas fa-exclamation-triangle';
    default: return 'fas fa-info-circle';
  }
};

// Make showToast available globally
window.showToast = showToast;

</script>

<style>
@import 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css';
@import 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
.app-container {
  min-height: 100vh;
  background: var(--bg-color);
  transition: background-color 0.3s ease;
}
:root {
  /* Light Mode - Forest/Mint Theme */
  --bg-color: #f4f9f4;
  --card-bg: rgba(255, 255, 255, 0.95);
  --card-header: linear-gradient(135deg, #52b788 0%, #40916c 100%);
  --text-color: #2d3047;
  --text-color-secondary: #495057;
  --accent-color: #40916c;
  --success-color: #52b788;
  --warning-color: #ffd166;
  --danger-color: #ef476f;
  --glass-effect: rgba(82, 183, 136, 0.1);
  --border-color: #e9ecef;
  --btn-control-light: linear-gradient(135deg, #52b788 0%, #40916c 100%);

  /* Keep existing dark mode specific variables */
  --card-header-dark: linear-gradient(135deg, #0077b6 0%, #0096c7 100%);
  --input-bg-dark: linear-gradient(135deg, #0077b6 0%, #0096c7 100%);
  --text-color-dark: #caf0f8;
  --text-muted-dark: #90e0ef;
}

body {
  background: var(--bg-color);
  color: var(--text-color);
  transition: all 0.3s ease;
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  transition: all 0.3s ease;
}

.dark-mode {
  --bg-color: #1a1a2e;
  --card-bg: #162447;
  --card-header: linear-gradient(135deg, #0077b6 0%, #0096c7 100%);
  --text-color: #e9ecef;
  --text-color-secondary: #adb5bd;
  --accent-color: linear-gradient(135deg, #0077b6 0%, #0096c7 100%);
  --border-color: #2a2a4a;
  --glass-effect: rgba(0, 0, 0, 0.2);
}

.dark-mode body {
  background: var(--bg-color);
  color: var(--text-color);
}

.dark-mode .card {
  background: var(--card-bg);
  border-color: var(--border-color);
}

.dark-mode .card-header {
  background: var(--card-header);
  color: var(--text-color);
  border-bottom: 1px solid var(--border-color);
}

.dark-mode .card-body {
  color: var(--text-color);
}

.dark-mode h1, 
.dark-mode h2, 
.dark-mode h3, 
.dark-mode h4, 
.dark-mode h5, 
.dark-mode h6 {
  color: var(--text-color);
}

  /* Dark Mode (Sun) */
  .dark-mode #theme-icon.fa-sun {
    color: yellow;
  }
  
  .dark-mode #theme-toggle:hover {
    background: yellow;
  }
  
  .dark-mode #theme-toggle:hover #theme-icon.fa-sun {
    color: black;
  }
  
  .dark-mode .form-select, .dark-mode .form-control, .dark-mode .list-group .list-group-item {
    background-color: var(--card-header-dark) !important;
    border: 1px solid #0096c7;
    color: var(--text-color-dark) !important;
  }
  
  .dark-mode select option {
    background-color: #023e8a !important;
    color: var(--text-color-dark) !important;
  }
  
  .dark-mode .form-control:focus {
    background-color: var(--input-bg-dark);
    border-color: #90e0ef;
    box-shadow: 0 0 0 0.2rem rgba(144, 224, 239, 0.25);
  }
  
    /* Adjust the plus/minus buttons */
    .dark-mode .btn-control {
    background: linear-gradient(135deg, #0077b6 0%, #0096c7 100%);
    border: none;
    color: white;
    transition: all 0.3s ease;
  }
  
  .dark-mode .btn-control:hover {
    background: linear-gradient(135deg, #028dd8 0%, #0ab2eb 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
  
  .dark-mode .text-muted {
    color: var(--text-muted-dark) !important;
  }
  
  .dark-mode .form-label, .dark-mode .form-control::placeholder {
    color: var(--text-color-dark) !important;
  }
  
  .dark-mode input[type="number"], .dark-mode input[type="time"], .dark-mode input[type="text"], .dark-mode input[type="password"], .dark-mode input[type="email"], .dark-mode input[type="url"], .dark-mode input[type="search"], .dark-mode input[type="tel"], .dark-mode input[type="date"], .dark-mode input[type="month"], .dark-mode input[type="week"], .dark-mode input[type="datetime-local"], .dark-mode select, .dark-mode textarea {
    background-color: var(--card-header-dark);
    border: 1px solid #0096c7;
    color: var(--text-color-dark);
  }
  
  .dark-mode input[type="number"]::placeholder, .dark-mode input[type="time"]::placeholder, .dark-mode input[type="text"]::placeholder, .dark-mode input[type="password"]::placeholder, .dark-mode input[type="email"]::placeholder, .dark-mode input[type="url"]::placeholder, .dark-mode input[type="search"]::placeholder, .dark-mode input[type="tel"]::placeholder, .dark-mode input[type="date"]::placeholder, .dark-mode input[type="month"]::placeholder, .dark-mode input[type="week"]::placeholder, .dark-mode input[type="datetime-local"]::placeholder, .dark-mode select::placeholder, .dark-mode textarea::placeholder {
    color: var(--text-color-dark);
  }
  
  .dark-mode input[type="number"]:focus, .dark-mode input[type="time"]:focus, .dark-mode input[type="text"]:focus, .dark-mode input[type="password"]:focus, .dark-mode input[type="email"]:focus, .dark-mode input[type="url"]:focus, .dark-mode input[type="search"]:focus, .dark-mode input[type="tel"]:focus, .dark-mode input[type="date"]:focus, .dark-mode input[type="month"]:focus, .dark-mode input[type="week"]:focus, .dark-mode input[type="datetime-local"]:focus, .dark-mode select:focus, .dark-mode textarea:focus {
    background-color: var(--input-bg-dark);
    border-color: #90e0ef;
    box-shadow: 0 0 0 0.2rem rgba(144, 224, 239, 0.25);
  }
/* Custom Switch Styles */
.switch {
  position: relative;
  display: inline-block;
  width: 46px;
  height: 24px;
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
  background-color: var(--text-color-secondary);
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
}

.switch input:checked + .slider {
  background: var(--accent-color);
}

.dark-mode .switch input:checked + .slider {
  background: linear-gradient(135deg, #0077b6 0%, #0096c7 100%);
}

.switch input:checked + .slider:before {
  transform: translateX(22px);
}

.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}

/* Remove the old form-check-input styles */
.form-check-input {
  display: none;
}

/* Add to existing styles */
.floating-menu {
  position: fixed;
  z-index: 1000;
  user-select: none;
  touch-action: none;
}

.floating-menu-trigger {
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
  cursor: move;
  transition: all 0.3s ease;
}

.floating-menu-items {
  position: absolute;
  bottom: 70px;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  opacity: 0;
  transform: scale(0.5);
  transform-origin: bottom right;
  transition: all 0.3s ease;
  pointer-events: none;
}

.floating-menu-items.is-open {
  opacity: 1;
  transform: scale(1);
  pointer-events: all;
}

.menu-item {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--card-bg);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  cursor: pointer;
  position: relative;
  text-decoration: none;
  transition: all 0.3s ease;
}

.menu-item:hover {
  transform: scale(1.1);
  background: var(--card-header);
  color: white;
}

.notification-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: var(--danger-color);
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dark-mode .menu-item {
  background: var(--card-bg);
  color: var(--text-color);
  border-color: var(--border-color);
}

.dark-mode .menu-item:hover {
  background: var(--card-header);
}

/* Add to your existing styles */
.notifications-panel {
  position: fixed;
  top: 0;
  right: -350px;
  width: 350px;
  height: 100vh;
  background: var(--card-bg);
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  transition: right 0.3s ease;
  z-index: 1100;
}

.notifications-panel.is-open {
  right: 0;
}

.notifications-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notifications-list {
  overflow-y: auto;
  height: calc(100vh - 60px);
}

.notification-item {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  gap: 1rem;
  transition: all 0.3s ease;
}

.notification-item.unread {
  background: var(--glass-effect);
}

.notification-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--card-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.notification-content {
  flex: 1;
}

.notification-title {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.notification-message {
  font-size: 0.9rem;
  color: var(--text-color-secondary);
  margin-bottom: 0.25rem;
}

.notification-time {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

/* Update existing menu-item styles */
.menu-item i {
  transition: transform 0.3s ease;
}

.menu-item:hover i {
  transform: scale(1.2);
}

.dark-mode .notifications-panel {
  background: var(--card-bg);
  border-left: 1px solid var(--border-color);
}

/* Update table styles for dark mode */
.dark-mode .table {
  color: var(--text-color);
  border-color: var(--border-color);
}

.dark-mode .table thead th {
  background: var(--card-header);
  color: var(--text-color);
  border-bottom: 2px solid var(--border-color);
}

.dark-mode .table td {
  border-color: var(--border-color);
  color: var(--text-color);
}

.dark-mode .table tbody tr:hover {
  background-color: var(--glass-effect);
}

.dark-mode .table-hover tbody tr:hover {
  background-color: var(--glass-effect);
}

/* Add chart styles for dark mode */
.dark-mode .chart-container {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
}

.dark-mode canvas {
  filter: brightness(0.9) contrast(1.1);
}

/* Update loading overlay for dark mode */
.dark-mode .chart-overlay {
  background: rgba(0, 0, 0, 0.7);
}

.dark-mode .spinner-border {
  color: var(--text-color);
}

/* Update scrollbar for dark mode */
.dark-mode .table-responsive::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.dark-mode .table-responsive::-webkit-scrollbar-track {
  background: var(--card-bg);
}

.dark-mode .table-responsive::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.dark-mode .table-responsive::-webkit-scrollbar-thumb:hover {
  background: var(--text-color-secondary);
}

/* Add text color transitions */
.table,
.table th,
.table td,
.chart-container {
  transition: all 0.3s ease;
}

/* Confirmation Dialog Styles */
.confirmation-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
}

.confirmation-content {
  background: var(--card-bg);
  padding: 1.5rem;
  border-radius: 12px;
  text-align: center;
  max-width: 300px;
  width: 90%;
}

.confirmation-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1.5rem;
}

.confirm-btn,
.cancel-btn {
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.confirm-btn {
  background: var(--danger-color);
  color: white;
}

.confirm-btn:hover {
  background: #ff5c8a;
  transform: translateY(-1px);
}

.cancel-btn {
  background: var(--border-color);
  color: var(--text-color);
}

.cancel-btn:hover {
  background: #e0e0e0;
  transform: translateY(-1px);
}

.dark-mode .confirmation-content {
  background: var(--card-bg);
  color: var(--text-color);

  
}

.dark-mode .cancel-btn {
  background: var(--card-header);
  color: var(--text-color);
}

.dark-mode .cancel-btn:hover {
  background: #1a1a2e;
}

/* Add these dark mode styles for login page */
.dark-mode .login-container {
  background: var(--bg-color);
}

.dark-mode .login-card {
  background: var(--card-bg);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.dark-mode .login-header h1 {
  color: var(--text-color);
}

.dark-mode .tab-btn {
  background: var(--card-header);
  color: var(--text-color-secondary);
}

.dark-mode .tab-btn.active {
  background: linear-gradient(135deg, #0077b6 0%, #0096c7 100%);
  color: white;
  box-shadow: 0 4px 6px rgba(0, 119, 182, 0.2);
}

.dark-mode .pattern-instruction {
  color: var(--text-color);
}

.dark-mode .pattern-dot .dot-center {
  background: var(--border-color);
}

.dark-mode .pattern-dot.active .dot-center {
  background: #0096c7;
  box-shadow: 0 0 15px rgba(0, 150, 199, 0.3);
}

.dark-mode .pattern-dot.error.active .dot-center {
  background: var(--danger-color);
  box-shadow: 0 0 15px rgba(239, 71, 111, 0.3);
}

.dark-mode .pattern-lines line {
  stroke: #0096c7;
}

.dark-mode .pin-digit {
  background: var(--border-color);
}

.dark-mode .pin-digit.filled {
  background: #0096c7;
}

.dark-mode .pin-button {
  background: var(--card-header);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.dark-mode .pin-button:hover {
  background: linear-gradient(135deg, #0077b6 0%, #0096c7 100%);
  color: white;
}

.dark-mode .pin-button:disabled {
  background: var(--border-color);
  color: var(--text-color-secondary);
  opacity: 0.5;
}

/* Global Toast notification system */
.global-toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  max-width: 350px;
  width: 100%;
}

.global-toast-message {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  margin-bottom: 10px;
  animation: toast-slide-in 0.3s ease-out forwards;
  background: white;
  border-left: 4px solid;
}

.global-toast-message.success {
  border-left-color: var(--success-color, #52b788);
}

.global-toast-message.error {
  border-left-color: var(--danger-color, #e63946);
}

.global-toast-message.warning {
  border-left-color: var(--warning-color, #ffb703);
}

.global-toast-message.info {
  border-left-color: var(--info-color, #00b4d8);
}

.global-toast-icon {
  margin-right: 12px;
  font-size: 18px;
}

.global-toast-message.success .global-toast-icon {
  color: var(--success-color, #52b788);
}

.global-toast-message.error .global-toast-icon {
  color: var(--danger-color, #e63946);
}

.global-toast-message.warning .global-toast-icon {
  color: var(--warning-color, #ffb703);
}

.global-toast-message.info .global-toast-icon {
  color: var(--info-color, #00b4d8);
}

.global-toast-content {
  flex: 1;
  font-size: 14px;
}

.global-toast-close {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  margin-left: 8px;
  color: #666;
}

@keyframes toast-slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Dark mode adjustments */
.dark-mode .global-toast-message {
  background-color: #333;
  color: #eee;
}

.dark-mode .global-toast-close {
  color: #bbb;
}
</style>