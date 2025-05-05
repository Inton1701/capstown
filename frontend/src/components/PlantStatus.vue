<template>
  <div class="col-md-6 mb-4">
    <div class="h-100 card">
      <div class="card-header">
        <div class="d-flex justify-content-between align-items-center">
          <h5 class="mb-0"><i class="fas fa-seedling icon-animate me-1"></i> Plant Status</h5>
          <span class="last-checked" v-if="plant.lastChecked">
            <i class="fas fa-clock me-1 text-light"></i>
            Last checked: {{ formatLastChecked }}
          </span>
        </div>
      </div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-6">
            <div class="plant-image-container">
              <div class="image-wrapper">
                <img :src="imageUrl" alt="Plant Status" class="plant-image">
              </div>
              <div class="action-buttons">
                <button class="analyze-btn" @click="openWebcam">
                  <i class="fas fa-camera"></i>
                  Camera
                </button>
              </div>
            </div>
            
            <!-- Add image history preview if available -->
            <div class="previous-image-container mt-3" v-if="plant.imageHistory && plant.imageHistory.length > 0">
              <h6 class="text-muted mb-2">
                <i class="fas fa-history me-1"></i> Previous Analysis
              </h6>
              <div class="d-flex">
                <div class="previous-image">
                  <img :src="plant.imageHistory[0].imageData" alt="Previous Plant Image" class="previous-plant-image">
                  <div class="previous-stage-badge">
                    {{ plant.imageHistory[0].growthStage.name }}
                  </div>
                  <div class="previous-date-badge">
                    {{ formatHistoryDate(plant.imageHistory[0].timestamp) }}
                  </div>
                </div>
                <div class="ms-3 d-flex flex-column justify-content-center">
                  <div class="previous-accuracy" v-if="plant.imageHistory[0].predictions.accuracy">
                    Accuracy: {{ plant.imageHistory[0].predictions.accuracy }}%
                  </div>
                  <button class="btn btn-sm btn-outline-primary mt-2" @click="showImageHistory = true">
                    View All History
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="plant-metrics">
              <!-- Health Status -->
              <div class="metric-card" :class="`border-${plant.health.status}`">
                <div class="metric-header">
                  <i class="fas fa-heart"></i>
                  <span>Plant Health</span>
                </div>
                <div class="metric-value">
                  {{ plant.health.message }}
                  <span class="emoji">{{ plant.health.emoji }}</span>
                </div>
              </div>

              <!-- Growth Stage -->
              <div class="metric-card growth-stage">
                <div class="metric-header">
                  <i class="fas fa-seedling"></i>
                  <span>Growth Stage</span>
                  <span class="accuracy-pill" v-if="plant.predictions && plant.predictions.accuracy">
                    {{ plant.predictions.accuracy }}% accurate
                  </span>
                </div>
                <div class="metric-value">
                  <div class="stage-indicator" :class="`bg-${plant.growthStage.color}`">
                    {{ plant.growthStage.name }}
                  </div>
                </div>
              </div>

              <!-- Growth Metrics -->
              <div class="metrics-grid">
                <div class="metric-card">
                  <div class="metric-header">
                    <i class="fas fa-ruler-vertical"></i>
                    <span>Height</span>
                  </div>
                  <div class="metric-value">{{ plant.metrics.height }} cm</div>
                </div>

                <div class="metric-card">
                  <div class="metric-header">
                    <i class="fas fa-chart-line"></i>
                    <span>Growth Rate</span>
                  </div>
                  <div class="metric-value">{{ plant.metrics.growthRate }} cm/day</div>
                </div>

                <div class="metric-card">
                  <div class="metric-header">
                    <i class="fas fa-calendar-alt"></i>
                    <span>Age</span>
                  </div>
                  <div class="metric-value">{{ plant.metrics.age }} days</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Replace the predictions detail section with a simplified accuracy display -->
        <div class="row mt-4" v-if="plant.predictions && plant.predictions.accuracy">
          <div class="col-12">
            <div class="accuracy-section">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="text-muted mb-0">
                  <i class="fas fa-check-circle me-2"></i>
                  Analysis Accuracy
                </h6>
              </div>
              
              <!-- Enhanced accuracy meter -->
              <div class="accuracy-meter-enhanced">
                <div class="accuracy-level-enhanced" :style="{ width: `${plant.predictions.accuracy}%` }">
                  <span class="accuracy-value-enhanced">{{ plant.predictions.accuracy }}%</span>
                </div>
                <div class="accuracy-markers-enhanced">
                  <div class="marker-enhanced" style="left: 25%">25%</div>
                  <div class="marker-enhanced" style="left: 50%">50%</div>
                  <div class="marker-enhanced" style="left: 75%">75%</div>
                  <div class="marker-enhanced" style="left: 95%">100%</div>
                </div>
              </div>
              
              <!-- Optional confidence note -->
              <div class="accuracy-note" v-if="plant.predictions.accuracy >= 80">
                <i class="fas fa-star text-warning me-1"></i>
                High confidence in growth stage identification
              </div>
              <div class="accuracy-note" v-else-if="plant.predictions.accuracy >= 50">
                <i class="fas fa-info-circle text-info me-1"></i>
                Moderate confidence in growth stage identification
              </div>
              <div class="accuracy-note" v-else>
                <i class="fas fa-exclamation-triangle text-warning me-1"></i>
                Low confidence - consider taking another image
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Webcam Modal -->
  <div class="modal fade" id="webcamModal" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Analyze Plant Growth</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" @click="closeWebcam"></button>
        </div>
        <div class="modal-body">
          <div class="webcam-container">
            <video ref="webcamVideo" class="webcam-video" autoplay playsinline></video>
            <canvas ref="webcamCanvas" style="display: none;"></canvas>
            <div class="capture-overlay" v-if="isProcessing">
              <div class="spinner-border text-light" role="status">
                <span class="visually-hidden">Analyzing...</span>
              </div>
            </div>
          </div>
          
          <!-- Add upload option in modal -->
          <div class="upload-container mt-3">
            <div class="d-flex align-items-center">
              <div class="divider-text">OR</div>
            </div>
            <button class="btn btn-outline-secondary w-100" @click="triggerFileUpload">
              <i class="fas fa-upload me-2"></i>
              Upload from device
            </button>
            <input 
              type="file" 
              ref="fileInput" 
              @change="handleFileUpload"
              accept="image/*" 
              style="display: none"
            >
            <div class="upload-hint text-muted mt-2">
              <small><i class="fas fa-info-circle me-1"></i> Upload a clear image of your plant for best analysis results</small>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="closeWebcam">Cancel</button>
          <button type="button" class="btn btn-primary" @click="captureImage" :disabled="isProcessing">
            <i class="fas" :class="isProcessing ? 'fa-spinner fa-spin' : 'fa-camera'"></i>
            {{ isProcessing ? 'Analyzing...' : 'Capture & Analyze' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Image History Modal -->
  <div class="modal fade" id="imageHistoryModal" tabindex="-1" v-if="showImageHistory">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Plant Growth History</h5>
          <button type="button" class="btn-close" @click="showImageHistory = false"></button>
        </div>
        <div class="modal-body">
          <div class="image-history-grid" v-if="plant.imageHistory && plant.imageHistory.length > 0">
            <div class="history-item" v-for="(item, index) in plant.imageHistory" :key="index">
              <div class="history-image-container">
                <img :src="item.imageData" :alt="`Plant at ${item.growthStage.name}`" class="history-image">
                <div class="history-stage-badge" :class="`bg-${item.growthStage.color}`">
                  {{ item.growthStage.name }}
                </div>
              </div>
              <div class="history-details">
                <div class="history-date">{{ formatHistoryDate(item.timestamp) }}</div>
                <div class="history-accuracy" v-if="item.predictions.accuracy">
                  Accuracy: {{ item.predictions.accuracy }}%
                </div>
              </div>
            </div>
          </div>
          <div class="text-center p-5" v-else>
            <p class="text-muted">No image history available</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { Modal } from 'bootstrap'

const webcamVideo = ref(null)
const webcamCanvas = ref(null)
const webcamStream = ref(null)
const isProcessing = ref(false)
let webcamModal = null

const plant = ref({
  image: require('@/assets/downloads.jpg'),
  lastChecked: new Date(),
  health: {
    status: 'success',
    message: 'Healthy',
    emoji: '🌱'
  },
  growthStage: {
    name: 'Vegetative',
    color: 'primary'
  },
  metrics: {
    height: 45,
    growthRate: 2.5,
    age: 28
  }
})

// Add a function to fetch the latest plant data
const fetchPlantData = async () => {
  try {
    const baseUrl = process.env.VUE_APP_API_URL || '/api';
    const response = await fetch(`${baseUrl}/plant/status`);
    
    if (!response.ok) {
      console.error('Error fetching plant data:', response.statusText);
      return;
    }
    
    const result = await response.json();
    if (result.success && result.data) {
      plant.value = result.data;
      console.log('Loaded latest plant data:', plant.value);
    }
  } catch (error) {
    console.error('Failed to load plant data:', error);
  }
}

// Add a computed property for the image URL
const imageUrl = computed(() => {
  // First check if we have base64 image data in MongoDB
  if (plant.value.imageData) {
    return plant.value.imageData;
  }
  
  // Fall back to file path if no base64 data
  if (plant.value.image && typeof plant.value.image === 'string' && plant.value.image.startsWith('/plant-images/')) {
    // Extract the base URL without the '/api' suffix
    const baseUrl = process.env.VUE_APP_API_URL 
      ? process.env.VUE_APP_API_URL.replace('/api', '') 
      : 'http://192.168.254.185:5000';
    
    console.log('Loading plant image from:', `${baseUrl}${plant.value.image}`);
    return `${baseUrl}${plant.value.image}`;
  }
  
  // For assets or other images, use as is
  return plant.value.image;
})

// Add this computed property
const formatLastChecked = computed(() => {
  if (!plant.value.lastChecked) return ''
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    month: 'short',
    day: 'numeric'
  }).format(new Date(plant.value.lastChecked))
})

