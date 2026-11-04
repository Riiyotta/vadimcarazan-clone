Source: https://vadimcarazan.com/

# CLONE_SPEC: vadimcarazan.com (single page, three.js "portrait cosmos")

How this was measured: live site driven by headless Chromium (playwright-core, Chromium 1243) at 1440x900 (DPR 2), 1280x800 (DPR 2) and 390x844 (DPR 3, touch, mobile UA). Computed styles and rects come from `getComputedStyle` and `getBoundingClientRect`. Motion was sampled every animation frame through the page's own debug handles (`window.__cosmos`, `window.__cosmosD`, `window.__LD`). Mechanics were also cross-checked against the saved `style.css` and `app.js` in `Vadim Carazan, Creative Director_files/`. Everything below describes behaviour and numbers in my own words. Nothing was downloaded into the project. Reference screenshots are in `.recon/` (named `<viewport>-NN-<state>.png`).

Rebuild rule from the brief: use our own code, our own placeholder imagery, our own portrait source and our own signature/name lettering. Reuse only the numbers and behaviour described here.

Not measurable or not reproduced:
- The portrait halftone data (`data/cosmos.json`: cell positions, depths and per-cell colours) is the owner's photo baked into data. We must generate our own from our own portrait (see 3.2 for the format).
- The name lettering and the signature are SVG paths of the owner's lettering and handwriting. Replace both with our own.
- The consent banner only appears for EEA/UK/CH visitors. I ran with `?internal=1`, which disables tracking and therefore the banner, so as not to pollute the owner's analytics. Its values below come from the inline CSS in `track.js`, not from a live render.
- Mobile load timing under emulation was very slow (about 12 s) and does not represent a real device.

---

## 1. Page structure and z-order

Single document. `html, body` use `overflow:hidden; height:100%; overscroll-behavior:none`, so there is no native scroll at all. Every layer is `position:fixed`.

| z | element | role |
|---|---|---|
| 0 | `svg.sig` | hand-signature layer, behind the canvas (canvas is transparent) |
| 1 | `canvas#c` | three.js, full viewport (`inset:0; 100vw x 100dvh`), `touch-action:none`, `cursor:default`; class `.hot` gives `cursor:pointer` |
| 2 | `.hero` | intro text, CTA, giant name at the bottom |
| 2 | `body::before` / `body::after` | top and bottom dark fades, visible only while flying |
| 3 | `.flybar` | "now passing" caption, counter, Back button |
| 4 | `.topbar` | logo plus 3 labelled fact columns |
| 4 | `.social` | "Elsewhere" links, bottom right, About/Contact only |
| 5 | `aside.box` | glass panel: project / about / contact / selected |
| 6 | `.hud` | hover label pill following the pointer |
| 6 | `.mnav` | phone menu panel |
| 10 | `.loader` | full-screen loader with self-drawing logo |
| 20 | `.copy-toast` | "Link copied" toast |
| 9000 | `#vc-consent` | cookie banner (EEA only) |

Body state classes drive all UI changes:
- `away` when travel distance `dist > 8`.
- `far` when `dist > 60` and not rewinding.
- `boxed` when any box view is open.
- `side` when the about or contact view is open.

---

## 2. Design tokens

### 2.1 Colour

| token | value |
|---|---|
| `--bg` | `#0a0a0b` (WebGL clear is transparent; the page bg shows through; shader bg = rgb(10,10,11)/255) |
| `--ink` | `#f2f2f2` = rgb(242,242,242) |
| `--mute` | `rgba(242,242,242,0.55)` |
| `--line` | `rgba(255,255,255,0.12)` |
| lead text | `rgba(242,242,242,0.86)`, text-shadow `0 0 18px rgba(0,0,0,.9), 0 0 4px rgba(0,0,0,.7)` |
| body copy in box | `rgba(242,242,242,0.78)` |
| sub copy (c-sub, cta-d) | `rgba(242,242,242,0.72)` |
| link underline colour | `rgba(255,255,255,0.3)`, offset 3px (4px on the CTA alt link) |
| solid pill buttons | bg `#fff`, text `#000` |
| error | `#ff9b92`; invalid field border `rgba(255,120,110,0.7)` |
| theme-color meta | `#0a0a0b` |

### 2.2 Glass and blur

| surface | bg | border | blur | radius | shadow |
|---|---|---|---|---|---|
| `.box` (final cascade) | `rgba(22,22,24,0.6)` | 1px `rgba(255,255,255,0.09)` | `blur(18px)` (no saturate) | 22px | `0 30px 80px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.06)` |
| `.mnav` (phone) | `rgba(22,22,24,0.62)` | 1px `rgba(255,255,255,0.09)` | `blur(26px) saturate(1.25)` | 22px | `0 30px 80px rgba(0,0,0,.45)` |
| `.hud` | `rgba(0,0,0,0.62)` | 1px `--line` | `blur(10px)` | 999px | none |
| `.start` pill | `rgba(10,10,11,0.25)` | 1px `rgba(255,255,255,0.35)` | `blur(6px)` | 999px | none |
| `#vc-consent` | `rgba(22,22,24,.72)` | 1px `rgba(255,255,255,.12)` | `blur(22px)` | 18px | `0 20px 60px rgba(0,0,0,.45)` |
| `.back-link` / copy-link | `rgba(255,255,255,0.06)` (hover 0.12) | 1px `--line` | none | 999px | none |
| `.p-cta` card | radial `120% 140% at 100% 0%`, from `rgba(255,255,255,.10)` to `.02` at 55%, over `rgba(255,255,255,.03)` | 1px `rgba(255,255,255,.12)` | none | 16px (12px phone) | none |

Fly fades (only with `body.far`, opacity transition 0.6s ease):
- `body::before`: top, height `2*pad + 70px` (127.6px at 1440). Gradient from `rgba(10,10,11,.92)` to `.6` at 45% to `0`.
- `body::after`: bottom, height `2*pad + 150px` (207.6px at 1440). Gradient from `0` to `rgba(10,10,11,.65)` at 50% to `.94`.

The background behind an open box is blurred inside WebGL, not with CSS (see 3.9).

### 2.3 Spacing and easing

- `--pad: clamp(16px, 2vw, 32px)`. Measured 28.8px at 1440, 25.6px at 1280, 16px at 390.
- `--box-open: clamp(460px, 42vw, 780px)`. Measured 604.8px at 1440, 537.6px at 1280.
- `--ease: cubic-bezier(0.22, 1, 0.36, 1)`. This is the house ease-out for every transform.
- Large screens: `--z = max(1, min(innerWidth/1600, innerHeight/900))`, set inline on `<html>` by a head script and on resize. It is applied as `zoom` on `.topbar, .hero-row, .flybar, .box, .ld-mark`. All three test sizes measured `--z = 1`.

