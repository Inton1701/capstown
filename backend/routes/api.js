const express = require('express');
const mongoose = require('mongoose'); // Add mongoose import to validate ObjectIds
const router = express.Router();
const { Actuator } = require('../models/Actuator');
const initializeActuators = require('../utils/initActuators');
const SensorController = require('../controllers/SensorController');
const PlantController = require('../controllers/PlantController');
const ActuatorController = require('../controllers/ActuatorController');
const RuleController = require('../controllers/RuleController');
const asyncHandler = require('express-async-handler');
const { broadcastTempHumUpdate } = require('../services/websocket');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Sensor routes
router.get('/readings/latest', SensorController.getLatestReadings);
router.post('/readings', SensorController.storeSensorData);
router.get('/readings/history', SensorController.getHistoricalData);
router.get('/readings/download', SensorController.downloadReadings);
// New route for air temperature and humidity only
router.post('/readings/air', SensorController.storeAirTempHumidity);

// Plant routes
router.get('/plant/status', PlantController.getPlantStatus);
router.post('/plant/analyze', PlantController.updatePlantAnalysis);
router.post('/plant/analyze-image', upload.single('image'), PlantController.analyzePlantImage);
// Add new route for plant image history
router.get('/plant/image-history', PlantController.getPlantImageHistory);

// Actuator routes
router.get('/actuators/status', asyncHandler(async (req, res) => {
    const status = await ActuatorController.getActuatorsStatus();
    res.status(200).json({ success: true, data: status });
}));

router.put('/actuators/:id/status', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await ActuatorController.updateStatus(id, req.body);
    res.json({ success: true, data: result });
}));

router.put('/actuators/:id/settings', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await ActuatorController.updateSettings(id, req.body);
    res.json({ success: true, data: result });
}));

router.post('/actuators/status-update', asyncHandler(async (req, res) => {
    const { actuators } = req.body;
    if (!Array.isArray(actuators)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid request format'
        });
    }

    const updatePromises = actuators.map(update => 
        ActuatorController.updateStatus(update.id, { status: update.status })
    );

    await Promise.all(updatePromises);
    res.status(200).json({ success: true });
}));

// Sample test route for actuator status
router.post('/actuators/:id/test-status', asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { status = 'active', duration = 5 } = req.body; // Default 5 seconds if not specified

        // Update status with required fields
        const result = await ActuatorController.updateStatus(id, {
            status: status,
            startTime: Date.now(),
            duration: duration,
            remainingTime: duration
        });

        console.log(`Test status update for ${id}:`, {
            status: result.status,
            duration: result.duration,
            remainingTime: result.remainingTime
        });

        res.json({ 
            success: true, 
            data: result 
        });
    } catch (error) {
        console.error('Test status update error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}));

router.get('/actuators/:id/remaining-time', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await ActuatorController.getRemainingTime(id);
    res.json({ success: true, data: result });
}));

// Reset actuators (development only)
router.post('/actuators/reset', asyncHandler(async (req, res) => {
    try {
        await Actuator.deleteMany({});
        console.log('Existing actuators deleted');

        await initializeActuators();
        console.log('New actuators initialized');

        res.json({ 
            success: true, 
            message: 'Actuators reset successfully' 
        });
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}));

// Add new endpoint for combined fertilizer dispensing
router.post('/actuators/fertilizer/combined', asyncHandler(async (req, res) => {
  try {
    const result = await ActuatorController.handleCombinedFertilizer(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Combined fertilizer error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to process combined fertilizer request' 
    });
  }
}));

// Add endpoint for stopping fertilizer dispensing
router.post('/actuators/fertilizer/combined/stop', asyncHandler(async (req, res) => {
  try {
    const result = await ActuatorController.stopFertilizerDispensing();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error stopping fertilizer dispensing:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to stop fertilizer dispensing'
    });
  }
}));

// Add new routes for auto-dosing
router.post('/actuators/fertilizer/auto-dose', asyncHandler(async (req, res) => {
  try {
    const result = await ActuatorController.startAutoDosing(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Auto-dosing setup error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to start auto-dosing' 
    });
  }
}));

router.post('/actuators/fertilizer/auto-dose/stop', asyncHandler(async (req, res) => {
  try {
    const result = await ActuatorController.stopAutoDosing();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error stopping auto-dosing:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to stop auto-dosing'
    });
  }
}));

