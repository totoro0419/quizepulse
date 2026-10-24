#!/usr/bin/env python3
"""Create PNG PWA icons with stdlib only; generated in the Pages build."""
from pathlib import Path
from struct import pack
from zlib import compress, crc32

OUT = Path(__file__).resolve().parents[1] / "icons"
OUT.mkdir(parents=True, exist_ok=True)
BLUE = (39, 107, 229)
SKY = (57, 133, 250)
WHITE = (255, 255, 255)
PALE = (189, 229, 255)
BOLT = [
    (.535, .185), (.302, .547), (.494, .547), (.424, .822),
    (.725, .408), (.521, .408), (.639, .185)
]

def inside_poly(x, y, pts):
    within = False
    for a, b in zip(pts, pts[1:] + pts[:1]):
        ax, ay = a; bx, by = b
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            within = not within
    return within

def color_at(x, y):
    # Maskable safe zone: bolt remains inside the central 60% of the tile.
    if inside_poly(x,y,BOLT):
        return WHITE
    if (x-.5)**2+(y-.5)**2 < .323**2:
        return SKY
    return BLUE

def chunk(tag, data):
    return pack('!I', len(data)) + tag + data + pack('!I', crc32(tag + data) & 0xffffffff)

def create(size, filename):
    # RGB with 2x2 coverage antialiasing around icon edges.
    buf = bytearray()
    for row in range(size):
        buf.append(0)  # PNG filter type 0
        for col in range(size):
            sample = [
                color_at((col+sx)/size, (row+sy)/size)
                for sy in (.25,.75) for sx in (.25,.75)
            ]
            for channel in range(3):
                buf.append(round(sum(rgb[channel] for rgb in sample) / 4))
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', pack('!2I5B', size, size, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', compress(bytes(buf), 9))
    png += chunk(b'IEND', b'')
    target = OUT / filename
    target.write_bytes(png)
    print(target.relative_to(OUT.parent), target.stat().st_size)

create(192, "icon-192.png")
create(512, "icon-512.png")
create(512, "icon-maskable-512.png")