// Webcam handling methods
const openWebcam = async () => {
  try {
    // Initialize webcam modal if not already done
    if (!webcamModal) {
      const modalElement = document.getElementById('webcamModal');
      if (modalElement) {
        webcamModal = new Modal(modalElement);
      } else {
        console.error('Webcam modal element not found');
        return;
      }
    }
    
    webcamModal.show();
    
    // Start webcam only after modal is visible
    setTimeout(async () => {
      try {
        if (!webcamVideo.value) {
          console.warn('Webcam video element not found');
          return;
        }
        
        webcamStream.value = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        
        // Only set srcObject if both stream and video element exist
        if (webcamStream.value && webcamVideo.value) {
          webcamVideo.value.srcObject = webcamStream.value;
        }
      } catch (error) {
        console.error('Error accessing webcam:', error);
        alert('Unable to access camera. Please check permissions or try uploading an image instead.');
      }
    }, 500);
  } catch (error) {
    console.error('Error opening webcam modal:', error);
  }
}

const closeWebcam = () => {
  // Stop webcam stream if it exists
  if (webcamStream.value) {
    webcamStream.value.getTracks().forEach(track => track.stop());
    webcamStream.value = null;
  }
  
  // Clear video source safely with null check
  if (webcamVideo.value) {
    webcamVideo.value.srcObject = null;
  }
  
  // Hide modal if it exists
  if (webcamModal) {
    webcamModal.hide();
  }
}

