# SunsetRush: visual gap analysis against the reference board

Status 2026-10-30: **audit and plan only. No game code was changed and no reference quality has been achieved or claimed.**

## 0. What this is based on (and what it is not)
- **Code audit** of `src/render/*`, `src/sim/trackDef.ts`, `src/ui/hud.ts`, `src/ui/overlays.ts`, `src/save/save.ts` (all facts below were read from the code).
- **One real in-game frame** (`docs/car-revamp/after-rear-chase-full.png`, 1280x720, captured in an earlier session) as the only "current" visual evidence. See `compare-hero.png` and `compare-hud.png`.
- **The reference board** (`reference-board.png`, 1536x1024) is a concept render, not a game screenshot.
- **Not available this session:** a way to run the game (no `node_modules`, no network), so there are **no new gameplay screenshots, no draw-call or fps numbers**. Per the brief, no stage is implemented until it can be captured and compared. See section 7 for how to unblock.

Caveats about the reference itself: the tagline text ("Race. Learn. Impern. improve.") and the "A" in the speed gauge are AI-render garble and must not be copied; a manufacturer crest appears on the steering wheel and car (no real-brand marks in our game); photographic effects (depth of field, heavy motion blur, global illumination) are not realistic to match 1:1 in a browser at phone budgets. The realistic target is the **mood, composition, colour, depth layering and polish**, judged side by side.

## 1. Current implementation, in brief (verified in code)
| Area | What exists today |
|---|---|
| World | One island circuit, "Coral Cove Circuit", ~2.5 km lap from 18 control points; one golden-hour palette (`PALETTE` in `sky.ts`) shared by sky, ocean, fog, backdrop |
| Sky | Procedural dome shader with fbm clouds (3, 4 or 5 octaves by tier), sunset gradient and sun glow |
| Lighting | One directional sun (intensity 3.6, warm), hemisphere light, IBL from the same procedural sky (PMREM), ACES filmic tone mapping, `FogExp2` (density 0.00058) |
| Shadows | One PCF-soft shadow map: 2048 / 1024 / 512 px over 70 / 56 / 44 m around the action; no cascades, so nothing beyond that range casts shadows |
| Post | UnrealBloom (0.55 / 0.85 / 1.0) + MSAA via `EffectComposer` on **High only**; Medium and Low render straight to screen. No colour grade, vignette, motion blur, sun shafts, SSAO or depth of field |
| Terrain | 6 m height-field grid over ~1660 x 1160 m; fbm hills + ridged-noise spurs/gullies + central peak; shader-injected ground colour and normal detail; colour ramp sand / grass / forest / rock / peak. **No snow, no desert, no urban ground** |
| Mountains | Ring(s) of procedural layered ranges with strata, tree-line and fog-based atmospheric perspective |
| Water | Custom ocean shader reading the terrain height texture |
| Road | PBR asphalt (map, normal, roughness, AO), tyre-wear overlay, cracks and patches, kerb texture strips, concrete-profile barrier, alpha-tested catch fence, chevron boards, start gantry, grandstand, arch, billboards, lighthouse |
| Vegetation | Procedural vertex-coloured meshes: oaks, pines, slim pines, cypresses, bushes, scrub, rocks, bedrock slabs, grass tufts (7,500 x tier), flowers (4,200 x tier), instanced in chunks |
| Camera | Chase (distance 6.9 m + 1.5 m x speed, height 2.3 m + 0.4 m x speed, FOV about 60, boost FOV +9, kick FOV +4 and shake), plus orbit/intro/showcase modes. Speed feel = a 2D canvas overlay of 46 radial streaks. No motion blur |
| HUD | DOM overlay: position (top-left), lap chip, timer (top-centre), square minimap + pause (top-right), arc speed gauge + boost bar (bottom-right), drift pips, toasts, countdown, key hints, touch controls |
| Quality | `Auto / High / Medium / Low` only; tiers change pixel ratio, shadow size, bloom/MSAA, scenery and grass density, particles, cloud octaves, skid-mark pool. A performance governor steps down (never up) |
| Performance baseline (earlier sessions, `tools/measure.mjs`, 640x360, **software GL, not a GPU**) | Medium about 759 draw calls / 0.89 M triangles; Low about 787 calls / 0.65 M. **Already heavy for phones**; HANDOVER lists draw calls as an open issue. High was never measured |

## 2. Panel-by-panel gap analysis
Gap size: S small, M medium, L large (relative effort and visible distance from the reference).

