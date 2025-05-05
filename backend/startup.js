const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { ensurePythonServerRunning } = require('./services/pythonBridge');

// Function to start the Node.js server
async function startNodeServer() {
  console.log('Starting Node.js backend server...');
  
  // Start the main app
  const nodeProcess = spawn('node', ['app.js'], {
    stdio: 'inherit',
    shell: true
  });

  // Handle server process events
  nodeProcess.on('error', (err) => {
    console.error('Failed to start Node.js server:', err);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    console.log('Shutting down servers...');
    nodeProcess.kill('SIGINT');
    process.exit(0);
  });
}

// Main function to start all services
async function startAllServices() {
  console.log('Starting all services...');
  
  try {
    // First ensure Python model server is running
    console.log('Ensuring Python model server is running...');
    await ensurePythonServerRunning();
    console.log('Python model server is running.');
    
    // Then start the Node.js server
    await startNodeServer();
  } catch (error) {
    console.error('Error starting services:', error);
    process.exit(1);
  }
}

// Start everything
startAllServices();
