#!/usr/bin/env python3
"""Per-section geometry / typography / token parity between the live original and the clone.

    python3 extraction/geometry_parity.py [--dumps <dir>] [--json] [--write <result.json>]

Reads the text-free dumps written by extraction/geometry_capture.mjs (<vp>-<state>.n under
extraction/evidence/parity-<date>/run1|run2/live and /clone). Nothing here reads pixels or copy, so it does not
depend on the substituted work images, portrait, lettering or WebGL tiles.

Rows are paired by (tag.class, occurrence index) inside each section: the clone reuses the original's
class vocabulary, so a live row pairs with the clone row of the same role. For every paired row:
  geometry    all four box numbers (x, y, w, h) within TOL px
  position    x and y within TOL px (size ignored: text-width boxes legitimately change with substituted copy)
  typography  font-size, weight, line-height, letter-spacing, text-transform equal (family ignored)
  family      font-family first name equal (the serif is a declared substitution: expected to differ)
  tokens      colour, background, radius, opacity equal
  textrows    number of rendered text lines equal and line tops (relative to the element) within TOL
Every paired row that fails 'geometry' is also classed (measured, not a cause): missWidthOnly (x, y, h match, only
the width differs: shrink-wrapped text boxes), missHeightOnly (x, y, w match: the line count changed), missShifted
(x or y moved: downstream of an upstream copy/line-count change), and unpaired live rows (missUnpaired).
Percentages are over the LIVE rows of the section (a live row with no clone counterpart counts as a miss
in every metric). 'structure' is paired/live rows. Sections absent on the live side are skipped.
"""
import argparse, json, sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TOL = 1.5
ROLE_PX = 60
VIEWPORTS = ("1440", "390")
STATES = ("closed", "about", "contact", "selected")
METRICS = ("structure", "geometry", "position", "typography", "family", "tokens", "textrows")
MISSES = ("missWidthOnly", "missHeightOnly", "missShifted", "missOther", "missUnpaired")


def parse(path):
    secs, cur, head = {}, None, ""
    for line in Path(path).read_text().splitlines():
        if line.startswith("# "):
            head = line
        elif line.startswith("## "):
            cur = secs.setdefault(line[3:].strip(), [])
        elif cur is not None and line.strip():
            cur.append(line)
    return secs, head


def row(line):
    if line == "MISSING":
        return None
    key, box, style, txt = line.split("\t")
    if tag_of(key) in SVG_INNER:
        return None
    x, y, w, h = (float(v) for v in box.split(","))
    # style = family size weight line-height letter-spacing transform color bg radius opacity (parsed by STYLE)
    return dict(key=key, box=(x, y, w, h), style=style, txt=txt)


import re
STYLE = re.compile(r"^(?P<fam>.*?) (?P<size>[\d.]+px) (?P<wt>\d+|normal|bold) (?P<lh>[\d.]+px|normal) (?P<ls>-?[\d.]+px|normal) (?P<tt>\S+) (?P<color>rgba?\([^)]*\)) (?P<bg>rgba?\([^)]*\)) (?P<radius>.*) (?P<op>[\d.]+)$")


SVG_INNER = {"g", "path", "circle", "rect", "line", "defs", "use", "mask", "clippath", "lineargradient", "radialgradient", "stop", "polyline", "polygon", "ellipse", "filter", "image", "pattern", "symbol", "text", "tspan", "title"}


def tag_of(key): return key.split(".")[0]


def pairs(live, clone):
    """Greedy nearest pairing. Pass 1: same tag.class (nearest by box centre). Pass 2: for still-unpaired live
    rows, same tag with any class within ROLE_PX of the live row's centre (the clone wraps/renames some
    unclassed wrappers). Each clone row is used at most once."""
    used = set(); res = {}
    def ctr(r): return (r["box"][0] + r["box"][2] / 2, r["box"][1] + r["box"][3] / 2)
    def dist(a, b): return abs(a[0] - b[0]) + abs(a[1] - b[1])
    for stage in (1, 2):
        for i, l in enumerate(live):
            if i in res: continue
            best = None
            for j, c in enumerate(clone):
                if j in used: continue
                if stage == 1 and c["key"] != l["key"]: continue
                if stage == 2 and tag_of(c["key"]) != tag_of(l["key"]): continue
                d = dist(ctr(l), ctr(c))
                if stage == 2 and d > ROLE_PX: continue
                if best is None or d < best[0]: best = (d, j)
            if best: res[i] = best[1]; used.add(best[1])
    for i, l in enumerate(live):
        yield l, (clone[res[i]] if i in res else None)


def near(a, b): return abs(a - b) <= TOL