### 2.4 Fonts

| slot | family stack | loaded from |
|---|---|---|
| `--sans` | "Inter Tight", "Inter", -apple-system, "Helvetica Neue", Arial, sans-serif | Google Fonts: Inter Tight 400 and 500 |
| `--serif` | "Editorial Old Italic", "Instrument Serif", "Times New Roman", serif | self-hosted `fonts/pp-editorial-old-italic.woff2` (97.9 KB), declared as `font-style:normal; weight 400; font-display:swap` (italic design registered as normal) |
| fallback | Instrument Serif normal plus italic | Google Fonts; both faces load, but they are only the fallback inside `--serif`. No element names Instrument Serif first. |

Every serif slot uses Editorial Old Italic. **None use Instrument Serif directly.** The serif slots are:
- `.now-i` (the counter number)
- `.now-t` (title of the piece being passed)
- `.box h2`
- `.p-cta-t`
- `.sel-item .t`
- `.mnav-links button`

The giant name (`.bigname`) and the signature are **SVG paths, not text**.

Font metrics at 100px, measured with canvas `measureText` after load. Use these to tune the free substitute serif.

| font | cap height | x-height | descender | font ascent / descent | width of "Let's make the next one yours." | width of "0123456789" | width of a–z |
|---|---|---|---|---|---|---|---|
| Editorial Old Italic | 80.5 | 54.3 | 22.5 | 110 / 30 | 1204.9 | 509.3 | 1190.4 |
| Instrument Serif (roman) | 72.0 | 51.0 | 20.5 | 99 / 31 | 1012.7 | 386.2 | 1008.2 |
| Instrument Serif Italic | 72.0 | 51.6 | 20.5 | 99 / 31 | 1059.2 | 388.2 | 1072.4 |
| Inter Tight 400 | 72.75 | 54.59 | 20.41 | 97 / 24 | 1311.0 | 543.7 | 1261.4 |
| Inter Tight 500 | 72.75 | 54.59 | 20.41 | 97 / 24 | 1341.1 | 561.3 | 1299.7 |

Tuning note for the substitute: Editorial Old Italic is about 11.8% taller in cap height and 13.8% wider (sentence) than Instrument Serif Italic. Its digits are about 31% wider. To match line lengths with Instrument Serif Italic, scale `font-size` about 1.12–1.14x, or keep the size and accept narrower lines. The site's own CSS comment says sizes were cut and letter-spacing tightened for Editorial, so a narrower substitute could go back to the earlier, larger values:
- `.now-i`: clamp(56px, 6vw, 96px)
- `.now-t`: clamp(22px, 1.9vw, 30px)
- `.box h2`: clamp(32px, 3vw, 46px)
- `.p-cta-t`: clamp(28px, 2.4vw, 38px)

---

## 3. The 3D scene

### 3.1 Renderer and camera

- Renderer: three.js r169 WebGLRenderer.
  - `alpha:true`, clear colour 0 with alpha 0 (transparent).
  - Antialias only when DPR < 1.5.
  - Colour management off; linear output (sRGB textures used as-is).
  - Pixel ratio = min(devicePixelRatio, 2). It is further capped by a budget of 5.5M drawing-buffer pixels (`sqrt(5.5e6/(W*H))`), and by GPU max viewport/renderbuffer size.
  - Measured buffers: 2880x1800 at 1440x900 and 2560x1600 at 1280x800 (both DPR 2), 780x1688 at 390x844 (DPR 3 capped to 2).
- Adaptive quality: after the intro, it collects 90 frame times. If the median is over 21 ms and the budget is over 1.4M, the budget is multiplied by 0.7 and the canvas resized.
- Camera: PerspectiveCamera, **near 0.1, far 8000**. The FOV is computed on every frame (below).
- Camera always looks down −Z. Position is `(parallaxX + aimX, parallaxY + aimY, −dist)`. It looks at a point 200 units ahead, offset by 0.6x the parallax. Images never rotate; every plane faces +Z.
- **No three.js Fog object.** "Fog" is done in the fragment shader (see 3.6).

**Framing rule ("stage")**. Recomputed every frame and smoothed with rate 5 (`k = 1−e^(−5·dt)`).
1. Define a target frame rectangle in screen px:
   - top = max(topbar bottom + 10, 0.085·H)
   - bottom = 1.07·H, with a floor of top + 200
   - left = 0, right = W
2. Desktop with a box open: left = box right edge. Phone with a box open: bottom = max(top + 160, H − boxHeight − 30).
3. Frame centre:
   - cx = mid-x
   - cy = mid-y − 0.08·H (closed) or exactly mid-y (open)
4. Phone (W ≤ 860) and closed: frame h = 0.7·H, cy = 0.475·H, cx = 0.47·W.
5. FOV that fits the portrait (100 units tall at depth D0 = 160, aspect 0.93418):
   - fitH = 2·atan( (100/1.03) / 2 / D0 · H/frameH )
   - fitW = 2·atan( (100·0.93418/0.96) / 2 / D0 / cameraAspect · W/frameW )
   - Desktop, or any box open: fov = max(fitH, fitW). Phone and closed: fov = fitH.
6. The projection centre moves to the frame centre with `setViewOffset(W, H, W/2 − cx, H/2 − cy, W, H)`. The illusion stays aligned from the camera.

Measured values:

| viewport | fov | viewOffset x / y |
|---|---|---|
| 1440x900 | 34.37° | 0 / +0.5 |
| 1280x800 | 34.61° | 0 / −2.4 |
| 390x844 | 46.87° | +11.7 / +21.1 |
| 1440x900, project box open | 34.37° easing to 37.47° (about 1.3 s) | x easing to −316.5 |
| 1280x800, project box open | 37.47° | x −281.4 |

### 3.2 The portrait (initial state)

The data is a halftone of a head-and-shoulders photo:
- **110 columns x 157 rows**.
- Cell size **0.84926 x 0.63694** world units (4:3), so the portrait is **93.42 x 100.0 units at depth D0 = 160** (aspect 0.93418).
- **7,832 cells**. Each cell stores:
  - an image index
  - the cell colour (RGB)
  - its own depth `d`, ranging 56 to 1440. Quantiles 10% 189, median 749, 90% 1302.
  - column and row (fractional)
  - "halftone share" `hs`, from 0.056 to 1 (median 0.37). This is the tile's size as a fraction of a full cell, so darker areas get smaller tiles.
  - a "dim" value, from 0.15 to 1. 1,691 cells have dim < 1: these are halo pieces around the silhouette.
  - a "filler" flag. 6,765 cells are portrait-only fillers that dissolve once you fly in.

