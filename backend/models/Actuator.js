const mongoose = require('mongoose');

// Basic schedule schema for automatic mode
const scheduleSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    activeDays: [{ type: String }],
    interval: {
        hours: { type: Number, default: 0, min:0 },
        minutes: { type: Number, default: 0, min:0, max:60 },
        seconds: { type: Number, default: 0, min:0, max:60 }
    },
    duration: {
        hours: { type: Number, default: 0, min:0 },
        minutes: { type: Number, default: 0, min:0, max:60 },
        seconds: { type: Number, default: 0, min:0, max:60 }
    }
});

// Base actuator schema
const actuatorSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    pin: { type: Number, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    mode: { type: String, default: 'manual', enum: ['manual', 'auto', 'rule'] }, // Added 'rule' mode
    previousMode: { type: String, default: 'manual' }, // Store previous mode for restoration
    enabled: { type: Boolean, default: true },
    startTime: { type: Date, default: null },
    duration: { type: Number, default: 0 },
    elapsedTime: { type: Number, default: 0 }, // Add this field to store elapsed time
    remainingTime: { type: Number, default: 0 },
    status: { type: String, enum: ['idle', 'active', 'paused'], default: 'idle' },
    schedule: { type: scheduleSchema, default: () => ({}) },
    lastRun: { type: Number, default: null },
    flowRate: {
        type: Number,
        min: 0,
        default: 60.0, // Default of 60.0 mL per minute
        description: 'Flow rate in mL per minute'
    },
    nextScheduledRun: { type: Number, default: null },
    triggeredByRule: { type: mongoose.Schema.Types.ObjectId, ref: 'Rule', default: null },
    overrideMode: { type: Boolean, default: false }, // Explicit override mode flag
    fertilizerAmount: {
        type: Number,
        default: 1.0 // Default 1mL of fertilizer
    },
    waterAmount: {
        type: Number,
        default: 1.0 // Default 1L of water
    },
    // Add new fields for handling sequence display
    isPartOfSequence: { type: Boolean, default: false },
    sequencePosition: { type: Number, default: 0 },
    totalInSequence: { type: Number, default: 0 },
    dispensingDelay: { type: Number, default: 0 } // Delay in seconds between fertilizers
}, { 
    timestamps: true,
    discriminatorKey: 'actuatorType' 
});

// Discriminator schemas for specific pump types
const PhPumpSchema = new mongoose.Schema({
    flowRate: {
        type: Number,
        default: 0
       
    },
    direction: {
        type: String,
        enum: ['up', 'down'],
        required: true
    }
});

const FertilizerPumpSchema = new mongoose.Schema({
    flowRate: {
        type: Number,
        default: 60.0, // Default to 60 mL/min
        description: 'Flow rate in mL per minute'
    },
    nutrientType: {
        type: String,
        default: '', // Change default to empty string to prevent overriding user values
        set: (value) => value || '' // Ensure we don't save null/undefined values
    }
});

const SensorPumpSchema = new mongoose.Schema({
    lastReading: {
        type: Date,
        default: null
    }
});

// Add middleware to save previous mode when switching to rule mode
actuatorSchema.pre('save', function(next) {
    // If changing to rule mode, store the previous mode
    if (this.isModified('mode') && this.mode === 'rule' && this.previousMode !== 'rule') {
        // Only save previous mode if it's not already rule mode
        if (!this.previousMode || this.previousMode === 'rule') {
            this.previousMode = 'manual'; // Default fallback
        }
    }
    
    // Disable schedule in manual or rule mode
    if (this.mode === 'manual' || this.mode === 'rule') {
        this.schedule.enabled = false;
    }

    // Update lastRun when status changes to active
    if (this.isModified('status')) {
        if (this.status === 'active') {
            this.lastRun = Date.now();
        }
    }
    next();
});

// Create models
const Actuator = mongoose.model('Actuator', actuatorSchema);
const PhPump = Actuator.discriminator('ph-pump', PhPumpSchema);
const FertilizerPump = Actuator.discriminator('fertilizer-pump', FertilizerPumpSchema);
const SensorPump = Actuator.discriminator('sensor-pump', SensorPumpSchema);

module.exports = {
    Actuator,
    PhPump,
    FertilizerPump,
    SensorPump
};