def textrows_ok(lt, ct, ltop, ctop):
    if lt == "-" and ct == "-":
        return True
    if lt == "-" or ct == "-":
        return False
    ln, cn = int(lt[1:].split(":")[0]), int(ct[1:].split(":")[0])
    if ln != cn:
        return False
    lv = [float(v) - ltop for v in lt.split(":")[1].split("/")]
    cv = [float(v) - ctop for v in ct.split(":")[1].split("/")]
    return all(near(a, b) for a, b in zip(lv, cv))


def compare_section(lrows, crows):
    n = len(lrows); c = {m: 0 for m in METRICS}; ms = {m: 0 for m in MISSES}
    for l, k in pairs(lrows, crows):
        if k is None:
            ms["missUnpaired"] += 1
            continue
        c["structure"] += 1
        a, b = l["box"], k["box"]
        if all(near(p, q) for p, q in zip(a, b)): c["geometry"] += 1
        else:
            xy, w_, h_ = near(a[0], b[0]) and near(a[1], b[1]), near(a[2], b[2]), near(a[3], b[3])
            ms["missWidthOnly" if xy and h_ and not w_ else "missHeightOnly" if xy and w_ and not h_ else "missShifted" if not xy else "missOther"] += 1
        if near(a[0], b[0]) and near(a[1], b[1]): c["position"] += 1
        ls, cs = STYLE.match(l["style"]), STYLE.match(k["style"])
        if ls and cs:
            if all(ls.group(g) == cs.group(g) for g in ("size", "wt", "lh", "ls", "tt")): c["typography"] += 1
            if ls.group("fam") == cs.group("fam"): c["family"] += 1
            if all(ls.group(g) == cs.group(g) for g in ("color", "bg", "radius", "op")): c["tokens"] += 1
        if textrows_ok(l["txt"], k["txt"], a[1], b[1]): c["textrows"] += 1
    pct = {m: (round(100.0 * c[m] / n, 1) if n else None) for m in METRICS}
    return {"liveRows": n, "cloneRows": len(crows), **{m + "Rows": c[m] for m in METRICS}, **ms, "pct": pct}


def run(d):
    out = {}
    for vp in VIEWPORTS:
        for st in STATES:
            lp, cp = d / "live" / f"{vp}-{st}.n", d / "clone" / f"{vp}-{st}.n"
            if not (lp.exists() and cp.exists()):
                continue
            (ls, lh), (cs, ch) = parse(lp), parse(cp)
            secs = {}
            for name, lines in ls.items():
                lrows = [r for r in (row(x) for x in lines) if r]
                if not lrows:
                    continue
                crows = [r for r in (row(x) for x in cs.get(name, [])) if r]
                secs[name] = compare_section(lrows, crows)
            out[f"{vp}-{st}"] = {"liveDoc": lh.split("doc ")[-1], "cloneDoc": ch.split("doc ")[-1], "sections": secs}
    return out


def summarise(res):
    """Average each metric over the sections that have at least one live row; also the rows-weighted mean."""
    agg = {}
    for k, v in res.items():
        secs = v["sections"]
        agg[k] = {}
        for m in METRICS:
            vals = [s["pct"][m] for s in secs.values() if s["pct"][m] is not None]
            tot = sum(s["liveRows"] for s in secs.values()); got = sum(s[m + "Rows"] for s in secs.values())
            agg[k][m] = {"sectionMean": round(sum(vals) / len(vals), 1) if vals else None, "rowWeighted": round(100.0 * got / tot, 1) if tot else None}
    return agg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dumps", default=None)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--write")
    a = ap.parse_args()
    d = Path(a.dumps) if a.dumps else next(iter(sorted((REPO / "extraction" / "evidence").glob("parity-*/run1"))[::-1]), None)
    if not d or not d.is_dir():
        print("NOTICE: no dump folder; geometry parity not re-run (recorded values stay in measured-values.json)")
        return 0
    res = run(d); agg = summarise(res)
    doc = {"tolerancePx": TOL, "dumps": d.name, "byState": res, "summary": agg}
    if a.write:
        Path(a.write).write_text(json.dumps(doc, indent=1) + "\n")
    if a.json:
        print(json.dumps(doc, indent=1)); return 0
    for k, v in res.items():
        print(f"{k}  doc live {v['liveDoc']} / clone {v['cloneDoc']}  rowWeighted " + "  ".join(f"{m}={agg[k][m]['rowWeighted']}" for m in METRICS))
        for n, s in v["sections"].items():
            print(f"   {n:10} rows {s['liveRows']:3}/{s['cloneRows']:3}  " + " ".join(f"{m[:4]}={s['pct'][m]}" for m in METRICS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