| # | Reference panel | What the reference shows | Current game | Gap | Notes / approach |
|---|---|---|---|---|---|
| Hero | Sunset coast road | Low, close, 3/4 camera, car about 35 % of frame width; golden directional light with strong rim light and haze layers; sun low over the sea with glitter; rocky strata cliffs; metal guardrail with posts; heavy radial motion blur; warm wet-looking road | Higher, farther camera (car about 18 % of width); pink-purple wash, lower contrast; smooth green hillside with stylised trees and a chain-link fence; red/white kerb and concrete barrier; cracked dark asphalt; no blur | **L** | Camera, colour grade, fog in-scatter, cliff material, armco guardrail, motion blur (High) |
| 1 | Coastal cliffs, midday | Saturated blue sea with sailboat, cumulus clouds, terracotta village on a headland, layered cliffs, stone wall on the bend | Same island, but golden hour only; no villages or boats; clouds are sunset fbm streaks | **M-L** | Time-of-day/theme parameters; instanced village on a headland; cumulus cloud variant |
| 2 | Snow mountains | Snow-laden pines, snow banks, icy road with tracks, jagged alpine peaks, yellow chevron signs | No snow anywhere (terrain ramp tops out at grey rock) | **L** | Snow-line terrain shader, white-tinted conifers, icy road roughness, snow banks. Needs a new theme and likely a new circuit |
| 3 | Mountain forest and lake | Dense conifers, deep-green valley, lake, hairpins, rivals ahead | Forest groves exist and the sea could pass for a lake; conifer density and variety are lower | **M** | Theme with denser conifer mix, lake water colour, valley fog |
| 4 | City at sunset | Skyscrapers, bridge, wet reflective road, palms, traffic | No urban content at all | **L (largest)** | Instanced towers with emissive windows, bridge, wet-road variant (low roughness, env reflections). A big art and level job |
| 5 | Desert | Red mesas, saguaro cacti, dry scrub, warm light | No desert ground, rocks or cacti | **L** | Sand/red-rock ramp, mesa geometry from the existing ridge noise, cactus and scrub meshes |
| 6 | Car detail | Premium car close-up | Car not in scope ("do not redesign the car yet") | n/a | Deferred. Car body work already done separately |
| 7 | Cockpit view | Interior view, gauges, hands | No interior camera mode | n/a | Deferred: needs an interior and a car-design decision |
| 8 | Racing UI / HUD | Minimal, panel-free type: "POS 2/8" top-left, "LAP 2/3" plus millisecond total time top-right, **circular minimap bottom-left**, **circular speed gauge bottom-right with a red arc and a gear number**, thin white type | Boxed chips and panels; position `5th / 6`; lap chip; centred timer; square minimap top-right; arc gauge (cyan to gold) | **M** | Re-layout and restyle (DOM/CSS only). **Conflicts with touch controls** (bottom-left is the steering zone on phones) so touch layout must stay different. A gear number would be cosmetic (the physics has no gears): decision needed |
| 9 | Graphics settings | Preset plus per-feature rows (Shadows, Reflections, Post Processing, Draw Distance) each Off / Low / Medium / High, "Target: 60 FPS" note and a preview | One row: Auto / High / Medium / Low | **M** | New per-feature settings and a save-schema migration (save data must be preserved). Wiring to shadows, post and draw distance touches the renderer |

## 3. What the real frame shows against the hero panel (observed in `compare-hero.png`)
1. **Camera:** the reference camera is lower and closer, with a 3/4 offset, so the car is large and the road sweeps. Ours is a distant centred view; the car is small.
2. **Light and colour:** the reference has high contrast, warm gold light and cool shadows. Ours reads as a purple-pink wash with a flat green hill.
3. **Material richness:** reference cliffs have visible strata, rubble and foliage; ours is a smooth gradient hill with stylised low-poly trees.
4. **Road edge:** the reference has a metal guardrail with posts and painted lines; ours has a striped kerb, concrete barrier and a fence.
5. **Atmosphere:** the reference has several haze layers and a sun glare; ours has fog and a sun bloom but less depth separation.
6. **Speed:** the reference has radial blur on the road and scenery; ours has thin streak lines only.
7. **HUD:** ours is competent but boxier than the reference's panel-free look.

## 4. Budget and rules for every stage
- **Draw calls and triangles may not grow on Low** (baseline about 787 calls / 0.65 M tris). Medium within about +5 % of baseline (about 759 / 0.89 M). High may spend more but must be measured, and `initialTier` already sends phones to Low/Medium.
- New geometry must be instanced or merged; new post passes are High-only unless they cost under about 0.5 ms and need no extra render target.
- Gameplay, physics, handling, collisions, rivals, HUD data flow and **save data must not change** (settings changes need a versioned migration).
- Every stage ships behind the existing tier system; a failure must fall back to the current look.

## 5. Staged plan with evidence gates
**Evidence gate for every stage (the same set each time, so before/after is comparable):** 8 named shot points along the lap (start grid, first coastal straight, tight bend, high ridge, sea view, tunnel/forest section if any, final corner, finish) x 3 tiers x 2 viewports (1280x720 and 390x844); before/after PNGs side by side with the matching reference panel; `node tools/measure.mjs` draw calls and triangles; fps noted as software GL (not a GPU). Nothing is called "achieved" without those images, and the final judgement of look is the owner's.

