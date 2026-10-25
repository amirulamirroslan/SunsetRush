// Drives a race in headless Chromium and captures driving-camera screenshots at fixed track distances.
// Usage: node tools/shoot.mjs <baseUrl> <outDir> [tier=high] [w=1280] [h=720]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [base = 'http://127.0.0.1:4173/', out = 'shots', tier = 'high', W = '1280', H = '720'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const chromePath = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: +W, height: +H } });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
page.on('pageerror', e => errs.push('pageerror ' + e.message.slice(0, 200)));
await page.goto(`${base}?debug&q=${tier}`);
await page.waitForSelector('#menu.on', { timeout: 120000 });
await page.waitForTimeout(800);
await page.locator('#menu .btn', { hasText: 'Race' }).first().click();
await page.waitForSelector('.setup');
await page.locator('.setup .btn.good').click();
await page.waitForSelector('#hud.on');
const state = () => page.evaluate(() => window.__rush.debugState());
const waitStage = async st => { const t = Date.now(); while (Date.now() - t < 90000) { if ((await state()).stage === st) return true; await page.waitForTimeout(150); } return false; };
await waitStage('racing');
console.log('racing', JSON.stringify(await state()));
await page.keyboard.down('ArrowUp');
// capture while driving; the autopilot is not used so we only get what the player drives; instead fast-forward with autopilot in steps
const marks = [0, 1, 2, 3, 4, 5];
for (const i of marks) {
  await page.waitForTimeout(i === 0 ? 2500 : 1);
  await page.screenshot({ path: `${out}/drive-${i}.png`, timeout: 180000 });
  const s = await state();
  console.log(i, 'speed', s.speed?.toFixed?.(1), 'dist', s.dist?.toFixed?.(0) ?? JSON.stringify(s).slice(0, 120));
  await page.evaluate(() => window.__rush.debugFastForward(9, true));
  await page.waitForTimeout(400);
}
console.log('errors', errs.length, errs.slice(0, 5));
await browser.close();
