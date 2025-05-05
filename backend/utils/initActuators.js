const { Actuator, PhPump, FertilizerPump, SensorPump } = require('../models/Actuator');
const defaultActuators = require('../config/defaultActuators');

async function initializeActuators() {
    try {
        // Check if actuators already exist
        const count = await Actuator.countDocuments();
        
        if (count === 0) {
            console.log('Initializing default actuators...');
            
            // Initialize actuators based on their type
            for (const actuator of defaultActuators) {
                switch (actuator.type) {
                    case 'ph-pump':
                        await PhPump.create(actuator);
                        break;
                    case 'fertilizer-pump':
                        await FertilizerPump.create(actuator);
                        break;
                    case 'sensor-pump':
                        await SensorPump.create(actuator);
                        break;
                    default:
                        await Actuator.create(actuator);
                }
            }
            
            console.log('Default actuators initialized successfully');
        } else {
            console.log('Actuators already initialized');
        }
    } catch (error) {
        console.error('Error initializing actuators:', error);
        throw error;
    }
}

module.exports = initializeActuators;