Placement (the projection trick):
- For a cell at depth d, let k = d / D0.
  - Position = ((col + 0.5 − cols/2)·cellW·k, (rows/2 − row − 0.5)·cellH·k, −d).
  - Full height h0 = cellH·k·0.94.
- Every tile lies on the ray from the camera (at the origin) through its 2D halftone cell. Scaling by k cancels perspective, so the whole field projects into one flat image from the start camera. Any camera movement pulls it apart into depth.
- Drawn height = h0·(hs + (1 − hs)·grow). `grow` goes from 0 at the portrait to 1 once flying (`grow = ease`, see 3.4). At the portrait each tile shows its halftone size; flying in, every tile grows to its full 0.94-cell size. Fillers always keep the halftone size.
- Tile geometry: a 4:3 plane (width = cellW/cellH ≈ 1.3333 x height). The corners are rounded in the shader with radius 6% of tile height.
- Tile colour at the portrait: the image texture is mixed toward the bg by the cell's dim, `mix(bg, colour, dim)`. Dim fades out as fog rises. Tiles keep their own image colours; the face reads purely from tile sizes. A `?shift` param can tint toward the cell colour; the default is 0.

Halo pieces (cells with dim < 1) are never still at the portrait:
- Each loops from far out in the dark to its home on the silhouette.
- Loop speed is 0.05–0.12 cycles/s, with a random phase.
- Distance out = R0·(1 − u)^1.6, where R0 = 20 + rand·40 + (1 − dim)·40 units (scaled by k).
- The direction is radial from the head centre (offset 10 units down), plus a swirl from a slow sum-of-sines flow field. The swirl amplitude is 0.35·R0, its spatial frequencies are about 0.045 and 0.03 per unit, and its time rates are about 0.23–0.35 rad/s.
- Scale goes 0.6 → 1 along the trip. Opacity fades in over the first 30% and fades 85% over the last 18%.

Motes:
- 260 extra tiles keep drifting into the face at the portrait.
- Each trip lasts 5–9 s. It starts at a random point (110–250)·k units out, at depth 1.3–1.9x its target. It ends on a random non-filler, full-dim cell.
- The path uses easeInOutQuad, plus flow-field swirl with amplitude 12·k that fades out as the mote arrives.
- Size = (0.4–0.9)·target h0, shrinking 30% on arrival. Opacity peaks at 0.9 with fade in/out envelopes.
- Visible only at the portrait (multiplied by 1 − fog). Motes ramp in after 35% of the intro.

### 3.3 Intro / loading sequence

1. **Loader**: a full-screen `--bg` panel at z 10, with the logo mark centred.
   - Mark: 84px wide (744x640 source, so about 72px tall). Measured at 678,414 on 1440x900.
   - Drawing: the mark draws itself as two masked strokes. Stroke 1 (left diagonal) uses easeInOutCubic over progress 0–0.58. Stroke 2 (the curve) uses easeInOutCubic over 0.44–1.0, so it starts just before stroke 1 ends.
   - Displayed progress chases real load progress with exponential smoothing (rate 7/s), but is never faster than a 1.6 s "hand pace".
   - Progress budget:
     - 5% on start
     - 5→70% from image-sheet bytes (streamed fetch)
     - 72% when the scene is built
     - 72→98% while sheets upload to the GPU (about 10 ms per frame)
     - 100% after the signature is baked
   - At p = 1 the drawn mark swaps to the exact logo bitmap (class `drawn`). Then `done` fades the loader: opacity 0.6s ease, visibility delayed 0.6s, mark scales to 1.06 over 0.8s `--ease`. On first appearance the mark settles from scale 0.94 / opacity 0.85 to 1 over 1.6s `--ease`.
   - Measured (1440, fast network): stroke 1 finished about 1.8 s after navigation, stroke 2 about 2.8 s, loader `done` at about 3.0 s.
2. **Arrival**: starts the frame the loader fades.
   - Every portrait tile starts at a random angle, (60–180)·k units out, at depth d·(1.4–2.6).
   - It flies to its home with easeOutCubic over 1300–2200 ms.
   - Delay = rand·1500 ms + 9 ms x its grid distance from (cols/2, rows·0.4), so the centre settles first.
   - Scale goes 0.35 → 1. Opacity is dim·min(1, 1.6p).
   - Halo pieces aim at their moving loop position.
   - Measured: a typical tile landed about 2.6 s after the loader faded. The intro ends at the max of (delay + duration) + 50 ms (about 3.5–4.5 s).
3. **Signature** (behind the canvas):
   - Starts at introStart + 22% of the intro length. Measured about 1.0 s after `done`.
   - Draws in **2.9 s**. The pen speed depends on curvature: fast on straight runs, slow in loops, starting from rest (6% ramp) and easing off at the end (8%).
   - A bright 60-unit tip segment at opacity 0.5 and a soft radial glow (r 18, white 0.5 → 0) follow the nib while drawing.
   - The ink is pre-rendered once into a bitmap (liquid-ink SVG filter: turbulence, displacement, blur, alpha threshold), then revealed by a dashed stroke mask.
   - The signature gets a soft elliptical hole around the head: a CSS radial mask with transparent 0–55% and opaque at 100%. The ellipse is centred at the projected point (0.5, 0.34) of the portrait, with radii equal to the projections of 0.24 portrait-width and 0.30 portrait-height. Measured at 1440: centre 748.8,196; radii 203.9 x 272.8 px.
   - Position (desktop): left −2vw, top 12vh, width 104vw (viewBox 1707.93x752.83, inner group rotated −13°). Measured rect at 1440: −28.8,108, 1497.6x660.
   - Hidden (opacity 0.6s) when `away`. Cleared on leaving and redrawn 350 ms after returning to the portrait.
   - **Replace with our own signature path.**

### 3.4 Scroll → camera travel

- Travel is along −Z only. `target` accumulates input; `dist` chases it.
  - Each frame: `dist += (target − dist)·(1 − e^(−4·dt))`. That is an exponential ease with time constant 250 ms; dt is clamped to 50 ms.
  - It snaps to target within 0.01. `target` is never below 0. **There is no end**: the flight is infinite.
- **Wheel**: target += deltaY x 0.55. deltaY is scaled by 32 for line mode and innerHeight for page mode. The handler is non-passive and calls preventDefault. Wheel events inside `.box` are ignored, so the box scrolls natively.
  - Measured: a wheel event the page received as 50px moved target by 27.5. dist reached 61% at 217 ms, 92% at 617 ms and 99.6% at 1.3 s.
