# Sunset Rush

A browser 3D arcade drift racer (Vite + TypeScript + Three.js). Race the Coral Cove Circuit against five rivals, earn coins,
and customise your car in the garage. No backend, no real payments: progress is saved locally in the browser.

## Run

```bash
npm install          # .npmrc sets legacy-peer-deps
npm run dev          # http://localhost:5173
npm run build        # type-check + production build into dist/
npm run preview      # serve dist/ on :4173
npm test             # unit tests (simulation, save, quality, loft)
npm run e2e          # headless-Chromium flow check; needs a served build: node tools/e2e.mjs http://localhost:4173/ shots
```

URL options: `?q=high|medium|low` forces a graphics tier, `?touch=1|0` forces touch controls, `?debug` exposes `window.__rush` (used by the e2e script).

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Accelerate / brake | W, Up / S, Down | Auto-accelerate (setting) or GAS / BRAKE |
| Steer | A, D, Left, Right | Slide on the pad (bottom left) |
| Drift | Space (hold while turning) | DRIFT |
| Boost | Shift or B | BOOST |
| Respawn on track | R | respawn button |
| Pause | P or Esc | pause button |
| Restart race | Shift+T | pause menu |

Holding a drift charges a mini-turbo (blue, orange, purple tiers); release to fire it. Boost pads give a free burst.

## Structure

```
src/sim/      pure simulation (no DOM/three): track, car physics, AI, race rules, rewards  (unit tested)
src/render/  three.js (trackside.ts = overpasses, braking boards, marshal posts): sky/ocean shaders, terrain, road, scenery, landmarks, procedural cars, effects, camera rig, quality tiers
src/ui/      DOM + CSS screens: menu, garage, HUD (+touch controls), results, dialogs, SVG icon set
src/save/    sanitising localStorage save with memory fallback
src/data/    garage catalogue (all cosmetic) and rival drivers
src/input/ src/audio/   keyboard+touch input, WebAudio synth sound
src/app/Game.ts         wires everything together
tools/snap.mjs, screens.mjs  screenshots of world frames / UI screens at chosen viewports
tools/e2e.mjs           Playwright flow check with desktop + mobile screenshots
```

Design rules: cosmetics never change handling; every vehicle shares one physics tuning. Rendering reuses geometry and materials
(instanced scenery, shared car materials) and disposes what it replaces. `PerfGovernor` lowers resolution, then the quality tier, when the frame rate is poor (never raises it).

## Art assets and licences

| Asset | Source | Licence |
|---|---|---|
| Sports car (`public/models/car-*.glb`) | "Car Concept" by Eric Chadwick / Darmstadt Graphics Group, derived from a CC0 model by Unity Fan — Khronos glTF-Sample-Assets `CarConcept` | CC-BY 4.0 (attribution required) |
| Asphalt PBR textures (`public/textures/asphalt_*.webp`) | Poly Haven `asphalt_02` | CC0 |

Attribution: *Car Concept* © Eric Chadwick, Darmstadt Graphics Group GmbH, CC-BY 4.0, based on a CC0 model by Unity Fan.

Optional, off by default (`?hdri`): the Poly Haven sunset HDRI (CC0) as shipped, resized to 512 px, by `@pmndrs/assets@1.7.0` (CC0-1.0), used only as the reflection map of car paint and glass.

Everything else (trees, rocks, buildings, barriers, kerbs, sky) is procedural. Full licence text lives in `assets-src/`.

### Rebuilding the car model
The shipped GLBs are decimated LODs (high ≈55k tris, mid ≈25k, low ≈13k). Regenerate with
`node tools/prepare-car.mjs` (needs the source in `assets-src/car-concept/`). Only one car body is used; rivals are the same model in different liveries.