router.get('/actuators/fertilizer/auto-dose/status', asyncHandler(async (req, res) => {
  try {
    const status = ActuatorController.getAutoDosingStatus();
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    console.error('Error getting auto-dosing status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get auto-dosing status'
    });
  }
}));

// Rule routes directly in api.js instead of a separate file
// Get all rules
router.get('/rules', asyncHandler(async (req, res) => {
  const rules = await RuleController.getAllRules();
  res.json({ success: true, data: rules });
}));

// Create a new rule
router.post('/rules', asyncHandler(async (req, res) => {
  const rule = await RuleController.createRule(req.body);
  res.status(201).json({ success: true, data: rule });
}));

// Get a rule by ID
router.get('/rules/:id', asyncHandler(async (req, res) => {
  const rule = await RuleController.getRuleById(req.params.id);
  res.json({ success: true, data: rule });
}));

// Update a rule
router.put('/rules/:id', asyncHandler(async (req, res) => {
  const rule = await RuleController.updateRule(req.params.id, req.body);
  res.json({ success: true, data: rule });
}));

// Delete a rule
router.delete('/rules/:id', asyncHandler(async (req, res) => {
  const rule = await RuleController.deleteRule(req.params.id);
  res.json({ success: true, data: rule });
}));

// Completely rewritten toggle rule status endpoint
router.patch('/rules/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[API] Received rule toggle request for ID: ${id}`);
    
    // Basic validation first
    if (!id) {
      console.error('[API] Missing rule ID in request');
      return res.status(400).json({
        success: false,
        message: 'Rule ID is required'
      });
    }
    
    // Validate MongoDB ID format to prevent server errors
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error(`[API] Invalid MongoDB ID format: ${id}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid rule ID format'
      });
    }
    
    // Process the toggle action
    RuleController.toggleRuleStatus(id)
      .then(rule => {
        console.log(`[API] Rule ${id} toggle successful - New status: ${rule.enabled}`);
        return res.status(200).json({
          success: true,
          message: `Rule ${rule.enabled ? 'enabled' : 'disabled'} successfully`,
          data: rule
        });
      })
      .catch(err => {
        console.error(`[API] Error in rule toggle:`, err);
        const statusCode = err.message.includes('not found') ? 404 : 500;
        return res.status(statusCode).json({
          success: false,
          message: err.message || 'Server error occurred'
        });
      });
  } catch (error) {
    console.error('[API] Unexpected error in rule toggle endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// PATCH route to update rule fields (for debugging)
router.patch('/rules/:id', asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid rule ID format' });
  }
  
  try {
    // Update only specific fields that are present
    const updateData = {};
    const allowedFields = ['currentlyActive', 'activeSince', 'lastTriggered', 'enabled'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    // Only attempt to update if we have fields to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid fields to update' 
      });
    }
    
    const rule = await Rule.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    if (!rule) {
      return res.status(404).json({ 
        success: false, 
        message: 'Rule not found' 
      });
    }
    
    res.json({ success: true, data: rule });
  } catch (error) {
    console.error('Error updating rule:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}));

// Force check all rules (for testing)
router.post('/rules/check', asyncHandler(async (req, res) => {
  await RuleController.checkAndApplyRules();
  res.json({ success: true, message: 'Rules checked and applied' });
}));

// Add a test endpoint for triggering temp/hum updates (for testing)
router.post('/test/sensor-update', (req, res) => {
    try {
        const { temperature, humidity } = req.body;
        
        // Create data in the ESP32 format
        const testData = {
            temperature: temperature ? parseFloat(temperature).toFixed(2) : '25.50',
            humidity: humidity ? parseFloat(humidity).toFixed(2) : '60.00'
        };
        
        console.log('Sending test temperature and humidity data:', testData);
        
        // Broadcast the data
        broadcastTempHumUpdate(testData);
        
        return res.status(200).json({
            success: true,
            message: 'Test temperature and humidity data sent',
            data: testData
        });
    } catch (error) {
        console.error('Error sending test sensor data:', error);
        return res.status(500).json({
            success: false,
            message: 'Error sending test sensor data',
            error: error.message
        });
    }
});

module.exports = router;