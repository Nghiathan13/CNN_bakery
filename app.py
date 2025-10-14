import json
import os
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
import numpy as np
from keras.preprocessing.image import img_to_array
from keras.models import load_model
from PIL import Image

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
    img = pil_image.resize(IMAGE_SIZE)
    x = img_to_array(img)
    x = np.expand_dims(x, axis=0) / 255.0
    pred = model.predict(x)
    class_idx = np.argmax(pred, axis=-1)[0]
    label_key = labels[class_idx]
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


# --- THAY ĐỔI BẮT ĐẦU TỪ ĐÂY ---

@app.route('/predict_tray', methods=['POST'])
def predict_tray():
    """
    Handles multiple cropped image uploads and predicts each one.
    The cropping logic is now done on the frontend.
    """
    # 1. Get the list of files sent from the frontend
    files = request.files.getlist('files')

    if not files or files[0].filename == '':
        return jsonify({'error': 'No selected files'})

    try:
        predictions = []
        total_price = 0

        # 2. Loop through each uploaded cropped file
        for file in files:
            img = Image.open(file.stream).convert('RGB')
            
            # 3. Predict each small image using the existing helper function
            item_name, price, confidence = process_and_predict(img)
            
            predictions.append({
                'position': len(predictions) + 1,
                'item_name': item_name,
                'price': int(price),
                'confidence': float(round(confidence, 2))
            })
            total_price += price

        return jsonify({
            'predictions': predictions,
            'total_price': int(total_price)
        })

    except Exception as e:
        return jsonify({'error': str(e)})

# --- KẾT THÚC THAY ĐỔI ---


if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    app.run(debug=True)