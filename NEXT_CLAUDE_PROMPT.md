# Next Claude Prompt — Sunset Rush

Continue the existing Sunset Rush racing game in this repository (branch `sunset-rush-cloud-development`; never force-push, never touch `main`).

1. Read `HANDOVER.md` (audit ranking, verified results, known issues), then inspect the real source. Confirm the baseline yourself: `npm ci && npm run typecheck && npm test && npm run build` (expected at last handover: tsc clean, 42/42 tests, build OK).
2. Do not redo completed work: world/UI polish (REPORT.md) and rival racing quality pass 1 (`src/sim/ai.ts`, `src/sim/racing.test.ts`).
3. Next task: improvement **#2, mobile/low-end performance**. Measure first with `tools/measure.mjs` (baseline: medium 759/535 main-pass draw calls, low 787/536; ~0.7–0.9 M tris), then cut draw calls (coarser/merged vegetation chunks, per-tier caps, far-LOD) and shave the 814 kB main chunk (lazy-load garage / HDRI, split three). Keep visuals; compare screenshots before/after. Report calls/tris before and after.
   Alternative if you prefer gameplay: rest of #1 (rivals defend/attack, slipstream, rival engine audio).
4. Keep cars, physics tuning, camera, controls and the garage layout unless fixing a verified bug. No feature additions for their own sake.
5. Small milestones: test, commit and push after each. Do not claim anything is tested or complete unless you ran it. Before ending, update `HANDOVER.md` and this file with completed work, actual test/build results, known issues and the next task. No ZIP backups for now.
