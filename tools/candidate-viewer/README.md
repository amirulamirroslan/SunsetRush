# Candidate car viewer (offline, dependency-free)

Renders a GLB/glTF from SunsetRush's real chase-camera numbers (`src/render/cameraRig.ts`: eye 2.3 m up / 6.9 m behind, look-at 3.5 m ahead at y 1.15, vertical FOV 58; `chase_fast` = 2.7 / 8.4 / 6.7 / FOV 73) with a fixed sunset-sky reflection, flat material colours and no three.js.
It is a **shape / proportion / lamp / wheel screening tool, not a lighting match for the game**: final judgement must be made in the running game.

```bash
cp candidate.glb tools/candidate-viewer/        # temp copy; do not commit unlicensed files
python3 tools/candidate-viewer/glb_geom.py candidate.glb      # tris, bounds, tris per material, part names
# optional flat-colour texture average json (see HANDOVER) passed as &tex=file.json
B=http://127.0.0.1:8765/viewer.html
tools/candidate-viewer/run.sh '[["'$B'?m=candidate.glb&v=chase&flip=90&paint=e8501c","out.png",1280,720]]'
```
Query: `v=chase|chase_fast|rear34|side|top|front34`, `flip=<deg about Y>` (the two Innerscene models face +X, so `flip=90` turns the nose to +Z), `paint=<hex>` recolours the material named `paint`, `s=` scale, `y=` height offset. Needs Python 3 + `playwright` and Chromium (`CHROME_PATH`).

Also: `python3 intake.py model.glb` gives the licence-metadata / budget / proportions PASS-WARN-FAIL report (see `docs/car-candidates/MANUAL_SEARCH.md`).