| Stage | Scope | Tier plan | Main files | Size / risk |
|---|---|---|---|---|
| 0 | Baseline capture rig and numbers (shot points, `?debug` hooks, measure) | all | `tools/` only | S, none |
| 1 | **Light and atmosphere:** sun-aware fog (in-scatter toward the sun, height falloff, via a shared fog shader chunk), colour grade plus vignette, sun glare, rim-light and exposure tuning, cumulus cloud option | grade in the High composer; Low/Med use exposure plus a CSS vignette overlay | `world.ts`, `sky.ts`, `gfx.ts` | S-M, low |
| 2 | **Road and trackside:** metal guardrail with posts on selected sections (merged geometry), cleaner edge lines, optional wet road (lower roughness plus env reflection), kerb/barrier detail | geometry merged (draw-call neutral); wet look is material-only | `roadMesh.ts`, `trackside.ts`, `textures.ts` | M, low-med |
| 3 | **Terrain, cliffs, vegetation:** slope-driven rock strata and rubble in the ground shader, snow-line parameter, more tree variants and far-LOD billboards, villages on headlands | scenery multiplier per tier as today | `terrain.ts`, `terrainField.ts`, `vegetation.ts`, `scenery.ts` | M-L, med (draw calls) |
| 4 | **Environment themes and track identity:** a `Theme` descriptor (palette, sky, fog, terrain ramp, vegetation mix, props, time of day, wet/dry) replacing the module-level `PALETTE`; apply first to the current circuit, then one themed circuit at a time (alpine snow, mountain forest, desert, city dusk) | theme data is tier-independent | `sky.ts`, `world.ts`, `backdrop.ts`, `water.ts`, `trackDef.ts`, menu | **L**, med-high (refactor touches many files) |
| 5 | **Chase-camera presentation and speed:** lower/closer camera with corner offset, radial motion blur on High, stronger FOV punch, road streaks and dust, keeping the speed-line overlay for Med/Low | blur High only | `cameraRig.ts`, `gfx.ts`, `effects.ts` | M, med (visibility trade-off needs playtest) |
| 6 | **HUD:** panel-free type, POS / LAP + time groups, circular minimap and gauge on desktop, **unchanged touch layout**, optional cosmetic gear | DOM/CSS | `hud.ts`, `styles.css` | M, low-med (verifiable without three.js) |
| 7 | **Graphics settings:** Preset plus Shadows / Reflections / Post / Draw Distance rows, "Target 60 FPS" note, versioned save migration | maps onto `TIERS` plus overrides | `quality.ts`, `overlays.ts`, `save.ts`, `gfx.ts` | M, med (save compatibility) |

Order of delivery follows your priority list (1-7), except Stage 0 first, and Stage 1 before Stage 4 because themes need the new fog and grade. Stage 6 is the only one that can be fully verified without running three.js, and the only one I could have done blind; I held it back because of the touch-layout conflict and the gear question.

## 6. Decisions I need from you
1. **Environments:** re-skin the existing circuit with themes first (recommended, cheaper, shows progress early) or build a new circuit per biome from the start?
2. **Gear number in the HUD:** the physics has no gears. OK to show a cosmetic gear derived from speed bands, or skip it?
3. **Wet roads:** OK as a theme option (city dusk) and not a global change?
4. **Touch HUD:** keep the current touch layout (my recommendation), with the new circular layout on desktop only?
5. **Camera:** accept a lower and closer chase camera if it costs a little track visibility? It needs a playtest on your side.
6. **Performance target:** phones on Low/Medium must not exceed today's draw calls; is that the right floor, and what is your minimum target device?
7. **Cockpit view and car close-up** (panels 6 and 7): defer until the car work you plan?
8. **Branding:** confirm no manufacturer logos in the game, whatever the reference shows.

## 7. What I need to start Stage 0 (a runnable copy of the game)
My copy of the project has no `node_modules` and the sandbox has no network, so I cannot run the game. Earlier sessions captured real screenshots by running it headlessly with software GL; that is what Stage 0 restores. Either route works:
- **Route A (best):** upload a ZIP of your current repo and a ZIP of `node_modules\three` and `node_modules\@pmndrs` from it. I bundle the game myself (esbuild) and run it in headless Chromium with software WebGL, capture the shot points and measure draw calls.
  ```powershell
  git archive --format=zip -o SunsetRush-latest.zip HEAD
  Compress-Archive -Path node_modules\three, node_modules\@pmndrs -DestinationPath deps-three.zip
  ```
- **Route B:** run `npm run dev` on your PC, capture the shot points yourself (a 1280x720 PNG at each, on Low, Medium and High) and upload them. I analyse them, implement a stage, and you send new captures.

I have not yet confirmed Route A works with your exact setup; I will say so after the first bundle attempt.
