const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { PORT } = require('./config/config');
const bodyParser = require('body-parser');
const initializeActuators = require('./utils/initActuators');
const http = require('http');
const scheduler = require('./services/scheduler');
const ruleService = require('./services/ruleService');
const { initializeAutoDosing } = require('./services/autoDosing');
const fs = require('fs');
const path = require('path');
const { ensurePythonServerRunning } = require('./services/pythonBridge');

// Initialize express
const app = express();
const server = http.createServer(app);

// Enable CORS with specific configuration
app.use(cors({
    origin: ['http://localhost:8080', 'http://192.168.254.185:8080', '*'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
    maxAge: 86400
}));

// Connect to database and initialize actuators
connectDB()
    .then(async () => {
        console.log('MongoDB connection established');
        try {
            await initializeActuators();
            console.log('Actuators initialized successfully');
            initializeAutoDosing();
            
            // Ensure Python model server is running
            try {
                await ensurePythonServerRunning();
                console.log('Python model server is running');
            } catch (error) {
                console.warn('Warning: Python model server could not be started:', error.message);
                console.warn('Plant analysis will fall back to JavaScript implementation');
            }
        } catch (error) {
            console.error('Error initializing actuators:', error);
        }
    })
    .catch(err => {
        console.error('Database connection error:', err);
        process.exit(1);
    });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Added body-parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Add improved request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] BEGIN ${req.method} ${req.url}`);
  
  // Track response
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] END ${req.method} ${req.url} - Status: ${res.statusCode} (${duration}ms)`);
    return originalSend.call(this, body);
  };
  
  next();
});

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Add request timeout handling middleware
app.use((req, res, next) => {
  // Set a 30 second timeout for all requests
  req.setTimeout(30000, () => {
    console.error(`[Timeout] Request timed out: ${req.method} ${req.url}`);
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        message: 'Request timeout'
      });
    }
  });
  next();
});

// Ensure public directory exists
const publicDir = path.join(__dirname, 'public');
const plantImagesDir = path.join(publicDir, 'plant-images');

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log('Created public directory');
}

if (!fs.existsSync(plantImagesDir)) {
    fs.mkdirSync(plantImagesDir, { recursive: true });
    console.log('Created plant-images directory');
}

// Serve static files
app.use('/plant-images', express.static(path.join(__dirname, 'public', 'plant-images')));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize WebSocket services first - using the same server instance
const websocketService = require('./services/websocket');
websocketService.initWebSocket(server);

// Then import auto-dosing manager so it can use the websocket service
const autoDosingManager = require('./services/AutoDosingManager');

// Start services
scheduler.start();
ruleService.start(); // Start the rule service

// Routes
app.use('/api', require('./routes/api'));

// Add auto-dosing initialization with better error handling
try {
  // Initialize auto-dosing after WebSocket and other services are ready
  console.log('Initializing auto-dosing service...');
  const { initializeAutoDosing, restoreAutoDosingState } = require('./services/autoDosing');
  
  // First initialize the service
  initializeAutoDosing();
  
  // Then attempt to restore previous state if it exists
  restoreAutoDosingState().then(restored => {
    if (restored) {
      console.log('Auto-dosing state was successfully restored');
    } else {
      console.log('No previous auto-dosing state to restore');
    }
  }).catch(err => {
    console.error('Error restoring auto-dosing state:', err.message);
  });
} catch (error) {
  console.error('Failed to initialize auto-dosing service:', error.message);
  console.log('System will continue without auto-dosing functionality');
}

// Add graceful shutdown handler for auto-dosing
process.on('SIGINT', async () => {
  console.log('Received shutdown signal, cleaning up...');
  
  try {
    // Safely stop auto-dosing
    const ActuatorController = require('./controllers/ActuatorController');
    await ActuatorController.stopAutoDosing();
    console.log('Auto-dosing stopped successfully');
  } catch (error) {
    console.error('Error stopping auto-dosing:', error.message);
  }
  
  console.log('Shutdown complete');
  process.exit(0);
});

// Improve error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  console.error(err.stack);
  
  // Send appropriate status code based on error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? null : err.stack
  });
});

// IMPORTANT: Use a single server for both HTTP and WebSocket
const HOST = '0.0.0.0';
server.listen(PORT, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`WebSocket server available at ws://${HOST}:${PORT}`);
});
