// Chase-camera rear-view capture of the player car only (rivals hidden) for car-visual review.
// Usage: node tools/rearshot.mjs <baseUrl> <outPrefix> [tier=high] [w=1280] [h=720]
// Captures: straight at speed, braking, and a cornering frame, plus a 3x crop around the car.
import { chromium } from 'playwright-core';
import sharp from 'sharp';
const [base = 'http://127.0.0.1:4173/', out = 'shots/rear', tier = 'high', W = '1280', H = '720'] = process.argv.slice(2);
const chromePath = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: +W, height: +H } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 200))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await page.goto(`${base}?debug&q=${tier}`);
await page.waitForSelector('#menu.on', { timeout: 180000 });
await page.waitForTimeout(500);
await page.locator('#menu .btn', { hasText: 'Race' }).first().click();
await page.waitForSelector('.setup'); await page.locator('.setup .btn.good').click(); await page.waitForSelector('#hud.on');
const t0 = Date.now();
while (Date.now() - t0 < 120000) { if ((await page.evaluate(() => window.__rush.debugState().stage)) === 'racing') break; await page.waitForTimeout(200); }
await page.keyboard.down('ArrowUp');
await page.evaluate(() => { const g = window.__rush; g.views.slice(1).forEach(v => v.setVisible(false)); });
const names = ['straight', 'later'];
const only = process.env.ONLY ? +process.env.ONLY : 2;
for (const [i, ff] of [[0, 6], [1, 14]].slice(0, only)) {
  await page.evaluate(s => { const g = window.__rush; g.debugFastForward(s, true); g.views.slice(1).forEach(v => v.setVisible(false)); }, ff);
  await page.waitForTimeout(700);
  const p = `${out}-${names[i]}.png`;
  await page.screenshot({ path: p, timeout: 240000 });
  // crop around the car (screen centre-low) and upscale
  const w = +W, h = +H; const cw = Math.round(w * 0.42), ch = Math.round(h * 0.42);
  await sharp(p).extract({ left: Math.round(w / 2 - cw / 2), top: Math.round(h * 0.40), width: cw, height: ch }).resize(cw * 3, ch * 3, { kernel: 'lanczos3' }).toFile(`${out}-${names[i]}-crop.png`);
  console.log('captured', names[i]);
}
console.log('errors', errs.length, errs.slice(0, 3));
await browser.close();
