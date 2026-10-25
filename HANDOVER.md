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
