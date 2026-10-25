# Sunset Rush — Handover (checkpoint 01)

Checkpoint date: 2026-10-25. Package version in `package.json`: **0.1.0** (no semver bump has been made; "polish" comes from the received ZIP filename `sunset-rush-polish`).

## 1. What this project is
Browser 3D arcade drift racer: Vite 7 + TypeScript 5.9 + Three.js 0.180. Coral Cove Circuit, five AI rivals, coins, garage (cosmetics only), keyboard + touch controls, WebAudio synth. No backend; progress is saved in localStorage. ~5,500 lines of TS in `src/`.

## 2. Status at this checkpoint
**No source changes were made in this checkpoint session.** The project was received as a ZIP, unpacked, verified, and re-packaged with this handover.

### Completed (per existing `REPORT.md` / `README.md` / `docs/ASSETS.md`; NOT re-verified visually this session)
- Race simulation, car physics, AI, rewards, track (pure TS in `src/sim/`, unit tested).
- Rendering: sky/ocean shaders, terrain, road mesh, scenery, landmarks, LOD'd GLB car (3 tiers), procedural props, effects, camera rig, quality tiers + `PerfGovernor`.
- UI: menu, garage, HUD with touch controls, results, overlays, SVG icons, Barlow fonts (visual-polish pass).
- Save system with sanitising localStorage + memory fallback.
- Environment pass (REPORT.md): foliage/trunk/rock colour retune, mountain-ridge backdrop winding fix + taller ridges, optional `?hdri` reflection map (off by default).

### Verified in this session
| Check | Command | Result |
|---|---|---|
| Install | `npm ci` | OK, 0 vulnerabilities |
| Typecheck | `npx tsc --noEmit` | exit 0, clean |
| Unit tests | `npx vitest run` | **5 files, 36/36 passed** |
| Production build | `npx vite build` | OK in ~2.5 s. Main chunk 802.6 kB (222 kB gzip) |
| E2E (`tools/e2e.mjs`) | against `vite preview`, Chromium at `/opt/pw-browsers/chromium-1243/...` | **NOT VERIFIED** — timed out at 280 s under software GL, no result produced. The script's default `CHROME_PATH` (`/opt/pw-browsers/chromium-1194/...`) does not exist in this sandbox; set `CHROME_PATH` explicitly |

### Not verified
- Gameplay feel, visuals, frame rate (nothing was viewed this session).
- Touch controls on a real device; audio.
- `?hdri` reflected-sun alignment (already flagged in REPORT.md).
- High graphics tier draw calls/triangles (never measured per REPORT.md).

## 3. Files changed this session
None in `src/`, `public/`, `tools/` or config. Added only `HANDOVER.md` and `NEXT_CLAUDE_PROMPT.md`. (`node_modules/` and `dist/` were generated for verification and are excluded from the ZIP.)

## 4. Outstanding items (prioritised)
1. **E2E not confirmed passing.** Re-run with working Chromium and a long timeout; make the Chromium path auto-detect in `tools/e2e.mjs` and other tools.
2. **Bundle size**: main JS 802 kB. Consider code-splitting (three.js vs game code, lazy garage).
3. **Draw calls high** (REPORT.md: ~500–680 main-pass calls, 0.55–0.78 M tris on low/medium; high unmeasured). Merge/instance more scenery, distance culling.
4. **Rocks still read slightly warm** in sunset light (REPORT.md known limit).
5. **HDRI** option off by default; decide to drop or polish.
6. **No downloaded art beyond car + asphalt** (sites were unreachable in the original sandbox); see `docs/ASSETS.md`.
7. Version/changelog: still 0.1.0; no CHANGELOG.
8. Licence: car model is CC-BY 4.0 — attribution is in README; whether an in-game credits screen exists was NOT checked.

## 5. Exact next steps for the next Claude session
1. Read this file, `README.md`, `REPORT.md`, `docs/ASSETS.md`.
2. `npm ci && npm run typecheck && npm test && npm run build` — confirm baseline (tsc clean, 36/36 tests, build OK).
3. `ls /opt/pw-browsers/`, `export CHROME_PATH=<path>/chrome`, run `npx vite preview --port 4173` in the background (do not use `pkill -f` with a pattern that matches your own command line), then `node tools/e2e.mjs http://localhost:4173/ shots` with a generous timeout. Record the real result.
4. Ask the user which of items 2–8 to pursue before changing code.
5. After any change re-run typecheck, tests, build; update this file; create a new checkpoint ZIP.

## 6. Commands
```bash
npm ci                 # .npmrc sets legacy-peer-deps=true
npm run dev            # http://localhost:5173
npm run typecheck      # tsc --noEmit
npm test               # vitest run (36 tests)
npm run build          # tsc --noEmit && vite build -> dist/
npm run preview        # serves dist/ on :4173
CHROME_PATH=/path/to/chrome node tools/e2e.mjs http://localhost:4173/ shots
node tools/measure.mjs <url>        # draw call / triangle counts
node tools/prepare-car.mjs          # regenerate car LOD GLBs from assets-src/car-concept
```
URL flags: `?q=high|medium|low`, `?touch=1|0`, `?debug` (exposes `window.__rush`), `?hdri`.

## 7. Setup notes
- Node 22 worked. No environment variables, API keys or secrets are used or required (grep for key/secret/password/token in `src/`, `tools/`, `index.html` found nothing).
- No backend/database. Save data is browser localStorage.
- Pinned deps: three 0.180.0, vite 7.3.7, vitest 4.1.12, typescript 5.9.3, `@pmndrs/assets` 1.7.0 (HDRI only).

## 8. ZIP contents
Source, `public/` assets, `assets-src/` (licensed originals), `tools/`, `docs/`, configs, `package-lock.json`, `README.md`, `REPORT.md`, this file and `NEXT_CLAUDE_PROMPT.md`. Excludes `node_modules`, `dist`, `shots`, logs.
