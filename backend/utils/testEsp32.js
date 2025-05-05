/**
 * Utility for testing ESP32 WebSocket communication
 */
const WebSocket = require('ws');

// ESP32 temperature humidity simulation
class Esp32Simulator {
    constructor(wsUrl = 'ws://localhost:5000/ws') {
        this.wsUrl = wsUrl;
        this.ws = null;
        this.connected = false;
        this.simulationInterval = null;
    }

    connect() {
        this.ws = new WebSocket(this.wsUrl);
        
        this.ws.on('open', () => {
            this.connected = true;
            console.log('ESP32 simulator connected to WebSocket server');
        });
        
        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log('ESP32 simulator received message:', message);
                
                // Respond to certain messages
                if (message.type === 'connection') {
                    console.log('Connection acknowledged');
                }
            } catch (err) {
                console.error('Error parsing message:', err);
            }
        });
        
        this.ws.on('close', () => {
            this.connected = false;
            console.log('ESP32 simulator disconnected');
        });
        
        this.ws.on('error', (error) => {
            console.error('ESP32 simulator WebSocket error:', error);
        });
        
        return this;
    }
    
    // Send a single temperature and humidity update
    sendUpdate(temperature = null, humidity = null) {
        if (!this.connected) {
            console.error('Cannot send update: not connected');
            return false;
        }
        
        const temp = temperature !== null ? temperature : (20 + Math.random() * 10).toFixed(2);
        const hum = humidity !== null ? humidity : (50 + Math.random() * 30).toFixed(2);
        
        const data = {
            temperature: temp,
            humidity: hum
        };
        
        console.log('Sending ESP32 update:', data);
        this.ws.send(JSON.stringify(data));
        return data;
    }
    
    // Start automatic simulation
    startSimulation(intervalMs = 5000) {
        if (this.simulationInterval) {
            this.stopSimulation();
        }
        
        console.log(`Starting ESP32 simulation with interval ${intervalMs}ms`);
        this.simulationInterval = setInterval(() => {
            this.sendUpdate();
        }, intervalMs);
    }
    
    stopSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
            console.log('ESP32 simulation stopped');
        }
    }
    
    close() {
        this.stopSimulation();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Example usage:
// const simulator = new Esp32Simulator().connect();
// simulator.startSimulation(5000);  // Send updates every 5 seconds

module.exports = {
    Esp32Simulator
};