- **Keyboard** (ignored while focus is inside `.p-scroll`, input or textarea):
  - ArrowDown +160, ArrowUp −160
  - PageDown / Space +600, PageUp −600
  - Home = back to portrait
  - Escape closes the box and the phone menu
  - Measured: ArrowDown went from 27.5 to 187.4; PageDown went to 787.3 with the same 250 ms ease.
- **Touch**:
  - Each touchmove pushes (lastY − y)·1.6.
  - Fling velocity = dy / max(8 ms, dt)·16. After release it is applied every frame and decays by e^(−3.5·dt).
  - Measured: a 200px swipe over about 200 ms carried to dist 831.8, settling over about 2.5 s.
- **Fog / transition parameter**: `ease = smoothstep(clamp(dist/120, 0, 1))`. It drives tile growth (`grow`), fog, mip blur and lane visibility.
  - Measured: dist 27.5 gives fog 0.133; dist ≥ 120 gives 1.
- UI thresholds:
  - dist > 8: `body.away`. Hero fades out, signature hidden.
  - dist > 60: `body.far`. Flybar and fades appear.
- **Back to portrait** (Back button, logo click, Home key):
  - Reverse flight with easeInOutCubic.
  - Duration = min(2600, 1200 + sqrt(dist)·14) ms. Measured: from 787 it took 1.59 s.
  - Any new input cancels it. Closing the box also happens.
- **Recycling (looping)**:
  - Period **P = 1384** units.
  - A portrait cell belongs to generation g = 0 until the camera passes its depth d. After that, g = ceil((dist − d)/P), and the tile is re-placed at z = −(d + g·P).
  - Only every STRIDE-th cell flies in the stream; the rest are hidden. STRIDE = ceil(cells / (images·0.8)) = **10**, so about 784 stream tiles.
  - Stream tile placement (deterministic per tile and generation):
    - random angle
    - radius = 30 + (150 − 30)·rand^0.8 (so a 30–150 unit tunnel around the lane)
    - y squashed x 0.8
    - height 1.4 + rand^2.2 x 7 (1.4–8.4 units; mostly small)
  - Tiles whose radius is under 82.5 (55% of 150) are "near": they pass in front of the viewer and prefer unseen work. The rest draw from a shuffled deck.
  - Stream images come from the stretch of the time-ordered sequence that will reach the lane in the next 20–520 steps, so the edges preview what is coming.
  - The same place shows the same image when you fly back (memoised).

### 3.5 The central lane

- One image per lane slot, in time order: case studies first, then Dribbble newest to oldest, then repeat. There are 1,067 entries; each round adds "Round N" to the caption.
- Slot k sits at z = −(270 + 55·k).
- Position: uniform in a disc. The radius is sqrt(rand), giving **x ±12, y ±7** units.
- Height: 7.5 x (0.85–1.15) units.
- 52 slots are live at any time and rolled forward.
- Lane tiles are invisible at the portrait. Their opacity is `smoothstep(0.25, 0.9, fog)`, and their sharp copies only show when fog > 0.9.
- Keep-out: portrait tiles inside |x| < 30 and |y| < 22 are hidden while flying, so the lane stays clean.
- Typical on-screen size: at about 46 units from the camera a lane piece is about 310px tall at 1440x900 (measured 310.7px).

### 3.6 Per-tile shading (fragment rules)

- **Near dissolve**: a tile fades by ordered dither (interleaved-gradient-noise discard) as the camera reaches it. Opacity = smoothstep(1.1·h, 2.6·h, distance). Tiles never fill the screen.
- **Far fade ("fog")**: colour mixes to bg by smoothstep(520, 1300, depth) x fog.
- **Depth of field**: mip LOD bias = fog x smoothstep(45, 1150, depth)^0.75 x 5, plus 0.6 while a box is open. Far tiles look soft, near tiles sharp. The atlas UVs are inset by half a blurred texel so blurred samples stay inside their own tile.
- **Progressive develop**: until its sheet arrives a tile is its own mean colour. It then cross-fades to the image over 0.6 s, with a per-tile random delay of up to 0.9 s.
- **Hi-res swap**:
  - A tile taller than 170 screen px gets a separate high-res 4:3 texture. At most 22 at once, the largest first, re-evaluated every 6 frames.
  - At most one GPU upload per frame. The swap fades in over 350 ms (dissolve).
  - It is drawn with polygonOffset so it sits on top of the atlas tile.
- **Hover**: the tile colour is mixed 6% toward white, and a white border is drawn where the UV edge distance < 0.014 (about 1.4% of tile width).

### 3.7 Pointer parallax

- Pointer x and y are normalised to −1..1 over the viewport, then smoothed with rate 1.5/s (`1 − e^(−1.5·dt)`).
  - Measured: 54% of the target after 0.5 s, 97% after 2.5 s.
- Camera offset = smoothed x,y times the drift amplitude, with y inverted:
  - Drift = 0.5 units at the portrait, rising to **3.0 when flying** (0.5 + 2.5·ease). Measured: right edge gives camera x 0.494; top edge gives camera y 0.494.
  - The look-at point moves 0.6x as far, which gives a slight rotation.
- Disabled with prefers-reduced-motion.
- At the portrait, this small offset is what breaks the projection illusion slightly.

### 3.8 Picking, hover and click

- Raycast against the instanced mesh on every frame where the pointer is over the canvas.
  - Before flying (fog < 0.3) only portrait tiles are pickable; after that, filler/lane-keep-out tiles are excluded.
  - Tiles that are dissolving (distance ≤ 1.7·h) are skipped, so the ray passes through them.
  - The first remaining hit is pickable only if its projected height ≥ **34 px** (MIN_CLICK_PX). Otherwise nothing is picked.
- **Hover**:
  - Canvas gets `cursor:pointer`.
  - The tile gets the 6% white tint and 1.4% white edge.
  - `.hud` label shows the project title. It is positioned at the pointer with `translate(-50%, calc(-100% - 14px))`, so it is centred 14px above the cursor.
  - HUD: 12.5px Inter Tight, line-height 18.75px, padding 7px 12px, radius 999px, bg rgba(0,0,0,.62), blur 10px, 1px `--line` border, max-width 60vw with ellipsis. It is shown and hidden instantly, with no transition.
  - Measured label "Outset Law": 87.4 x 34.8 px.
- **Click** = pointerup on the canvas within 8 px and 600 ms of pointerdown. The click opens the hovered tile, even if the camera moved a hair.
- "Seen" tracking: a piece counts as seen when it is ≥ 80 px tall and on screen, checked every 8 frames.

### 3.9 Open / close of a project (overlay)

