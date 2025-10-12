import json
import os
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
import numpy as np
from keras.preprocessing.image import load_img, img_to_array
from keras.models import load_model

app = Flask(__name__)

# Paths
MODEL_PATH = "bakery_cnn.h5"
CLASS_INDICES_PATH = "class_indices.json"
BAKERY_INFO_PATH = "bakery_info.json"
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Image settings
IMAGE_SIZE = (128, 128)

# Load model
model = load_model(MODEL_PATH)
print("✅ Model loaded successfully")

# Load class indices
with open(CLASS_INDICES_PATH, 'r', encoding='utf-8') as f:
    class_indices = json.load(f)
print("✅ Class indices loaded successfully")

# Load bakery info
with open(BAKERY_INFO_PATH, 'r', encoding='utf-8') as f:
    bakery_info = json.load(f)
print("✅ Bakery info loaded successfully")

labels = {v: k for k, v in class_indices.items()}

def predict_image(image_path):
    """Predicts the class and price of a given image."""
    img = load_img(image_path, target_size=IMAGE_SIZE)
    x = img_to_array(img)
    x = np.expand_dims(x, axis=0) / 255.0

    pred = model.predict(x)
    class_idx = np.argmax(pred, axis=-1)[0]
    label_key = labels[class_idx]

    predicted_item = bakery_info.get(label_key)
    item_name = predicted_item.get("vietnamese_name", "Unknown")
    price = predicted_item.get("price", 0)
    confidence = np.max(pred) * 100

    return item_name, price, confidence

@app.route('/', methods=['GET'])
def index():
    """Renders the main page."""
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    """Handles image upload and prediction."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'})

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No selected file'})

    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        item_name, price, confidence = predict_image(filepath)

        return jsonify({
            'item_name': item_name,
            'price': f"{price:,}".replace(",", "."),
            'confidence': f"{confidence:.2f}"
        })

if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    app.run(debug=True)