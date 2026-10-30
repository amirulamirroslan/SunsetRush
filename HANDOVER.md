# Sunset Rush — Development Handover

Repository: https://github.com/amirulamirroslan/SunsetRush · branch `sunset-rush-cloud-development` (never force-push; never touch `main`).
Stack: Vite 7 + TypeScript 5.9 + Three.js 0.180. No backend; saves to localStorage. `README.md` has structure/controls/licences, `REPORT.md` the world+UI pass details.

## What happened in the last session (all pushed to the branch)
1. `9ef3e98` Applied the earlier "checkpoint 02" world/UI polish to the repo (the repo previously held the older pre-polish source): terrain relief, 4-range backdrop + mist, new vegetation types, road wear overlay, overpasses / braking boards / marshal posts, UI fixes (setup/pause/results fit on 960x540, 667x375, 390x844). Details in `REPORT.md`.
2. `0da1e51` **Rival racing quality** (the #1 item of the audit below): per-driver personalities, occasional misjudged corners, dead-zone rubber band, plus a headless benchmark test (`src/sim/racing.test.ts`).

## Verified results (run in this session)
| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | **7 files, 42/42 pass** |
| `npx vite build` | OK (main chunk ~814 kB, 226 kB gzip) |
| Headless sim benchmark, 3 laps, 6 cars, autopilot as player, Normal | field spread first→last **0.9 s → 5.2 s**; best rival lap 46.0 → 45.6 s; max gap 82 → 283 m |
| Same, Easy / Hard | spread 1.6 → 9.5 s / 3.1 → 3.0 s; best rival lap 51.6 → 50.5 s / 44.0 → 43.8 s |
| Robustness: 18 races (3 difficulties x 6 grid slots) | all finished, no stuck cars except a 0.1 s blip on Hard |
| Browser smoke test (headless Chromium, software GL, low tier) | see "Smoke test" line at the bottom of this file |

**Not verified:** how it feels to a human (no playtest possible here), real GPU fps, touch controls, audio, `tools/e2e.mjs`, high tier. The "player" in the benchmark is the AI autopilot, so difficulty balance against a real person is unknown.

## Audit: five highest-impact improvements (ranked)
1. **Rival racing quality — DONE this session (first pass).** Evidence: on Normal all six cars finished within 0.9 s of each other over 143 s and the pack stayed within 21–82 m, i.e. a convoy; difficulty barely changed behaviour. Rubber-banding (+4.5%/-3.5% scaled by gap/260 m) was the cause. Remaining: rivals still never defend/attack, no drafting or slipstream, no per-rival names/personality shown to the player, rival engine sounds absent.
2. **Mobile/low-end performance.** Main pass is ~760–830 draw calls and 0.7–0.9 M triangles at medium, 787 calls at low (measured via `tools/measure.mjs`, software GL), plus a shadow pass roughly doubling it. Each instanced vegetation *chunk* is its own draw call. Next: merge chunk cells / coarser far chunks / cap draw calls per tier; main JS chunk is 814 kB (code-split three + lazy-load garage/HDRI). Needs a real device to confirm gains.
3. **Sense of speed.** Currently FOV 58→73, camera pull-back, and a 46-streak canvas overlay. No post-processing cue (radial blur/chromatic fringe on boost), no roadside rhythm at low speed, no speed-dependent camera lowering. Candidate: shader-based radial blur in the existing composer in `src/render/gfx.ts`, gated by quality tier and reduced-motion.
4. **Audio.** Engine is two oscillators with a fake 3-gear sawtooth; no rival/Doppler engines, no music, no surface sounds (kerb/grass), no gear-shift cue. Candidate: layered engine (filtered noise + harmonics), positional rival engines via PannerNode, kerb rumble.
5. **Content depth / cars.** One car body (livery changes only) and one circuit. High commercial value but it is new content, so only after 1–4.

Physics/camera notes (no change made): steering authority drops to 0.85 rad/s at 60 m/s (stable, a little heavy); wall collision is a clean reflect with scrape; camera yaw follows velocity direction (good drift look). No defects were found by reading, but nothing was playtested.

## Commands
```bash
npm ci && npm run typecheck && npm test && npm run build
npm run preview            # :4173 (start it in the background; do NOT `pkill -f` a pattern that matches your own shell command)
export CHROME_PATH=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome | head -1)
node tools/snap.mjs http://127.0.0.1:4173/ shots low 960 540 0,9     # world frames (minutes under software GL)
node tools/screens.mjs http://127.0.0.1:4173/ shots 667 375 low     # UI screens + click hit-test
node tools/measure.mjs http://127.0.0.1:4173/ low,medium 640 360 0,9 # draw calls / tris
```

## Known issues
- `tools/e2e.mjs` not re-run (needs a long timeout under software GL).
- The debug fast-forward leaves the "GO" message on screen in headless runs (cosmetic, debug-only).
- Rocks near the verge read slightly warm; main JS chunk is large.

## Next task
Pick **#2 (performance / draw calls)** or the rest of #1 (see NEXT_CLAUDE_PROMPT.md). Work in small, tested milestones; commit and push to the branch after each; update this file before ending.

Smoke test: `node tools/snap.mjs … low 960 540 0,9,20` drove a race to ~30 s race time in headless Chromium (software GL, low tier) with **0 console/page errors** (verified this session). Screenshots were not reviewed for this AI-only change.

## Visual redesign pass 1 (local commit, not yet pushed at time of writing)
Priority changed: visual quality of car and world (gameplay features paused). Audit ranking: 1 car body/wheels, 2 vegetation variety, 3 road/trackside, 4 mountain backdrop, 5 lighting/grade, 6 ocean.
Done (procedural, no new external assets): open twin-spoke alloy rims replace the model's star rims (`carModel.ts`), accent panels follow paint, brighter head/tail lights and reflections, scrub recoloured green (`vegetation.ts`), cooler higher-contrast barrier texture (`textures.ts`), brighter asphalt tint (`roadMesh.ts`), warmer-neutral hemisphere fill (`world.ts`), exposure 1.06 + CSS vignette/grade overlay (`gfx.ts`, `styles.css`).
Verified: tsc clean, 42/42 tests, build OK, before/after screenshots (software GL; garage at high tier, race at medium). Not verified: real GPU/phone fps, draw calls after the change.
Not done: car body shape, tree/palm variety, mountain backdrop texture, ocean edge, fence/tyre-wall models, unexplained white sky wedge (upper right in race frames). Asset candidates researched (Quaternius Stylized Nature MegaKit CC0, Kenney Racing Kit CC0, Poly Haven `cliff_side`/`coast_sand_rocks_02` CC0) but none downloaded or integrated; sandbox cannot reach those hosts.

## Race experience & feedback pass (delivered as a ZIP, not committed or pushed)
Done: continuous, correctly oriented skid marks (`src/render/skidTrail.ts`); boost FOV kick, exhaust flames, multi-particle bursts and no boost pull-back; scrape feedback event/sparks/sound (physics unchanged); camera lag compensation (`CAMERA_TUNING.lagComp` in `cameraRig.ts`, 0 = old behaviour). Details and measurements: `CHANGELOG_race_experience_pass.md`.
Verified: tsc clean, 54/54 tests, build OK (main chunk 817.16 kB). Camera chase distance at 62 m/s 13.5 -> 9.6 m, boost 16.0 -> 10.2 m.
Not verified: feel, audio, GPU fps, touch, and the boost/exhaust/scrape visuals on screen (headless browser kept closing).
Workflow note: for this pass the owner asked for ZIP delivery and no commit/push without explicit approval, which supersedes the "commit and push after each milestone / no ZIP backups" lines above.
Next candidates (need a playtest): drift economics and tier thresholds, handbrake-without-steer on touch, scrape penalty tuning, HUD boost bar on phones.

---

## Car Visual Quality Revamp (worked on `main`, uncommitted in the working tree)

Owner instruction for this task: work on `main` only; no new branches, merges, cherry-picks, rebases, resets or force-pushes. `main` is an older line than `sunset-rush-cloud-development`. The only car-related difference is `src/render/carModel.ts` (brighter rim material, new "classic" rim style, accent-panel paint mix, stronger head/brake light and paint reflection values); **that file was NOT copied across**, awaiting owner approval. The improvements below were written fresh against `main`'s own `carModel.ts`.

Spectral GT RS was rejected (open-cockpit buggy look) and was not reapplied; `spectral-integration.patch` is not in this repo.

### Phase 1 — what changed (`src/render/carModel.ts`, new `tools/rearshot.mjs`)
- Feasibility: the Khronos Car Concept mesh (~13k/25k/55k tris for low/mid/high) is a closed-roof coupe with real glass, so it can support the look; its weakness is a wide, slab-like rear with a thin tail-light strip hidden under the rear glass.
- Rear surface was measured from the GLB (z of the tail panel by height/width), and a `tailZ()` helper lets added parts hug the curved panel.
- Added: smoked tail-light lens band with a lit LED bar (brighter when braking, no extra bloom), centre strip; finned dark diffuser with lower lip and a small rear fog lamp; twin chrome tailpipes with dark interiors. `CAR.exhaust` moved to y 0.355 / z -1.985 so boost flames and smoke start at the new pipes (visual only).
- Added a tighter, darker contact-shadow quad under the body (the soft blob alone left the car looking like it floats). Its effect is subtle.
- Low LOD gets fewer segments and no diffuser fins. Rear details are merged to 4 meshes per car (lens, LED, carbon/interiors, chrome pipes) plus the contact-shadow quad. Measured with `tools/measure.mjs` (low tier, software GL, 640x360, like-for-like against the original `carModel.ts` built in a temp copy): about **+26 draw calls per frame** (725 -> 751 at the start, 508 -> 534 at 9 s, roughly +4-5%) and about +3k triangles. A first unmerged version cost +41-53 calls, so it was merged. Medium/high tiers and real devices were not measured.
- Not touched: physics, collisions, camera, rivals, track, HUD, menus, save data.
- `tools/rearshot.mjs <baseUrl> <outPrefix>` captures the player's rear from the real chase camera with rivals hidden (`ONLY=1` for a single shot). Needs a `dist` build served over HTTP and `CHROME_PATH` set.

### Evidence
Before/after crops from the real chase camera (headless Chromium, software GL, high tier, 1280x720): `docs/car-revamp/before-rear-chase-crop.png`, `after-rear-chase-crop.png`, `after-rear-chase-full.png`. Only a straight-line frame was reviewed; braking, cornering/drift, boost and mobile/low tier were not visually reviewed.

### Verification
| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm test` | 9 files, 52/52 pass |
| `npm run build` | OK |
| `tools/measure.mjs` low tier, before -> after | main-pass calls 725 -> 751 and 508 -> 534 (later samples not comparable: the sampled race moments differed between runs) |
| Browser run | headless Chromium (software GL) race loaded, 0 console/page errors in the capture runs |

Not verified: real GPU fps, mobile devices, draw-call/perf delta, audio, touch controls.

### Honest verdict
The rear is clearly better than before (readable tail lights, exhaust and diffuser) but it is still an arcade-looking concept body: the wide flat rear panel, soft paint reflections and low-resolution look are unchanged, and the decal stripe makes the rear look busier. It is improved, not yet "premium realistic". A replacement model is still worth pursuing.

### Phase 2 — asset search (blocked)
Sketchfab, Poly Pizza, Polyhaven and Kenney were unreachable from the sandbox; only GitHub, raw.githubusercontent.com and npm were reachable. **No candidate was evaluated; no replacement was integrated; no new licences were added.** Current car licence unchanged: Car Concept, CC-BY 4.0 (attribution in README.md).

### Known issues / next steps
1. Owner decision: approve copying `carModel.ts` from the dev branch (single file) or keep `main` as is.
2. Review braking, drift and boost frames and the low tier; measure draw calls with `tools/measure.mjs`.
3. Consider darker/more reflective paint and a less busy default decal; the global start-line sun bloom is not car-specific and was left alone.
4. Phase 2: download candidate GLBs manually (closed-roof coupe, real rear lights/wheels), keep licence text in `assets-src/`, check commercial use, render them in an isolated scene from the chase camera (`tools/rearshot.mjs` style) and only replace the car if the result is clearly better.


---

## Better sports-car model search (2026-10-27) — result: no replacement, current car kept

Owner brief: find and test a more realistic closed-roof sports coupe for the chase camera; integrate only if clearly better. Local ZIP workflow only (no Git used).

**Outcome:** both supplied Innerscene GLBs (generic 1990s Japanese sports coupe, generic front-engine grand tourer coupe) were inspected and rendered from the chase-camera numbers and **rejected**: they are boxy notchback bodies (flat trunk deck, upright rear glass, small pink tail-lamp rectangles, scalloped trunk seam, stray parts under the floor) and look worse than the current Car Concept body from behind. Nothing in `src/`, `public/models/`, `package.json` or save data changed. Rollback is unnecessary; the original `carModel.ts` is untouched.

Evidence and details: `docs/car-candidates/EVALUATION.md` and the images in that folder (`compare_chase_current_vs_candidates.png` is the main one). Tooling for the next candidate: `tools/candidate-viewer/` (dependency-free WebGL screening viewer + GLB geometry report).

**Licence: unverified.** The sandbox had no internet; the Innerscene pages could not be read and the GLBs contain no licence/author metadata. Commercial use, attribution and redistribution are unknown, so the models were not added to the project. Other sources were not searched.

**Not run / not verified:** `npm run typecheck`, `npm test`, `npm run build` were **not run** because `node_modules` is not in the ZIP and the sandbox cannot reach the npm registry (no three, vite or vitest available). Source is unchanged from the previous checkpoint, which reported tsc clean / 52 tests / build OK, but that is not re-verified here. The running game was not launched, so there are no new in-game before/after screenshots, no draw-call or fps numbers, and no driving/braking/drift/boost checks. The candidate renders came from my own simplified WebGL viewer (flat colours, procedural sunset reflections), not the game's renderer, so they show shape and stance, not final paint quality; the "current car" panel is the existing real game frame `docs/car-revamp/after-rear-chase-full.png`.

**Next steps:** (1) read the Innerscene licence text yourself if you still want those models, though I would not use them; (2) find a fastback/wedge coupe (see the steps and integration contract at the bottom of `docs/car-candidates/EVALUATION.md`), save it plus its licence under `assets-src/`, screen it with `tools/candidate-viewer`; (3) only then integrate behind a flag with the existing `car-*.glb` as fallback; (4) on a machine with internet run `npm ci && npm run typecheck && npm test && npm run build`.


---

## Premium sports-car search, session 2 (2026-10-27) — blocked, no change

Brief: find a Porsche-style closed-roof coupe (not a copy of branded design), verified licence, integrate only if clearly better than the current car.

**Access check result:** no internet at all (DNS resolution fails for sketchfab.com, poly.pizza, polyhaven.com, kenney.nl, quaternius.com, github.com, raw.githubusercontent.com, registry.npmjs.org, innerscene.com, opengameart.org, jsdelivr), npm and pip installs also fail, and `node_modules` is not in the ZIP. No new model files were attached.

**Therefore:** no other site was searched, no candidate was downloaded or rendered, no licence was read, and **the current car is unchanged** (`src/`, `public/`, `package*.json` untouched this session). The two Innerscene models stay rejected.

**Added for the hand-back loop (tools/docs only):**
- `docs/car-candidates/MANUAL_SEARCH.md`: licence rules for a shipped browser game (CC0/CC-BY only, no redistribution-restricted marketplace licences, trademark/badge caution), source search pages (unverified, from memory), visual checklist, and what to send back.
- `tools/candidate-viewer/intake.py`: offline GLB/glTF checker (licence metadata, extensions, meshes/primitives, materials, texture sizes, triangles, size/proportions, PASS/WARN/FAIL). Tested on the rejected Innerscene GLB (FAIL: no licence metadata, 404 primitives) and the current Car Concept glTF. Geometry reading does not support meshopt/Draco-compressed files; it says so.

**Not run:** typecheck/tests/build (no dependencies, no network), the running game, screenshots, draw calls/fps. Nothing about the game changed, so the earlier recorded results (tsc clean, 52 tests, build OK) are inherited, not re-verified.

**Next step:** download up to 3 finalists following `MANUAL_SEARCH.md`, put them in a conversation with their licence text, run `intake.py`, render with `tools/candidate-viewer`, then integrate only the winner (contract in `docs/car-candidates/EVALUATION.md`).


---

## Session 3 (2026-10-27): two more owner-supplied models tested — rejected, current car kept

`sports-car.glb` (35k tris) and `1990s-sports-car.glb` (17k tris) pass the budget checks (18 primitives, correct +Z/y-up/scale, separate wheel nodes) but look like stylised clay/arcade cars (slab rear, bolt-on wing, flat painted lamps); not clearly better than the current car, licence unknown (no metadata, no source page). Details and images: `docs/car-candidates/EVALUATION.md` (session 3 section) and the `session3-*` images.

**Correction to session 1:** the candidate viewer ignored node transforms, so the "loose parts under the floor" note about the Innerscene models was wrong (withdrawn); fixed in `tools/candidate-viewer/viewer.html`, which now also samples base-colour and metal/rough textures (normal maps and clearcoat textures are not applied). The Innerscene rejection still stands (boxy notchback, 400 meshes, unverified licence).

Code unchanged: `src/`, `public/`, `package*.json` are identical to the original ZIP. Not run: typecheck/tests/build (no dependencies, no network), the running game, draw calls, fps.


---

## Session 4 (2026-10-28): Option B, sculpted body on the existing car (implemented, NOT run in the game)

Owner chose "rebuild the current car's body" instead of a third-party model. Implemented as a runtime reshaping of the stock Car Concept geometry; no asset files changed.

**Files:** `src/render/bodyWarp.ts` (pure, three-free: `warpPoint`/`warpBuffers`, `REAR_LAYOUTS`, `tailSurfaceZ`, `lensEdges`, `tailRibbonGrid`, `setBodyShape`), `src/render/bodyWarp.test.ts` (12 tests), `src/render/bodyWarpScene.ts` (`applyBodyShape(scene)`), edits in `carAssets.ts` (apply after load, `?body=original` switch, try/catch fallback) and `carModel.ts` (tailZ/tailRibbon now come from bodyWarp; lens band, spoiler height and tailpipe depth read the active layout; `CAR.exhaust[i].z` is synced in `rebuild()`), `tools/warp-preview.ts`, `docs/car-body-sculpt/`, README attribution note (CC-BY "changes made"). Physics, camera, track, rivals, HUD, menus, save data, `public/models/*` unchanged.

**What it does:** see `docs/car-body-sculpt/README.md` (tumblehome up to 15 %, roof -5 cm, rear deck falls up to 13 cm, tail plan up to 13 % narrower behind the axle, valance +5 cm, flares +4.5 cm, wheels untouched; normals via Jacobian). Rear lamp band, diffuser, pipes (z -2.01) and spoiler mounts (-0.14 m) follow the new surface via the `sculpted` layout, fitted to the warped mesh (rms 1.1 cm, max 3.3 cm).

**Fallbacks:** `?body=original`; any exception leaves stock body + stock layout; `original` layout is regression-tested to equal the previous `tailZ` exactly.

**Verified here:** the pure warp ran on the real source mesh (`tools/warp-preview.ts`) and was rendered before/after from the chase-camera numbers (`docs/car-body-sculpt/*.png`, simplified shader, NOT the game); 12 unit tests pass under `tsx` with a local vitest shim (a mutation check proved they can fail); `tsc` strict + noUnused* passes for bodyWarp.ts, its test and bodyWarpScene.ts against a hand-written minimal three stub (not authoritative).

**NOT verified (no node_modules, no network):** `npm run typecheck`, `npm test` (vitest, existing 52 tests), `npm run build`, the three.js glue against the real three 0.180 / GLTFLoader (meshopt-quantized attributes are converted to Float32 via `getX..getW`; node transforms are baked and reset), the running game, shadows, decals on the warped hood/rear panel (they target mesh names `BodyHood`/`BodyRearPanelsColor1`, which are preserved), spoiler fit for lip/wing/gt, the low LOD, rival cars, garage preview, draw calls and fps (geometry counts are unchanged; warping adds a one-off pass over about 100k vertices at load). Paint/glass materials were NOT changed (paintMain already has clearcoat 1, roughness 0): reflections only change through the new surface curvature and normals.

**To finish (on a machine with dependencies):**
1. `npm ci && npm run typecheck && npm test && npm run build`. If three typing complains about `bodyWarpScene.ts`, it is only glue (about 40 lines).
2. Run the game, open the same chase view with and without `?body=original`, and capture before/after screenshots; check the three spoilers, decals, low LOD and rivals; check that the tail lamps, diffuser and pipes still sit on the surface in all LODs.
3. Retune `SCULPTED` in `bodyWarp.ts` if wanted. If the rear shape changes, re-fit `REAR_LAYOUTS.sculpted` (method: `tools/warp-preview.ts` output, bin the rear-most z of `BodyRearPanelsColor1`/`BodyPanelsColor2` per (|x|, y), least-squares the curvature terms; the "layout and warp are consistent" test must stay green).
4. Known limits: the side profile barely changes (by design); the lower rear valance remains blocky; the roof glass transparency, and the paint look under the real HDRI, are unchanged.

**Process note:** one read-only `git status` was run by mistake while editing. It only refreshed git's stat cache (`.git/index`); that file was restored byte-for-byte from the original ZIP before packaging. No commit, branch, merge or push was made.


### Session 4 addendum (2026-10-29): final checks before hand-off
- Re-probed the sandbox: still no network/npm, so the "NOT verified" list above stands.
- Verified from the shipped `public/models/car-{high,mid,low}.glb` JSON: every LOD has the same hierarchy: one identity `Body` group holding 42 mesh nodes (each translation + uniform quantization scale), and `wheel_FL/FR/RL/RR` as separate scene roots. So `applyBodyShape` (bakes node transforms, resets only body mesh nodes and the identity `Body` group, skips anything under `wheel_*`) cannot move a wheel, and mesh names used by decals (`BodyHood`, `BodyRearPanelsColor1`) are preserved. Shipped node positions/scales match the source mesh the warp was fitted on.
- Git: this ZIP still contains the original `.git` folder untouched. In your working copy the change will show as 2 modified source files (`src/render/carAssets.ts`, `src/render/carModel.ts`), 3 new source files (`bodyWarp.ts`, `bodyWarp.test.ts`, `bodyWarpScene.ts`), `tools/warp-preview.ts`, `tools/candidate-viewer/`, `docs/car-candidates/`, `docs/car-body-sculpt/`, `README.md`, `HANDOVER.md`, `REPORT.md`. One read-only `git status` was run by mistake during session 4; it only refreshed git's stat cache (`.git/index`), which has been restored byte-for-byte from your original ZIP, so `.git` in this ZIP is identical to the original.


---

## Session 5 (2026-10-29): start splash screen

Added an animated start splash (sunset, sun, mountains, scrolling road, the car, logo, loading bar, then "Press any key / Tap to start"). See `docs/splash/README.md` for behaviour, skip rules (`?nosplash`, `?debug`, automated browsers), files and what was and was not verified. Code: new `src/ui/splash.ts`, `splash.css`, `splashLogic.ts`, `splashLogic.test.ts`; `src/main.ts` has 4 small edits. Not verified: inside the real game with three.js, on real devices, `npm run typecheck/test/build` (run them before pushing). NOTE: this project copy was built from a base that lacks `src/render/vegetation.test.ts` and `src/sim/racing.test.ts` from the live repo, so prefer applying only the splash files to the real repo.