On open:
1. `box[data-view=project]` is set, along with `body.boxed`.
2. URL `?work=<image id>` is written with `history.replaceState`. Title becomes `<Project> · <Name>`.
3. **Box slide-in**: `translateX(-40px)` → 0 over 0.75s `--ease`; opacity 0 → 1 over 0.45s ease; visibility immediate.
   - Measured at 60 ms steps: opacity .18, .43, .69, .85, .93, .98, 1 (done by about 470 ms); x −25.5, −17.2, −9.8, −5.3, −3.3, −1.7, −0.8.
   - Inner view: opacity 0.45s ease with a 0.1s delay.
4. **Hero** (if visible) fades out with opacity 0.6s ease and translateY(30px) over 0.9s `--ease`.
5. **Background blur in WebGL**:
   - The scene is rendered into a half-resolution target, then blurred with a separable 13-tap gaussian, horizontal then vertical.
   - Weights: 0.1964, 0.1760, 0.1255, 0.0713, 0.0323, 0.0117, 0.0034.
   - Radius = uSoft² x 3.5 texels of the half-res target, which is about 7 screen px at full.
   - uSoft chases 1 with rate 6/s. Measured: .45 at 60 ms, .73 at 190 ms, .91 at 370 ms, .99 at 1.1 s.
   - The field is also mixed 35% toward bg (dimmer) and gets +0.6 mip bias.
6. **Reframing**: the portrait/projection centre glides to the free area right of the box (rate 5/s), and the FOV refits. Measured: viewOffset x 0 → −316 and fov 34.4° → 37.5° over about 1.3 s.
7. **Focus drift**: the clicked tile slides along its camera ray toward the viewer by 30% of its distance over 10 s, with a cosine ease. It stays in place on screen and just grows. On close it returns with exponential decay at rate 3.2/s.

On close (Escape, Close button, a deliberate field scroll of ≥ 120 accumulated wheel/touch units, the logo, or Back):
- Box: transform back to −40px over 0.6s `--ease`, opacity 0.45s ease, visibility hidden after 0.6s.
  - Measured: opacity 0.89, 0.57, 0.36, 0.18, 0.08, 0.03, 0 by about 500 ms.
- uSoft decays at the same rate 6.
- URL `work` param is removed. Gallery DOM is cleared 700 ms later.

A small wheel nudge (measured: 27.5 units) does NOT close the box.

### 3.10 Image inventory and aspects (for placeholders)

- 1,067 images from 730 projects. 1,068 media entries, 8 of them videos. 15 projects are case studies (have an external URL).
- Aspect distribution of the originals:
  - about 4:3: 711
  - about 16:9: 226
  - 1.4–1.6: 38
  - over 1.85: 22
  - portrait (< 0.9): 53
  - roughly square: 9
  - 1.1–1.3: 9
- **In 3D every tile is drawn as a 4:3 crop.**
- Texture atlases: 5 WebP sheets, each 16x21 tiles of 256x192 (4096x4032), 1.06–2.06 MB each.
  - Phones and small screens (min(W,H)·DPR < 1200) use half-size `-sm` sheets with 128x96 tiles.
  - Sheets are fetched most-used-first, two in parallel, decoded and mip-mapped in a Worker, then uploaded in strips of about 1 MB, one strip per frame.
- Hi-res close-ups: individual 4:3 WebP files of about 4–100 KB each, fetched on demand.
- Case-study gallery images: 2000x1125 (16:9) WebP of 80–330 KB. Video entries autoplay muted and looped.
- Other assets: `logo.png` 744x640 (shown at 48px wide, 41.3px tall); `logo-part1.png` and `logo-part2.png` (the two loader stroke layers).
- **Placeholder plan**:
  - Generate our own atlas (or individual textures) at 4:3 with the aspect mix above for the box view.
  - Generate our own halftone cells from our own portrait: 110x157 cells. Size each cell's tile by luminance (hs), assign random depths 56–1440 (median about 750), and set dim < 1 on the outer silhouette ring.

---

## 4. DOM UI overlay (desktop; measured at 1440x900, with 1280x800 values where they differ)

### 4.1 Top bar (`.topbar`)

- Fixed, top/left/right = `--pad`.
- Flex, `justify-content:space-between`, `align-items:flex-start`.
- 13px Inter Tight 400, line-height 1.35 (17.55px), colour `--ink`.
- Measured rect: 28.8,28.8, 1382.4 x 41.3. At 1280: 25.6,25.6, 1228.8 x 41.3.
- Logo `.logo`: width 48px (height 41.3). Click = back to portrait.
- Three columns. Each column is two stacked lines: a mute key line, then an ink value line.
  1. "Currently:" + role with an underlined link. Starts at x 357.4 (1440) / 303 (1280); width 147.3.
  2. "Based in:" + city and a live clock (`HH:MM` 24h, Europe/Bucharest, tabular numerals, refreshed every 15 s). Starts at x 917 (clock position).
  3. "Navigation:" + "Selected, Work, About, Contact" as comma-separated text buttons. Right-aligned at the right pad.
- Clicking either fact column (not its link) opens About.
- Nav hover: a 1px underline grows from the left. It is `background-size 0 → 100% 1px` at the bottom, transitioning `background-size 0.35s --ease`.
- Value-line links: underline at 3px offset, colour rgba(255,255,255,.3).

### 4.2 Hero (`.hero`, z 2)

- Fixed, left/right `--pad`, bottom 0, `pointer-events:none`.
- Transition: opacity 0.6s ease, transform 0.9s `--ease`.
  - With `body.away`: opacity 0 and translateY(60px).
  - With `body.boxed`: opacity 0 and translateY(30px).
- `.hero-row`: flex, space-between, align-items flex-end, gap 24px, margin-bottom clamp(24px, 3.4vh, 40px). Measured at y 581.4, height 69.3.
- `.lead`:
  - max-width 440px, 16.5px/1.5 (24.75px), colour rgba(242,242,242,.86), with the text-shadow from 2.1.
  - margin-bottom −0.3em; 3 lines.
  - Measured 440 x 74.3 at 28.8,581.4.
- `.start` "Explore the work" pill:
  - 14px, padding 6px 6px 6px 18px, gap 12px, styling from 2.2.
  - Measured 170.5 x 46 at right edge (x 1240.7, y 604.7).
  - Contains a 32px circle (1px rgba(255,255,255,.35) border) holding a 14px down-arrow.
  - The arrow bobs: translateY −2px ↔ +3px, 1.8s `--ease` infinite.
  - Hover: pill border goes `#fff`; the circle fills `#fff` with black arrow. Transitions: border-color/background 0.3s ease on the pill, background/color 0.3s ease on the circle.
  - Click: target = max(target, 420), i.e. a fly-in.
