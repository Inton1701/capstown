import os
import numpy as np
import tensorflow as tf
from flask import Flask, request, jsonify
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image
import tempfile
import time

app = Flask(__name__)

# Suppress TensorFlow logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

# Load the model
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'machine learning models', 'lettuce_growth_model.keras')
print(f"Loading model from: {MODEL_PATH}")
model = load_model(MODEL_PATH)
print("Model loaded successfully!")

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'model': 'loaded'})

@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'success': False, 'error': 'No image file provided'})
    
    file = request.files['image']
    
    # Save the uploaded file temporarily
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
    file.save(temp_file.name)
    temp_file.close()
    
    try:
        start_time = time.time()
        
        # Preprocess the image
        img_array = preprocess_image(temp_file.name)
        
        # Make prediction
        growth_stage, predictions = predict_growth_stage(img_array)
        
        # Calculate confidence from predictions
        confidence = float(predictions[growth_stage])
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        return jsonify({
            'success': True,
            'growth_stage': int(growth_stage),
            'predictions': [float(p) for p in predictions],
            'confidence': confidence,
            'process_time_ms': round(process_time * 1000, 2)
        })
    except Exception as e:
        import traceback
        return jsonify({
            'success': False, 
            'error': str(e),
            'traceback': traceback.format_exc()
        })
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_file.name):
            os.remove(temp_file.name)

def preprocess_image(img_path, target_size=(254, 254)):
    # Resize to target size
    img = image.load_img(img_path, target_size=target_size)
    
    # Convert to numpy array
    img_array = image.img_to_array(img)  

    # Add batch dimension
    img_array = np.expand_dims(img_array, axis=0)  

    # Normalize pixel values
    img_array /= 255.0  
    return img_array

def predict_growth_stage(img_array):    
    # Get predictions for the batch (first element)
    predictions = model.predict(img_array, verbose=0)[0]
    
    # Get the class with the highest probability
    growth_stage = np.argmax(predictions) 
    print(f"Predicted growth stage: {growth_stage}, confidence: {predictions[growth_stage]:.2f}")
    
    # Convert predictions to a Python list
    return growth_stage, predictions

if __name__ == '__main__':
    print("Starting Python model server...")
    app.run(host='0.0.0.0', port=5001, debug=False)
