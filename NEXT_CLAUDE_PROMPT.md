# Copy-paste prompt for the next Claude session

```
You are continuing work on "Sunset Rush", a Vite + TypeScript + Three.js browser arcade racing game. The project ZIP is attached/unpacked in the working directory.

1. Read HANDOVER.md first, then README.md, REPORT.md and docs/ASSETS.md.
2. Do NOT trust the handover blindly: inspect the actual source in src/, tools/ and the configs, and confirm the baseline yourself:
   npm ci && npm run typecheck && npm test && npm run build
   (expected at checkpoint 01: tsc clean, 36/36 tests passing, build OK).
3. Continue from checkpoint 01. Do not redo completed work (simulation, rendering, UI, save system, environment colour/backdrop pass, optional ?hdri). Do not overwrite working features.
4. First task: get the e2e flow (tools/e2e.mjs) genuinely running — set CHROME_PATH to the installed Chromium, serve with `npx vite preview --port 4173`, use a long timeout — and report the real result. It was NOT verified at checkpoint 01.
5. Then ask me which outstanding item in HANDOVER.md section 4 to tackle (bundle size, draw calls, rock colour, HDRI decision, credits/attribution screen, versioning) before changing code.
6. Never claim a feature is complete without running it. Report test/build failures honestly.
7. When done or at a time limit, produce a new checkpoint: update HANDOVER.md and this file, create a versioned ZIP (exclude node_modules, dist, caches, secrets), verify it opens, and give me exact paths.
```
