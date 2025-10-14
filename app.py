import os
import io
import json
import qrcode
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, render_template, send_file
from keras.models import load_model
from keras.preprocessing.image import img_to_array


app = Flask(__name__)


# ======================================
# CONFIGURATION
# ======================================
# Model & Data paths
MODEL_PATH = "bakery_cnn.h5"
CLASS_INDICES_PATH = "class_indices.json"
BAKERY_INFO_PATH = "bakery_info.json"
UPLOAD_FOLDER = 'uploads'
IMAGE_SIZE = (128, 128)

# Information bank for QR Payment
BANK_BIN = "970436"                 # Vietcombank
ACCOUNT_NO = "1040221643"           # Account Number
ACCOUNT_NAME = "THAN MINH NGHIA"    # Account Name

# Flask config
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


# ======================================
# LOAD MODEL & DATA
# ======================================
model = load_model(MODEL_PATH)
print("✅ Model loaded successfully")

with open(CLASS_INDICES_PATH, 'r', encoding='utf-8') as f:
    class_indices = json.load(f)
    labels = {v: k for k, v in class_indices.items()}
print("✅ Class indices loaded successfully")

with open(BAKERY_INFO_PATH, 'r', encoding='utf-8') as f:
    bakery_info = json.load(f)
print("✅ Bakery info loaded successfully")


# ======================================
# FUNCTION
# ======================================
def process_and_predict(pil_image):
    """ Image Processing and Prediction """
    img = pil_image.resize(IMAGE_SIZE)
    x = img_to_array(img)
    x = np.expand_dims(x, axis=0) / 255.0

    pred = model.predict(x)
    class_idx = np.argmax(pred, axis=-1)[0]
    confidence = np.max(pred) * 100

    label_key = labels[class_idx]
    predicted_item = bakery_info.get(label_key, {})
    item_name = predicted_item.get("vietnamese_name", "Unknown")
    price = predicted_item.get("price", 0)
    
    return item_name, price, confidence

def crc16(data: str) -> str:
    """ Generate CRC16 for QR code """
    poly = 0x1021
    crc = 0xFFFF

    for byte in data.encode('utf-8'):
        crc ^= (byte << 8)
        for _ in range(8):
            if (crc & 0x8000):
                crc = (crc << 1) ^ poly
            else:
                crc = crc << 1

    return format(crc & 0xFFFF, '04X')

def generate_qr_payload(bank_bin: str, account_no: str, amount: str,
                            description: str, account_name: str = "") -> str:
    """ Generate QR Payload from information """
    merchant_info_parts = [
        f"00{len('A000000727'):02d}A000000727",
        f"01{len(f'00{len(bank_bin):02d}{bank_bin}01{len(account_no):02d}{account_no}'):02d}"
        f"00{len(bank_bin):02d}{bank_bin}01{len(account_no):02d}{account_no}"
    ]
    merchant_info = "".join(merchant_info_parts)
    
    payload_parts = [
        "000201", "010212",
        f"38{len(merchant_info):02d}{merchant_info}",
        "5303704",
        f"54{len(amount):02d}{amount}",
        "5802VN",
    ]
    
    additional_info_parts = [f"01{len(description):02d}{description}"]
    additional_info = "".join(additional_info_parts)
    payload_parts.append(f"62{len(additional_info):02d}{additional_info}")
    payload_parts.append("6304")
    
    pre_crc_payload = "".join(payload_parts)
    return f"{pre_crc_payload}{crc16(pre_crc_payload)}"

def generate_qr_image(payload: str):
    """ Generate QR image from Payload """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4
    )
    qr.add_data(payload)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buf = io.BytesIO()
    img.save(buf, 'PNG')
    buf.seek(0)
    
    return buf


# ======================================
# ROUTES
# ======================================
@app.route('/', methods=['GET'])
def index():
    """ Home """
    return render_template('index.html')


@app.route('/predict', methods=['POST'])
def predict():
    """ Predict Single (1) """
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        img = Image.open(file.stream).convert('RGB')
        item_name, price, confidence = process_and_predict(img)
        return jsonify({
            'item_name': item_name,
            'price': int(price),
            'confidence': f"{confidence:.2f}"
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/predict_tray', methods=['POST'])
def predict_tray():
    """ Predict Tray (6) """
    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({'error': 'No selected files'}), 400

    try:
        predictions = []
        total_price = 0

        for file in files:
            img = Image.open(file.stream).convert('RGB')
            item_name, price, confidence = process_and_predict(img)

            predictions.append({
                'position': len(predictions) + 1,
                'item_name': item_name,
                'price': int(price),
                'confidence': float(round(confidence, 2))
            })
            total_price += int(price)

        return jsonify({
            'predictions': predictions,
            'total_price': int(total_price)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/generate_qr', methods=['POST'])
def generate_qr():
    """ Generate QR from total money and show QR image """
    data = request.get_json()
    if not data or 'amount' not in data:
        return jsonify({'error': 'Missing amount'}), 400

    amount = str(data.get('amount'))
    description = data.get('description', f'Thanh toan don hang {np.random.randint(1000, 9999)}')

    try:
        qr_payload = generate_qr_payload(
            bank_bin=BANK_BIN,
            account_no=ACCOUNT_NO,
            amount=amount,
            description=description,
            account_name=ACCOUNT_NAME
        )
        
        qr_buffer = generate_qr_image(qr_payload)
        
        # Return image to browser
        return send_file(qr_buffer, mimetype='image/png')

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ======================================
# MAIN
# ======================================
if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    app.run(debug=True)