# Manual search brief: premium Porsche-style coupe (needs a machine with internet)

Status 2026-10-27 (session 2): **no internet in the build sandbox** (DNS fails for every host; npm and pip also unreachable). No site was searched, no model was downloaded, no licence was read. Nothing below is a verified candidate. The links are *search pages and known-good sources*, written from memory and unchecked from here; open them yourself.

## Licence rules that matter for this game (a browser game ships the GLB to every player)
1. Prefer **CC0** or **CC-BY 4.0** (attribution goes in `README.md`). Commercial use must be explicitly allowed.
2. Avoid CC-BY-NC, CC-BY-ND, "editorial", and marketplace "royalty free" licences that forbid redistributing the raw file (TurboSquid/CGTrader/Free3D standard licences commonly do; a public web build exposes the file). Skip unless the licence text clearly allows embedding in a distributed game.
3. **Trademarks:** a real-model Porsche/Ferrari/etc. with badges, wheel crests or brand lettering is a trademark risk even when the mesh licence is fine. Take only generic/unbranded cars, or ones where logos are separate meshes you can delete.
4. Save, per model: the GLB/glTF, a screenshot or text of the licence, author, URL and download date.

## Where to look
| Source | Use | Notes |
|---|---|---|
| https://sketchfab.com/search?q=sports%20coupe&type=models&features=downloadable (also try `gt coupe`, `sports car 911 style`, `fastback`, `supercar`) | Largest pool of realistic cars. In the UI tick **Downloadable** and set the **License** filter to CC0 / CC-BY. | Check the per-model licence box, poly count (aim <=150k raw), "Animated" off, and the rear view in the 3D viewer before downloading. Sketchfab GLB downloads usually embed `asset.extras` with author and licence, which `intake.py` prints. |
| https://poly.pizza/search/sports%20car | CC0 / CC-BY low-poly pool | Mostly stylised/low poly; likely too toy-like. Quick to check. |
| https://kenney.nl/assets/car-kit and https://quaternius.com | CC0 | Stylised packs: **known not premium**, listed only to rule out. |
| https://github.com/KhronosGroup/glTF-Sample-Assets | Reference assets | Already used (Car Concept, CC-BY 4.0). |
| CGTrader / TurboSquid / Free3D "free" filters | Sometimes high quality | Usually restrictive licences: see rule 2. |

## What to hand back
For each of up to 3 finalists send me: the GLB (or glTF + bin + textures), and the licence text/screenshot and page URL.
Pre-screen yourself with `python3 tools/candidate-viewer/intake.py model.glb` (prints licence metadata, mesh/material/triangle/texture counts, size, proportions, PASS/WARN/FAIL). Then I will render the chase view with `tools/candidate-viewer` and compare with the current car.

## Visual checklist (reject on first miss)
- Low, wide fastback/coupe roofline with a sloping rear glass flowing into an integrated deck (not a notchback trunk).
- Slim full-width LED tail-light bar or strongly sculpted lamps, visible bumper, diffuser and two exhaust tips from behind.
- Wheels about 0.33-0.36 m radius, tyres not cartoon-fat, no loose parts under the car.
- Reasonable cost: <=60 meshes (or mergeable by material), <=150k raw triangles, textures <=2048 px, no animation dependence.
