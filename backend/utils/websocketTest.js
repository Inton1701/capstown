/**
 * Utility for testing WebSocket communication
 */
const WebSocket = require('ws');
const { broadcastTempHumUpdate, broadcastActuatorUpdate } = require('../services/websocket');

// Test sending temperature and humidity data
const sendTestTempHumData = () => {
    const testData = {
        temperature: (20 + Math.random() * 10).toFixed(2),
        humidity: (50 + Math.random() * 30).toFixed(2)
    };
    
    console.log('Sending test temperature and humidity data:', testData);
    broadcastTempHumUpdate(testData);
    
    return testData;
};

// Test sending actuator data
const sendTestActuatorData = () => {
    const testData = {
        id: 'test-actuator',
        name: 'Test Actuator',
        state: Math.random() > 0.5 ? 'on' : 'off',
        timestamp: new Date().toISOString()
    };
    
    console.log('Sending test actuator data:', testData);
    broadcastActuatorUpdate(testData);
    
    return testData;
};

// Manual WebSocket client for testing
const createTestClient = (url = 'ws://localhost:5000/ws') => {
    const ws = new WebSocket(url);
    
    ws.on('open', () => {
        console.log('Test client connected to WebSocket server');
    });
    
    ws.on('message', (data) => {
        try {
            const parsed = JSON.parse(data);
            console.log('Test client received message:', parsed);
        } catch (err) {
            console.error('Error parsing message:', err);
            console.log('Raw message:', data);
        }
    });
    
    ws.on('close', () => {
        console.log('Test client disconnected');
    });
    
    ws.on('error', (err) => {
        console.error('Test client error:', err);
    });
    
    return ws;
};

module.exports = {
    sendTestTempHumData,
    sendTestActuatorData,
    createTestClient
};
