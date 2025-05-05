const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    default: 'DEVICE001'
  },
  ph: {
    type: Number,
    min: 0,
    max: 14
  },
  ec: {
    type: Number,
    min: 0
  },
  waterLevel: {
    type: Number,
    min: 0,
    max: 100
  },
  airTemp: {
    type: Number
  },
  waterTemp: {
    type: Number
  },
  humidity: {
    type: Number,
    min: 0,
    max: 100
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Reading = mongoose.model('Reading', readingSchema);

module.exports = Reading;
