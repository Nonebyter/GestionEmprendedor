"""Genera los iconos PNG de la PWA."""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "static" / "icons"
OUT.mkdir(parents=True, exist_ok=True)


def make(size: int) -> None:
    img = Image.new("RGB", (size, size), "#0d6efd")
    draw = ImageDraw.Draw(img)
    m = size * 0.22
    box = [m, m * 1.25, size - m, size - m]
    draw.rounded_rectangle(box, radius=size * 0.06, fill="white")
    draw.rectangle([m, m * 1.25, size - m, m * 1.25 + size * 0.10], fill="#e7f0ff")
    handle_top = m * 0.55
    draw.arc(
        [size * 0.34, handle_top, size * 0.66, m * 1.9],
        start=180, end=360, fill="white", width=int(size * 0.055),
    )
    img.save(OUT / f"icon-{size}.png")


for s in (192, 512):
    make(s)
print(f"Iconos generados en {OUT}")
