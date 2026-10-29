# Car model candidate evaluation (Innerscene generic coupes)

Date: 2026-10-27. Outcome: **neither candidate integrated; the current Car Concept body is kept.** `src/`, `public/models/` and `package.json` are unchanged.

## What was tested
Files supplied by the owner (not downloaded by me):
`generic-front-engine-grand-tourer-coupe.glb` (4.31 MB) and `generic-1990s-japanese-style-sports-coupe.glb` (4.35 MB).

| | 1990s JDM coupe | Front-engine GT coupe |
|---|---|---|
| Size (x length, y, z width) | 4.49 x 1.29 x 2.09 m | 4.84 x 1.35 x 2.24 m |
| Orientation | length on X, nose at +X (needs a 90 deg Y rotation); origin on ground, centred | same |
| Triangles / meshes / nodes | 113,490 / 400 / 401 | 112,994 / 397 / 398 |
| Draw calls if loaded as-is | about 400 per car | about 400 per car |
| Materials | 11, all PBR, clearcoat on all but one, 3 use KHR_materials_transmission (glass, clear lens) | same |
| Textures | 11 embedded 2048x2048 PNGs (about 36 KB each) that are **solid single colours**, so they can be replaced by base-colour factors; as GPU textures they would cost roughly 180 MB | same |
| Biggest parts | 33k tris of tyre tread segments (176 meshes), 28k "black", 22k paint | same |
| Tail lamp | `redlens` is only 48 triangles in 2 meshes | same |

The two files share one generator (identical part names, materials and textures); the GT is mostly a longer, wider version of the JDM body.

## Visual verdict (reject both)
Rendered from SunsetRush's chase-camera numbers (see `tools/candidate-viewer`), and compared with a real game frame of the current car: `compare_chase_current_vs_candidates.png`, plus side and rear three-quarter views.
- **Boxy notchback rear**: tall flat trunk deck, upright rear glass and a small cabin read as a 1980s sedan/coupe, not a premium sports coupe. This is the "boxy rear end" rejection criterion, on both.
- Tail lamps are two small pink-red rectangles; no full-width light signature. The current car's bar, pipes and diffuser read better at game size.
- Scalloped/wavy edge along the trunk-lid seam; loose parts hang under the floor in side view (stray mechanical geometry).
- Wheels (five-spoke alloys, tyre sidewalls) are acceptable, not toy-like, but they do not rescue the body.
- Glass is a single large flat rear window; interior is visible through it.
- The current car has the lower, wider, more aggressive stance that the owner's brief asks for, so replacing it would be a regression, not an upgrade.

Caveat: my test lighting is a simplified sunset-sky shader, not the game's HDRI/PBR/shadows, so the paint gloss in the candidate renders is only indicative. The shape, stance and rear design conclusions do not depend on lighting.

## Licence and provenance: NOT verified
- The sandbox has **no internet access** (innerscene.com, Sketchfab, GitHub and npm all unreachable), so the two Innerscene library pages and their licence text could not be read.
- The GLBs carry **no licence, copyright, author or source field** (`asset` has only `generator: Khronos glTF Blender I/O v5.2.40`; no `extras`).
- Therefore commercial-use rights, attribution requirement, redistribution limits and any dependency terms are **unknown**. The files were not copied into `public/` or `assets-src/`, and nothing is shipped from them. Do not ship them until the licence text on the Innerscene pages has been read and recorded.

## Other sources
Not searched: no network. I did not substitute any other model.

