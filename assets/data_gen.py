import os
import random
import cv2
import albumentations as A


INPUT_FOLDER = 'assets/anh_goc/banh_mi_dua_luoi'
OUTPUT_FOLDER = 'assets/anh_gen/banh_mi_dua_luoi'
TOTAL_IMAGES_NEEDED = 3000
VALID_EXTENSIONS = ('.png', '.jpg', '.jpeg')
PROGRESS_INTERVAL = 100

HORIZONTAL_FLIP_PROB = 0.5
ROTATION_PROB = 0.7
BRIGHTNESS_CONTRAST_PROB = 0.8
SHIFT_SCALE_ROTATE_PROB = 0.6
BLUR_PROB = 0.2
GAUSS_NOISE_PROB = 0.3
RGB_SHIFT_PROB = 0.3

ROTATION_LIMIT = 20
BRIGHTNESS_LIMIT = 0.2
CONTRAST_LIMIT = 0.2
SHIFT_LIMIT = 0.05
SCALE_LIMIT = 0.05
ROTATE_LIMIT = 10
BLUR_LIMIT = (3, 7)
GAUSS_NOISE_VAR = (10.0, 50.0)
RGB_SHIFT_LIMIT = 20


def create_augmentation_pipeline():
    """Tạo pipeline biến đổi ảnh."""
    transform = A.Compose([
        A.HorizontalFlip(p=HORIZONTAL_FLIP_PROB),
        A.Rotate(limit=ROTATION_LIMIT, p=ROTATION_PROB),
        A.RandomBrightnessContrast(
            brightness_limit=BRIGHTNESS_LIMIT,
            contrast_limit=CONTRAST_LIMIT,
            p=BRIGHTNESS_CONTRAST_PROB
        ),
        A.ShiftScaleRotate(
            shift_limit=SHIFT_LIMIT,
            scale_limit=SCALE_LIMIT,
            rotate_limit=ROTATE_LIMIT,
            p=SHIFT_SCALE_ROTATE_PROB
        ),
        A.OneOf([
            A.GaussianBlur(blur_limit=BLUR_LIMIT, p=1.0),
            A.MotionBlur(blur_limit=BLUR_LIMIT, p=1.0),
            A.MedianBlur(blur_limit=BLUR_LIMIT, p=1.0)
        ], p=BLUR_PROB),
        A.GaussNoise(var_limit=GAUSS_NOISE_VAR, p=GAUSS_NOISE_PROB),
        A.RGBShift(
            r_shift_limit=RGB_SHIFT_LIMIT,
            g_shift_limit=RGB_SHIFT_LIMIT,
            b_shift_limit=RGB_SHIFT_LIMIT,
            p=RGB_SHIFT_PROB
        ),
    ])

    return transform


def get_source_images(input_folder):
    """Lấy danh sách ảnh từ thư mục nguồn."""
    if not os.path.exists(input_folder):
        raise FileNotFoundError(
            f"Thư mục '{input_folder}' không tồn tại."
        )

    images = [
        f for f in os.listdir(input_folder)
        if f.lower().endswith(VALID_EXTENSIONS)
    ]

    if not images:
        raise ValueError(
            f"Không tìm thấy ảnh hợp lệ trong '{input_folder}'."
        )

    return images


def create_output_folder(output_folder):
    """Tạo thư mục đầu ra nếu chưa tồn tại."""
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)


def augment_and_save_image(image_path, transform, output_path):
    """Biến đổi và lưu ảnh."""
    image = cv2.imread(image_path)

    if image is None:
        return False

    transformed = transform(image=image)
    augmented_image = transformed['image']
    cv2.imwrite(output_path, augmented_image)

    return True


def augment_data(
    input_folder=INPUT_FOLDER,
    output_folder=OUTPUT_FOLDER,
    total_images=TOTAL_IMAGES_NEEDED
):
    """Hàm chính thực hiện data augmentation."""
    # Tạo thư mục output
    create_output_folder(output_folder)

    # Lấy danh sách ảnh nguồn
    try:
        source_images = get_source_images(input_folder)
        print(f"Tìm thấy {len(source_images)} ảnh gốc")
    except (FileNotFoundError, ValueError) as e:
        print(f"Lỗi: {e}")
        return

    # Tạo pipeline
    transform = create_augmentation_pipeline()
    print(f"Bắt đầu tạo {total_images} ảnh...")

    # Tạo ảnh
    current_count = 0
    while current_count < total_images:
        random_image_name = random.choice(source_images)
        image_path = os.path.join(input_folder, random_image_name)

        new_image_name = f"hinh{current_count + 1}.jpg"
        output_path = os.path.join(output_folder, new_image_name)

        if augment_and_save_image(image_path, transform, output_path):
            current_count += 1

            if current_count % PROGRESS_INTERVAL == 0:
                print(f"Đã tạo {current_count}/{total_images} ảnh")

    print(f"Hoàn tất! Đã tạo {current_count} ảnh trong '{output_folder}'")


def main():
    """Chạy chương trình chính."""
    augment_data()


if __name__ == "__main__":
    main()
