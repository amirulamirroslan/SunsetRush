# SunsetRush — Race Experience & Feedback Pass

Base: `sunset-rush-cloud-development` @ `fee014b`. Nothing here is committed or pushed; `main` untouched.
Apply by extracting this ZIP over the repository root (paths are repo-relative), then `npm ci && npm run typecheck && npm test && npm run build`.

## Changes (in priority order)

### 1. Skid marks and tyre effects
Problem (measured): marks used a heading + slip angle with the wrong sign (34.6 deg off the real path in a test drift), were
0.9 m decals stamped every 50 ms (about 40% road coverage at 45 m/s, 30% at 60 m/s) and had long faded ends, so they read as dashes.
- NEW `src/render/skidTrail.ts` — marks are laid between a wheel's previous and current contact point: oriented along the real
  path, as long as the gap (+0.3 m overlap), one trail per rear wheel, new line after a drift ends or a respawn.
- `src/render/effects.ts` — `SkidMarks.add(..., strength, length)` takes a length.
- `src/render/textures.ts` — skid texture fades shortened (20% -> 7%) so overlapping joins are invisible.
- `src/render/quality.ts` — low-tier mark pool 240 -> 360 (marks are now distance-based and longer; one instanced draw call, unchanged).
- `src/app/Game.ts` — uses the trails; light smoke from the rear tyres on hard braking above 28 m/s (player only, about 14 puffs/s).

### 2. Boost feel
- `src/render/cameraRig.ts` — `kick()`: a short FOV punch (+4 deg) and shake that decays in about 1 s, fired on boost start, pads
  and mini-turbos (scaled by 0.35 under reduced motion; kicks never stack). The sustained boost camera pull-back (+1.1 m) is removed.
- `src/render/effects.ts` — `boostTrail()` exhaust flames (new: `exhaustWorld()` existed but was never used) and `boostBurst()` now throws
  14 embers backwards instead of a single particle.
- `src/app/Game.ts` — emits exhaust flames for the player while boosting (about 35 particles/s per exhaust).

### 3. Wall scrape feedback (feedback only — motion is unchanged)
Problem (measured): a 2 deg nose-in scrape at 45 m/s costs 8 m/s (45 -> 37) with no spark, sound or shake, because feedback only
fired above 3 m/s of impact speed.
- `src/sim/carPhysics.ts` — new `scrape` event (outward speed > 0.5 m/s, at most every 0.12 s, player only; hard hits start a 0.2 s
  cooldown so the two never double up). New fields `scrape` and `scrapeTimer`. No change to velocity, heading or collision response.
- `src/audio/GameAudio.ts` — `scrape()`, a short quiet rasp.
- `src/app/Game.ts` — 3-8 small sparks plus the rasp.

### 4. Camera lag compensation (feel change — one constant)
Problem (measured): the smoothed camera trails a moving target by speed/11 m, so the real chase distance was 13.5 m at 62 m/s
(the code constants imply 8.4 m) and 16 m on boost, with about 85 deg FOV.
- `src/render/cameraRig.ts` — `CAMERA_TUNING.lagComp = 0.7` leads the target by 70% of that trail. Result: 9.6 m at 62 m/s, 10.2 m
  on boost; 6.9 m at rest and the sustained FOV are unchanged. **Set `lagComp` to 0 to restore the old behaviour exactly.**

### Tests added (12)
`src/render/skidTrail.test.ts` (4), `src/render/cameraRig.test.ts` (5), `src/sim/scrape.test.ts` (3, including a guard that the
scrape speed loss is still 45 -> about 37 m/s), plus `HANDOVER.md` updated.

## Verified results (run in this session)
| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 10 files, **54/54** pass (was 7 files, 42/42); rival racing benchmark unchanged |
| `npx vite build` | OK; main chunk 817.16 kB / 227.37 kB gzip (was 814.87 / 226.59) |
| Camera probe | 62 m/s: 13.5 -> 9.6 m; boost 75 m/s: 16.0 -> 10.2 m |
| Particle budget (Node) | sustained boost + 2 bursts: peak 35 live sparks = 19% of the low-tier pool |
| ZIP overlay on a clean checkout of `fee014b` | tsc, tests and build re-run there (see below) |

## Not verified / limitations
- Not playtested: how any of this *feels*, real GPU/phone fps, touch input, and audio (nothing was listened to).
- Exhaust flames, boost bursts, FOV kick and scrape sparks were **not seen on screen**: the headless browser in this sandbox kept
  closing mid-race. Their code paths were exercised only in unit tests and a Node run of the particle code.
- Skid-mark before/after screenshots were inconclusive (the scripted car ended against the wall in both; marks are dark on dark asphalt).
  Continuity and orientation are proven by unit tests, not by the screenshots.
- Draw calls were not re-measured with `tools/measure.mjs`; no new draw calls are expected (same particle and mark pools).
- Portrait (390x844) HUD screenshot captured but not reviewed.

## Deliberately not changed (needs your playtest first)
Drift economics (held drifts lose 3-10 m/s per second; tier 3 was never reached in probes), handbrake without steer scrubbing speed on
touch, heavy high-speed steering (min radius about 62 m at 55 m/s), the wall scrape/hit speed penalty itself (it also affects the AI),
phone boost-bar size, skid-mark contrast.