## If you want to keep looking (exact steps)
1. Pick a **fastback / wedge supercar or GT silhouette**, closed roof, low (about 1.1-1.25 m), wide (about 1.9-2.0 m), with a lamp signature visible from behind. Avoid notchback/sedan decks.
2. On the model's page, read the licence text yourself: commercial use must be allowed (CC0 or CC-BY 4.0 are fine; avoid NC, ND and "editorial only"; no brand logos). Download the **GLB or glTF** plus the licence text/screenshot. Save the original under `assets-src/<name>/` with `LICENSE.md` containing the author, URL, date and licence.
3. Check size: aim at or below 60-80k triangles for the high LOD, and either under about 20 meshes or willing to be merged by material (`npx gltf-transform optimize`, `--compress meshopt --texture-compress webp`).
4. Screen it with `tools/candidate-viewer` (README there) before touching the game.
5. Integration contract (from `src/render/carModel.ts`): +Z nose, y up, about 4.34 m long and ground at y 0 (or update `CAR` constants); materials named `paintMain`, `paintAccent`, `brakelight`, `headlight`, `glass`; four groups `wheel_FL/FR/RL/RR` with children named `rim*`, `disc*`, `pad*`; keep `car-low/mid/high.glb` as the fallback. Prefer 3 LODs.
6. Merge draw calls (one mesh per material), drop tread geometry and any interior at the low LOD, avoid `transmission` (use plain alpha glass) for lower-end PCs, and keep the existing envMap intensity approach.


---

## Correction (session 3): viewer bug found
The session-1 renders of the Innerscene models used a viewer that **ignored per-node transforms**. Corrected renders (`innerscene-jdm-recheck-corrected-viewer.png`) show the JDM body with spoiler, plate and exhaust tips, and **no loose parts under the floor**. So these session-1 statements were wrong and are withdrawn: "stray mechanical geometry hangs under the floor", and "tail lamp is tiny / lacks pipes" (the 48-triangle `redlens` count is still true, but the body still shows modest lamps). The rejection still stands because of the boxy notchback body, the 400 meshes and the unverified licence. The corrected viewer is in `tools/candidate-viewer/viewer.html`.

## Session 3 candidates: `sports-car.glb` and `1990s-sports-car.glb` (owner-supplied) — rejected
Files inspected directly and rendered with the corrected viewer (base-colour and metal/rough textures; normal maps not applied).

| | sports-car.glb | 1990s-sports-car.glb |
|---|---|---|
| File | 1.55 MB | 1.13 MB |
| Triangles / primitives / materials | 34,763 / 18 / 18 | 16,983 / 18 / 18 |
| Size (W x H x L) | 1.97 x 1.22 x 4.38 m | 1.88 x 1.23 x 4.42 m |
| Orientation | +Z nose, y up, ground at y=0 (matches the game) | same |
| Structure | body, 4 wheel nodes (pivot at hub, radius 0.345 m), windows | same (wheel radius 0.31 m) |
| Textures | body 2048 JPEG baseColor + metalRough + normal (about 0.6 MB); tyre/rim solid colours | same, plus 64x256 tyre maps |
| Materials in game terms | body is one baked-texture material, so paint colour cannot be switched without rebuilding the texture | same |
| Licence metadata | none (no extras/copyright); source page not supplied | none |

Why rejected on look (`session3-compare-chase-current-vs-new-models.png`, `session3-sports-car-models-side-and-rear34.png`):
- Both are stylised soft "clay" bodies with a tall slab rear, a bolt-on wing, and lamps painted into a flat texture. They read as arcade/toy cars, which is the same problem the current car has, not a premium realistic coupe.
- sports-car: four round "ring" tail lamps, white wing and white pipes, pill-shaped fenders, blank flat rear window.
- 1990s-sports-car: the best lamp (full-width bar) and a lower nose, but a teal blobby body, a huge wing, and both exhaust tips bunched off-centre on one side.
- Wheels are acceptable five-spokes with coral hubcaps (sports-car), not premium.
- Neither is a clear improvement over the current Car Concept body with its added rear detail, so nothing was integrated.

What they do offer (worth remembering): the budgets are ideal (18 draw calls, 17-35k triangles, correct axis and scale, separate wheel nodes). A model with this structure but a more realistic body would integrate cheaply. Licence for these two is unknown; they were not added to the project.
