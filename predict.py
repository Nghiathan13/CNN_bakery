import json
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import numpy as np
from keras.preprocessing.image import load_img, img_to_array
from keras.models import load_model


MODEL_PATH = "bakery_cnn.h5"
CLASS_INDICES_PATH = "class_indices.json"
IMAGE_SIZE = (128, 128)
TEST_IMAGE_PATH = "assets/test/murffin_test.png"


# Load lại mô hình
model = load_model(MODEL_PATH)
print("✅ Mô hình đã được load thành công")

# Load lại class_indices từ file json
with open(CLASS_INDICES_PATH, 'r') as f:
    class_indices = json.load(f)
print("✅ Class indices đã được load thành công")

# Tạo một map ngược từ index -> label để dễ tra cứu
labels = {v: k for k, v in class_indices.items()}

# Dự đoán 1 ảnh
img_path = TEST_IMAGE_PATH
img = load_img(img_path, target_size=IMAGE_SIZE)
x = img_to_array(img)
x = np.expand_dims(x, axis=0) / 255.0

pred = model.predict(x)
class_idx = np.argmax(pred, axis=-1)[0]
label = labels[class_idx]

print("👉 Dự đoán:", label)
print(f"Confidence: {np.max(pred)*100:.2f}%")
