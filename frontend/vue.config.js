const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        logLevel: 'debug'
      },
      '/plant-images': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
