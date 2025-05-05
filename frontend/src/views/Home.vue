<template>
  <div class="home-container">
    <div class="hero-section">
      <img src="@/assets/ecoponicslogo.png" alt="Ecoponics Logo" class="logo">
      <h1 class="brand-title">ECOPONICS</h1>
      <h6 class="brand-subtitle">Solar-Powered IoT-Based Hydroponics System</h6>
      <div class="hero-divider"></div>
    </div>

    <div class="container py-1">
      <div class="row g-4 justify-content-center">
        <!-- Monitoring Card -->
        <div class="col-md-6 col-lg-4">
          <router-link to="/dashboard" class="nav-card">
            <div class="card h-100">
              <div class="card-body text-center">
                <div class="icon-wrapper">
                  <i class="fas fa-desktop"></i>
                </div>
                <h3 class="card-title">Monitoring</h3>
                <p class="card-text">Real-time system monitoring and control dashboard</p>
              </div>
            </div>
          </router-link>
        </div>

        <!-- Automation & Sensors Card -->
        <div class="col-md-6 col-lg-4">
          <router-link to="/automation" class="nav-card">
            <div class="card h-100">
              <div class="card-body text-center">
                <div class="icon-wrapper">
                  <i class="fas fa-microchip"></i>
                </div>
                <h3 class="card-title">Automation & Sensors</h3>
                <p class="card-text">Configure system automations and sensor settings</p>
              </div>
            </div>
          </router-link>
        </div>

        <!-- Historical Data Card -->
        <div class="col-md-6 col-lg-4">
          <router-link to="/history" class="nav-card">
            <div class="card h-100">
              <div class="card-body text-center">
                <div class="icon-wrapper">
                  <i class="fas fa-chart-line"></i>
                </div>
                <h3 class="card-title">Historical Data</h3>
                <p class="card-text">View and analyze historical sensor data</p>
              </div>
            </div>
          </router-link>
        </div>

        <!-- Scheduling Card -->
        <div class="col-md-6 col-lg-4">
          <router-link to="/schedule" class="nav-card">
            <div class="card h-100">
              <div class="card-body text-center">
                <div class="icon-wrapper">
                  <i class="fas fa-calendar-alt"></i>
                </div>
                <h3 class="card-title">Scheduling</h3>
                <p class="card-text">Manage system schedules and automations</p>
              </div>
            </div>
          </router-link>
        </div>

        <!-- Analytics Card -->
        <div class="col-md-6 col-lg-4">
          <router-link to="/analytics" class="nav-card">
            <div class="card h-100">
              <div class="card-body text-center">
                <div class="icon-wrapper">
                  <i class="fas fa-microscope"></i>
                </div>
                <h3 class="card-title">Analytics</h3>
                <p class="card-text">Advanced analytics and growth insights</p>
              </div>
            </div>
          </router-link>
        </div>

        <!-- Settings Card -->
        <div class="col-md-6 col-lg-4">
          <router-link to="/settings" class="nav-card">
            <div class="card h-100">
              <div class="card-body text-center">
                <div class="icon-wrapper">
                  <i class="fas fa-cog"></i>
                </div>
                <h3 class="card-title">Settings</h3>
                <p class="card-text">System configuration and preferences</p>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </div>
  </div>
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
.home-container {
  min-height: 100vh;
  background: var(--bg-gradient);
  padding-bottom: 2rem;
}

.hero-section {
  text-align: center;
  padding: 3rem 0;
  background: linear-gradient(180deg, var(--card-bg) 0%, transparent 100%);
}

.logo {
  width: 120px;
  height: 120px;
  margin-bottom: 1.5rem;
  animation: float 6s ease-in-out infinite;
}

.brand-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  background: var(--card-header);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
}

.brand-subtitle {
  color: var(--text-color-secondary);
  font-size: 1.1rem;
  font-weight: 500;
  margin-bottom: 2rem;
}

.hero-divider {
  width: 60px;
  height: 4px;
  background: var(--accent-color);
  margin: 0 auto;
  border-radius: 2px;
}

.nav-card {
  text-decoration: none;
  color: inherit;
  display: block;
  transition: all 0.3s ease;
}

.nav-card:hover {
  transform: translateY(-5px);
}

.nav-card:hover .icon-wrapper {
  transform: scale(1.1);
}

.card {
  border: none;
  border-radius: 20px;
  background: var(--card-bg);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.card-body {
  padding: 2rem;
}

.icon-wrapper {
  width: 64px;
  height: 64px;
  background: var(--glass-effect);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  transition: transform 0.3s ease;
}

.card i {
  font-size: 1.8rem;
  color: var(--accent-color);
}

.card-title {
  font-size: 1.4rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-color);
}

.card-text {
  color: var(--text-color-secondary);
  font-size: 0.95rem;
  line-height: 1.5;
}

@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}

/* Dark mode adjustments */
:deep(.dark-mode) .hero-section {
  background: linear-gradient(180deg, var(--card-bg) 0%, transparent 100%);
}

:deep(.dark-mode) .card {
  background: var(--card-bg);
}

:deep(.dark-mode) .icon-wrapper {
  background: rgba(255, 255, 255, 0.05);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .hero-section {
    padding: 2rem 0;
  }

  .logo {
    width: 100px;
    height: 100px;
  }

  .brand-title {
    font-size: 2rem;
  }

  .brand-subtitle {
    font-size: 1rem;
  }

  .card-body {
    padding: 1.5rem;
  }

  .icon-wrapper {
    width: 56px;
    height: 56px;
  }
}
</style>