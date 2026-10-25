// Fast two-frame capture for colour tuning: the same fixed race moments as shoot.mjs frames 1 and 3 (deterministic sim).
// Usage: node tools/quick.mjs <baseUrl> <outDir> [tier=high] [w=960] [h=540] [extraQuery=]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [base = 'http://127.0.0.1:4173/', out = 'quick', tier = 'high', W = '960', H = '540', extra = ''] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const chromePath = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: +W, height: +H } })).newPage();
await page.goto(`${base}?debug&q=${tier}${extra ? '&' + extra : ''}`);
await page.waitForSelector('#menu.on', { timeout: 180000 });
await page.waitForTimeout(500);
await page.locator('#menu .btn', { hasText: 'Race' }).first().click();
await page.waitForSelector('.setup');
await page.locator('.setup .btn.good').click();
await page.waitForSelector('#hud.on');
const t0 = Date.now();
while (Date.now() - t0 < 120000) { if ((await page.evaluate(() => window.__rush.debugState().stage)) === 'racing') break; await page.waitForTimeout(200); }
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(1500);
for (const [i, ff] of [[1, 0], [3, 9]]) {
  if (ff) await page.evaluate(s => window.__rush.debugFastForward(s, true), ff);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/q${i}.png`, timeout: 240000 });
  console.log('captured', i);
}
await browser.close();
