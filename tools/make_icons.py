# Icônes de l'appli : la silhouette des poumons, tirée de la même carte que le rendu.
from pathlib import Path

import numpy as np
from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "assets"
b = np.asarray(Image.open(ASSETS / "lungs-b.png"), np.float32) / 255
c = np.asarray(Image.open(ASSETS / "lungs-a.png"), np.float32) / 255
mask = np.maximum(b[:, :, 0], b[:, :, 1])
shade = 0.72 + 0.34 * c[:, :, 2]
color = np.dstack([240 * shade, 141 * shade, 122 * shade])
bg = np.array([15, 13, 12], np.float32)
out = bg + (color - bg) * mask[:, :, None]
art = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")

for size in (180, 192, 512):
    canvas = Image.new("RGB", (size, size), (15, 13, 12))
    h = int(size * 0.74)
    w = int(h * art.width / art.height)
    canvas.paste(art.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2))
    canvas.save(ASSETS / f"icon-{size}.png", optimize=True)
    print(size, "ok")
