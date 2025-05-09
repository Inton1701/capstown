const defaultSensors = [
    {
        deviceId: 'SENSOR001',
        readings: {
            ph: {
                value: 0,
                status: 'normal'
            },
            ec: {
                value: 0,
                status: 'normal'
            },
            waterTemp: {
                value: 0,
                status: 'normal'
            },
            airTemp: {
                value: 0,
                status: 'normal'
            },
            humidity: {
                value: 0,
                status: 'normal'
            },
            waterLevel: {
                value: 0,
                status: 'normal'
            }
        }
    }
];

module.exports = defaultSensors;
