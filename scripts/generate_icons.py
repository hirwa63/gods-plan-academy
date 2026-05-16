#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'images')
os.makedirs(OUT_DIR, exist_ok=True)

SIZES = [48,72,96,144,192,256,512]
BG = (8,80,65)
FG = (255,255,255)

def make_icon(size):
    img = Image.new('RGBA', (size, size), BG)
    draw = ImageDraw.Draw(img)
    # choose font size relative to image
    try:
        # try a common system font
        font = ImageFont.truetype('arial.ttf', int(size*0.32))
    except Exception:
        font = ImageFont.load_default()
    text = 'GPA'
    # measure text size in a way compatible with multiple Pillow versions
    try:
        bbox = draw.textbbox((0,0), text, font=font)
        w, h = bbox[2]-bbox[0], bbox[3]-bbox[1]
    except Exception:
        try:
            w, h = font.getsize(text)
        except Exception:
            w, h = (int(size*0.6), int(size*0.3))
    draw.text(((size-w)/2, (size-h)/2), text, font=font, fill=FG)
    return img

def main():
    for s in SIZES:
        img = make_icon(s)
        out = os.path.join(OUT_DIR, f'icon-{s}.png')
        img.save(out)
        print('Wrote', out)

if __name__ == '__main__':
    main()
#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'images')
os.makedirs(OUT_DIR, exist_ok=True)

SIZES = [48,72,96,144,192,256,512]
BG = (8,80,65)
FG = (255,255,255)

def make_icon(size):
    img = Image.new('RGBA', (size, size), BG)
    draw = ImageDraw.Draw(img)
    # choose font size relative to image
    try:
        # try a common system font
        font = ImageFont.truetype('arial.ttf', int(size*0.32))
    except Exception:
        font = ImageFont.load_default()
    text = 'GPA'
    # measure text size in a way compatible with multiple Pillow versions
    try:
        bbox = draw.textbbox((0,0), text, font=font)
        w, h = bbox[2]-bbox[0], bbox[3]-bbox[1]
    except Exception:
        try:
            w, h = font.getsize(text)
        except Exception:
            w, h = (int(size*0.6), int(size*0.3))
    draw.text(((size-w)/2, (size-h)/2), text, font=font, fill=FG)
    return img

def main():
    for s in SIZES:
        img = make_icon(s)
        out = os.path.join(OUT_DIR, f'icon-{s}.png')
        img.save(out)
        print('Wrote', out)

if __name__ == '__main__':
    main()
