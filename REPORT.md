# Sunset Rush — world + UI polish pass (checkpoint 02)

## Asset research (npm / GitHub, inspected from the real package files)
| Source | What I found | Decision |
|---|---|---|
| `@netforge/asset-library-files@0.2.0` (MIT wrapper, content CC0 per its NOTICE: Quaternius, Kenney, Screaming Brain Studios) | 444 GLB + 68 PNG, 35 MB. `lowpoly/` includes Kenney Nature Kit models (tree_oak/pine/palm/fat, bush, rock_small/large/tall, fence, log, cactus). Inspected with gltf-transform: meshopt-compressed and quantised; **16–230 triangles each, flat single-colour materials, no textures** (buildings ~1.1–1.3k tris with a 1-colour palette map). | **Not integrated.** The current procedural trees/rocks (noise-sculpted lobes with baked AO, 1–4k tris) are more detailed than these; they would be a visual step down and clash with the PBR car. Licence not independently verified at the upstream Kenney pages (sites unreachable), only per the package NOTICE. |
| `@jgengine/assets@0.39.0` | Index + CLI only; the tarball ships no GLB bytes, files are fetched from provider CDNs at install time (blocked here). | Not usable. |
| `kenney-hexagon-pack@1.0.0` (CC0) | 1,306 files of hex-tile game art (22 MB). | Wrong style/purpose. |
| `@pmndrs/assets@1.7.0` (CC0, already used) | HDRIs, matcaps, normal maps, fonts and three demo models (bunny, suzanne, pmndrs logo). Nothing for environments beyond the HDRI already used (`?hdri`). | Nothing new to integrate. |
| GitHub (`raw.githubusercontent.com` reachable; `api.github.com` returned 403) | Could fetch raw files only by exact path; no browsable listing, so no repository could be surveyed. | No repository inspected beyond npm. |

**Integrated external assets this pass: none.** Everything below is procedural. Existing assets (car GLB CC-BY 4.0, asphalt CC0, HDRI CC0, Barlow OFL) are unchanged.

## World changes (no external assets)
- **Terrain relief** (`terrainField.ts`): ridged-noise spurs/gullies, knolls and benches added to the height field (fades out at the coast, flattened near the road by the existing blend). Hillsides now have silhouette instead of one smooth slope.
- **Mountain backdrop** (`backdrop.ts`): rebuilt as 4 ranges (added a far one), 520 columns x 9 rows; ridged crests with sharp spires, vertical gullies cut into the flanks, strata, lee-side shading and a ragged tree-line. Winding/visibility fix from the previous pass is preserved (verified in screenshots). New low **mist banks** (tileable noise strip) separate the layers.
- **Vegetation** (`vegetation.ts`, `scenery.ts`): new cypress, slim pine, dry-scrub (with blossoms) and angular bedrock-slab meshes; tree size variety (tall veterans and saplings, non-uniform height), cypress groves, scrub bands on dry slopes, trees allowed closer to the verge. Slabs replace rounded boulders on steep ground.
- **Road** (`textures.ts`, `roadMesh.ts`): wear overlay (one extra draw call): rubbered wheel tracks, edge grime, resurfaced patches, sealed cracks, oil drips; tiles seamlessly every 24 m.
- **Trackside** (`trackside.ts`): two overpasses (end of the start straight, coastal run) with sponsor banner, 3-2-1 braking boards before the tightest corners, marshal posts on corner exits. Placement is data-driven from track curvature (unit tested).

## UI changes (garage layout untouched)
- **Fixed a real bug:** at short heights (960x540) the menu footer overlapped and intercepted clicks on the race-setup "Start race" button, and the panel pushed the logo off-screen. Setup now uses a one-line wordmark, the footer hides during setup, and a hit-test confirms the button is clickable at 960x540, 667x375 and 390x844.
- Race setup: full-width segmented controls; compact two-column rows on short landscape phones.
- Pause: "Race" kicker, title, and live status (lap x/y, position).
- Results: calmer hero, readable table, sticky action bar, single-row buttons on portrait, two-column compact layout on short landscape.
- HUD: shared shadows/accent between timer, lap box and minimap, higher contrast hints.

## Verification
- `npm run typecheck`: clean. `npm test`: **40/40** (36 + 4 new: trackside placement, terrain relief bounds). `npm run build`: OK (main chunk 814 kB / 226 kB gzip).
- Screenshots (software GL, medium tier, 960x540) of menu, setup, driving frames before/after, pause, results; 667x375 and 390x844 for setup/results. No console errors in the driving runs.
- Draw calls / triangles (640x360, software GL; main pass), before -> after: low start 655 -> 787 calls, 634k -> 652k tris; medium start 679 -> 759, 778k -> 890k; medium after ~9 s 543 -> 535, 689k -> 739k. Costs a bit more than before; high tier not measured.

## Not verified / limits
- Never measured real GPU frame rate; only software rendering here. High tier visuals and draw calls were not captured.
- Braking boards and the second overpass were seen only at distance in screenshots; marshal-post orientation looks right in one frame.
- Touch controls, audio and `tools/e2e.mjs` were not re-run. UI screenshots at 667x375 after the last CSS tweak (hidden notice/hint) were not re-captured.
- UI reference screenshots were never accessible; no claim of having studied them.
- Rocks near the verge still read slightly warm; the debug fast-forward leaves the "GO" message on screen (headless-only).

# Previous pass: environment pass report

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
