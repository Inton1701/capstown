const Sensor = require('../models/Sensor');
const asyncHandler = require('express-async-handler');
const parseAndValidateDate = (dateString) => {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return null;
        }
        return date;
    } catch {
        return null;
    }
};
const SensorController = {
    getLatestReadings: asyncHandler(async (req, res) => {
        const readings = await Sensor.findOne().sort({ timestamp: -1 });
        res.json({ success: true, data: readings });
    }),

    storeSensorData: asyncHandler(async (req, res) => {
        const reading = await Sensor.create(req.body);
        res.status(201).json({ success: true, data: reading });
    }),

    getHistoricalData: asyncHandler(async (req, res) => {
        const readings = await Sensor.find()
            .sort({ timestamp: -1 })
            .limit(100);
        res.json({ success: true, data: readings });
    }),

    downloadReadings: asyncHandler(async (req, res) => {
        const readings = await Sensor.find().sort({ timestamp: -1 });
        res.json({ success: true, data: readings });
    }),

    // New controller method for air temperature and humidity only
    storeAirTempHumidity: asyncHandler(async (req, res) => {
        try {
            const { airTemp, humidity } = req.body;
            
            // Validate input data
            if (airTemp === undefined || humidity === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Both airTemp and humidity values are required'
                });
            }
            
            // Create a new reading with default values for other parameters
            const reading = await Sensor.create({
                deviceId: 'SENSOR001',
                readings: {
                    ph: {
                        value: 7.0,
                        status: 'normal'
                    },
                    ec: {
                        value: 1.5,
                        status: 'normal'
                    },
                    waterTemp: {
                        value: 23.0,
                        status: 'normal'
                    },
                    airTemp: {
                        value: parseFloat(airTemp),
                        status: 'normal'
                    },
                    humidity: {
                        value: parseFloat(humidity),
                        status: 'normal'
                    },
                    waterLevel: {
                        value: 50,
                        status: 'normal'
                    }
                },
                timestamp: new Date()
            });
            
            res.status(201).json({
                success: true,
                message: 'Air temperature and humidity data stored successfully',
                data: reading
            });
        } catch (error) {
            console.error('Error storing air temperature and humidity:', error);
            res.status(500).json({
                success: false,
                message: 'Error storing air temperature and humidity data',
                error: error.message
            });
        }
    }),

    generateDummyData: asyncHandler(async (req, res) => {
        try {
            const { count = 24 } = req.body;
            const dummyReadings = [];

            for (let i = 0; i < count; i++) {
                const timestamp = new Date(Date.now() - (i * 60 * 60 * 1000));
                
                const newReading = {
                    deviceId: 'SENSOR001',
                    readings: {
                        ph: {
                            value: parseFloat((Math.random() * (7.5 - 5.5) + 5.5).toFixed(2)),
                            status: 'normal'
                        },
                        ec: {
                            value: parseFloat((Math.random() * (2.5 - 1.0) + 1.0).toFixed(2)),
                            status: 'normal'
                        },
                        waterTemp: {
                            value: parseFloat((Math.random() * (26 - 20) + 20).toFixed(1)),
                            status: 'normal'
                        },
                        airTemp: {
                            value: parseFloat((Math.random() * (30 - 20) + 20).toFixed(1)),
                            status: 'normal'
                        },
                        humidity: {
                            value: parseFloat((Math.random() * (80 - 50) + 50).toFixed(1)),
                            status: 'normal'
                        }
                    },
                    timestamp
                };

                const reading = new Sensor(newReading);
                await reading.save();
                dummyReadings.push(reading);
            }

            res.status(201).json({
                success: true,
                message: `Generated ${count} dummy readings`,
                data: dummyReadings
            });
        } catch (error) {
            console.error('Error generating dummy data:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating dummy data',
                error: error.message
            });
        }
    })
};

module.exports = SensorController;