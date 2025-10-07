import os


def rename_images(folder_path, prefix="image"):
    """Đổi tên các tệp hình ảnh trong một thư mục được chỉ định với tiền tố và số thứ tự."""
    files = os.listdir(folder_path)
    files = [f for f in files if os.path.isfile(os.path.join(folder_path, f))]
    files.sort()

    count = 1
    for filename in files:
        ext = ".jpg"
        new_name = f"{prefix}{count}{ext}"
        src = os.path.join(folder_path, filename)
        dst = os.path.join(folder_path, new_name)

        while os.path.exists(dst):
            count += 1
            new_name = f"{prefix}{count}{ext}"
            dst = os.path.join(folder_path, new_name)
        
        os.rename(src, dst)
        print(f"Đổi {filename} -> {new_name}")
        count += 1


if __name__ == "__main__":
    folder = "croissant"  # Folder
    rename_images(folder)
