const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

let wss;
const clients = new Map(); // Track connected clients with IDs

const initWebSocket = (server) => {
    wss = new WebSocket.Server({ 
        server,
        clientTracking: true
    });

    wss.on('connection', (ws) => {
        // Assign unique ID to client
        const clientId = uuidv4();
        clients.set(ws, clientId);
        
        console.log(`New client connected: ${clientId}`);

        // Send connection acknowledgment with client ID
        ws.send(JSON.stringify({
            type: 'connection',
            data: { 
                status: 'connected', 
                clientId
            }
        }));

        // Keep connection alive with ping/pong
        const interval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            }
        }, 30000);

        ws.on('pong', () => {
            // Client responded, connection is alive
        });

        // Handle messages from ESP32 or frontend
        ws.on('message', (message) => {
            try {
                const parsed = JSON.parse(message);
                
                // ... existing handlers
                if (parsed.type === 'status_update') {
                    console.log('ESP32 Status Update:', parsed.data);
                }
            } catch (error) {
                console.error('Invalid JSON received:', error);
            }
        });

        ws.on('close', () => {
            clearInterval(interval);
            
            // Remove from clients map
            clients.delete(ws);
            console.log(`Client disconnected: ${clientId}`);
        });

        ws.on('error', (error) => {
            console.error(`WebSocket client error (${clientId}):`, error);
            clearInterval(interval);
            
            clients.delete(ws);
        });
    });

    wss.on('error', (error) => {
        console.error('WebSocket server error:', error);
    });
};

// Broadcast fertilizer progress updates with auto-dosing information
const broadcastFertilizerProgress = (data) => {
    if (!wss) return;

    // Always include current server timestamp to allow precise countdown calculation on client
    data.serverTimestamp = Date.now();

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'fertilizer_progress',
                data
            }));
        }
    });
};

// Check if auto-dosing is active helper
const isAutoDosingActive = () => {
    try {
        const ActuatorController = require('../controllers/ActuatorController');
        const status = ActuatorController.getAutoDosingStatus();
        return status.active === true;
    } catch (error) {
        console.error('Error checking auto-dosing status:', error);
        return false;
    }
};

// For new client connections, send current auto-dosing status
const sendInitialAutoDosingStatus = (ws) => {
    try {
        const ActuatorController = require('../controllers/ActuatorController');
        const status = ActuatorController.getAutoDosingStatus();
        
        // Only send if active
        if (status.active) {
            ws.send(JSON.stringify({
                type: 'fertilizer_progress',
                data: {
                    isDispensing: status.inMixingPhase || status.recentlyActive.length > 0,
                    autoDosingMode: true,
                    currentEC: status.currentEC,
                    targetEC: status.targetEC,
                    inMixingPhase: status.inMixingPhase,
                    mixingTimeRemaining: status.mixingTimeRemaining,
                    mixingEndTime: status.mixingEndTime,
                    nextCheckTime: status.nextCheckTime,
                    serverTimestamp: Date.now()
                }
            }));
        }
    } catch (error) {
        console.error('Error sending initial auto-dosing status:', error);
    }
};

// **Send actuator updates to all clients (Frontend & ESP32)**
const broadcastActuatorUpdate = (data) => {
    if (!wss) return;

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'actuator_update',
                data
            }));
        }
    });
};

module.exports = {
    initWebSocket,
    broadcastActuatorUpdate,
    broadcastFertilizerProgress,
    isAutoDosingActive,
    sendInitialAutoDosingStatus
};

