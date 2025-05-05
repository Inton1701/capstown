const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  trigger: {
    type: String,
    required: true,
    enum: ['pH Level', 'EC Level', 'Water Level', 'Air Temperature', 'Water Temperature']
  },
  condition: {
    type: String,
    required: true,
    enum: ['<', '>', '=']
  },
  value: {
    type: Number,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  actuatorId: {
    type: String,
    required: true
  },
  solutionAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  enabled: {
    type: Boolean,
    default: true
  },
  lastTriggered: {
    type: Date,
    default: null
  },
  currentlyActive: {
    type: Boolean,
    default: false
  },
  activeSince: {
    type: Date,
    default: null
  },
  priority: {
    type: Number,
    default: 10,
    min: 1,
    max: 100
  },
  // Until condition fields
  untilConditionEnabled: {
    type: Boolean,
    default: false
  },
  untilTrigger: {
    type: String,
    enum: ['pH Level', 'EC Level', 'Water Level', 'Air Temperature', 'Water Temperature']
  },
  untilCondition: {
    type: String,
    enum: ['<', '>', '=']
  },
  untilValue: {
    type: Number
  },
  // Cooldown time field
  cooldownUntil: {
    type: Date,
    default: null
  },
  // Fertilizer dispensing conditions
  minInterval: {
    type: Number,
    default: 0,  // Minimum minutes between fertilizer dispensing
    min: 0
  },
  checkEcLevel: {
    type: Boolean,
    default: false  // Whether to check EC level before dispensing
  },
  maxEcLevel: {
    type: Number, 
    default: 3.0,  // Maximum EC level allowed for fertilizer dispensing
    min: 0
  }
}, { timestamps: true });

const Rule = mongoose.model('Rule', ruleSchema);

module.exports = Rule;