- `.bigname`:
  - An SVG of the name lettering, viewBox 4609.52 x 633.15 (aspect 7.28:1), filled `--ink`.
  - `width:100%` of the content box. Padding-bottom = `--pad`.
  - Measured SVG 1382.4 x 189.9 at y 681.3; block height 218.7.
  - **Replace with our own lettering** (outline a serif italic). Keep the full-bleed width and the bottom pad.

### 4.3 Flybar (`.flybar`, z 3; shown with `body.far`)

- Fixed, left/right/bottom = `--pad`. Flex, space-between, align-items flex-end, gap 20px.
- Hidden state: opacity 0 and translateY(14px). Transition: opacity 0.5s ease, transform 0.7s `--ease`.
- Measured: y 829.7, height 41.5.
- Left, `.now` button (click opens that piece):
  - `.now-i` number: 3-digit zero-padded lane index, Editorial Old Italic, clamp(40px, 3.6vw, 60px), letter-spacing −0.03em, tabular numerals.
    - Measured 51.84px (ls −1.555px) at 1440; 46.08px at 1280.
    - Uses `text-box: trim-both cap alphabetic` where supported.
  - `.now-t` title: serif clamp(19px, 1.5vw, 24px), letter-spacing −0.01em, line-height 1.1. Measured 21.6px at 1440 and 19.2px at 1280. Single line with ellipsis.
  - `.now-s` kind: 12.5px, mute colour.
  - Layout: gap 14px; the title's cap line is level with the top of the number and the subtitle sits on its baseline (`align-items:stretch`, text column `space-between`, gap 8px).
  - Hover underlines the title (offset 4px, 1px thick).
  - The index is the next lane piece still ahead: k = ceil((dist + 28 − 270)/55).
- Right, `.flyright` (gap 14px):
  - `#seen` "N of 1,067 works": 12.5px mute, tabular numerals. Once all are seen it reads "All 1,067 works seen".
  - `#back` "Back to home" pill: 13px, black on white, padding 8px 14px 8px 11px, gap 7px, 14px circular-arrow icon. Measured 122.9 x 35.5. Hover: scale(1.04) with transform 0.2s ease.

### 4.4 Social (`.social`, z 4)

- Bottom-right at `--pad`. Two lines: "Elsewhere:" plus 3 links. 13px/1.35, right-aligned.
- Visible only with `body.side` (About/Contact open).
- Hidden state: opacity 0, translateY(10px). Transitions: opacity 0.45s ease, transform 0.6s `--ease`, bottom 0.4s ease.
- With `body.far` it lifts to bottom = pad + 52px so it clears the flybar. Measured y 784.1 vs 846.1.
- Link hover uses the same growing underline as the nav.

### 4.5 The glass box (`aside.box`, z 5)

- Desktop geometry: top = 2·pad + 42px (99.6 at 1440, 93.2 at 1280); left = pad; bottom = pad; width `--box-open`.
  - Measured: 604.8 x 771.6 at 1440; 537.6 x 681.2 at 1280.
- Inner padding `--bp` 28px. Each view is absolutely positioned and cross-fades.
- **Header** `.v-head`: flex, space-between, padding-bottom 20px (18px in project), wraps if needed.
  - `.back-link` "Close" with chevron: 13.5px, padding 6px 13px 6px 9px, radius 999, bg .06 (hover .12), 1px `--line`. Measured 78.8 x 34.3.
  - Right side: `.src` label (12.5px mute) or project actions:
    - "Copy link" (same pill, 100.1 x 34.3)
    - "Read the case study" (white pill, 13.5px weight 500, padding 8px 15px, 150.5 x 36.3; only shown for case studies)
- **Project view** (`.p-fit`, gap 10px):
  - kind line: 12.5px mute, with " · N pieces" appended for multi-piece
  - `h2` title: serif clamp(28px, 2.3vw, 38px), line-height 1.08, letter-spacing −0.015em. Measured 33.12px at 1440, 29.44px at 1280.
  - desc: 14.5px/1.55, rgba(242,242,242,.78)
  - stage: the piece. 4:3 or wider is shown whole (contain, radius 14px). Taller than 1.3:1 is put in a 4:3 frame cropped with cover. Measured image 546.8 x 407.4.
  - multi-piece case studies scroll vertically: the first piece takes the space, the rest stack under it with gap 10px.
  - closing CTA card (`.p-cta`): padding 16px 16px 16px 20px, row layout wrapping.
    - kicker 12px mute
    - title serif clamp(19px, 1.45vw, 23px) (20.88px at 1440), ls −0.01em, lh 1.12
    - "Start a project" white pill: 13.5px weight 500, padding 10px 18px. Hover scale 1.04 over 0.2s.
    - "See the studio" underline link: hover makes the underline full colour.
  - Gallery images fade in with opacity 0.5s ease on load.
- **Copy link**: copies `origin + path + ?work=<id>`. The button turns white with "Link copied" for 2 s, and a toast appears:
  - bottom = pad + 18px, centred, white pill, 13px, padding 9px 16px
  - in: opacity 0.25s, translateY 8px → 0 over 0.35s `--ease`
  - auto-hide after 1.8 s
- **Selected view**:
  - h2, then 15px/1.6 body.
  - An ordered list with a top border of 1px `--line`. Each row has a 1px bottom border and is padding 12px 0, gap 16px:
    - thumbnail 84x63, cover, radius 8px
    - title: serif 24px, ls −0.01em, lh 1.05
    - kind: 13px mute, margin-top 4px
    - number "01".."08": 12.5px mute, right-aligned
    - hover underlines the title
  - Footer line: 14px mute with an underline button "fly through everything" (sets target 420).
  - Clicking a row closes the box, flies the camera to that lane piece and opens it on arrival:
    - The camera stops at 40–60 units before the piece (5.7x its height).
    - It slides sideways onto the piece with rate 3/s. On desktop it is lifted by 7.5% of H.
    - The piece opens when within 4 units, or after a 9 s timeout.
- **About view**:
  - h2, two body paragraphs.
  - A `.facts` 2-column grid: gap 20px 24px, top border 1px `--line`, padding-top 20px. Each fact has a 12px mute label and a 14px/1.5 value; client names are buttons that fly to the work.
  - CTA card pinned to the bottom (margin-top auto).
