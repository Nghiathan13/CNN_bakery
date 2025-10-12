import json
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
from keras.models import Model
from keras.layers import Conv2D, MaxPooling2D, Flatten, Dense, Dropout, BatchNormalization, Input
from keras._tf_keras.keras.preprocessing.image import ImageDataGenerator


INPUT_DIR = "assets/anh_gen" # Folder anh train
IMAGE_SIZE = (128, 128)
BATCH_SIZE = 32
EPOCH = 15
VALIDATION_SPLIT = 0.2
MODEL_PATH = "bakery_cnn.h5"
CLASS_INDICES_PATH = "class_indices.json"

ROTATION_RANGE = 30
SHIFT_RANGE = 0.2
SHEAR_RANGE = 0.2
ZOOM_RANGE = 0.2


def create_data_generators():
    """Tăng cường dữ liệu cho việc huấn luyện và đánh giá."""
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        validation_split=VALIDATION_SPLIT,
        rotation_range=ROTATION_RANGE,
        width_shift_range=SHIFT_RANGE,
        height_shift_range=SHIFT_RANGE,
        shear_range=SHEAR_RANGE,
        zoom_range=ZOOM_RANGE,
        horizontal_flip=True,
        brightness_range=[0.8, 1.2],
        fill_mode='nearest'
        )

    val_datagen = ImageDataGenerator(
        rescale=1./255,
        validation_split=VALIDATION_SPLIT
    )

    train_generator = train_datagen.flow_from_directory(
        INPUT_DIR,
        target_size=IMAGE_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        subset='training'
    )

    val_generator = val_datagen.flow_from_directory(
        INPUT_DIR,
        target_size=IMAGE_SIZE,
        batch_size=32,
        class_mode='categorical',
        subset='validation'
    )
    
    return train_generator, val_generator


def save_class_indices(class_indices):
    """Lưu data vào tệp JSON."""
    with open(CLASS_INDICES_PATH, 'w', encoding='utf-8') as f:
        json.dump(class_indices, f, ensure_ascii=False, indent=2)
    print(f"✅ Đã lưu class_indices vào file {CLASS_INDICES_PATH}")


def build_cnn_model(num_classes):
    """Build CNN model."""
    input_layer = Input(shape=(*IMAGE_SIZE, 3))

    x = Conv2D(32, (3, 3), activation='relu', padding='same')(input_layer)
    x = BatchNormalization()(x)
    x = Conv2D(32, (3, 3), activation='relu', padding='same')(x)
    x = BatchNormalization()(x)
    x = MaxPooling2D((2, 2))(x)

    x = Conv2D(64, (3, 3), activation='relu', padding='same')(x)
    x = BatchNormalization()(x)
    x = Conv2D(64, (3, 3), activation='relu', padding='same')(x)
    x = BatchNormalization()(x)
    x = MaxPooling2D((2, 2))(x)

    x = Conv2D(128, (3, 3), activation='relu', padding='same')(x)
    x = BatchNormalization()(x)
    x = Conv2D(128, (3, 3), activation='relu', padding='same')(x)
    x = BatchNormalization()(x)
    x = MaxPooling2D((2, 2))(x)

    x = Flatten()(x)
    x = Dense(256, activation='relu')(x)
    x = BatchNormalization()(x)
    x = Dropout(0.5)(x)
    x = Dense(128, activation='relu')(x)
    x = BatchNormalization()(x)
    x = Dropout(0.5)(x)
    outputs = Dense(num_classes, activation='softmax')(x)

    model = Model(inputs=input_layer, outputs=outputs)

    model.compile(
        optimizer='adam',
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    return model


def main():
    """Hàm main"""
    train_generator, val_generator = create_data_generators()

    save_class_indices(train_generator.class_indices)

    model = build_cnn_model(train_generator.num_classes)

    model.summary()

    history = model.fit(
        train_generator,
        validation_data=val_generator,
        epochs=EPOCH
    )

    model.save(MODEL_PATH)
    print(f"✅ Mô hình đã được lưu: {MODEL_PATH}")
    
    return model, history


if __name__ == "__main__":
    model, history = main()
