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
