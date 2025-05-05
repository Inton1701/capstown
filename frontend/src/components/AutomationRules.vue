<template>
  <div class="col-md-6">
    <div class="card h-100">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">
          <i class="fas fa-robot me-2"></i> Automation Rules
        </h5>
        <button class="btn btn-sm btn-rule" @click="showAddRule = !showAddRule">
          <i :class="['fas', showAddRule ? 'fa-chevron-up' : 'fa-plus']"></i>
          {{ showAddRule ? 'Hide Form' : 'New Rule' }}
        </button>
      </div>
      
      <div class="card-body">
        <!-- Toast notification system -->
        <div class="toast-container" v-if="toast.show">
          <div class="toast-message" :class="toast.type">
            <div class="toast-icon">
              <i :class="getToastIcon(toast.type)"></i>
            </div>
            <div class="toast-content">{{ toast.message }}</div>
            <button class="toast-close" @click="toast.show = false">&times;</button>
          </div>
        </div>
        
        <!-- Rule Creation Form -->
        <div v-show="showAddRule" class="rule-form mb-4">
          <div class="rule-card">
            <div class="rule-section">
              <h6 class="section-title">
                <i class="fas fa-trigger me-2"></i>Trigger Condition
              </h6>
              <div class="row g-3">
                <div class="col-md-5">
                  <select v-model="newRule.trigger" class="form-select">
                    <option v-for="trigger in triggers" :key="trigger" :value="trigger">
                      {{ trigger }}
                    </option>
                  </select>
                </div>
                <div class="col-md-3">
                  <select v-model="newRule.condition" class="form-select">
                    <option value="<">Below</option>
                    <option value=">">Above</option>
                    <option value="=">Equals</option>
                  </select>
                </div>
                <div class="col-md-4">
                  <div class="input-group">
                    <input v-model="newRule.value" type="number" class="form-control" step="0.1">
                    <span class="input-group-text">{{ getUnit(newRule.trigger) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Replace termination mode selector with just condition section -->
            <div v-if="showTerminationOptions" class="rule-section">
              <h6 class="section-title">
                <i class="fas fa-stop-circle me-2"></i>Termination Condition
              </h6>
              <div class="row g-3">
                <div class="col-md-5">
                  <select v-model="newRule.untilTrigger" class="form-select">
                    <option v-for="trigger in triggers" :key="trigger" :value="trigger">
                      {{ trigger }}
                    </option>
                  </select>
                </div>
                <div class="col-md-3">
                  <select v-model="newRule.untilCondition" class="form-select">
                    <option value="<">Below</option>
                    <option value=">">Above</option>
                    <option value="=">Equals</option>
                  </select>
                </div>
                <div class="col-md-4">
                  <div class="input-group">
                    <input v-model="newRule.untilValue" type="number" class="form-control" step="0.1">
                    <span class="input-group-text">{{ getUnit(newRule.untilTrigger) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="rule-section">
              <h6 class="section-title">
                <i class="fas fa-bolt me-2"></i>Action
              </h6>
              <div class="d-flex flex-column gap-3">
                <select v-model="newRule.action" class="form-select">
                  <option v-for="action in actions" :key="action" :value="action">
                    {{ action }}
                  </option>
                </select>
                
                <!-- Add solution amount input -->
                <div v-if="showSolutionAmount" class="input-group">
                  <input 
                    v-model="newRule.solutionAmount" 
                    type="number" 
                    class="form-control" 
                    min="0" 
                    step="0.1"
                    placeholder="Amount"
                  >
                  <span class="input-group-text">mL</span>
                </div>
              </div>
            </div>

            <!-- Add fertilizer safety conditions when fertilizer action is selected -->
            <div v-if="showFertilizerSafetySection" class="rule-section">
              <h6 class="section-title">
                <i class="fas fa-shield-alt me-2"></i>Fertilizer Safety Controls
              </h6>
              
              <div class="form-check mb-3">
                <input 
                  type="checkbox" 
                  class="form-check-input" 
                  id="checkEcLevel"
                  v-model="newRule.checkEcLevel"
                >
                <label class="form-check-label" for="checkEcLevel">
                  Check EC level before dispensing
                </label>
              </div>
              
              <div v-if="newRule.checkEcLevel" class="mb-3">
                <label class="form-label">Maximum EC level for dispensing (mS/cm)</label>
                <input 
                  type="number" 
                  class="form-control" 
                  step="0.1"
                  min="0"
                  v-model="newRule.maxEcLevel"
                >
                <small class="text-muted">Fertilizer won't be dispensed if EC is above this value</small>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Minimum time between doses (minutes)</label>
                <input 
                  type="number" 
                  class="form-control" 
                  min="0"
                  v-model="newRule.minInterval"
                >
                <small class="text-muted">Fertilizer won't be dispensed more frequently than this</small>
              </div>
            </div>

            <div class="rule-actions">
              <button class="btn btn-accent" @click="addRule">
                <i class="fas fa-save me-1"></i> Save Rule
              </button>
              <button class="btn btn-outline-secondary" @click="resetNewRule">
                <i class="fas fa-undo me-1"></i> Reset
              </button>
            </div>
          </div>
        </div>

        <!-- Active Rules List -->
        <div class="active-rules">
          <h6 class="section-title mb-3">
            <i class="fas fa-list-check me-2"></i>Active Rules
            <span v-if="isLoading" class="spinner-indicator">
              <i class="fas fa-spinner fa-spin"></i>
            </span>
          </h6>
          <div v-if="rules.length === 0 && !isLoading" class="no-rules-message">
            <i class="fas fa-info-circle me-2"></i>
            No automation rules defined yet. Create your first rule above.
          </div>
          <div v-else class="rules-list">
            <div v-for="rule in rules" 
                 :key="rule._id" 
                 class="rule-item"
                 :class="{'rule-disabled': !rule.enabled, 'rule-active': rule.currentlyActive}">
              <!-- Update the rule-content section to remove duration display -->
              <div class="rule-content">
                <div class="rule-summary">
                  <i :class="getTriggerIcon(rule.trigger)" class="trigger-icon"></i>
                  <span class="trigger">{{ rule.trigger }}</span>
                  <span class="condition-badge" :class="getConditionClass(rule.condition)">
                    {{ getConditionSymbol(rule.condition) }}
                    {{ rule.value }}{{ getUnit(rule.trigger) }}
                  </span>
                  <!-- Add cooldown indicator -->
                  <span v-if="rule.cooldownUntil && new Date(rule.cooldownUntil) > new Date()" class="cooldown-badge">
                    <i class="fas fa-hourglass-half me-1"></i>
                    {{ formatCooldownTime(rule.cooldownUntil) }}
                  </span>
                </div>
                
                <!-- Remove duration badge and only show until condition badge -->
                <!-- Update the rule-arrow display for until condition -->
                <div class="rule-arrow" v-if="rule.untilConditionEnabled">
                  <i class="fas fa-arrow-right"></i>
                  <span class="until-condition-badge">
                    <i class="fas fa-stop-circle me-1"></i>
                    Until: {{ rule.untilTrigger }} {{ getConditionSymbol(rule.untilCondition) }} {{ rule.untilValue }}{{ getUnit(rule.untilTrigger) }}
                  </span>
                </div>
                
                <div class="action-summary">
                  <i class="fas" :class="getActionIcon(rule.action)"></i>
                  <span class="action">
                    {{ rule.action }}
                    <span v-if="rule.action.includes('Release')" class="solution-amount">
                      ({{ rule.solutionAmount }}mL)
                    </span>
                  </span>
                </div>
              </div>

              <!-- Add fertilizer safety info display -->
              <div class="rule-extra-info" v-if="rule.action.includes('Fertilizer') && (rule.checkEcLevel || rule.minInterval > 0)">
                <div class="safety-info">
                  <span v-if="rule.checkEcLevel" class="safety-badge">
                    <i class="fas fa-tachometer-alt me-1"></i>
                    Max EC: {{ rule.maxEcLevel }}mS/cm
                  </span>
                  <span v-if="rule.minInterval > 0" class="safety-badge">
                    <i class="fas fa-clock me-1"></i>
                    Min interval: {{ rule.minInterval }}m
                  </span>
                  <span v-if="rule.lastTriggered" class="timing-info">
                    Last dispensed: {{ formatLastTriggered(rule.lastTriggered) }}
                  </span>
                </div>
              </div>

              <div class="rule-controls">
                <button class="btn btn-sm border-0" 
                  :class="rule.enabled ? 'btn-outline-accent' : 'btn-rule'"
                  @click="toggleRuleStatus(rule._id)">
                  <i :class="rule.enabled ? 'fas fa-toggle-on' : 'fas fa-toggle-off'" class="me-1"></i>
                  {{ rule.enabled ? 'Disable' : 'Enable' }}
                </button>
                <button class="btn btn-sm condition-above" @click="editRule(rule)">
                  <i class="fas fa-edit me-1"></i>
                  Edit
                </button>
                <button class="btn btn-sm condition-below" @click="deleteRule(rule._id)">
                  <i class="fas fa-trash me-1"></i>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Confirmation Modal -->
    <div class="confirmation-modal" v-if="showConfirmModal">
      <div class="confirmation-modal-content">
        <div class="confirmation-modal-header">
          <h5>{{ confirmModal.title }}</h5>
          <button class="confirmation-modal-close" @click="cancelConfirmation">&times;</button>
        </div>
        <div class="confirmation-modal-body">
          <i class="fas fa-exclamation-triangle"></i>
          <p>{{ confirmModal.message }}</p>
        </div>
        <div class="confirmation-modal-footer">
          <button class="btn btn-secondary" @click="cancelConfirmation">Cancel</button>
          <button class="btn btn-danger" @click="confirmAction">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

// API URL
const API_URL = process.env.VUE_APP_API_URL;

// Change "Temperature" to "Air Temperature" and add "Water Temperature"
const triggers = ref(['pH Level', 'EC Level', 'Water Level', 'Air Temperature', 'Water Temperature'])

// Update actions array with your actual actuators
const actions = ref([
  'Release pH Up Solution',
  'Release pH Down Solution',
  'Turn On Water Pump',
  'Turn Off Water Pump',
  'Turn On Fan',             // Changed from "Aerator" to "Fan"
  'Turn Off Fan',            // Changed from "Aerator" to "Fan"
  'Turn On Chiller',         // Added
  'Turn Off Chiller',        // Added
  'Release Fertilizer A',
  'Release Fertilizer B',
  'Release Fertilizer C'     // Added
])

// Track loading state
const isLoading = ref(false)
const isEditing = ref(false)
const editingRuleId = ref(null)

// Update newRule - remove duration-related fields and keep only until condition fields
const newRule = ref({
  name: '',
  trigger: 'pH Level',
  condition: '<',
  value: 5.5,
  action: 'Release pH Up Solution',
  solutionAmount: 5,
  actuatorId: '', // Will be populated based on action
  // Keep only until condition fields
  untilConditionEnabled: true,
  untilTrigger: 'Air Temperature',
  untilCondition: '<',
  untilValue: 30.0,
  // Fertilizer safety fields
  checkEcLevel: false,
  maxEcLevel: 3.0,
  minInterval: 60 // Default: 60 minutes between fertilizer doses
})

const rules = ref([])

// Actuator mapping to connect actions with actuator IDs from your actual system
const actuatorMapping = {
  'Release pH Up Solution': 'ph-up-pump',
  'Release pH Down Solution': 'ph-down-pump',
  'Turn On Water Pump': 'irrigation-pump',
  'Turn Off Water Pump': 'irrigation-pump',
  'Turn On Fan': 'fan',
  'Turn Off Fan': 'fan',
  'Turn On Chiller': 'chiller',
  'Turn Off Chiller': 'chiller',
  'Release Fertilizer A': 'fertilizer-pump-a',
  'Release Fertilizer B': 'fertilizer-pump-b',
  'Release Fertilizer C': 'fertilizer-pump-c'
}

// Auto-select actuatorId when action changes
watch(() => newRule.value.action, (newAction) => {
  newRule.value.actuatorId = actuatorMapping[newAction] || '';
})

// Fetch rules from API
const fetchRules = async () => {
  isLoading.value = true
  try {
    const { data } = await axios.get(`${API_URL}/rules`)
    if (data.success) {
      rules.value = data.data
    }
  } catch (error) {
    console.error('Error fetching rules:', error)
  } finally {
    isLoading.value = false
  }
}

// Toast notification system
const toast = ref({
  show: false,
  message: '',
  type: 'info', // 'success', 'error', 'warning', 'info'
  timeout: null
})

// Function to show toast messages
const showToast = (message, type = 'info', duration = 3000) => {
  // Clear any existing timeout
  if (toast.value.timeout) {
    clearTimeout(toast.value.timeout)
  }
  
  // Set toast properties
  toast.value.message = message
  toast.value.type = type
  toast.value.show = true
  
  // Auto-hide after duration
  toast.value.timeout = setTimeout(() => {
    toast.value.show = false
  }, duration)
}

// Get icon for toast type
const getToastIcon = (type) => {
  switch (type) {
    case 'success': return 'fas fa-check-circle'
    case 'error': return 'fas fa-exclamation-circle'
    case 'warning': return 'fas fa-exclamation-triangle'
    default: return 'fas fa-info-circle'
  }
}

// Add or update rule - updated to remove duration handling 
const addRule = async () => {
  if (!newRule.value.actuatorId) {
    showToast('Please select a valid action with an associated actuator', 'warning');
    return;
  }
  
  if (!newRule.value.name) {
    newRule.value.name = `${newRule.value.trigger} ${newRule.value.condition} ${newRule.value.value}`;
  }
  
  // For termination conditions
  if (showTerminationOptions.value) {
    // Always enable until condition for On/Off actions
    newRule.value.untilConditionEnabled = true;
    
    console.log('Using condition-based termination:', {
      trigger: newRule.value.untilTrigger,
      condition: newRule.value.untilCondition,
      value: newRule.value.untilValue
    });
  } else {
    // No termination for other actions like Release solutions
    newRule.value.untilConditionEnabled = false;
    console.log('No termination needed for this action');
  }
  
  try {
    isLoading.value = true;
    
    if (isEditing.value && editingRuleId.value) {
      await axios.put(`${API_URL}/rules/${editingRuleId.value}`, newRule.value);
      showToast('Rule updated successfully', 'success');
      
      // If the rule was originally enabled, re-enable it
      if (originalRuleState.value) {
        console.log('Re-enabling rule after edit');
        await toggleRuleStatus(editingRuleId.value);
      }
    } else {
      await axios.post(`${API_URL}/rules`, newRule.value);
      showToast('New rule created successfully', 'success');
    }
    
    await fetchRules();
    resetNewRule();
    isEditing.value = false;
    editingRuleId.value = null;
    originalRuleState.value = false;
    // Hide add rule form after successful save
    showAddRule.value = false;
  } catch (error) {
    console.error('Error saving rule:', error);
    showToast('Failed to save rule. Please try again.', 'error');
  } finally {
    isLoading.value = false;
  }
}

// Edit rule - modify to automatically disable rule when editing
const editRule = (rule) => {
  isEditing.value = true;
  editingRuleId.value = rule._id;
  
  // Automatically disable the rule while editing
  if (rule.enabled) {
    console.log('Temporarily disabling rule while editing');
    toggleRuleStatus(rule._id)
      .then(() => {
        // After toggling, continue with edit mode
        // Store the original enabled state to restore later
        originalRuleState.value = true;
        
        // Clone the rule to avoid modifying the original
        newRule.value = {
          name: rule.name,
          trigger: rule.trigger,
          condition: rule.condition,
          value: rule.value,
          action: rule.action,
          solutionAmount: rule.solutionAmount || 0,
          actuatorId: rule.actuatorId,
          // Handle until condition fields with defaults if not present
          untilConditionEnabled: rule.untilConditionEnabled || false,
          untilTrigger: rule.untilTrigger || 'Air Temperature',
          untilCondition: rule.untilCondition || '<',
          untilValue: rule.untilValue || 30.0,
          // Handle fertilizer safety fields with defaults if not present
          checkEcLevel: rule.checkEcLevel || false,
          maxEcLevel: rule.maxEcLevel || 3.0,
          minInterval: rule.minInterval || 60
        };
        
        // Show the form when editing
        showAddRule.value = true;
      })
      .catch((error) => {
        console.error('Failed to disable rule for editing:', error);
        showToast('Failed to prepare rule for editing', 'error');
        isEditing.value = false;
        editingRuleId.value = null;
      });
  } else {
    // Rule is already disabled, just continue editing
    originalRuleState.value = false;
    
    // Clone the rule to avoid modifying the original
    newRule.value = {
      name: rule.name,
      trigger: rule.trigger,
      condition: rule.condition,
      value: rule.value,
      action: rule.action,
      solutionAmount: rule.solutionAmount || 0,
      actuatorId: rule.actuatorId,
      // Handle until condition fields with defaults if not present
      untilConditionEnabled: rule.untilConditionEnabled || false,
      untilTrigger: rule.untilTrigger || 'Air Temperature',
      untilCondition: rule.untilCondition || '<',
      untilValue: rule.untilValue || 30.0,
      // Handle fertilizer safety fields with defaults if not present
      checkEcLevel: rule.checkEcLevel || false,
      maxEcLevel: rule.maxEcLevel || 3.0,
      minInterval: rule.minInterval || 60
    };
    
    // Show the form when editing
    showAddRule.value = true;
  }
}

// Add this right after the existing ref variables at the top of the script setup
const originalRuleState = ref(false);

// Delete rule - updated to use modal confirmation instead of browser alert
const deleteRule = async (id) => {
  showConfirmation(
    'Confirm Deletion',
    'Are you sure you want to delete this rule?',
    async () => {
      try {
        isLoading.value = true;
        await axios.delete(`${API_URL}/rules/${id}`);
        await fetchRules();
        showToast('Rule deleted successfully', 'success');
      } catch (error) {
        console.error('Error deleting rule:', error);
        showToast('Failed to delete rule. Please try again.', 'error');
      } finally {
        isLoading.value = false;
      }
    }
  );
}

// Completely rewritten toggle function that uses toast for error notifications
const toggleRuleStatus = async (id) => {
  if (!id) {
    console.error('Invalid rule ID');
    return Promise.reject(new Error('Invalid rule ID'));
  }

  isLoading.value = true;
  
  try {
    console.log(`Toggling rule status for ID: ${id} using fetch API`);
    
    // Use the basic fetch API instead of axios for more reliability
    const response = await fetch(`${API_URL}/rules/${id}/toggle`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({}), // Empty payload
    });
    
    console.log(`Response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Response data:', data);
    
    if (data.success) {
      // Update UI immediately
      const index = rules.value.findIndex(r => r._id === id);
      if (index !== -1) {
        rules.value[index].enabled = data.data.enabled;
        console.log(`Updated rule status in UI: ${data.data.enabled}`);
      }
      
      // Refresh all rules in the background
      fetchRules().catch(err => console.error('Error refreshing rules after toggle:', err));
      
      isLoading.value = false;
      return Promise.resolve(data.data);
    } else {
      throw new Error(data.message || 'Unknown error');
    }
  } catch (error) {
    console.error('Error toggling rule status:', error);
    
    // Generate appropriate error message but show toast instead of alert
    let errorMessage = 'Failed to update rule status. Please try again.';
    
    if (!error.response && error.message === 'Network Error') {
      errorMessage = 'Network error. Please check your connection to the server.';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timed out. The server might be busy.';
    } else if (error.response) {
      errorMessage = error.response.data?.message || `Server error (${error.response.status})`;
    }
    
    showToast(errorMessage, 'error', 5000); // Show longer for errors
    isLoading.value = false;
    return Promise.reject(error);
  }
}

// Reset the form - remove duration fields
const resetNewRule = () => {
  newRule.value = {
    name: '',
    trigger: 'pH Level',
    condition: '<',
    value: 5.5,
    action: 'Release pH Up Solution',
    solutionAmount: 5,
    actuatorId: actuatorMapping['Release pH Up Solution'] || '',
    // Reset until condition fields
    untilConditionEnabled: true,
    untilTrigger: 'Air Temperature',
    untilCondition: '<',
    untilValue: 30.0,
    // Reset fertilizer safety fields
    checkEcLevel: false,
    maxEcLevel: 3.0,
    minInterval: 60
  };
  
  isEditing.value = false;
  editingRuleId.value = null;
  originalRuleState.value = false;
}

// Add a new helper function to display cooldown status
const formatCooldownTime = (cooldownUntil) => {
  if (!cooldownUntil) return '';
  
  const now = new Date();
  const cooldown = new Date(cooldownUntil);
  
  if (cooldown <= now) return '';
  
  const remainingMs = cooldown - now;
  const seconds = Math.ceil(remainingMs / 1000);
  
  return `${seconds}s`;
}

const showAddRule = ref(false)

const getUnit = (trigger) => {
  switch(trigger) {
    case 'pH Level': return 'pH'
    case 'EC Level': return 'mS/cm'
    case 'Water Level': return '%'
    case 'Air Temperature': return '°C'
    case 'Water Temperature': return '°C'
    default: return ''
  }
}

const getTriggerIcon = (trigger) => {
  switch(trigger) {
    case 'pH Level': return 'fas fa-flask'
    case 'EC Level': return 'fas fa-tachometer-alt'
    case 'Water Level': return 'fas fa-water'
    case 'Air Temperature': return 'fas fa-thermometer-half'
    case 'Water Temperature': return 'fas fa-tint-slash'
    default: return 'fas fa-sensor'
  }
}

const getConditionSymbol = (condition) => {
  switch(condition) {
    case '<': return '↓'
    case '>': return '↑'
    case '=': return '='
    default: return condition
  }
}

const getConditionClass = (condition) => {
  switch(condition) {
    case '<': return 'condition-below'
    case '>': return 'condition-above'
    case '=': return 'condition-equals'
    default: return ''
  }
}

// Update the computed property for showing termination options to include Turn Off actions
const showTerminationOptions = computed(() => {
  const action = newRule.value.action;
  // Show for both Turn On and Turn Off actions, but not for Release actions
  return (action.includes('Turn On') || action.includes('Turn Off')) && 
         !action.includes('Release');
})

// Add computed property to show solution amount input
const showSolutionAmount = computed(() => {
  return newRule.value.action.includes('Release')
})

// Add computed property to show fertilizer safety section
const showFertilizerSafetySection = computed(() => {
  return newRule.value.action.includes('Fertilizer');
})

const getActionIcon = (action) => {
  switch(action) {
    case 'Turn On Water Pump':
    case 'Turn Off Water Pump':
      return 'fa-faucet'
    case 'Turn On Fan':
    case 'Turn Off Fan':
      return 'fa-wind'
    case 'Turn On Chiller':
    case 'Turn Off Chiller':
      return 'fa-snowflake'
    case 'Release Fertilizer A':
    case 'Release Fertilizer B':
    case 'Release Fertilizer C':
      return 'fa-vial'
    case 'Trigger pH Up Pump':
    case 'Trigger pH Down Pump':
      return 'fa-flask'
    default:
      return 'fa-bolt'
  }
}

// Helper function to format last triggered time
const formatLastTriggered = (dateString) => {
  if (!dateString) return 'Never';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.round(diffMs / 60000);
  
  if (diffMins < 60) {
    return `${diffMins} min ago`;
  } else if (diffMins < 1440) {
    const hours = Math.floor(diffMins / 60);
    return `${hours} hr ago`;
  } else {
    const days = Math.floor(diffMins / 1440);
    return `${days} day(s) ago`;
  }
}

// Load rules when component is mounted
onMounted(() => {
  fetchRules();
})

// Confirmation modal state
const showConfirmModal = ref(false);
const confirmModal = ref({
  title: '',
  message: '',
  callback: null
});

// Function to show confirmation modal
const showConfirmation = (title, message, callback) => {
  confirmModal.value = {
    title,
    message,
    callback
  };
  showConfirmModal.value = true;
};

// Function to handle confirmation
const confirmAction = () => {
  if (confirmModal.value.callback) {
    confirmModal.value.callback();
  }
  showConfirmModal.value = false;
};

// Function to cancel confirmation
const cancelConfirmation = () => {
  showConfirmModal.value = false;
};
</script>

<style scoped>
/* Reset */
* {
  box-sizing: border-box;
}

/* Base styles */
.btn-control {
  background-color: #8db600;
  color: white;
  border: none;
}

.btn-control:hover {
  background-color: #7aa000;
}

.list-group-item {
  border-radius: 8px;
  margin-bottom: 8px;
}

.rule-card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px var(--glass-effect);
}

.rule-section {
  padding: 1rem 0;
  border-bottom: 1px solid var(--border-color);
}

.rule-section:last-child {
  border-bottom: none;
}

.section-title {
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-color-secondary);
  margin-bottom: 1rem;
}

/* Input styles */
.duration-inputs {
  display: flex;
  gap: 1rem;
}

.time-input {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.time-input label {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

.rule-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

/* Rules list */
.rules-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  padding-right: 0.5rem;
  margin-right: -0.5rem;
  scrollbar-width: thin;
  scrollbar-color: var(--text-color-secondary) transparent;
}

.rules-list::-webkit-scrollbar {
  width: 6px;
}

.rules-list::-webkit-scrollbar-track {
  background: transparent;
}

.rules-list::-webkit-scrollbar-thumb {
  background-color: var(--text-color-secondary);
  border-radius: 6px;
}

/* Rule Item Layout - Core Layout */
.rule-item {
  display: flex !important;
  flex-direction: column !important;
  padding: 1rem;
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  transition: all 0.3s ease;
  margin-bottom: 1rem;
  overflow: hidden;
}

/* Rule Content - Horizontal Layout Enforced */
.rule-content {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  gap: 0.75rem !important;
  width: 100% !important;
}

/* Rule summary and action summary styles */
.rule-summary, .action-summary {
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.5rem !important;
  flex: 0 1 auto !important;
  min-width: 120px !important;
  max-width: none !important;
}

/* Rule arrow styles */
.rule-arrow {
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.5rem !important;
  flex: 0 0 auto !important;
}

/* Control buttons at the bottom */
.rule-controls {
  display: flex !important;
  width: 100% !important;
  margin-top: 1rem !important;
  padding-top: 1rem !important;
  border-top: 1px solid var(--border-color) !important;
  justify-content: flex-end !important; /* Right-aligned on desktop */
  gap: 0.5rem !important;
}

/* Button styles */
.rule-controls .btn {
  padding: 0.4rem 0.75rem;
  min-width: 80px;
  font-size: 0.8rem;
  text-align: center;
  font-weight: 500;
  letter-spacing: 0.2px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  transition: all 0.2s ease-in-out;
  border-radius: 6px;
  color: white;
}

/* Hover effects */
.rule-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px var(--glass-effect);
}

/* Icons */
.trigger-icon, .action-icon {
  font-size: 1.1em;
  width: 24px;
  text-align: center;
  color: var(--text-color);
}

/* Label styles */
.trigger, .action {
  font-weight: 600;
  font-size: inherit;
}

/* Condition Badge */
.condition-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.9em;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.condition-below {
  background: var(--danger-color);
  color: white;
}

.condition-above {
  background: var(--card-header-dark);
  color: white;
}

.condition-equals {
  background: var(--accent-color);
  color: white;
}

/* Badge styles */
.duration-badge, .until-condition-badge {
  font-size: 0.85em;
  padding: 0.2rem 0.5rem;
  background: var(--glass-effect);
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

/* Card layout */
.card-body {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
  overflow: hidden;
}

.rule-form {
  flex-shrink: 0;
}

.active-rules {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Status indicators */
.rule-disabled {
  opacity: 0.6;
  border-style: dashed;
}

.rule-active {
  border-color: var(--success-color);
  border-width: 2px;
  position: relative;
}

.rule-active::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 8px;
  height: 100%;
  background-color: var(--success-color);
  border-top-left-radius: 7px;
  border-bottom-left-radius: 7px;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  /* Center buttons on mobile */
  .rule-controls {
    justify-content: center !important;
    flex-wrap: wrap;
  }
  
  .rule-controls .btn {
    flex: 0 1 auto;
    font-size: 0.75rem;
    padding: 0.35rem 0.5rem;
    min-width: 80px !important;
  }
  
  /* Ensure rule content stays horizontal */
  .rule-content {
    flex-wrap: wrap !important;
    gap: 0.5rem !important;
  }
  
  .rule-summary, .action-summary {
    min-width: 0 !important;
    max-width: none !important;
  }
}

/* Small screens */
@media (max-width: 480px) {
  .rule-controls .btn {
    font-size: 0.65rem;
    padding: 0.35rem 0.15rem;
  }
  
  .rule-content {
    font-size: 0.8rem;
  }
}

/* Toast notification */
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  max-width: 350px;
  width: 100%;
}

.toast-message {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  margin-bottom: 10px;
  animation: slide-in 0.3s ease-out forwards;
  background: white;
  border-left: 4px solid;
}

.toast-message.success {
  border-left-color: var(--success-color);
}

.toast-message.error {
  border-left-color: var(--danger-color);
}

.toast-message.warning {
  border-left-color: var(--warning-color);
}

.toast-message.info {
  border-left-color: var(--info-color);
}

.toast-icon {
  margin-right: 12px;
  font-size: 18px;
}

.toast-message.success .toast-icon {
  color: var(--success-color);
}

.toast-message.error .toast-icon {
  color: var(--danger-color);
}

.toast-message.warning .toast-icon {
  color: var(--warning-color);
}

.toast-message.info .toast-icon {
  color: var(--info-color);
}

.toast-content {
  flex: 1;
  font-size: 14px;
}

.toast-close {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  margin-left: 8px;
  color: #666;
}

@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Confirmation Modal */
.confirmation-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1050;
}

.confirmation-modal-content {
  background-color: var(--card-bg, white);
  border-radius: 8px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  position: relative;
}

.confirmation-modal-header {
  background-color: var(--accent-color);
  color: white;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.confirmation-modal-header h5 {
  margin: 0;
  font-weight: 600;
}

.confirmation-modal-close {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: white;
  padding: 0;
  line-height: 1;
}

.confirmation-modal-body {
  padding: 1.5rem;
  text-align: center;
  color: var(--text-color, #333);
}

.confirmation-modal-body i {
  font-size: 3rem;
  color: var(--warning-color, #ff9500);
  margin-bottom: 1rem;
  display: block;
}

.confirmation-modal-footer {
  padding: 1rem;
  display: flex;
  justify-content: center;
  gap: 1rem;
  border-top: 1px solid var(--border-color, #e9ecef);
}

.confirmation-modal-footer .btn-danger {
  background-color: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.confirmation-modal-footer .btn-danger:hover {
  background-color: var(--accent-color-dark, #358163);
  border-color: var(--accent-color-dark, #358163);
}

/* Dark mode adjustments for confirmation modal */
:deep(.dark-mode) .confirmation-modal-content {
  background-color: var(--card-bg-dark, #222);
  color: var(--text-color-dark, #eee);
  border-color: var(--border-color-dark, #444);
}

:deep(.dark-mode) .confirmation-modal-body {
  color: var(--text-color-dark, #eee);
}

:deep(.dark-mode) .confirmation-modal-footer {
  border-top-color: var(--border-color-dark, #444);
}

:deep(.dark-mode) .confirmation-modal-footer .btn-secondary {
  background-color: #444;
  border-color: #555;
  color: #eee;
}

:deep(.dark-mode) .confirmation-modal-footer .btn-secondary:hover {
  background-color: #555;
  border-color: #666;
}

/* Tab Styles */
.termination-tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.75rem;
  margin-bottom: 1.25rem;
}

.tab-button {
  background: var(--glass-effect);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.5rem 1rem;
  color: var(--text-color);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.tab-button.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.tab-content {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Dark mode adjustments */
:deep(.dark-mode) .tab-button {
  background: var(--glass-effect-dark);
  border-color: var(--border-color-dark);
  color: var(--text-color-dark);
}

:deep(.dark-mode) .tab-button.active {
  background: var(--accent-color);
  color: white;
}

:deep(.dark-mode) .confirmation-modal-content {
  background-color: var(--card-bg-dark);
  color: var(--text-color-dark);
}

:deep(.dark-mode) .confirmation-modal-footer {
  border-top-color: var(--border-color-dark);
}

:deep(.dark-mode) .toast-message {
  background-color: var(--card-bg-dark);
  color: var(--text-color-dark);
}

:deep(.dark-mode) .toast-close {
  color: var(--text-color-secondary-dark);
}

:deep(.dark-mode) .duration-badge,
:deep(.dark-mode) .until-condition-badge {
  background-color: rgba(255, 255, 255, 0.1);
}

/* Custom button colors and styles */
.btn-accent {
  background-color: #358163;
  border-color: #358163;
  color: white;
}

.btn-outline-accent {
  background-color: #666;
  border: 1px solid #358163;
  color: var(--accent-color, #40916c);
}

.btn-accent:hover {
  background-color: var(--accent-color-dark, #358163);
  border-color: var(--accent-color-dark, #358163);
  color: white;
}

.btn-outline-accent:hover {
  background-color: rgba(64, 145, 108, 0.1);
  color: var(--accent-color);
}

/* Ensure card header button is always accent colored with white text */
.card-header .btn-accent {
  background-color: var(--accent-color);
  border: none;
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  transition: all 0.3s ease;
  color: white;
}

.card-header .btn-accent:hover {
  background-color: var(--accent-color-dark, #358163);
  box-shadow: 0 4px 6px -1px var(--glass-effect);
  transform: translateY(-1px);
}

/* Make delete confirmation button match accent color */
.confirmation-modal-footer .btn-danger {
  background-color: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.confirmation-modal-footer .btn-danger:hover {
  background-color: var(--accent-color-dark, #358163);
  border-color: var(--accent-color-dark, #358163);
}

/* Update these class styles */
.btn-primary {
  background-color: var(--accent-color, #40916c) !important;
  border-color: var(--accent-color, #40916c) !important;
  color: white;
}

.btn-rule{
  background: #52b88a ;
  color: white;
}

.btn-primary:hover {
  background-color: #358163 !important;
  border-color: #358163 !important;
  transform: translateY(-1px);
}

/* Card header button style */
.card-header .btn-accent {
  background-color: var(--accent-color, #40916c);
  border: none;
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  transition: all 0.3s ease;
  color: white;
}

.card-header .btn-accent:hover {
  background-color: #358163;
  box-shadow: 0 4px 6px -1px var(--glass-effect);
  transform: translateY(-1px);
}

/* Remove old classes */
.card-header .btn-primary {
  display: none;
}

.btn-success {
  display: none;
}

/* Cooldown badge styles */
.cooldown-badge {
  font-size: 0.75rem;
  background-color: #4361ee;
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 0.5rem;
  animation: pulse 1.5s infinite;
}

/* Add styles for fertilizer safety badges */
.rule-extra-info {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border-color);
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.safety-info {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: 100%;
}

.safety-badge {
  font-size: 0.75rem;
  background-color: #2a9d8f;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
}

.timing-info {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-left: auto;
}

/* Dark mode adjustments */
:deep(.dark-mode) .safety-badge {
  background-color: #264653;
}

:deep(.dark-mode) .timing-info {
  color: var(--text-color-secondary-dark);
}
</style>