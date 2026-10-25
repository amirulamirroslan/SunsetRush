# Adding real models and textures

Poly Haven, Kenney, Quaternius and Sketchfab were unreachable from the sandbox this project was built in, so no downloaded
art beyond the car and asphalt has been verified. These are the sites and the steps; check each asset page for its licence.

| Source | Typical licence | Notes |
|---|---|---|
| https://polyhaven.com | CC0 | HDRIs, PBR textures, some models. Textures: download 1k/2k JPG or PNG maps. |
| https://kenney.nl/assets | CC0 | Low-poly packs (GLB included). |
| https://quaternius.com | CC0 | Low-poly nature/props packs (GLTF/FBX). |
| https://sketchfab.com | **Per model** | Filter by "Downloadable". CC-BY needs attribution in the credits; avoid NC/ND for a shipped game. |

## Install steps
1. Download the GLB (or GLTF + textures). Record the author, URL and licence in the table in `README.md` the same day.
2. Optimise (already a devDependency): `npx gltf-transform optimize in.glb public/models/name.glb --compress meshopt --texture-compress webp`
3. Textures: convert to WebP at 1024 or 2048 px (`cwebp -q 82 in.png -o public/textures/name.webp`); keep roughness/AO/normal as separate maps.
4. Keep the original download and its licence text in `assets-src/`.
5. Load the file the way `src/render/carAssets.ts` loads the car models (GLTFLoader, then clone per instance). Prefer `InstancedMesh` for repeated props to keep draw calls flat.
6. Run `npm test && npm run build`, then `node tools/measure.mjs <url>` to compare draw calls and triangles before/after.

## Fonts (added in the visual-polish pass)
- Barlow Condensed (600, 700, 700 italic, 800 italic) and Barlow (500, 600), Latin subset woff2, from the `@fontsource` npm packages v5.3.0.
- Licence: SIL Open Font License 1.1, commercial use permitted; texts in `assets-src/fonts/`. Files in `public/fonts/`.
- Used for all UI text and the start-gantry banner canvas texture.

## Not integrated
- Kenney Nature Kit and Quaternius LowPoly Nature Pack list CC0 on their pages, but kenney.nl, quaternius.com, polyhaven.com and opengameart.org were unreachable from the build sandbox, so no files from them are in the game.
