import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    isDark: localStorage.getItem('darkMode') === 'true'
  }),
  actions: {
    toggleTheme() {
      this.isDark = !this.isDark
      localStorage.setItem('darkMode', this.isDark)
    }
  }
})