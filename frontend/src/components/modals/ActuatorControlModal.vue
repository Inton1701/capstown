<template>
  <div class="actuator-control-modal">
     <!-- Mode Toggle -->
     <div class="controls-group">
       <div class="mode-toggle">
         <button 
           class="btn-mode"
           :class="{ active: localState.mode === 'auto' }"
           @click="setMode('auto')"
         >
           <i class="fas fa-clock"></i>
           <span>Auto</span>
         </button>
         <button 
           class="btn-mode"
           :class="{ active: localState.mode === 'manual' }"
           @click="setMode('manual')"
         >
           <i class="fas fa-hand-pointer"></i>
           <span>Manual</span>
         </button>
       </div>
     </div>
 
     <!-- Manual Mode -->
     <div v-if="localState.mode === 'manual'" class="manual-controls">
       <div class="setting-group">
         <label class="setting-label">
           <i class="fas fa-hourglass-half"></i>Duration
         </label>
         <div class="time-input-group">
           <div class="time-unit">
             <input 
               v-model="localState.manualDuration.hours"
               type="number"
               min="0"
               max="23"
               class="time-input"
               :disabled="localState.status !== 'idle'"
             >
             <span class="unit-label">hr</span>
           </div>
           <span class="time-separator">:</span>
           <div class="time-unit">
             <input 
               v-model="localState.manualDuration.minutes"
               type="number"
               min="0"
               max="59"
               class="time-input"
               :disabled="localState.status !== 'idle'"
             >
             <span class="unit-label">min</span>
           </div>
           <span class="time-separator">:</span>
           <div class="time-unit">
             <input 
               v-model="localState.manualDuration.seconds"
               type="number"
               min="0"
               max="59"
               class="time-input"
               :disabled="localState.status !== 'idle'"
             >
             <span class="unit-label">sec</span>
           </div>
         </div>
         <div v-if="!isValidDuration" class="input-warning">
           Duration must be greater than zero
         </div>
       </div>
 
       <div class="manual-buttons">
         <button 
           v-if="localState.status === 'idle'"
           class="btn-manual"
           @click="toggleStatus('active')"
           :disabled="!isValidDuration"
         >
           <i class="fas fa-play"></i>
           Start
         </button>
         
         <template v-else>
           <button 
             class="btn-manual"
             :class="{ active: localState.status === 'paused' }"
             @click="toggleStatus(localState.status === 'paused' ? 'active' : 'paused')"
           >
             <i class="fas" :class="localState.status === 'paused' ? 'fa-play' : 'fa-pause'"></i>
             {{ localState.status === 'paused' ? 'Resume' : 'Pause' }}
           </button>
           
           <button 
             class="btn-manual danger"
             @click="toggleStatus('idle')"
           >
             <i class="fas fa-stop"></i>
             Stop
           </button>
         </template>
 
         <div v-if="localState.status !== 'idle'" class="time-remaining">
           {{ formatTime(remainingTime) }}
         </div>
       </div>
     </div>
 
 
     <!-- Auto Mode -->
     <div v-else class="auto-controls">
       <div class="setting-group">
         <div class="d-flex justify-content-between align-items-center">
           <label class="setting-label" for="scheduleEnabled">
             <i class="fas fa-power-off"></i>Enable Schedule
           </label>
           <label class="switch">
             <input 
               type="checkbox"
               v-model="localState.schedule.enabled"
               id="scheduleEnabled"
             >
             <span class="slider"></span>
           </label>
         </div>
       </div>
 
       <div class="setting-group">
         <label class="setting-label">
           <i class="fas fa-clock"></i>Interval
         </label>
         <div class="time-input-group">
           <div class="time-unit">
             <input 
               v-model.number="localState.schedule.interval.hours"
               type="number"
               min="0"
               max="23"
               class="time-input"
               :disabled="!localState.schedule.enabled"
             >
             <span class="unit-label">hr</span>
           </div>
           <span class="time-separator">:</span>
           <div class="time-unit">
             <input 
               v-model.number="localState.schedule.interval.minutes"
               type="number"
               min="0"
               max="59"
               class="time-input"
               :disabled="!localState.schedule.enabled"
             >
             <span class="unit-label">min</span>
           </div>
           <span class="time-separator">:</span>
           <div class="time-unit">
             <input 
               v-model.number="localState.schedule.interval.seconds"
               type="number"
               min="0"
               max="59"
               class="time-input"
               :disabled="!localState.schedule.enabled"
             >
             <span class="unit-label">sec</span>
           </div>
         </div>
         <div v-if="!isValidInterval" class="input-warning">
           Interval must be greater than zero
         </div>
       </div>
 
       <!-- Add this after the interval setting group in auto mode -->
       <div class="setting-group">
         <label class="setting-label">
           <i class="fas fa-hourglass-half"></i>Duration
         </label>
         <div class="time-input-group">
           <div class="time-unit">
             <input 
             v-model="localState.schedule.duration.hours"
     type="number"
     min="0"
     max="23"
     class="time-input"
     :disabled="actuator.status !== 'idle'"
             >
             <span class="unit-label">hr</span>
           </div>
           <span class="time-separator">:</span>
           <div class="time-unit">
             <input 
               v-model.number="localState.schedule.duration.minutes"
               type="number"
               min="0"
               max="59"
               class="time-input"
               :disabled="!localState.schedule.enabled"
             >
             <span class="unit-label">min</span>
           </div>
           <span class="time-separator">:</span>
           <div class="time-unit">
             <input 
               v-model.number="localState.schedule.duration.seconds"
               type="number"
               min="0"
               max="59"
               class="time-input"
               :disabled="!localState.schedule.enabled"
             >
             <span class="unit-label">sec</span>
           </div>
         </div>
         <div v-if="!isValidDuration" class="input-warning">
           Duration must be greater than zero
         </div>
       </div>
 
       <div class="setting-group">
         <label class="setting-label">
           <i class="fas fa-calendar-week"></i>Active Days
         </label>
         <div class="days-grid">
           <button 
             v-for="day in weekDays" 
             :key="day.value"
             class="day-btn"
             :class="{ active: localState.schedule.activeDays.includes(day.value) }"
             @click="toggleDay(day.value)"
             :disabled="!localState.schedule.enabled"
           >
             {{ day.label }}
           </button>
         </div>
       </div>
     </div>
 
     <!-- Add this at the bottom of the modal -->
     <div class="modal-footer">
       <button 
         class="btn-save"
         :disabled="!hasChanges || (localState.mode === 'auto' && localState.schedule.enabled && 
              ((isValidInterval !== undefined && !isValidInterval) || 
               (isValidDuration !== undefined && !isValidDuration)))"
         @click="saveSettings"
       >
         <i class="fas fa-save"></i>
         Save Changes
       </button>
     </div>
   </div>
 </template>
 
 <script setup>
 import { reactive, ref, watch, onUnmounted, computed, inject, onMounted } from 'vue';
 import axios from 'axios';
 
 const API_URL = process.env.VUE_APP_API_URL;
 const props = defineProps({
   actuator: {
     type: Object,
     required: true,
     validator: (value) => {
       return value && value.id && ['chiller', 'fan', 'pump'].includes(value.type);
     }
   }
 });
 
 const emit = defineEmits(['close', 'save']);
 
 // Replace the hasChanges ref with a computed property that properly detects changes
 const hasChanges = computed(() => {
   // Check if mode has changed
   if (localState.value.mode !== props.actuator.mode) return true;
   
   // Check if status has changed
   if (localState.value.status !== props.actuator.status) return true;
   
   // Check if schedule settings have changed
   const origSchedule = props.actuator.schedule || {};
   const newSchedule = localState.value.schedule;
   
   if (newSchedule.enabled !== origSchedule.enabled) return true;
   
   // Compare active days
   const origDays = origSchedule.activeDays || [];
   const newDays = newSchedule.activeDays || [];
   if (origDays.length !== newDays.length) return true;
   if (origDays.some(day => !newDays.includes(day))) return true;
   
   // Compare interval
   const origInterval = origSchedule.interval || {};
   const newInterval = newSchedule.interval || {};
   if (
     origInterval.hours !== newInterval.hours ||
     origInterval.minutes !== newInterval.minutes ||
     origInterval.seconds !== newInterval.seconds
   ) return true;
   
   // Compare duration
   const origDuration = origSchedule.duration || {};
   const newDuration = newSchedule.duration || {};
   if (
     origDuration.hours !== newDuration.hours ||
     origDuration.minutes !== newDuration.minutes ||
     origDuration.seconds !== newDuration.seconds
   ) return true;
   
   return false;
 });
 
 // Single declaration of localState with proper initialization
 const localState = ref({
   mode: props.actuator?.mode || 'manual',
   status: props.actuator?.status || 'idle',
   manualDuration: {
     hours: 0,
     minutes: 0,
     seconds: 0
   },
   schedule: {
     enabled: props.actuator?.schedule?.enabled ?? false,
     activeDays: [...(props.actuator?.schedule?.activeDays ?? [])],
     interval: {
       hours: props.actuator?.schedule?.interval?.hours ?? 0,
       minutes: props.actuator?.schedule?.interval?.minutes ?? 0,
       seconds: props.actuator?.schedule?.interval?.seconds ?? 0
     },
     duration: {
       hours: props.actuator?.schedule?.duration?.hours ?? 0,
       minutes: props.actuator?.schedule?.duration?.minutes ?? 0,
       seconds: props.actuator?.schedule?.duration?.seconds ?? 0
     }
   }
 });
 
 const remainingTime = ref(0);
 let timer = null;
 
 // Define setMode function
 const setMode = (mode) => {
   localState.value.mode = mode;
   if (mode === 'manual') {
     localState.value.schedule.enabled = false;
   }
 };
 
 // Define toggleDay function
 const toggleDay = (day) => {
   const index = localState.value.schedule.activeDays.indexOf(day);
   if (index === -1) {
     localState.value.schedule.activeDays.push(day);
   } else {
     localState.value.schedule.activeDays.splice(index, 1);
   }
 };
 
 // Define toggleStatus function
 const toggleStatus = async (newStatus) => {
   if (!props.actuator?.id) return;
   
   try {
     let duration = 0;
     if (newStatus === 'active') {
       // Calculate duration only for new starts, not for resume
       if (localState.value.status !== 'paused') {
         duration = getDurationInSeconds();
         // For new starts, set the initial remaining time
         remainingTime.value = duration;
       }
       // For resume from pause, keep existing remainingTime
     }
 
     const response = await axios.put(`${API_URL}/actuators/${props.actuator.id}/status`, {
       status: newStatus,
       duration: newStatus === 'active' && localState.value.status !== 'paused' ? duration : undefined,
       remainingTime: remainingTime.value // Send current remaining time with status update
     });
 
     if (response.data.success) {
       localState.value.status = newStatus;
       
       // Handle timer based on status
       if (newStatus === 'active') {
         // Start/restart the timer
         if (timer) clearInterval(timer);
         timer = setInterval(updateRemainingTime, 1000);
       } 
       else if (newStatus === 'paused') {
         // Just stop the timer, keep remaining time
         if (timer) {
           clearInterval(timer);
           timer = null;
         }
       } 
       else if (newStatus === 'idle') {
         // Clear timer and remaining time
         remainingTime.value = 0;
         if (timer) {
           clearInterval(timer);
           timer = null;
         }
       }
     }
   } catch (error) {
     console.error('Error updating actuator status:', error);
   }
 };
 
 // Define saveSettings function
 const saveSettings = async () => {
   // Create a complete settings object with all necessary fields
   const settings = {
     ...props.actuator,
     id: props.actuator.id,
     mode: localState.value.mode,
     status: localState.value.status,
     type: props.actuator.type,
     schedule: {
       enabled: localState.value.schedule.enabled,
       activeDays: [...localState.value.schedule.activeDays],
       interval: {
         hours: Number(localState.value.schedule.interval.hours),
         minutes: Number(localState.value.schedule.interval.minutes),
         seconds: Number(localState.value.schedule.interval.seconds)
       },
       duration: {
         hours: Number(localState.value.schedule.duration.hours),
         minutes: Number(localState.value.schedule.duration.minutes),
         seconds: Number(localState.value.schedule.duration.seconds)
       }
     },
     // Add a flag to indicate interval has been updated - this will help the backend
     intervalUpdated: props.actuator?.schedule?.interval?.hours !== localState.value.schedule.interval.hours ||
                      props.actuator?.schedule?.interval?.minutes !== localState.value.schedule.interval.minutes ||
                      props.actuator?.schedule?.interval?.seconds !== localState.value.schedule.interval.seconds
   };
 
   console.log('Saving actuator settings:', settings);
   
   try {
     // Send the settings to the parent component
     emit('save', settings);
   } catch (error) {
     console.error('Error saving settings:', error);
   }
 };
 
 // Update the script section
 const updateRemainingTime = async () => {
   if (props.actuator?.id && localState.value.status === 'active') {
     if (remainingTime.value > 0) {
       remainingTime.value--;
       
       // When timer reaches zero, update status to idle
       if (remainingTime.value <= 0) {
         try {
           const response = await axios.put(`${API_URL}/actuators/${props.actuator.id}/status`, {
             status: 'idle'
           });
           
           if (response.data.success) {
             localState.value.status = 'idle';
             clearInterval(timer);
           }
         } catch (error) {
           console.error('Error updating actuator status:', error);
         }
       }
     }
   }
 };
 
 // Define weekDays array
 const weekDays = [
   { value: 'monday', label: 'Mon' },
   { value: 'tuesday', label: 'Tue' },
   { value: 'wednesday', label: 'Wed' },
   { value: 'thursday', label: 'Thu' },
   { value: 'friday', label: 'Friday' },
   { value: 'saturday', label: 'Sat' },
   { value: 'sunday', label: 'Sun' }
 ];
 
 // Watcher to update localState and remainingTime when props change
 watch(() => props.actuator, (newActuator) => {
   if (newActuator) {
     // Initialize remainingTime from actuator if it exists
     if (newActuator.remainingTime !== undefined) {
       remainingTime.value = newActuator.remainingTime;
     }
     
     // Save current manual duration before updating
     const currentManualDuration = { ...localState.value.manualDuration };
     
     localState.value = {
       mode: newActuator.mode || 'manual',
       status: newActuator.status || 'idle',
       // Preserve user entered manual duration
       manualDuration: currentManualDuration,
       schedule: {
         enabled: newActuator.schedule?.enabled ?? false,
         activeDays: [...(newActuator.schedule?.activeDays ?? [])],
         interval: {
           hours: newActuator.schedule?.interval?.hours ?? 0,
           minutes: newActuator.schedule?.interval?.minutes ?? 0,
           seconds: newActuator.schedule?.interval?.seconds ?? 0
         },
         duration: {
           hours: newActuator.schedule?.duration?.hours ?? 0,
           minutes: newActuator.schedule?.duration?.minutes ?? 0,
           seconds: newActuator.schedule?.duration?.seconds ?? 0
         }
       }
     };
   }
 }, { immediate: true, deep: true });
 
 // Update onMounted to initialize timer for both active and paused states
 onMounted(() => {
   // Initialize remainingTime regardless of status
   if (props.actuator?.remainingTime > 0) {
     remainingTime.value = props.actuator.remainingTime;
     
     // Only start the timer if the actuator is active
     if (props.actuator?.status === 'active') {
       timer = setInterval(updateRemainingTime, 1000);
     }
   }
 });
 
 // Make sure to clean up the timer
 onUnmounted(() => {
   if (timer) clearInterval(timer);
 });
 
 const getDurationInSeconds = () => {
   const duration = localState.value.mode === 'manual' 
     ? localState.value.manualDuration 
     : localState.value.schedule.duration;
   return (duration.hours * 3600) + (duration.minutes * 60) + duration.seconds;
 };
 
 const formatTime = (seconds) => {
   const hrs = Math.floor(seconds / 3600);
   const mins = Math.floor((seconds % 3600) / 60);
   const secs = seconds % 60;
   return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
 };
 
 const isValidDuration = computed(() => {
   const duration = localState.value.mode === 'manual' 
     ? localState.value.manualDuration 
     : localState.value.schedule.duration;
   return duration.hours > 0 || duration.minutes > 0 || duration.seconds > 0;
 });
 
 const isValidInterval = computed(() => {
   const { hours, minutes, seconds } = localState.value.schedule.interval;
   return hours > 0 || minutes > 0 || seconds > 0;
 });
 
 </script>
 
 <style scoped>
 .actuator-control-modal {
   padding: 1rem;
   background: var(--card-bg);
   border-radius: 12px;
 }
 
 .mode-toggle {
   display: flex;
   gap: 1rem;
   margin-bottom: 1.5rem;
 }
 
 .btn-mode {
   flex: 1;
   padding: 0.75rem;
   border: 1px solid var(--border-color);
   background: transparent;
   color: var(--text-color);
   border-radius: 8px;
   display: flex;
   align-items: center;
   justify-content: center;
   gap: 0.5rem;
   transition: all 0.3s ease;
 }
 
 .btn-mode.active {
   background: var(--accent-color);
   color: white;
   border-color: var(--accent-color);
 }
 
 .setting-group {
   margin-bottom: 1.5rem;
 }
 
 .setting-label {
   display: flex;
   align-items: center;
   gap: 0.5rem;
   color: var(--text-color);
   font-weight: 500;
 }
 
 .time-input-group {
   display: flex;
   align-items: center;
   gap: 0.5rem;
   background: var(--input-bg);
   padding: 0.75rem;
   border-radius: 8px;
   border: 1px solid var(--border-color);
 }
 
 .time-unit {
   display: flex;
   align-items: center;
   gap: 0.25rem;
 }
 
 .time-input {
   width: 3rem;
   padding: 0.375rem;
   text-align: center;
   border: 1px solid var(--border-color);
   border-radius: 4px;
   background: var(--input-bg);
   color: var(--text-color);
 }
 
 .time-separator {
   font-weight: bold;
   color: var(--text-color);
 }
 
 .unit-label {
   color: var(--text-muted);
   font-size: 0.9rem;
 }
 
 .days-grid {
   display: grid;
   grid-template-columns: repeat(7, 1fr);
   gap: 0.5rem;
   margin-top: 0.5rem;
 }
 
 .day-btn {
   padding: 0.5rem;
   border: 1px solid var(--border-color);
   background: transparent;
   color: var(--text-color);
   border-radius: 6px;
   transition: all 0.2s ease;
 }
 
 .day-btn.active {
   background: var(--accent-color);
   color: white;
   border-color: var(--accent-color);
 }
 
 .btn-manual {
   width: 100%;
   padding: 1rem;
   border: none;
   background: var(--success-color);
   color: white;
   border-radius: 8px;
   display: flex;
   align-items: center;
   justify-content: center;
   gap: 1rem;
   font-weight: 500;
   transition: all 0.3s ease;
 }
 
 .btn-manual.active {
   background: var(--danger-color);
 }
 
 .btn-manual.danger {
   background: var(--danger-color);
 }
 
 .time-remaining {
   background: rgba(255, 255, 255, 0.2);
   padding: 0.25rem 0.75rem;
   border-radius: 4px;
   font-family: monospace;
 }
 
 .switch {
   position: relative;
   display: inline-block;
   width: 48px;
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
   background-color: #ccc;
   transition: .4s;
   border-radius: 24px;
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
   border-radius: 50%;
 }
 
 input:checked + .slider {
   background-color: var(--accent-color);
 }
 
 input:checked + .slider:before {
   transform: translateX(24px);
 }
 
 .modal-footer {
   margin-top: 1.5rem;
   display: flex;
   justify-content: flex-end;
 }
 
 .btn-save {
   padding: 0.75rem 1.5rem;
   border: none;
   background: var(--accent-color);
   color: white;
   border-radius: 8px;
   display: flex;
   align-items: center;
   gap: 0.5rem;
   font-weight: 500;
   transition: all 0.3s ease;
   /* Ensure the button is visible */
   opacity: 1 !important;
   transform: none !important;
 }
 
 .btn-save:disabled {
   background: var(--text-muted);
   cursor: not-allowed;
   opacity: 0.7 !important; /* Allow some transparency when disabled, but not fully hidden */
 }
 
 .btn-save:not(:disabled):hover {
   background: var(--accent-color-dark);
 }
 
 @media (max-width: 768px) {
   .days-grid {
     grid-template-columns: repeat(4, 1fr);
   }
   
   .time-input {
     width: 2.5rem;
   }
 }
 
 /* Add to existing styles */
 .manual-buttons {
   display: flex;
   align-items: center;
   gap: 1rem;
   margin-top: 1rem;
 }
 
 .btn-manual {
   flex: 1;
   padding: 1rem;
   border: none;
   background: var(--success-color);
   color: white;
   border-radius: 8px;
   display: flex;
   align-items: center;
   justify-content: center;
   gap: 0.5rem;
   font-weight: 500;
   transition: all 0.3s ease;
 }
 
 .btn-manual.danger {
   background: var(--danger-color);
 }
 
 .btn-manual.active {
   background: var(--warning-color);
 }
 
 .time-remaining {
   background: var(--bg-dark);
   color: var(--text-light);
   padding: 0.5rem 1rem;
   border-radius: 8px;
   font-family: monospace;
   font-size: 1.25rem;
   min-width: 80px;
   text-align: center;
 }
 
 /* Add to existing styles */
 .input-warning {
   color: var(--danger-color);
   font-size: 0.875rem;
   margin-top: 0.5rem;
 }
 
 /* Add to existing styles */
 .modal-footer {
   border-top: 1px solid var(--border-color);
   padding: 1rem;
   display: flex;
   justify-content: flex-end;
 }
 
 /* Remove or fix these styles that are hiding the save button */
 .btn-primary {
   /* Remove the opacity and transform properties that hide the button */
   transition: all 0.3s ease;
 }
 
 .btn-primary:not(:disabled) {
   /* Remove transform that may affect positioning */
 }
 
 .btn-primary:disabled {
   cursor: not-allowed;
 }
 </style>