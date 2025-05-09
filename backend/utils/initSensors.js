const Sensor = require('../models/Sensor');
const defaultSensors = require('../config/defaultSensors');

async function initializeSensors() {
    try {
        // Check if sensors already exist
        const count = await Sensor.countDocuments();
        
        if (count === 0) {
            console.log('Initializing default sensors...');
            
            // Initialize sensors from default values
            await Sensor.insertMany(defaultSensors);
            
            console.log('Default sensors initialized successfully');
        } else {
            console.log('Sensors already initialized');
        }
    } catch (error) {
        console.error('Error initializing sensors:', error);
        throw error;
    }
}

module.exports = initializeSensors;