- **Contact view** (brief form, gap 13px):
  - h2 "Tell me what you're building.", sub 14.5px .72.
  - Name and Email in a 2-column grid (gap 12px), then Company.
  - "What do you need?" chips (checkbox) and "Budget" chips (radio):
    - chip: 13px, padding 7px 13px, radius 999, bg .04, border `--line`, text .8
    - hover border .35
    - checked: white bg, black text
    - transitions 0.2s ease
  - Textarea min-height 84px.
  - Inputs: 14.5px, padding 10px 13px, radius 12px, bg .05, border `--line`. Focus: border .45, bg .08, over 0.2s ease.
  - Submit button is the white pill. Next to it is a 13px mute note with a mailto link.
  - Error line 13px `#ff9b92`. Invalid fields get a red border after the first submit.
  - Success swaps to a thank-you block.
  - On open, Name gets focus after 450 ms (desktop only).
  - Wiring: POST JSON to an endpoint; fall back to mailto. Our build can stub this.
- Box view-switch: the active view fades in with opacity 0.45s ease and a 0.1s delay; the outgoing one fades over 0.35s.

### 4.6 Consent banner (from source CSS; not rendered live)

- Fixed right/bottom 20px, max-width 360px, padding 16px 16px 14px, radius 18px, glass from 2.2.
- Text 13.5px/1.5 Inter Tight in rgba(242,242,242,.82), paragraph margin 0 0 12px.
- Buttons are right-aligned, gap 8px, radius 999, padding 8px 16px:
  - Decline: transparent with a .3 border
  - Accept: white with black text
- In: opacity 0.35s ease, translateY 14px → 0 over 0.45s `--ease`. Out reverses, then the element is removed after 400 ms.
- Appears 4 s after load, only for EEA/UK/CH visitors without a stored choice.
- ≤ 600px: left/right/bottom 12px, no max-width.

---

## 5. Hover and transition summary (UI)

| element | property | duration / easing |
|---|---|---|
| nav links, social links, phone "Menu" word | underline `background-size 0→100% 1px` | 0.35s `--ease` |
| `.start` pill | border-color → #fff; circle bg → #fff, arrow → #000 | 0.3s ease |
| `.start` arrow | idle bob −2px ↔ +3px | 1.8s `--ease` infinite |
| `#back`, `.p-cta-btn` | scale 1.04 | 0.2s ease |
| `.back-link` | bg .06 → .12 | instant |
| `.p-cta-alt`, `.sel-all`, `.go-work` | underline colour .3 → currentColor | instant |
| `.now`, `.sel-item` | underline title (offset 4px, 1px) | instant |
| chips | bg / colour / border | 0.2s ease |
| inputs | border / bg on focus | 0.2s ease |
| hero | opacity / translateY | 0.6s ease / 0.9s `--ease` |
| flybar | opacity / translateY(14px) | 0.5s ease / 0.7s `--ease` |
| fly fades (body pseudos) | opacity | 0.6s ease |
| box open | transform −40px→0 / opacity | 0.75s `--ease` / 0.45s ease |
| box close | transform / opacity / visibility delay | 0.6s `--ease` / 0.45s ease / 0.6s |
| box width change | width | 0.6s `--ease` |
| loader out | opacity, visibility delay | 0.6s ease |
| signature hide | opacity | 0.6s ease |
| canvas hover | cursor pointer + in-shader tint | instant |

Reduced motion:
- CSS transitions are removed on box/view/hero/flybar, and the arrow bob and loader drawing are skipped.
- In JS: no damping (dist = target), no parallax, no focus drift, no WebGL blur pass, and Back is instant.

---

## 6. URL parameters, routes, keyboard

There is a single route `/`. Behaviour depends on query parameters:

| param | effect |
|---|---|
| `?work=<image-id>` | Shareable link. 2.6 s after the intro starts it flies to target ≥ 260, then opens that work 1.4 s later. Written via replaceState whenever a project opens; removed on close. |
| `?open=about` / `contact` / `selected` | Opens that box view 1.8 s after the intro starts, and strips the param. Measured: contact opened about 1.4–1.8 s after the loader faded. |
| `?fly=1` | Starts the flight immediately (target 460), then strips the param. Used when arriving from the 404 page. |
| `?internal=1` / `0` | Tracking off / on (localStorage). |
| `?sm=1` / `0` | Force small / large atlas sheets. |
| `?safari=1` | Forces the Safari path (signature without filters, no worker decode). |
| `?timer=1` | Uses setTimeout at 33 ms instead of rAF (testing). |
| `?glow=line\|halo\|ring` | Experimental light around case-study lane pieces. Off by default; do not build. |
| `?shift=<n>` | Tints tiles toward their halftone cell colour. Default 0. |

Keyboard:
- ArrowDown/ArrowUp: ±160
- PageDown/Space: +600; PageUp: −600
- Home: back to portrait
- Escape: close box and phone menu

Other click targets:
- Logo: back to portrait.
- "Work" in the nav: closes the box and, if dist < 200, flies to 420.
- Top-bar fact columns: open About.
- Each nav button (About, Selected, Contact) toggles its view.

---

## 7. Mobile (≤ 860px; measured at 390x844, DPR 3)

- `--pad` = 16px.
- Top bar: 12px base.
  - Logo 38px wide (32.7 tall).
  - All three fact columns are hidden.
  - A plain word button "Menu" sits top-right: 15px, line-height 1.35, padding 4px 0, growing underline on hover/open. Measured 36.8 x 28.3 at x 337.2. It reads "Close" while open.
- `.mnav` panel (z 6):
  - top = pad + 52 (68px), left/right pad, padding 22px 20px 20px, gap 22px, glass from 2.2. Measured 358 x 429.5.
  - Closed: opacity 0, translateY(−10px), visibility delayed 0.35s. Open: opacity 0.35s ease, transform 0.5s `--ease`.
  - Content:
    - 4 serif links (Selected work / Work / About / Contact): 40px, line-height 1.1 (44px), ls −0.02em, gap 2px
    - the lead text: 15px/1.5, .82
    - the facts in 2 columns: 12.5px/1.4, top border 1px `--line`, padding-top 16px
- Hero:
  - The lead is hidden (it moves into the menu).
  - The name uses a two-line stacked SVG (viewBox 2545 x 1288). Measured 354 x 179.1 at y 649.9, with padding 2px left/right and bottom pad + safe-area − 1px.
  - The start button is just a 38px circle with a .35 border, bg rgba(10,10,11,.35) and blur 8px. It is absolutely positioned at the right, level with the first line of the name: bottom = pad + safe-area + 0.382·(100vw − 2·pad) − 12px. Measured at 336,665.3.
- Signature: small and centred at the top (left 25vw, width 50vw, top pad + 22px; rotated −8°; heavier stroke of 11px; no head mask). Measured 195 x 85.9 at 97.5,38.
- Portrait framing: fills the height only.
  - frame height 0.7·H
  - centre y 0.475·H, centre x 0.47·W (nudged left)
  - fov 46.87°, viewOffset (+11.7, +21.1)
  - The shoulders run off both sides. See `.recon/390x844-02-portrait.png`.
