import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'

const routes = [
  {
    path: '/',
    redirect: '/login'  // Redirect root to login
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: {
      requiresAuth: false
    }
  },
  {
    path: '/home',
    name: 'Home',
    component: Home,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/monitoring',
    name: 'Monitoring',
    component: () => import('@/views/Sensors.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/control',
    name: 'Control',
    component: () => import('@/views/Actuators.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/analytics',
    name: 'Analytics',
    component: () => import('@/views/Analytics.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('@/views/HistoryView.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/automation',
    name: 'Automation',
    component: () => import('@/views/Sensors.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/schedule',
    name: 'Schedule',
    component: () => import('@/views/Actuators.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login'  // Catch all route redirects to login
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Update navigation guard to reflect new routing structure
router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true'
  
  // Handle login page access
  if (to.path === '/login') {
    if (isAuthenticated) {
      next('/home')  // Redirect to home if already authenticated
    } else {
      next()
    }
    return
  }

  // Check authentication for protected routes
  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!isAuthenticated) {
      next('/login')
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router