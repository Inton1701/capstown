const mongoose = require('mongoose');

const sensorSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: [true, 'Device ID is required'],
        default: 'SENSOR001'
    },
    readings: {
        ph: {
            value: {
                type: Number,
                required: true,
                min: 0,
                max: 14
            },
            status: {
                type: String,
                enum: ['normal', 'warning', 'error'],
                default: 'normal'
            }
        },
        ec: {
            value: {
                type: Number,
                required: true,
                min: 0
            },
            status: {
                type: String,
                enum: ['normal', 'warning', 'error'],
                default: 'normal'
            }
        },
        waterTemp: {
            value: {
                type: Number,
                required: true
            },
            status: {
                type: String,
                enum: ['normal', 'warning', 'error'],
                default: 'normal'
            }
        },
        airTemp: {
            value: {
                type: Number,
                required: true
            },
            status: {
                type: String,
                enum: ['normal', 'warning', 'error'],
                default: 'normal'
            }
        },
        humidity: {
            value: {
                type: Number,
                required: true,
                min: 0,
                max: 100
            },
            status: {
                type: String,
                enum: ['normal', 'warning', 'error'],
                default: 'normal'
            }
        },
        waterLevel: {
            value: {
                type: Number,
                required: true
            },
            status: {
                type: String,
                enum: ['normal', 'warning', 'error'],
                default: 'normal'
            }
        }
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Sensor', sensorSchema);
