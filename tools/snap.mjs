// Screenshot helper: menu, race setup, and driving-camera frames at chosen fast-forward steps.
// Usage: node tools/snap.mjs <baseUrl> <outDir> [tier=medium] [w=960] [h=540] [steps=0,9,9] [extraQuery=]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [base = 'http://127.0.0.1:4173/', out = 'snaps', tier = 'medium', W = '960', H = '540', steps = '0,9,9', extra = ''] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const chromePath = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: +W, height: +H } })).newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
page.on('pageerror', e => errs.push('pageerror ' + e.message.slice(0, 200)));
await page.goto(`${base}?debug&q=${tier}${extra ? '&' + extra : ''}`);
await page.waitForSelector('#menu.on', { timeout: 240000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/menu.png`, timeout: 240000 });
await page.evaluate(() => [...document.querySelectorAll('#menu .btn')].find(b => b.textContent.includes('Race')).click());
await page.waitForSelector('.setup');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/setup.png`, timeout: 240000 });
await page.evaluate(() => document.querySelector('.setup .btn.good').click());
await page.waitForSelector('#hud.on');
const t0 = Date.now();
while (Date.now() - t0 < 180000) { if ((await page.evaluate(() => window.__rush.debugState().stage)) === 'racing') break; await page.waitForTimeout(200); }
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(1200);
let i = 0;
for (const ff of steps.split(',').map(Number)) {
  if (ff) await page.evaluate(s => window.__rush.debugFastForward(s, true), ff);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/drive-${i}.png`, timeout: 240000 });
  console.log('captured', i++, JSON.stringify(await page.evaluate(() => window.__rush.debugState())).slice(0, 140));
}
await page.keyboard.press('KeyP'); await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/pause.png`, timeout: 240000 });
console.log('errors', errs.length, errs.slice(0, 5));
await browser.close();
