// Captures the same race moment under each lighting preset in ONE browser session (presets are switched at runtime).
// Usage: node tools/lighting.mjs <baseUrl> <outDir> [tier=medium] [w=960] [h=540] [presets=daylight,golden,overcast]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [base = 'http://127.0.0.1:4173/', out = 'lighting', tier = 'medium', W = '960', H = '540', presets = 'daylight,golden,overcast'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const chromePath = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage'] });
const page = await (await browser.newContext({ viewport: { width: +W, height: +H } })).newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
page.on('pageerror', e => errs.push('pageerror ' + e.message.slice(0, 200)));
await page.goto(`${base}?debug&q=${tier}`);
await page.waitForSelector('#menu.on', { timeout: 240000 });
await page.waitForTimeout(500);
await page.locator('#menu .btn', { hasText: 'Race' }).first().click();
await page.waitForSelector('.setup');
await page.locator('.setup .btn.good').click();
await page.waitForSelector('#hud.on');
const t0 = Date.now();
while (Date.now() - t0 < 180000) { if ((await page.evaluate(() => window.__rush.debugState().stage)) === 'racing') break; await page.waitForTimeout(200); }
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(1500);
await page.evaluate(s => window.__rush.debugFastForward(s, true), 9);
await page.keyboard.press('KeyP'); await page.waitForTimeout(300); await page.addStyleTag({ content: '.overlay{display:none!important}' }); // freeze the sim and hide the pause menu so each preset is shot at the identical moment
for (const id of presets.split(',')) {
  await page.evaluate(i => window.__rush.debugSetLighting(i), id);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${id}.png`, timeout: 240000 });
  console.log('captured', id);
}
console.log('errors', errs.length, errs.slice(0, 5));
await browser.close();
