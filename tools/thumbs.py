"""
Makes the small copies the gallery actually serves. Needs Pillow (pip install pillow).

    python tools/thumbs.py
    node tools/photos.mjs

For every photograph in assets/photos/ it writes
  assets/photos/thumbs/<name>.webp   900px wide, for the contact sheet
  assets/photos/web/<name>.webp      2400px on the long edge, for the viewer
and leaves the original untouched. photos.mjs then points the manifest at them.
Files that already have up-to-date copies are skipped.
"""

from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent / 'assets' / 'photos'
TYPES = {'.jpg', '.jpeg', '.png', '.webp', '.avif'}
DERIVED = {'thumbs', 'web'}


def make(src: Path, dst: Path, long_edge: int, quality: int) -> bool:
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)  # bake the camera's rotation in
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGB')
        im.thumbnail((long_edge, long_edge), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=quality, method=6)
    return True


made = 0
for src in sorted(ROOT.rglob('*')):
    rel = src.relative_to(ROOT)
    if src.suffix.lower() not in TYPES or rel.parts[0] in DERIVED:
        continue
    name = rel.with_suffix('.webp')
    made += make(src, ROOT / 'thumbs' / name, 900, 78)
    made += make(src, ROOT / 'web' / name, 2400, 84)

print(f'{made} files written under assets/photos/thumbs and assets/photos/web')
