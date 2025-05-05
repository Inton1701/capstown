const RuleController = require('../controllers/RuleController');
const ActuatorController = require('../controllers/ActuatorController');

class RuleService {
  constructor() {
    this.checkInterval = null;
    this.CHECK_INTERVAL_MS = 5000; // Check rules every 5 seconds
  }

  start() {
    console.log('[RuleService] Starting rule evaluation service');
    this.checkInterval = setInterval(() => {
      this.checkRules();
    }, this.CHECK_INTERVAL_MS);
  }

  async checkRules() {
    try {
      // Patch RuleController to have access to fertilizer dispensing status
      RuleController.fertilizerDispensingActive = ActuatorController.isFertilizerDispensingActive();
      
      await RuleController.checkAndApplyRules();
    } catch (error) {
      console.error('[RuleService] Error checking rules:', error);
    }
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[RuleService] Rule evaluation service stopped');
    }
  }
}

module.exports = new RuleService();
