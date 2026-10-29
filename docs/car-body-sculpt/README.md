# Sculpted body (Option B): reshaping the existing Car Concept body

What changed (code): `src/render/bodyWarp.ts` (pure warp + rear layout data, 12 unit tests in `bodyWarp.test.ts`), `src/render/bodyWarpScene.ts` (applies it to the loaded template), small edits in `carAssets.ts` and `carModel.ts`. No asset files, physics, camera, track, rivals, HUD, menus or save data were touched.

## What the warp does (model space, +z nose, metres)
| Part | Change |
|---|---|
| Greenhouse / shoulders | up to 15 % narrower at the roof (tumblehome); roof 5 cm lower |
| Rear deck + rear glass | falls away towards the tail by up to 13 cm, so the rear glass has more rake and the deck is no longer a high flat slab |
| Tail plan | up to 13 % narrower behind the rear axle only, so the hips stay wide over the wheels |
| Lower rear valance | pushed rearwards up to 5 cm: a deeper bumper lip |
| Wheel arches | up to 4.5 cm outward flare around both axles, so the body covers the tyres |
| Wheels, floor line, doors, nose | not moved |

Normals are transformed with the inverse-transpose of the warp Jacobian, so highlights and the existing clearcoat follow the new curvature. Applied once per level of detail at load time (about 100k vertices in total), so rivals, garage preview and all three LODs share it.

## Rear lighting / details
The procedural tail-light bar, diffuser, tailpipes and spoilers key off a measured tail surface (`REAR_LAYOUTS`). The `sculpted` layout was fitted to the warped mesh (rms 1.1 cm, worst 3.3 cm); the lens band sits lower on the new deck, and tailpipes (z -2.01) and spoiler mounts (-0.14 m) follow the body. A unit test also checks that the sculpted layout lands on the warped original tail surface.

## Fallbacks
- `?body=original` in the URL: stock shape + stock layout (A/B in the browser).
- Any exception while reshaping: nothing is committed, the stock body and stock layout stay (a console warning is logged).
- To retune: edit `SCULPTED` in `bodyWarp.ts`, then re-fit the layout with `tools/warp-preview.ts` and the measurement approach in the HANDOVER notes.

## Evidence (isolated renders, NOT the running game)
`before-after-chase-crop.png`, `before-chase-full.png`, `after-chase-full.png`, `before-after-rear34-and-side.png`. Made with `tools/candidate-viewer` renderer (simplified shader, flat sunset reflections, no game lighting or shadows) from the real chase-camera numbers, using the same TS code the game runs on the real source mesh, plus the real rear-detail layout (boxes and pipes simplified). Use them to judge shape and placement, not final paint gloss.
