# Copy-paste prompt for the next Claude session

```
You are continuing "Sunset Rush" (Vite + TypeScript + Three.js). Read HANDOVER.md and REPORT.md first, then inspect the actual source (src/render/{terrainField,backdrop,vegetation,scenery,trackside,roadMesh,textures}.ts, src/ui/*, tools/*).
Confirm the baseline yourself: npm ci && npm run typecheck && npm test && npm run build (expected: tsc clean, 40/40 tests, build OK).
Do not redo completed work (terrain relief, 4-range backdrop + mist, new vegetation types, road wear, overpasses/braking boards/marshal posts, UI polish). Keep cars, physics, camera, controls, garage layout.
First: re-capture the 667x375 results/setup screens and a high-tier frame, run tools/e2e.mjs with CHROME_PATH set, then address HANDOVER.md "Next steps". Never claim something is verified unless you ran it. Finish with a new checkpoint ZIP and updated HANDOVER.md.
```