const captureImage = async () => {
  isProcessing.value = true
  
  try {
    // Capture frame from webcam
    const video = webcamVideo.value
    const canvas = webcamCanvas.value
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    
    // Convert to blob
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/jpeg')
    })

    // Create form data for API
    const formData = new FormData()
    formData.append('image', blob, 'plant.jpg')

    // Use the API URL from environment variables
    const baseUrl = process.env.VUE_APP_API_URL || '/api';
    const apiUrl = `${baseUrl}/plant/analyze-image`;
    
    console.log('Sending plant image to:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      console.error('API error:', await response.text());
      throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json()
    
    if (result.success && result.data) {
      // Update plant data with analysis results
      plant.value = result.data
    } else {
      throw new Error(result.message || 'Analysis failed')
    }

    closeWebcam()
  } catch (error) {
    console.error('Error analyzing image:', error)
    alert('Failed to analyze image. Please try again.')
  } finally {
    isProcessing.value = false
  }
}

const fileInput = ref(null)

// Trigger the hidden file input
const triggerFileUpload = () => {
  fileInput.value.click()
}

// Handle file selection
const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  isProcessing.value = true
  
  try {
    // Create form data
    const formData = new FormData()
    formData.append('image', file, file.name)
    
    // Use the API URL from environment variables
    const baseUrl = process.env.VUE_APP_API_URL || '/api';
    const apiUrl = `${baseUrl}/plant/analyze-image`;
    
    console.log('Sending uploaded plant image to:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      console.error('API error:', await response.text());
      throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json()
    
    if (result.success && result.data) {
      // Update plant data with analysis results
      plant.value = result.data
    } else {
      throw new Error(result.message || 'Analysis failed')
    }
    
    // Reset file input for future uploads
    event.target.value = ''
    
    // Close the modal after successful upload
    closeWebcam();
  } catch (error) {
    console.error('Error analyzing uploaded image:', error)
    alert('Failed to analyze uploaded image. Please try again.')
  } finally {
    isProcessing.value = false
  }
}

