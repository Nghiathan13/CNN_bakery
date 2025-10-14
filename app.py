import json
import os
import io # Thư viện để xử lý in-memory binary streams
import qrcode # Thư viện bạn đã cung cấp

from flask import Flask, request, jsonify, render_template, send_file
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

# --- THÔNG TIN THANH TOÁN VIETQR (Bạn cần thay đổi cho đúng) ---
BANK_BIN = "970436"  # Vietcombank
ACCOUNT_NO = "1040221643" # Số tài khoản của bạn
ACCOUNT_NAME = "THAN MINH NGHIA" # Tên chủ tài khoản

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

# --- VIETQR HELPER FUNCTIONS (Dựa trên code bạn cung cấp) ---
def crc16(data: str) -> str:
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

def generate_vietqr_payload(bank_bin: str, account_no: str, amount: str, description: str, account_name: str = "") -> str:
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

# --- ROUTES ---
@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files: return jsonify({'error': 'No file part'})
    file = request.files['file']
    if file.filename == '': return jsonify({'error': 'No selected file'})
    
    try:
        img = Image.open(file.stream).convert('RGB')
        item_name, price, confidence = process_and_predict(img)
        return jsonify({
            'item_name': item_name,
            'price': int(price), # Trả về dạng số để JS dễ xử lý
            'confidence': f"{confidence:.2f}"
        })
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/predict_tray', methods=['POST'])
def predict_tray():
    files = request.files.getlist('files')
    if not files or files[0].filename == '': return jsonify({'error': 'No selected files'})

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
        return jsonify({'error': str(e)})

# --- ROUTE MỚI ĐỂ TẠO QR CODE ---
@app.route('/generate_qr', methods=['POST'])
def generate_qr():
    """Tạo mã QR từ thông tin số tiền và mô tả được gửi lên."""
    data = request.get_json()
    if not data or 'amount' not in data:
        return jsonify({'error': 'Missing amount'}), 400

    amount = str(data.get('amount'))
    # Tạo mô tả đơn hàng ngẫu nhiên để tránh trùng lặp
    description = data.get('description', f'Thanh toan don hang {np.random.randint(1000, 9999)}')

    try:
        # Tạo payload
        qr_payload = generate_vietqr_payload(
            bank_bin=BANK_BIN,
            account_no=ACCOUNT_NO,
            amount=amount,
            description=description,
            account_name=ACCOUNT_NAME
        )
        
        # Tạo ảnh QR trong bộ nhớ
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(qr_payload)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Lưu ảnh vào một buffer in-memory
        buf = io.BytesIO()
        img.save(buf, 'PNG')
        buf.seek(0)
        
        # Trả về file ảnh cho trình duyệt
        return send_file(buf, mimetype='image/png')

    except Exception as e:
        return jsonify({'error': str(e)}), 500
# --- KẾT THÚC ROUTE MỚI ---

if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    app.run(debug=True)