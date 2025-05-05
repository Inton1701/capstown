const defaultActuators = [
    {
        id: 'chiller',
        pin: 16,
        name: 'Chiller',
        type: 'chiller',
        icon: 'fas fa-snowflake',
        mode: 'manual',
        status: 'idle',
        schedule: {
            enabled: false,
            activeDays: [],
            interval: { hours: 0, minutes: 0, seconds: 0 },
            duration: { hours: 0, minutes: 0, seconds: 0 }
        },
        lastRun: null
    },
    {
        id: 'fan',
        pin: 4,
        name: 'Fan',
        type: 'fan',
        icon: 'fas fa-fan',
        mode: 'manual',
        status: 'idle',
        schedule: {
            enabled: false,
            activeDays: [],
            interval: { hours: 0, minutes: 0, seconds: 0 },
            duration: { hours: 0, minutes: 0, seconds: 0 }
        },
        lastRun: null
    },
    {
        id: 'irrigation-pump',
        pin: 5,
        name: 'Irrigation Pump',
        type: 'pump',
        icon: 'fas fa-tint',
        mode: 'manual',
        status: 'idle',
        schedule: {
            enabled: false,
            activeDays: [],
            interval: { hours: 0, minutes: 0, seconds: 0 },
            duration: { hours: 0, minutes: 0, seconds: 0 }
        },
        lastRun: null
    },
    {
        id: 'sensor-pump',
        pin: 18,
        name: 'Sensor Pump',
        type: 'sensor-pump',
        icon: 'fas fa-microscope',
        mode: 'manual',
        status: 'idle',
        schedule: {
            enabled: false,
            activeDays: [],
            interval: { hours: 0, minutes: 0, seconds: 0 },
            duration: { hours: 0, minutes: 0, seconds: 0 }
        },
        lastRun: null
    },
    {
        id: 'fertilizer-pump-a',
        pin: 19,
        name: 'Fertilizer Pump A',
        type: 'fertilizer-pump',
        icon: 'fas fa-flask',
        mode: 'manual',
        status: 'idle',
        nutrientType: 'A',
        flowRate: 1.0,
        schedule: {
            enabled: false,
            activeDays: [],
            interval: { hours: 0, minutes: 0, seconds: 0 },
            duration: { hours: 0, minutes: 0, seconds: 0 }
        },
        lastRun: null
    },
    {
        id: 'fertilizer-pump-b',
        pin: 21,
        name: 'Fertilizer Pump B',
        type: 'fertilizer-pump',
        icon: 'fas fa-flask',
        mode: 'manual',
        status: 'idle',
        nutrientType: 'B',
        flowRate: 1.0,
        schedule: {
            enabled: false,
            activeDays: [],
            interval: { hours: 0, minutes: 0, seconds: 0 },
            duration: { hours: 0, minutes: 0, seconds: 0 }
        },
        lastRun: null
    },
    {
        id: 'fertilizer-pump-c',
        pin: 22,
        name: 'Fertilizer Pump C',
        type: 'fertilizer-pump',
        icon: 'fas fa-flask',
        mode: 'manual',
        status: 'idle',
        nutrientType: 'C',
        flowRate: 1.0,
        schedule: {
            enabled: false,
            activeDays: [],
            interval: { hours: 0, minutes: 0, seconds: 0 },
            duration: { hours: 0, minutes: 0, seconds: 0 }
        },
        lastRun: null
    },
    {
        id: 'ph-up-pump',
        pin: 23,
        name: 'pH Up Pump',
        type: 'ph-pump',
        icon: 'fas fa-arrow-up',
        mode: 'manual',
        status: 'idle',
        direction: 'up',
        flowRate: 1.0,
        schedule: {
            enabled: false,
            activeDays: [],
            interval: { hours: 0, minutes: 0, seconds: 0 },
            duration: { hours: 0, minutes: 0, seconds: 0 }
        },
        lastRun: null
    },
    {
        id: 'ph-down-pump',
        pin: 24,
        name: 'pH Down Pump',
        type: 'ph-pump',
        icon: 'fas fa-arrow-down',
        mode: 'manual',
        status: 'idle',
        direction: 'down',
        flowRate: 1.0,
        schedule: {
            enabled: false,
            activeDays: [],
            interval: { hours: 0, minutes: 0, seconds: 0 },
            duration: { hours: 0, minutes: 0, seconds: 0 }
        },
        lastRun: null
    }
];

module.exports = defaultActuators;