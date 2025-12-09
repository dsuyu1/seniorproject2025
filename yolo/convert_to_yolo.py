import os
from tqdm import tqdm
from PIL import Image

BASE_DIR = "datasets/wider_face_annotations"
IMAGE_BASE = "datasets"
OUTPUT_BASE = "yolo_labels"

SPLITS = {
    "train": {
        "ann": "wider_face_split/wider_face_train_bbx_gt.txt",
        "img": "WIDER_train/images"
    },
    "val": {
        "ann": "wider_face_split/wider_face_val_bbx_gt.txt",
        "img": "WIDER_val/images"
    },
    "test": {
        "ann": "wider_face_split/wider_face_test_filelist.txt",
        "img": "WIDER_test/images"
    }
}


def parse_train_val(annotation_path):
    """
    Parse train/val annotation format for WIDER FACE.
    Each entry:
        image_path
        num_faces
        x y w h ...
    """
    with open(annotation_path, "r", encoding="utf-8") as f:
        lines = [l.strip() for l in f.readlines() if l.strip()]

    data = []
    i = 0
    total = len(lines)
    while i < total:
        img_rel = lines[i]
        i += 1
        if i >= total:
            break
        if not img_rel.endswith(".jpg"):
            continue
        try:
            face_count = int(lines[i])
        except ValueError:
            i += 1
            continue
        i += 1
        boxes = []
        for j in range(face_count):
            if i + j >= total:
                break
            parts = lines[i + j].split()
            if len(parts) < 4:
                continue
            x, y, w, h = map(float, parts[:4])
            if w > 0 and h > 0:
                boxes.append([x, y, w, h])
        data.append((img_rel, boxes))
        i += face_count
    return data


def parse_test(annotation_path):
    """
    Parse test split file list (only image names, no boxes).
    """
    with open(annotation_path, "r", encoding="utf-8") as f:
        files = [l.strip() for l in f.readlines() if l.strip()]
    return [(img, []) for img in files]


def convert_to_yolo(x, y, w, h, img_w, img_h):
    """Convert (x, y, w, h) to normalized YOLO format."""
    xc = (x + w / 2) / img_w
    yc = (y + h / 2) / img_h
    w /= img_w
    h /= img_h
    return xc, yc, w, h


def convert_split(split_name, ann_file, img_dir, output_dir):
    os.makedirs(output_dir, exist_ok=True)

    print(f"\n🔹 Processing {split_name.upper()} split...")
    if split_name == "test":
        records = parse_test(ann_file)
    else:
        records = parse_train_val(ann_file)

    converted = 0
    for img_rel, boxes in tqdm(records, desc=f"{split_name.upper()}"):
        img_path = os.path.join(img_dir, img_rel)
        if not os.path.exists(img_path):
            continue

        try:
            with Image.open(img_path) as img:
                img_w, img_h = img.size
        except Exception:
            continue

        label_filename = os.path.splitext(os.path.basename(img_rel))[0] + ".txt"
        label_path = os.path.join(output_dir, label_filename)

        if split_name == "test":
            open(label_path, "w").close() 
            converted += 1
            continue

        with open(label_path, "w") as f:
            for x, y, w, h in boxes:
                xc, yc, wn, hn = convert_to_yolo(x, y, w, h, img_w, img_h)
                f.write(f"0 {xc:.6f} {yc:.6f} {wn:.6f} {hn:.6f}\n")
        converted += 1

    print(f"✅ {split_name.upper()} split: {converted} label files saved → {output_dir}/")


def main():
    print("📦 Starting WIDER FACE → YOLOv11 conversion...\n")

    for split, paths in SPLITS.items():
        ann_file = os.path.join(BASE_DIR, paths["ann"])
        img_dir = os.path.join(IMAGE_BASE, paths["img"])
        out_dir = os.path.join(OUTPUT_BASE, split)
        if not os.path.exists(ann_file):
            print(f"⚠️ Skipping {split}: missing {ann_file}")
            continue
        convert_split(split, ann_file, img_dir, out_dir)

    print("\n🎉 All splits processed! Output structure:")
    print(f"{OUTPUT_BASE}/")
    print("├── train/")
    print("├── val/")
    print("└── test/")


if __name__ == "__main__":
    main()
