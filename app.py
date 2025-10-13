import json
import os
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
import numpy as np
from keras.preprocessing.image import img_to_array
from keras.models import load_model
from PIL import Image # Import Pillow library

app = Flask(__name__)

# --- CONFIGURATION ---
MODEL_PATH = "bakery_cnn.h5"
CLASS_INDICES_PATH = "class_indices.json"
BAKERY_INFO_PATH = "bakery_info.json"
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
IMAGE_SIZE = (128, 128)

# --- LOAD ONCE ON STARTUP ---
model = load_model(MODEL_PATH)
print("✅ Model loaded successfully")

with open(CLASS_INDICES_PATH, 'r', encoding='utf-8') as f:
    class_indices = json.load(f)
    labels = {v: k for k, v in class_indices.items()}
print("✅ Class indices loaded successfully")

with open(BAKERY_INFO_PATH, 'r', encoding='utf-8') as f:
    bakery_info = json.load(f)
print("✅ Bakery info loaded successfully")


# --- HELPER FUNCTIONS ---
def process_and_predict(pil_image):
    """Takes a PIL image object, processes it, and returns prediction."""
    # Resize and convert to numpy array
    img = pil_image.resize(IMAGE_SIZE)
    x = img_to_array(img)
    x = np.expand_dims(x, axis=0) / 255.0

    # Make prediction
    pred = model.predict(x)
    class_idx = np.argmax(pred, axis=-1)[0]
    label_key = labels[class_idx]

    # Get info
    predicted_item = bakery_info.get(label_key, {})
    item_name = predicted_item.get("vietnamese_name", "Unknown")
    price = predicted_item.get("price", 0)
    confidence = np.max(pred) * 100

    return item_name, price, confidence

# --- ROUTES ---
@app.route('/', methods=['GET'])
def index():
    """Renders the main page."""
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    """Handles single image upload and prediction."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'})
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'})

    if file:
        try:
            img = Image.open(file.stream).convert('RGB')
            item_name, price, confidence = process_and_predict(img)
            return jsonify({
                'item_name': item_name,
                'price': f"{price:,}".replace(",", "."),
                'confidence': f"{confidence:.2f}"
            })
        except Exception as e:
            return jsonify({'error': str(e)})
    
    return jsonify({'error': 'File processing error'})

@app.route('/predict_tray', methods=['POST'])
def predict_tray():
    """Handles tray image upload, crops it into 6 parts, and predicts each."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'})
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'})

    if file:
        try:
            img = Image.open(file.stream).convert('RGB')
            width, height = img.size
            
            cell_width = width // 3
            cell_height = height // 2

            predictions = []
            total_price = 0

            # Loop through the 2x3 grid
            for row in range(2):
                for col in range(3):
                    # Define the box for cropping
                    left = col * cell_width
                    top = row * cell_height
                    right = (col + 1) * cell_width
                    bottom = (row + 1) * cell_height
                    
                    cropped_img = img.crop((left, top, right, bottom))
                    
                    # Predict the cropped image
                    item_name, price, confidence = process_and_predict(cropped_img)
                    
                    predictions.append({
                        'position': len(predictions) + 1,
                        'item_name': item_name,
                        'price': int(price), # Cast to python int
                        'confidence': float(round(confidence, 2)) # Cast to python float
                    })
                    total_price += price

            return jsonify({
                'predictions': predictions,
                'total_price': int(total_price) # Cast to python int
            })

        except Exception as e:
            return jsonify({'error': str(e)})

    return jsonify({'error': 'File processing error'})


if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    app.run(debug=True)
