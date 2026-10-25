# Sunset Rush — environment pass report

## Changes
| # | Item | Result |
|---|---|---|
| 1 | Colours | Foliage moved from yellow-green to green (leaf, pine, bush, grass, terrain grass; ground shader grass multiplier `vec3(1.22,1.02,0.66)` -> `vec3(1.08,1.02,0.84)`, blend 0.55 -> 0.4). Palm/broadleaf/pine trunks and rocks (instanced props and terrain rock/gravel/peak) made greyer and slightly blue so the orange sunset light no longer turns them orange/pink. Lighting untouched. These are my own values (yours were not in the zip). |
| 2 | Mountain ridges | **Root cause was not height:** the ring's triangles were wound facing outward, so every face was back-face culled from inside. Fixed in `src/render/backdrop.ts` (winding flipped, normals negated to keep the same lighting). Heights 210/300/420 -> 320/450/600, floor 40 -> 60, base 0.22 -> 0.3. Ridges now visible in the driving camera (see `screenshots/compare-3.png`). |
| 3 | Rebuild / tests / screenshots | `tsc` clean, 36/36 tests (34 + 2 new), build OK. Before/after frames at identical race moments, 1280x720, high tier, software GL: `screenshots/`. |
| 4 | Draw calls / triangles | Below. Unchanged by this pass. |
| 5 | HDRI (optional) | `?hdri` (off by default). Poly Haven sunset HDRI via `@pmndrs/assets@1.7.0` (CC0-1.0), 512 px, PMREM-filtered, car paint + glass only, sun azimuth auto-aligned (unit-tested). Verified it decodes and changes the cars in-browser; the result is softer and more pastel than the procedural sky, so it stays off. Lazy chunks ~198 kB (147 kB gzip), fetched only with `?hdri`. Not verified: which Poly Haven image "sunset" is, or that the reflected sun lines up visually. |
| 6 | Report + licences | This file; `README.md` licence table updated. |
| 7 | Real downloaded assets | Not done (sites blocked). Sources and install steps: `docs/ASSETS.md`. |

## Draw calls and triangles (`tools/measure.mjs`, 640x360, software GL)
"Main" = camera pass only; "Whole frame" = shadow pass + bloom/output through the real pipeline. Before = original build.

| Tier | Sample | Main calls | Main tris | Whole-frame calls | Whole-frame tris |
|---|---|---|---|---|---|
| low | start | 655 | 633,784 | 1007 | 790,930 |
| low | +9 s | 507 | 551,179 | 858 | 708,609 |
| medium | start | 679 | 778,513 | 1070 | 1,712,116 |
| medium | +6 s | 543 -> 549 | 688,574 -> 689,657 | 929 -> 935 | 1,161,857 -> 1,162,940 |

Only the last medium sample differs (the sample landed at a slightly different race moment). The high tier was not measured.

## Licences
| Asset | Licence |
|---|---|
| Sports car, "Car Concept" — Eric Chadwick / Darmstadt Graphics Group, derived from a CC0 model by Unity Fan | CC-BY 4.0 (attribution required) |
| Asphalt PBR textures — Poly Haven `asphalt_02` | CC0 |
| Sunset HDRI (optional, `?hdri`) — Poly Haven via `@pmndrs/assets@1.7.0` | CC0 |
| Trees, rocks, buildings, barriers, kerbs, sky | Procedural, no third-party assets |

## Known limits
- Rocks are much closer to neutral but still read slightly warm on the lit side; trunks measure hue ~30 deg, sat 0.43 (was 22 deg, 0.61).
- Screenshot timings differ by under a second between runs.
- Tools added: `tools/backdrop.mjs` (panoramas), `tools/measure.mjs`, `tools/quick.mjs`.