- Flybar: bottom = pad + safe-area.
  - `.now-i` 36px, `.now-t` 17px, `.now-s` 11.5px, gap 10px. The caption max-width is 100vw − 2·pad − 96px.
  - The "N of M works" counter is hidden.
  - `#back` shows only "Back": 13px, padding 9px 13px 9px 11px. Measured 71.7 x 37.5.
- Box = bottom sheet.
  - left/right pad, top auto, height `100% − 2·pad − 60px` (752px at 844), so it sits 76px from the top. Closed state translateY(40px).
  - `--bp` 14px. Header padding-bottom 12px.
  - Project Close and Copy become 38px round icon buttons (Close shows an X icon).
  - h2 24px; desc 13.5px/1.5. Stage images are full width, radius 10px.
  - CTA: padding 14px, radius 12px, title 19px, button 13px with padding 9px 15px.
  - Selected thumbnails 64x48, titles 20px.
  - Facts and form rows become 1 column.
  - For a single piece, the sheet height shrinks to fit it.
  - With a box open, the portrait frame bottom = max(top + 160, H − sheetHeight − 30).
- Social links and the consent max-width are adjusted as described above (social hidden on phones).
- Input: touch drag at 1.6x, plus fling (see 3.4). There is no hover HUD on touch. Tap = pointerup within 8px and 600ms.
- Phones and small screens use the half-size atlas sheets.

---

## 8. Build checklist

1. Global CSS tokens and fonts:
   - `--bg #0a0a0b`, `--ink #f2f2f2`, `--mute .55`, `--line .12`
   - `--pad clamp(16px,2vw,32px)`, `--box-open clamp(460px,42vw,780px)`, `--ease cubic-bezier(.22,1,.36,1)`
   - Inter Tight 400/500 for sans. A free italic display serif in the Editorial slot, tuned with the metrics in 2.4.
   - `html/body overflow:hidden`. Add the `--z` zoom script for windows over 1600x900.
2. Fixed layer stack and z-order exactly as in section 1. Body classes `away` (dist > 8), `far` (dist > 60), `boxed`, `side`.
3. Loader:
   - 84px mark drawn as 2 masked strokes with easeInOutCubic; stroke 1 over p 0–0.58, stroke 2 over p 0.44–1.
   - Progress smoothing rate 7, minimum 1.6 s.
   - Fade 0.6s and scale 1.06 over 0.8s.
4. three.js setup:
   - transparent renderer, DPR ≤ 2 with a 5.5M-pixel buffer budget
   - PerspectiveCamera near 0.1 / far 8000
   - per-frame "stage" FOV fit with D0 = 160, a 100-unit-tall portrait and setViewOffset framing (3.1), smoothed at rate 5
5. Portrait data generator, from our own photo:
   - 110x157 halftone cells of 0.84926x0.63694 at D0
   - per-cell random depth 56–1440, size share hs from luminance, dim < 1 for a halo ring, filler flag
   - place tiles on camera rays scaled by d/D0, with height = 0.94·cellH·k·(hs → 1 by `grow`)
6. One InstancedMesh of 4:3 planes for portrait + 52 lane slots + 260 motes. Shader rules:
   - rounded corners at 6% of height
   - dithered near-dissolve between 1.1h and 2.6h
   - far fade over depth 520–1300 x fog
   - mip-bias DoF
   - mean-colour → image develop over 0.6 s
   - hover tint of 6% white plus a 1.4% white edge
7. Intro arrival:
   - per tile: delay rand·1.5 s + 9 ms per cell from the centre, duration 1.3–2.2 s easeOutCubic, starting radius (60–180)·k, starting depth x1.4–2.6, scale 0.35 → 1
   - then the halo loops (3.2) and motes (260, 5–9 s trips)
8. Signature layer behind the canvas:
   - our own path, drawn over 2.9 s with curvature-based pen speed and a nib glow
   - starts at 22% of the intro
   - elliptical hole around the head
   - hidden when away; redrawn 350 ms after returning
9. Travel:
   - target/dist with the 250 ms exponential ease; no upper bound
   - wheel x0.55; keys ±160/±600; touch x1.6 with fling decaying at 3.5/s
   - fog ease = smoothstep(dist/120)
   - Back/Home rewind of min(2600, 1200 + 14·sqrt(dist)) ms with easeInOutCubic
10. Endless loop:
    - period P = 1384
    - generation recycling with STRIDE 10
    - stream tunnel radius 30–150 (y x0.8), heights 1.4–8.4
    - near tiles show unseen work
    - memoise per tile and generation
11. Lane:
    - slots at z = 270 + 55k
    - disc ±12 x ±7, height 7.5 x 0.85–1.15
    - time-ordered sequence
    - keep-out of |x| < 30, |y| < 22 for portrait tiles while flying
    - fade in at fog 0.25–0.9
12. Pointer parallax: rate 1.5/s; amplitude 0.5 → 3.0 units with fog; look-at at 0.6x; y inverted.
13. Picking:
    - raycast, skip dissolving tiles, minimum 34px
    - HUD pill 14px above the cursor
    - click = within 8px and 600ms
    - hi-res swap above 170px (max 22, 350ms fade)
    - seen at ≥ 80px
14. Project open:
    - box slide 0.75s `--ease` plus opacity 0.45s
    - WebGL half-res 13-tap separable blur, radius uSoft²·3.5, uSoft rate 6/s, field dims 35%
    - reframe portrait beside the box
    - focus drift of 30% over 10 s
    - `?work=` URL and title
    - close on Esc/Close/scroll ≥ 120
15. Box views: project, selected, about, contact, plus the copy-link toast. Use the exact paddings and sizes from 4.5.
16. Flybar (counter, title, kind, "N of M works", Back pill), social block, and top/bottom fly fades.
17. URL params: `?work`, `?open=about|contact|selected` (1.8 s after intro), `?fly`. Keyboard map as in section 6.
18. Mobile ≤ 860px, as in section 7:
    - Menu word plus glass panel
    - stacked name and 38px arrow
    - top-centre signature
    - height-fit portrait at 0.7H
    - bottom-sheet box
    - compact flybar with "Back"
    - half-size textures
19. Reduced motion: no damping, parallax, drift or blur pass; no CSS transitions on the main layers.
20. Compare against `.recon/*.png` at 1440x900, 1280x800 and 390x844 (portrait, flying, hover, project-open, about, contact, selected, menu, ?open=contact).
