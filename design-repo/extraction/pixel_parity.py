#!/usr/bin/env python3
"""Layout (ink block-map) and raw pixel comparison of live-vs-clone screenshots, with the reason pixel parity
is NOT a fidelity number for this site.

    python3 extraction/pixel_parity.py <live_shots> <clone_shots> <dumps_dir> <out.json> [--diffs <dir>]

<live_shots>/<clone_shots> hold <vp>-<state>-full.png (WebGL canvas visible) and <vp>-<state>-dom.png
(canvas hidden: only the DOM layer + signature svg) written by geometry_capture.mjs with SHOTS=. They are
scratch evidence and are never committed; only <out.json> is. <dumps_dir> is the tracked dump folder: the
live section rect of each DOM section is the crop window.

Method (the ink block-map of the sibling parity_compare.py): grayscale, background = median of the live
crop, ink = |px - bg| > 30, box-blur 12 px, downsample 4x, threshold 25/255; score = Dice(live, clone).
It compares WHERE ink sits, not what it says. Raw match = share of 4x-downsampled pixels within 25 levels.
--diffs writes <vp>-<state>-<layer>-diff.png (live | clone | abs diff) for looking at it.
Also reported per layer: diffPixelPct = share of frame pixels differing by more than 40 grey levels. The dom
layer shows how little of the frame differs once the WebGL field is hidden (the differing pixels are the
substituted copy, lettering and signature); the full layer adds the substituted WebGL tiles.
"""
import json, re, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

TOL = 30


def sect_rect(dump, name):
    cur = None
    for line in Path(dump).read_text().splitlines():
        if line.startswith("## "):
            cur = line[3:].strip(); first = True
        elif cur == name and line.strip() and line != "MISSING":
            x, y, w, h = (float(v) for v in line.split("\t")[1].split(","))
            return x, y, w, h
    return None


def gray(p):
    return np.asarray(Image.open(p).convert("L"), np.float64)


def ds(a, F):
    h, w = a.shape[0] // F * F, a.shape[1] // F * F
    return a[:h, :w].reshape(h // F, F, w // F, F).mean(axis=(1, 3))


def blocks(a, bg):
    m = Image.fromarray(((np.abs(a - bg) > TOL) * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(12))
    return np.asarray(m.resize((max(1, m.size[0] // 4), max(1, m.size[1] // 4))), np.float64) > 25


def score(la, ca):
    bg = float(np.median(la))
    A, B = blocks(la, bg), blocks(ca, bg)
    raw = np.abs(ds(la, 4) - ds(ca, 4)) <= 25
    den = int(A.sum() + B.sum())
    return (round(100 * 2 * int((A & B).sum()) / den, 1) if den else 100.0), round(100 * float(raw.mean()), 1)


def main():
    live, clone, dumps, outp = (Path(a) for a in sys.argv[1:5])
    diffs = Path(sys.argv[sys.argv.index("--diffs") + 1]) if "--diffs" in sys.argv else None
    if diffs: diffs.mkdir(parents=True, exist_ok=True)
    res = {}
    for vp in ("1440", "390"):
        for st in ("closed", "about", "contact", "selected"):
            e = {}
            for layer in ("dom", "full"):
                lp, cp = live / f"{vp}-{st}-{layer}.png", clone / f"{vp}-{st}-{layer}.png"
                if not (lp.exists() and cp.exists()): continue
                la, ca = gray(lp), gray(cp)
                h, w = min(la.shape[0], ca.shape[0]), min(la.shape[1], ca.shape[1])
                la, ca = la[:h, :w], ca[:h, :w]
                secs = {}
                for name in ("topbar", "hero", "social", "box", "flybar"):
                    r = sect_rect(dumps / "live" / f"{vp}-{st}.n", name)
                    if not r: continue
                    x0, y0 = max(0, int(r[0])), max(0, int(r[1])); x1, y1 = min(w, int(r[0] + r[2]) + 1), min(h, int(r[1] + r[3]) + 1)
                    if x1 - x0 < 8 or y1 - y0 < 8: continue
                    secs[name] = dict(zip(("inkDice", "rawMatch"), score(la[y0:y1, x0:x1], ca[y0:y1, x0:x1])))
                d, r = score(la, ca)
                e[layer] = {"frame": {"inkDice": d, "rawMatch": r}, "sections": secs}
                e[layer]["diffPixelPct"] = round(100 * float((np.abs(la - ca) > 40).mean()), 2)
                if diffs:
                    d3 = np.abs(la - ca).clip(0, 255)
                    sheet = np.concatenate([la, np.full((h, 6), 128.0), ca, np.full((h, 6), 128.0), 255 - d3], axis=1)
                    Image.fromarray(sheet.astype(np.uint8)).save(diffs / f"{vp}-{st}-{layer}-diff.png")
            if e: res[f"{vp}-{st}"] = e
    json.dump({"method": "ink block-map Dice (grayscale, |px-bg|>30, blur 12, down 4x, thr 25) per live section rect + whole frame; layers: dom = canvas hidden, full = canvas visible", "byState": res}, open(outp, "w"), indent=1)
    open(outp, "a").write("\n")
    for k, v in res.items():
        print(k, {l: (x["frame"], x["diffPixelPct"]) for l, x in v.items()})


if __name__ == "__main__":
    main()
