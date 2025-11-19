import io
import json
import base64
import qrcode
import numpy as np
import cv2
from PIL import Image
from flask import Flask, request, jsonify, render_template, send_file
from keras.models import load_model
from keras.preprocessing.image import img_to_array


# ======================================
# CONFIGURATION
# ======================================
MODEL_PATH = "bakery_cnn2.h5"
CLASS_INDICES_PATH = "class_indices.json"
BAKERY_INFO_PATH = "bakery_info.json"
IMAGE_SIZE = (128, 128)

BANK_BIN = "970436"
ACCOUNT_NO = "1040221643"
ACCOUNT_NAME = "THAN MINH NGHIA"

app = Flask(_name_)


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
# FUNCTIONS
# ======================================
def process_and_predict(pil_image):
    """Xử lý ảnh và dự đoán loại bánh với giá cả."""
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


def detect_and_crop_cakes(pil_image):
    """Phát hiện và cắt các bánh từ ảnh khay."""
    # =================================================================
    # TINH CHỈNH CÁC THAM SỐ
    # =================================================================
    SAVE_DEBUG_IMAGE = True
    MAX_ITEMS_TO_DETECT = 6
    TRAY_S_MAX = 85
    TRAY_V_MIN = 30
    OPENING_KERNEL_SIZE = 10
    CLOSING_KERNEL_SIZE = 15
    MIN_AREA_PIXELS = 30 * 30
    PADDING_PIXELS = 40

    open_cv_image = np.array(pil_image)
    open_cv_image = open_cv_image[:, :, ::-1].copy()
    img_height, img_width, _ = open_cv_image.shape

    hsv = cv2.cvtColor(open_cv_image, cv2.COLOR_BGR2HSV)

    lower_tray = np.array([0, 0, TRAY_V_MIN])
    upper_tray = np.array([235, TRAY_S_MAX, 255])
    tray_mask = cv2.inRange(hsv, lower_tray, upper_tray)
    item_mask = cv2.bitwise_not(tray_mask)

    opening_kernel = np.ones(
        (OPENING_KERNEL_SIZE, OPENING_KERNEL_SIZE), np.uint8
    )
    closing_kernel = np.ones(
        (CLOSING_KERNEL_SIZE, CLOSING_KERNEL_SIZE), np.uint8
    )

    cleaned_mask = cv2.morphologyEx(
        item_mask, cv2.MORPH_OPEN, opening_kernel, iterations=2
    )
    cleaned_mask = cv2.morphologyEx(
        cleaned_mask, cv2.MORPH_CLOSE, closing_kernel, iterations=2
    )

    contours, _ = cv2.findContours(
        cleaned_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    # Lọc và giữ lại N contour lớn nhất
    valid_contours = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area > MIN_AREA_PIXELS:
            valid_contours.append(contour)

    valid_contours.sort(key=cv2.contourArea, reverse=True)
    final_contours = valid_contours[:MAX_ITEMS_TO_DETECT]

    # Xử lý các contour đã lọc
    cropped_images = []
    if SAVE_DEBUG_IMAGE:
        debug_image = open_cv_image.copy()

    for contour in final_contours:
        x, y, w, h = cv2.boundingRect(contour)

        x_pad = max(0, x - PADDING_PIXELS)
        y_pad = max(0, y - PADDING_PIXELS)
        w_pad = min(img_width, x + w + PADDING_PIXELS)
        h_pad = min(img_height, y + h + PADDING_PIXELS)

        cropped_pil = pil_image.crop((x_pad, y_pad, w_pad, h_pad))
        cropped_images.append(cropped_pil)

        if SAVE_DEBUG_IMAGE:
            cv2.rectangle(
                debug_image, (x, y), (x + w, y + h), (0, 255, 0), 3
            )

    if SAVE_DEBUG_IMAGE:
        mask_bgr = cv2.cvtColor(cleaned_mask, cv2.COLOR_GRAY2BGR)
        combined_debug_img = np.hstack([debug_image, mask_bgr])
        cv2.imwrite("debug_detection.jpg", combined_debug_img)
        print("✅ Debug image saved to debug_detection.jpg")

    return cropped_images


def pil_to_base64(pil_img):
    """Chuyển ảnh PIL sang base64 string."""
    buffered = io.BytesIO()
    pil_img.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/jpeg;base64,{img_str}"


def crc16(data):
    """Tính CRC16 cho chuỗi dữ liệu."""
    poly = 0x1021
    crc = 0xFFFF
    for byte in data.encode('utf-8'):
        crc ^= (byte << 😎
        for _ in range(8):
            if (crc & 0x8000):
                crc = (crc << 1) ^ poly
            else:
                crc = crc << 1
    return format(crc & 0xFFFF, '04X')


def generate_qr_payload(bank_bin, account_no, amount, description):
    """Tạo payload VietQR theo chuẩn EMVCo."""
    merchant_info_parts = [
        f"00{len('A000000727'):02d}A000000727",
        f"01{len(f'00{len(bank_bin):02d}{bank_bin}01{len(account_no):02d}{account_no}'):02d}"
        f"00{len(bank_bin):02d}{bank_bin}01{len(account_no):02d}{account_no}"
    ]
    merchant_info = "".join(merchant_info_parts)
    payload_parts = [
        "000201",
        "010212",
        f"38{len(merchant_info):02d}{merchant_info}",
        "5303704",
        f"54{len(amount):02d}{amount}",
        "5802VN"
    ]
    additional_info = f"01{len(description):02d}{description}"
    payload_parts.append(f"62{len(additional_info):02d}{additional_info}")
    payload_parts.append("6304")
    pre_crc_payload = "".join(payload_parts)
    return f"{pre_crc_payload}{crc16(pre_crc_payload)}"


def generate_qr_image(payload):
    """Tạo ảnh QR code từ payload."""
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
    """Trang chủ ứng dụng."""
    return render_template('index.html')


@app.route('/detect_and_predict', methods=['POST'])
def detect_and_predict():
    """API phát hiện và dự đoán bánh từ ảnh tải lên."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        pil_image = Image.open(file.stream).convert('RGB')
        cropped_cakes = detect_and_crop_cakes(pil_image)
        
        if not cropped_cakes:
            error_msg = (
                'No items detected. '
                'Please check debug_detection.jpg for details.'
            )
            return jsonify({'error': error_msg}), 400
        
        predictions = []
        total_price = 0
        base64_crops = []
        
        for cake_img in cropped_cakes:
            item_name, price, confidence = process_and_predict(cake_img)
            predictions.append({
                'position': len(predictions) + 1,
                'item_name': item_name,
                'price': int(price),
                'confidence': float(round(confidence, 2))
            })
            total_price += int(price)
            base64_crops.append(pil_to_base64(cake_img))
        
        return jsonify({
            'predictions': predictions,
            'total_price': int(total_price),
            'cropped_images': base64_crops
        })
    
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({'error': 'An internal error occurred.'}), 500


@app.route('/generate_qr', methods=['POST'])
def generate_qr():
    """API tạo mã QR thanh toán."""
    data = request.get_json()
    if not data or 'amount' not in data:
        return jsonify({'error': 'Missing amount'}), 400
    
    amount = str(data.get('amount'))
    default_desc = f'Thanh toan don hang {np.random.randint(1000, 9999)}'
    description = data.get('description', default_desc)
    
    try:
        qr_payload = generate_qr_payload(
            BANK_BIN, ACCOUNT_NO, amount, description
        )
        qr_buffer = generate_qr_image(qr_payload)
        return send_file(qr_buffer, mimetype='image/png')
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ======================================
# MAIN
# ======================================
if _name_ == '_main_':
    app.run(debug=True)