const showImageHistory = ref(false);

// Format history date
const formatHistoryDate = (dateString) => {
  if (!dateString) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(new Date(dateString));
}

// Initialize modal when component is mounted
onMounted(() => {
  // Fetch initial plant data
  fetchPlantData();
  
  // Get modal element with null check
  const modalElement = document.getElementById('webcamModal');
  if (modalElement) {
    // Initialize webcam modal with proper event listeners
    webcamModal = new Modal(modalElement);
    
    // Handle modal hidden event to ensure camera is properly shut down
    // Use a safer approach with removeEventListener before adding
    const safeCloseWebcam = () => {
      if (webcamStream.value) {
        webcamStream.value.getTracks().forEach(track => track.stop());
        webcamStream.value = null;
      }
      
      if (webcamVideo.value) {
        webcamVideo.value.srcObject = null;
      }
    };
    
    // Remove any existing event listener to avoid duplicates
    modalElement.removeEventListener('hidden.bs.modal', safeCloseWebcam);
    // Add event listener
    modalElement.addEventListener('hidden.bs.modal', safeCloseWebcam);
  }
  
  // Watch for changes to showImageHistory
  watch(showImageHistory, (newVal) => {
    if (newVal) {
      const historyModal = document.getElementById('imageHistoryModal');
      if (historyModal) {
        new Modal(historyModal).show();
      }
    }
  });
})

onUnmounted(() => {
  // Ensure webcam is closed when component is unmounted
  if (webcamStream.value) {
    webcamStream.value.getTracks().forEach(track => track.stop());
    webcamStream.value = null;
  }
  
  // Clean up modal event listener with null checks
  const modalElement = document.getElementById('webcamModal');
  if (modalElement) {
    modalElement.removeEventListener('hidden.bs.modal', closeWebcam);
  }
})
</script>

