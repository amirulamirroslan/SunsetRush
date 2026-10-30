# Start splash screen

Shown when the game opens (there is no login in the game): a sunset scene with a striped sun, mountains, a scrolling perspective road and the car from behind with its tail-light bar lit, the logo slamming in, then **loading progress** and, once the game is ready, a pulsing **"Press any key" / "Tap to start"** button. Any key or tap fades it out into the main menu (about 0.7 s). Because that first key or tap is also what the game uses to unlock audio, the sound starts working normally; nothing stops the event reaching the game.

Files: `src/ui/splash.ts` (builds and controls it), `src/ui/splash.css` (all visuals, pure CSS and one inline SVG car, no new image files), `src/ui/splashLogic.ts` (pure helpers) with `splashLogic.test.ts` (7 tests), and 4 small edits in `src/main.ts` (import, create, feed it the progress numbers, remove it on a fatal error). Nothing else in the game was touched.

Behaviour
- Shown for a normal visit. **Skipped** with `?nosplash`, with `?debug` (the e2e and screenshot tools use it) and in automated browsers (`navigator.webdriver`), so `tools/e2e.mjs` etc. still reach the menu directly.
- The prompt appears after loading finishes and after the intro has played for at least 1.5 s; pressing before that does nothing, and a 0.35 s guard stops accidental double-presses. Tab, Shift, Ctrl, Alt, Meta, Esc and Caps Lock do not dismiss it.
- Touch screens (`pointer: coarse`) say "Tap to start". Portrait phones, tablets and short landscape phones have their own layouts. `prefers-reduced-motion` turns off the scrolling road, bobbing, twinkling and pulsing.
- If the game fails to start, the splash is removed so the normal error message is visible.
- Accessibility: `role="dialog"`, a live-region loading label, the prompt is a real focused button.

Tuning: colours use the game's CSS variables; sky, sun, road width/speed (`sp-road` 0.5 s per loop) and sizes are at the top of `splash.css`. The tagline text is in `splash.ts`.

Verified here (isolated harness with the game's real stylesheet and fonts, headless Chromium in software rendering): the screenshots in this folder; progress and ready states; input ignored while loading; Space, Enter and tap dismiss; Tab does not; the splash removes itself after the fade; the game's window-level key and pointer listeners still receive the event; the three skip rules; no horizontal or vertical scrolling at 390x844, 844x390, 820x1180, 1280x720 and 1920x1080; reduced motion; 7 unit tests; strict `tsc` on the new files.
**Not verified:** running inside the real game with real three.js (no node_modules here), real-device touch, real-device performance, and the real loading times (the minimum intro time is 1.5 s, so on a fast machine the splash is shown for at least that long). Run `npm run dev`, open the page, and `npm run build` before pushing.
