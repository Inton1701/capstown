const Plant = require('../models/Plant');
const asyncHandler = require('express-async-handler');
const { analyzeImage, GROWTH_STAGES } = require('../services/plantAnalyzer'); // Import GROWTH_STAGES
const fs = require('fs');
const path = require('path');
const { analyzePlantImage } = require('../services/pythonBridge');

const plantController = {
    getPlantStatus: asyncHandler(async (req, res) => {
        try {
            const plant = await Plant.findOne().sort({ lastChecked: -1 });
            res.status(200).json({ success: true, data: plant });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }),

    updatePlantAnalysis: asyncHandler(async (req, res) => {
        try {
            const { health, growthStage, metrics } = req.body;
            
            let plant = await Plant.findOne().sort({ lastChecked: -1 });
            if (!plant) {
                plant = new Plant();
            }

            plant.health = health;
            plant.growthStage = growthStage;
            plant.metrics = metrics;
            plant.lastChecked = new Date();

            await plant.save();
            res.status(200).json({ success: true, data: plant });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }),

    // New method to analyze plant image using the ML model
    analyzePlantImage: asyncHandler(async (req, res) => {
        try {
            if (!req.file) {
                console.error('No image file provided in request');
                return res.status(400).json({
                    success: false,
                    message: 'No image file provided'
                });
            }

            console.log('Analyzing plant image, received file:', req.file.originalname, 'size:', req.file.size);
            
            // Get the image buffer from the uploaded file
            const imageBuffer = req.file.buffer;
            
            // Save the image to disk first to ensure directory exists
            const imagesDir = path.join(__dirname, '..', 'public', 'plant-images');
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
                console.log('Created plant-images directory at:', imagesDir);
            }
            
            const filename = `plant_${Date.now()}.jpg`;
            const imagePath = path.join(imagesDir, filename);
            fs.writeFileSync(imagePath, imageBuffer);
            console.log('Saved image to:', imagePath);
            
            // Convert image to base64 for MongoDB storage
            const imageBase64 = imageBuffer.toString('base64');
            console.log('Converted image to base64 for MongoDB storage');
            
            // First try to use the Python model
            let pythonPrediction;
            try {
                pythonPrediction = await analyzePlantImage(imageBuffer);
                console.log('Python prediction complete:', pythonPrediction);
            } catch (pythonError) {
                console.warn('Python model error, falling back to JS implementation:', pythonError.message);
                pythonPrediction = null;
            }
            
            // Get JS analysis as backup or for additional metrics
            const jsAnalysis = await analyzeImage(imageBuffer);
            console.log('JS analysis complete');
            
            // Create or update plant record
            let plant = await Plant.findOne().sort({ lastChecked: -1 });
            if (!plant) {
                console.log('No existing plant record found, creating new one');
                plant = new Plant();
            }
            
            // If plant already has an image, add it to history before updating
            if (plant.imageData) {
                // Create a history entry with current image and growth stage
                const historyEntry = {
                    imageData: plant.imageData,
                    growthStage: {
                        name: plant.growthStage.name,
                        color: plant.growthStage.color,
                        stageIndex: plant.predictions?.stageIndex || 0
                    },
                    predictions: {
                        accuracy: plant.predictions?.accuracy || 0,
                        confidence: plant.predictions?.confidence || 0
                    },
                    timestamp: plant.lastChecked || new Date()
                };
                
                // Initialize history array if it doesn't exist
                if (!plant.imageHistory) {
                    plant.imageHistory = [];
                }
                
                // Add to history and limit to 10 most recent images
                plant.imageHistory.unshift(historyEntry);
                if (plant.imageHistory.length > 10) {
                    plant.imageHistory = plant.imageHistory.slice(0, 10);
                }
                
                console.log('Added previous image to history, history size:', plant.imageHistory.length);
            }
            
            // Determine which growth stage to use - prefer Python model if available
            const growthStageIndex = pythonPrediction ? pythonPrediction.growth_stage : jsAnalysis.growthStage.name.split(' ')[0];
            
            // Use the appropriate growth stage and confidence values
            plant.growthStage = GROWTH_STAGES[growthStageIndex];
            plant.health = jsAnalysis.health; // Use JS analysis for health assessment
            plant.metrics = jsAnalysis.metrics; // Use JS analysis for growth metrics
            
            // Combine predictions from Python (if available) or JS
            if (pythonPrediction) {
                // Use Python model predictions
                plant.predictions = {
                    stageIndex: pythonPrediction.growth_stage,
                    weekNumber: pythonPrediction.growth_stage,
                    rawValues: pythonPrediction.predictions,
                    percentages: pythonPrediction.predictions.map(p => parseFloat((p * 100).toFixed(2))),
                    labels: GROWTH_STAGES.map(stage => stage.name),
                    confidence: parseFloat((pythonPrediction.confidence * 100).toFixed(2)),
                    accuracy: parseFloat((pythonPrediction.confidence * 100).toFixed(1)),
                    source: 'python-model'
                };
            } else {
                // Fall back to JS predictions
                plant.predictions = jsAnalysis.predictions;
            }
            
            // Save image data to MongoDB
            plant.image = `/plant-images/${filename}`; // Keep path for backward compatibility
            plant.imageData = `data:image/jpeg;base64,${imageBase64}`; // Store base64 data
            plant.imageFormat = 'jpeg';
            plant.lastChecked = new Date();
            
            await plant.save();
            console.log('Plant record with image history saved to MongoDB');
            
            res.status(200).json({
                success: true,
                data: plant,
                modelSource: pythonPrediction ? 'python-keras' : 'javascript-simulation'
            });
        } catch (error) {
            console.error('Error analyzing plant image:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to analyze plant image',
                error: process.env.NODE_ENV === 'production' ? null : error.stack
            });
        }
    }),

    // Add new endpoint to get plant image history
    getPlantImageHistory: asyncHandler(async (req, res) => {
        try {
            const plant = await Plant.findOne().sort({ lastChecked: -1 });
            if (!plant || !plant.imageHistory || plant.imageHistory.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No plant image history found'
                });
            }
            
            res.status(200).json({
                success: true,
                data: plant.imageHistory
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to get plant image history'
            });
        }
    })
};

module.exports = plantController;