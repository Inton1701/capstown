const axios = require('axios');
const FormData = require('form-data');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const PYTHON_SERVER_URL = process.env.PYTHON_SERVER_URL || 'http://localhost:5001';
const PYTHON_SCRIPT_PATH = path.join(__dirname, '..', 'python', 'modelServer.py');
let serverProcess = null;
let serverStarting = false;

/**
 * Starts the Python model server if it's not already running
 */
function ensurePythonServerRunning() {
    return new Promise((resolve, reject) => {
        // First, check if server is already running
        checkServerHealth()
            .then(() => {
                console.log('Python server is already running');
                resolve();
            })
            .catch(() => {
                // Server not running, start it if not already starting
                if (serverStarting) {
                    console.log('Python server is already starting...');
                    // Wait for server to finish starting
                    const checkInterval = setInterval(() => {
                        checkServerHealth()
                            .then(() => {
                                clearInterval(checkInterval);
                                resolve();
                            })
                            .catch(() => {
                                // Still not ready, keep waiting
                            });
                    }, 1000);
                    return;
                }

                console.log('Starting Python model server...');
                serverStarting = true;

                // Make sure Python script directory exists
                if (!fs.existsSync(PYTHON_SCRIPT_PATH)) {
                    serverStarting = false;
                    return reject(new Error(`Python script not found at: ${PYTHON_SCRIPT_PATH}`));
                }

                // Launch the Python server process
                const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
                serverProcess = exec(`${pythonCommand} "${PYTHON_SCRIPT_PATH}"`, (error, stdout, stderr) => {
                    if (error) {
                        console.error('Python server error:', error);
                        console.error('stderr:', stderr);
                        serverStarting = false;
                        reject(error);
                    }
                });

                // Wait for server to be ready
                let attempts = 0;
                const maxAttempts = 10;
                const checkInterval = setInterval(() => {
                    attempts++;
                    checkServerHealth()
                        .then(() => {
                            clearInterval(checkInterval);
                            serverStarting = false;
                            console.log('Python server started successfully');
                            resolve();
                        })
                        .catch(() => {
                            if (attempts >= maxAttempts) {
                                clearInterval(checkInterval);
                                serverStarting = false;
                                reject(new Error('Failed to start Python server after multiple attempts'));
                            }
                        });
                }, 1500);
            });
    });
}

/**
 * Checks if the Python server is healthy
 */
function checkServerHealth() {
    return axios.get(`${PYTHON_SERVER_URL}/health`, { timeout: 2000 })
        .then(response => {
            if (response.data.status === 'ok') {
                return true;
            }
            throw new Error('Server responded but health check failed');
        });
}

/**
 * Send image to Python server for analysis
 * @param {Buffer} imageBuffer - Raw image data
 * @returns {Promise<Object>} Prediction results
 */
async function analyzePlantImage(imageBuffer) {
    try {
        // Ensure Python server is running
        await ensurePythonServerRunning();
        
        console.log('Sending image to Python model server for analysis...');
        
        const formData = new FormData();
        formData.append('image', imageBuffer, {
            filename: 'plant_image.jpg',
            contentType: 'image/jpeg'
        });
        
        const response = await axios.post(`${PYTHON_SERVER_URL}/predict`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            timeout: 30000, // 30 second timeout
            maxContentLength: 10 * 1024 * 1024, // 10MB
        });
        
        if (response.data && response.data.success) {
            console.log('Successfully received prediction from Python model:', {
                growth_stage: response.data.growth_stage,
                confidence: response.data.confidence,
                process_time_ms: response.data.process_time_ms
            });
            return response.data;
        } else {
            throw new Error(response.data?.error || 'Unknown error from Python server');
        }
    } catch (error) {
        console.error('Failed to get prediction from Python model:', error.message);
        throw new Error(`Python model error: ${error.message}`);
    }
}

// Cleanup on process exit
process.on('exit', () => {
    if (serverProcess) {
        console.log('Shutting down Python server...');
        serverProcess.kill();
    }
});

module.exports = {
    analyzePlantImage,
    ensurePythonServerRunning
};