<style scoped>
.plant-image-container {
  position: relative;
  margin-bottom: 1rem;
  border-radius: 8px;
  overflow: hidden;
  background: var(--card-bg);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.image-wrapper {
  width: 100%;
  aspect-ratio: 4/3;
  overflow: hidden;
}

.plant-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.plant-image:hover {
  transform: scale(1.05);
}

.growth-stage {
  margin-top: 1rem;
}

.stage-indicator {
  display: inline-block;
  padding: 0.5rem 1rem;
  color: white;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.plant-metrics {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.metric-card {
  padding: 1rem;
  border-radius: 8px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
}

.metric-card.border-success {
  border-left: 4px solid var(--success-color);
}

.metric-card.border-warning {
  border-left: 4px solid var(--warning-color);
}

.metric-card.border-danger {
  border-left: 4px solid var(--danger-color);
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-color-secondary);
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.metric-value {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-color);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-top: 1rem;
}

.emoji {
  font-size: 1.4rem;
  margin-left: 0.5rem;
}

.icon-animate {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

/* Add to existing styles */
.analyze-btn {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 20px;
  padding: 0.5rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  z-index: 1;
}

.analyze-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.webcam-container {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.webcam-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.capture-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Add these styles */
.last-checked {
  font-size: 0.85rem;
  color: white;
  background: var(--glass-effect);
  padding: 0.25rem 0.75rem;
  border-radius: 16px;
}

.last-checked i {
  color: var(--accent-color);
}

/* Update the button styles */
.action-buttons {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  gap: 0.5rem;
  z-index: 1;
}

.analyze-btn, .upload-btn {
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 20px;
  padding: 0.5rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.analyze-btn:hover, .upload-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.upload-btn {
  background: var(--secondary-color, #6c757d);
}

/* Enhanced accuracy display */
.accuracy-section {
  background: var(--card-bg);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  margin-top: 1rem;
}

.accuracy-meter-enhanced {
  height: 24px;
  background: #eee;
  border-radius: 12px;
  position: relative;
  margin-top: 1rem;
  margin-bottom: 2rem;
  overflow: hidden;
}

.accuracy-level-enhanced {
  height: 100%;
  background: linear-gradient(90deg, #f7b731 0%, #4caf50 100%);
  border-radius: 12px;
  transition: width 1s ease-out;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 10px;
}

.accuracy-value-enhanced {
  color: white;
  font-weight: 700;
  font-size: 0.9rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.accuracy-markers-enhanced {
  position: relative;
  height: 20px;
}

.marker-enhanced {
  position: absolute;
  top: 4px;
  transform: translateX(-50%);
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.accuracy-note {
  text-align: center;
  margin-top: 1rem;
  padding: 0.5rem;
  border-radius: 8px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  font-size: 0.9rem;
  color: var(--text-color);
}

/* Make the accuracy badge more prominent */
.accuracy-badge {
  background: linear-gradient(135deg, #4caf50, #2196f3);
  font-weight: 500;
  transition: all 0.3s ease;
  transform-origin: center;
  animation: pulse-accuracy 2s infinite;
}

.accuracy-badge:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

@keyframes pulse-accuracy {
  0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
  70% { box-shadow: 0 0 0 5px rgba(76, 175, 80, 0); }
  100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
}

/* Previous image styles */
.previous-image-container {
  background: var(--card-bg);
  border-radius: 8px;
  padding: 0.8rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.previous-image {
  position: relative;
  width: 100px;
  height: 75px;
  border-radius: 4px;
  overflow: hidden;
}

.previous-plant-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.previous-stage-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  background: var(--accent-color);
  color: white;
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  border-radius: 10px;
}

.previous-date-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  border-radius: 10px;
}

.previous-accuracy {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

/* Image history modal styles */
.image-history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.history-item {
  background: var(--card-bg);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.history-image-container {
  position: relative;
  width: 100%;
  height: 150px;
}

.history-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.history-stage-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  color: white;
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
}

.history-details {
  padding: 0.8rem;
}

.history-date {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

.history-accuracy {
  font-size: 0.8rem;
  color: var(--accent-color);
  font-weight: 600;
}

/* Upload container in modal */
.upload-container {
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.divider-text {
  width: 100%;
  text-align: center;
  position: relative;
  margin: 1rem 0;
  color: var(--text-color-secondary);
  font-size: 0.9rem;
}

.divider-text:before,
.divider-text:after {
  content: "";
  position: absolute;
  top: 50%;
  width: 45%;
  height: 1px;
  background: var(--border-color);
}

.divider-text:before {
  left: 0;
}

.divider-text:after {
  right: 0;
}

.upload-hint {
  text-align: center;
  font-size: 0.8rem;
}
</style>