# Your work goes here

1. Put your images (and videos) under `content/works/`, in any folder structure.
2. Copy `projects.example.json` to `projects.json` and list your projects **in the order they were made, newest first**. Case studies (`"case": true`) always come first in the flight.
3. Optional: add `portrait.jpg`, a head-and-shoulders photo on a plain, even background. It becomes the halftone face. If the figure doesn't separate cleanly from the background, raise or lower `portraitThreshold` (default 22).
4. Run `npm run import`, then `npm run dev`.

What it makes (in `public/`):
- `works/atlas.webp` and `atlas-sm.webp`: every piece as a 128×96 tile (64×48 on phones) for the 3D field
- `works/hi/`, `full/` and `thumb/`: the 1024×768 close-up, the full-width gallery image and the 168×126 list thumbnail
- `works/media/`: copied videos
- `data/works.json`: everything the app reads

The app falls back to generated placeholders while `public/data/works.json` doesn't exist. Delete it to go back to them.

**Only import work you own or have permission to show.**
