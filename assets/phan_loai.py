import os
import imagehash
from PIL import Image
from collections import defaultdict


def find_duplicate_images(folder_path):
    """Tìm các ảnh trùng lặp trong một thư mục dựa trên hàm băm nhận thức (phash)."""
    hashes = {}
    duplicates = defaultdict(list)

    for filename in os.listdir(folder_path):
        filepath = os.path.join(folder_path, filename)
        if not os.path.isfile(filepath):
            continue
        try:
            img = Image.open(filepath)
            img_hash = imagehash.phash(img)  
            if img_hash in hashes:
                duplicates[str(img_hash)].append(filepath)
            else:
                hashes[img_hash] = filepath
        except Exception as e:
            print(f"Lỗi khi đọc {filename}: {e}")

    for h, first_path in hashes.items():
        if h in duplicates:
            duplicates[h].insert(0, first_path)

    return duplicates


if __name__ == "__main__":
    folder = "croissant" # Folder
    dupes = find_duplicate_images(folder)

    if not dupes:
        print("Không tìm thấy ảnh trùng.")
    else:
        print("Các nhóm ảnh trùng nhau:")
        for h, files in dupes.items():
            print(f"\nHash: {h}")
            for f in files:
                print(f"    {f}")
