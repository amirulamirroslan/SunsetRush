// Renders panoramic views from the driving camera position so the mountain backdrop can be inspected.
// The normal chase view is mostly blocked by island hills, so this swaps in a free camera (same position, rotated).
// Usage: node tools/backdrop.mjs <baseUrl> <outDir> [tier=high] [w=960] [h=540] [ffSeconds=9]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [base = 'http://127.0.0.1:4173/', out = 'shots', tier = 'high', W = '960', H = '540', ff = '9'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const chromePath = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: +W, height: +H } })).newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
page.on('pageerror', e => errs.push('pageerror ' + e.message.slice(0, 200)));
await page.goto(`${base}?debug&q=${tier}`);
await page.waitForSelector('#menu.on', { timeout: 180000 });
await page.waitForTimeout(500);
await page.locator('#menu .btn', { hasText: 'Race' }).first().click();
await page.waitForSelector('.setup');
await page.locator('.setup .btn.good').click();
await page.waitForSelector('#hud.on');
const t0 = Date.now();
while (Date.now() - t0 < 120000) { if ((await page.evaluate(() => window.__rush.debugState().stage)) === 'racing') break; await page.waitForTimeout(200); }
await page.evaluate(s => window.__rush.debugFastForward(+s, true), ff);
await page.waitForTimeout(600);
// use a free camera with the chase camera's position; hide the HUD so the sky is unobstructed
await page.addStyleTag({ content: '#hud, .hud, #ui { visibility: hidden !important; }' });
await page.evaluate(() => {
  const g = window.__rush; const orig = g.gfx.render.bind(g.gfx);
  g.gfx.render = (s, c) => orig(s, window.__cam || c);
});
const views = [['fwd', 0], ['right', -90], ['back', 180], ['left', 90]];
for (const [name, offDeg] of views) {
  await page.evaluate(off => {
    const g = window.__rush, rc = g.rig.camera, d = rc.getWorldDirection(new rc.position.constructor());
    const yaw = Math.atan2(-d.x, -d.z) + off * Math.PI / 180;
    const c = rc.clone(); c.position.copy(rc.position); c.rotation.order = 'YXZ'; c.rotation.set(0.05, yaw, 0); c.fov = 62; c.aspect = rc.aspect;
    c.updateProjectionMatrix(); c.updateMatrixWorld(true); window.__cam = c;
  }, offDeg);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/pano-${name}.png`, timeout: 240000 });
  console.log('captured', name);
}
console.log('errors', errs.length, errs.slice(0, 5));
await browser.close();
