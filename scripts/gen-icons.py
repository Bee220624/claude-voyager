#!/usr/bin/env python3
"""生成 Claude Voyager 占位图标 (PNG, 纯 stdlib 实现)。

设计：浅米色背景 + 居中的 'CV' 字样近似图形（用纯色像素拼接），方圆角矩形。
"""
import os
import struct
import zlib
from pathlib import Path

SIZES = [16, 32, 48, 128]
OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

# 颜色 (R, G, B, A)
BG = (237, 226, 204, 255)        # Claude 主题米色
FG = (199, 105, 70, 255)         # Claude 橙色
TRANSPARENT = (0, 0, 0, 0)


def rounded_rect(size: int):
    """生成圆角矩形 + 中心 V 形像素阵列。"""
    px = [[TRANSPARENT for _ in range(size)] for _ in range(size)]
    radius = max(1, size // 6)
    for y in range(size):
        for x in range(size):
            # 圆角判定
            in_corner = False
            cx, cy = x, y
            for ox, oy in [
                (radius, radius),
                (size - radius - 1, radius),
                (radius, size - radius - 1),
                (size - radius - 1, size - radius - 1),
            ]:
                # 外圆角剔除
                if (x < radius and y < radius and ox == radius and oy == radius):
                    if (cx - ox) ** 2 + (cy - oy) ** 2 > radius ** 2:
                        in_corner = True
                if (x >= size - radius and y < radius and ox == size - radius - 1 and oy == radius):
                    if (cx - ox) ** 2 + (cy - oy) ** 2 > radius ** 2:
                        in_corner = True
                if (x < radius and y >= size - radius and ox == radius and oy == size - radius - 1):
                    if (cx - ox) ** 2 + (cy - oy) ** 2 > radius ** 2:
                        in_corner = True
                if (x >= size - radius and y >= size - radius and ox == size - radius - 1 and oy == size - radius - 1):
                    if (cx - ox) ** 2 + (cy - oy) ** 2 > radius ** 2:
                        in_corner = True
            if in_corner:
                continue
            px[y][x] = BG

    # 画一个简化的 V 形（两条斜线，从顶到底向中间汇合）
    pad = max(2, size // 5)
    stroke = max(1, size // 8)
    half = size / 2
    for y in range(pad, size - pad):
        t = (y - pad) / max(1, (size - pad * 2 - 1))
        left_x = int(pad + t * (half - pad))
        right_x = int(size - pad - 1 - t * (half - pad))
        for dx in range(-stroke // 2, stroke // 2 + 1):
            for x in (left_x + dx, right_x + dx):
                if 0 <= x < size and px[y][x] != TRANSPARENT:
                    px[y][x] = FG
    return px


def png_bytes(pixels):
    size = len(pixels)
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter byte
        for r, g, b, a in row:
            raw.extend([r, g, b, a])
    raw = bytes(raw)

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8bit, RGBA
    idat = zlib.compress(raw, 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def main() -> None:
    for s in SIZES:
        path = OUT / f"icon-{s}.png"
        path.write_bytes(png_bytes(rounded_rect(s)))
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
