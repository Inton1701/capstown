const mongoose = require('mongoose');

const PlantSchema = mongoose.Schema({
    health: {
        status: {
            type: String,
            enum: ['success', 'warning', 'danger'],
            default: 'success'
        },
        message: {
            type: String,
            default: 'Healthy'
        },
        emoji: {
            type: String,
            default: '🌱'
        }
    },
    growthStage: {
        name: {
            type: String,
            default: 'Seedling'
        },
        color: {
            type: String,
            default: 'primary'
        }
    },
    metrics: {
        height: {
            type: Number,
            default: 0
        },
        growthRate: {
            type: Number,
            default: 0
        },
        age: {
            type: Number,
            default: 0
        }
    },
    // Add predictions field to store detailed prediction data
    predictions: {
        stageIndex: {
            type: Number,
            default: 0
        },
        weekNumber: {
            type: Number,
            default: 0
        },
        rawValues: [Number],
        percentages: [Number],
        labels: [String],
        confidence: {
            type: Number,
            default: 0
        }
    },
    // Update image field to store base64 image data
    image: {
        type: String,
        default: ''
    },
    
    // Add new field for image data
    imageData: {
        type: String,  // Base64 encoded image data
        default: ''
    },
    
    // Add field to track image format
    imageFormat: {
        type: String,
        default: 'jpeg'
    },
    // Add image history array to store previous images and their growth stages
    imageHistory: [{
        imageData: String,  // Base64 encoded image
        growthStage: {
            name: String,
            color: String,
            stageIndex: Number
        },
        predictions: {
            accuracy: Number,
            confidence: Number
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    lastChecked: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Plant', PlantSchema);
