const { Actuator } = require('../models/Actuator');
const ActuatorController = require('../controllers/ActuatorController');
const { broadcastActuatorUpdate } = require('./websocket');

class Scheduler {
  constructor() {
    this.scheduledJobs = new Map();
    this.countdownInterval = null;
  }

  calculateNextRun(lastRun, interval) {
    const now = Date.now();
    // Convert interval to milliseconds
    const intervalMs =
      (interval.hours * 3600 + interval.minutes * 60 + interval.seconds) * 1000;

    if (!intervalMs) return null;

    let nextRun;
    if (lastRun) {
      const lastRunMs = typeof lastRun === 'number' ? lastRun : Date.parse(lastRun);
      nextRun = lastRunMs + intervalMs;
      // Ensure nextRun is in the future
      while (nextRun <= now) {
        nextRun += intervalMs;
      }
    } else {
      nextRun = now + intervalMs;
    }

    console.log(`[Scheduler] Calculating next run:`, {
      actuatorLastRun: lastRun ? new Date(lastRun).toISOString() : 'none',
      interval: `${interval.hours}:${interval.minutes}:${interval.seconds}`,
      nextRun: new Date(nextRun).toISOString(),
      now: new Date(now).toISOString()
    });

    return nextRun;
  }

  async checkAndRunSchedules() {
    try {
      const actuators = await Actuator.find({
        mode: 'auto',
        'schedule.enabled': true
      });
      const now = Date.now();

      for (const actuator of actuators) {
        // First check if the interval was updated regardless of status
        if (actuator.intervalUpdated) {
          console.log(`[${actuator.name}] Interval update flag detected - Recalculating schedule`);
          
          // Recalculate next run time based on the new interval
          const newNextRun = this.calculateNextRun(now, actuator.schedule.interval);
          
          // Update the actuator with the new next run time and clear the flag
          await Actuator.findByIdAndUpdate(actuator._id, {
            nextScheduledRun: newNextRun,
            $unset: { intervalUpdated: 1 }
          });
          
          console.log(`[${actuator.name}] Interval updated, recalculated next run:`, {
            newNextRun: new Date(newNextRun).toISOString()
          });
          
          // Broadcast the update to clients so UI reflects the change
          broadcastActuatorUpdate({
            ...actuator.toObject(),
            nextScheduledRun: newNextRun,
            intervalUpdated: false
          });
          
          // Continue to regular processing
        }

        // Compute total run duration (in seconds) for the schedule.
        const duration =
          (actuator.schedule.duration.hours * 3600) +
          (actuator.schedule.duration.minutes * 60) +
          actuator.schedule.duration.seconds;

        // ----- Active Branch -----
        if (actuator.status === 'active') {
          const startTimeMs = new Date(actuator.startTime).getTime();
          const elapsedSeconds = Math.floor((now - startTimeMs) / 1000);
          const remainingTime = Math.max(0, duration - elapsedSeconds);

          console.log(`[${actuator.name}] Active Check:`, {
            currentTime: new Date(now).toISOString(),
            elapsedSeconds,
            remainingTime
          });

          if (remainingTime <= 0) {
            // Run complete: update to idle and store nextScheduledRun.
            const newNextRun = this.calculateNextRun(now, actuator.schedule.interval);
            
            // Important: Keep the same mode when setting back to idle
            await ActuatorController.updateStatus(actuator.id, {
              status: 'idle',
              mode: actuator.mode, // Keep the same mode (typically 'auto')
              startTime: null,
              lastRun: now,
              remainingTime: 0,
              nextScheduledRun: newNextRun
            });
          }
        }
        // ----- Idle Branch -----
        else if (actuator.status === 'idle') {
          // Check if today is one of the active days.
          const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          if (!actuator.schedule.activeDays.includes(currentDay)) {
            console.log(`[${actuator.name}] Skipping schedule - ${currentDay} is not active`);
            continue; // Skip this actuator if today is not an active day.
          }
        
          // Use stored nextScheduledRun if available; otherwise, calculate it from lastRun.
          let nextRun;
          if (actuator.nextScheduledRun) {
            nextRun = typeof actuator.nextScheduledRun === 'number'
              ? actuator.nextScheduledRun
              : Date.parse(actuator.nextScheduledRun);
          } else {
            nextRun = this.calculateNextRun(actuator.lastRun, actuator.schedule.interval);
          }
          const timeUntilNext = Math.floor((nextRun - now) / 1000);
        
          console.log(`[${actuator.name}] Idle Check:`, {
            currentTime: new Date(now).toISOString(),
            nextRun: new Date(nextRun).toISOString(),
            status: actuator.status,
            lastRun: actuator.lastRun ? new Date(actuator.lastRun).toISOString() : 'none',
            timeUntilNext
          });
        
          // Trigger a new run only when the current time has passed the scheduled nextRun.
          if (now >= nextRun) {
            // Add safety check for irrigation pump - skip activation if fertilizer is dispensing
            if (actuator.type === 'pump' && 
                actuator.name === 'Irrigation Pump' && 
                ActuatorController.isFertilizerDispensingActive()) {
              
              console.log(`[${actuator.name}] Schedule activation skipped - fertilizer dispensing is active`);
              
              // Calculate next run time to try again later
              const newNextRun = this.calculateNextRun(now, {
                hours: 0, 
                minutes: 1, 
                seconds: 0
              }); // Try again in 1 minute
              
              await Actuator.findOneAndUpdate(
                { id: actuator.id },
                { $set: { nextScheduledRun: newNextRun } },
                { new: true }
              );
              
              broadcastActuatorUpdate({
                ...actuator.toObject(),
                nextScheduledRun: newNextRun,
                preventedActivation: true,
                disabledByFertilizer: true,
                overrideMessage: 'Activation delayed - fertilizer in use'
              });
              
              continue; // Skip to next actuator
            }
            
            const newNextRun = this.calculateNextRun(now, actuator.schedule.interval);
            await ActuatorController.updateStatus(actuator.id, {
              status: 'active',
              startTime: now,
              lastRun: now,
              duration: duration,
              remainingTime: duration,
              nextScheduledRun: newNextRun
            });
          }
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error:', error);
    }
  }

  // Update countdown times and broadcast to clients
  async updateCountdowns() {
    try {
      const actuators = await Actuator.find({
        $or: [
          { status: 'active' },
          { status: 'paused' },
          { mode: 'auto', 'schedule.enabled': true }
        ]
      });

      const now = Date.now();
      
      for (const actuator of actuators) {
        // Active actuators - countdown based on elapsed time
        if (actuator.status === 'active' && actuator.startTime && actuator.duration) {
          const startTimeMs = new Date(actuator.startTime).getTime();
          const elapsedSeconds = Math.floor((now - startTimeMs) / 1000);
          const remainingTime = Math.max(0, actuator.duration - elapsedSeconds);
          
          // Send more frequent updates for active actuators
          broadcastActuatorUpdate({
            ...actuator.toObject(),
            remainingTime
          });

          // Log updates less frequently to avoid console spam
          if (remainingTime % 5 === 0 || remainingTime <= 10) {
            console.log(`[Scheduler] ${actuator.mode} actuator ${actuator.name} - remaining time: ${remainingTime}s of ${actuator.duration}s`);
          }

          // Check if countdown finished
          if (remainingTime <= 0) {
            console.log(`[Scheduler] Duration completed for ${actuator.name}, deactivating (${actuator.duration}s elapsed)`);
            
            // Store properties before deactivation
            const triggeredByRule = actuator.triggeredByRule;
            
            // CRITICAL FIX: Ensure auto mode is preserved
            // If actuator is in auto mode with schedule enabled, always keep it in auto mode
            const preserveMode = (actuator.mode === 'auto' && actuator.schedule && actuator.schedule.enabled)
              ? 'auto' 
              : (actuator.previousMode || actuator.mode);
            
            console.log(`[Scheduler] Restoring actuator ${actuator.name} to ${preserveMode} mode (was ${actuator.mode})`);
            
            // Update actuator with restored settings
            const updateData = {
              id: actuator.id,
              status: 'idle',
              mode: preserveMode, // Use our calculated preserve mode
              overrideMode: false,
              triggeredByRule: null,
              duration: 0,
              remainingTime: 0,
              startTime: null,
              lastRun: now
            };
            
            await ActuatorController.updateSettings(actuator.id, updateData);
            
            // Process rule deactivation if needed
            if (triggeredByRule) {
              try {
                const Rule = require('../models/Rule');
                const rule = await Rule.findById(triggeredByRule);
                
                if (rule) {
                  console.log(`[Scheduler] Found rule ${rule.name} to deactivate after duration completed`);
                  // Update rule state
                  rule.currentlyActive = false;
                  rule.activeSince = null;
                  await rule.save();
                  console.log(`[Scheduler] Rule ${rule.name} marked as inactive after ${actuator.duration}s duration`);
                } else {
                  console.log(`[Scheduler] Could not find rule ${triggeredByRule}`);
                }
              } catch (ruleError) {
                console.error(`[Scheduler] Error updating rule status:`, ruleError);
              }
            }
          }
        } 
        // Paused actuators - keep broadcasting stored remainingTime
        else if (actuator.status === 'paused') {
          // Broadcast paused actuator state regularly for UI consistency
          broadcastActuatorUpdate({
            ...actuator.toObject()
          });
          
          // Only log occasionally to reduce spam
          if (Math.floor(now / 1000) % 5 === 0) {
            console.log(`[Scheduler] Broadcasting paused state for ${actuator.name} - remainingTime: ${actuator.remainingTime}s`);
          }
        }
        // Idle actuators with nextScheduledRun
        else if (actuator.status === 'idle' && actuator.nextScheduledRun) {
          const nextRun = typeof actuator.nextScheduledRun === 'number'
            ? actuator.nextScheduledRun
            : Date.parse(actuator.nextScheduledRun);
          const countdown = Math.max(0, Math.floor((nextRun - now) / 1000));
          
          // Broadcast countdown update for next scheduled run
          broadcastActuatorUpdate({
            ...actuator.toObject(),
            remainingTime: countdown
          });
        }
      }
    } catch (error) {
      console.error('[Scheduler] Countdown Error:', error);
    }
  }

  start() {
    // Run initial checks
    this.checkAndRunSchedules();
    this.updateCountdowns();

    // Set up intervals
    setInterval(() => this.checkAndRunSchedules(), 1000);
    this.countdownInterval = setInterval(() => this.updateCountdowns(), 1000);
    
    console.log('Scheduler started with countdown updates');
  }

  stop() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
}

module.exports = new Scheduler();
