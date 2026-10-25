# Sunset Rush — Handover (checkpoint 02, v0.2.0)

Read `REPORT.md` first: it lists the asset research (none integrated, why), all world/UI changes and honest limits.

## State
- tsc clean, vitest 40/40, `vite build` OK (verified this session).
- Visually checked via headless software-GL screenshots (menu, setup, drive frames, pause, results at 960x540, 667x375, 390x844).
- Not verified: real GPU fps, high tier, touch controls, audio, `tools/e2e.mjs`, the very last CSS tweak at 667x375.

## Commands
```bash
npm ci && npm run typecheck && npm test && npm run build
npm run preview            # :4173 (run in the background; do NOT `pkill -f` with a pattern that matches your own shell command)
export CHROME_PATH=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome | head -1)
node tools/snap.mjs http://127.0.0.1:4173/ shots medium 960 540 0,5,5,5     # world frames (slow under software GL: minutes)
node tools/screens.mjs http://127.0.0.1:4173/ shots 667 375 low             # setup/pause/results + click hit-test
node tools/measure.mjs http://127.0.0.1:4173/ low,medium 640 360 0,9        # draw calls / triangles
```

## Next steps (prioritised)
1. Re-capture 667x375 results/setup screens and a high-tier frame; run `tools/e2e.mjs` with `CHROME_PATH` set.
2. Draw calls rose ~10-20% (new vegetation types): consider merging scrub/bush chunks or lowering `cullRange`.
3. Main JS chunk 814 kB: code-split.
4. Rocks still slightly warm; mist/backdrop could be tuned on a real GPU.
5. Optional: real CC0 art if a source becomes reachable (see `docs/ASSETS.md`).
