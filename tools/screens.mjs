// UI screens at several viewports: setup, pause and results (race fast-forwarded to the finish with the autopilot).
// Usage: node tools/screens.mjs <baseUrl> <outDir> <w> <h> [tier=low]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [base = 'http://127.0.0.1:4173/', out = 'screens', W = '960', H = '540', tier = 'low'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const chromePath = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: +W, height: +H }, hasTouch: false })).newPage();
const tag = `${W}x${H}`;
await page.goto(`${base}?debug&q=${tier}`);
await page.waitForSelector('#menu.on', { timeout: 240000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/menu-${tag}.png`, timeout: 240000 });
await page.evaluate(() => [...document.querySelectorAll('#menu .btn')].find(b => b.textContent.includes('Race')).click());
await page.waitForSelector('.setup'); await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/setup-${tag}.png`, timeout: 240000 });
const box = await page.evaluate(() => { const r = document.querySelector('.setup .btn.good').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { bottom: r.bottom, vh: innerHeight, hit: e && e.closest('.btn.good') !== null }; });
console.log('start button', JSON.stringify(box));
await page.evaluate(() => document.querySelector('.setup .btn.good').click());
await page.waitForSelector('#hud.on');
const t0 = Date.now();
while (Date.now() - t0 < 240000) { if ((await page.evaluate(() => window.__rush.debugState().stage)) === 'racing') break; await page.waitForTimeout(200); }
await page.keyboard.press('KeyP'); await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/pause-${tag}.png`, timeout: 240000 });
await page.keyboard.press('KeyP'); await page.waitForTimeout(300);
await page.evaluate(() => window.__rush.debugFastForward(200, true));
await page.waitForSelector('#results.on', { timeout: 240000 }); await page.waitForTimeout(1800);
await page.screenshot({ path: `${out}/results-${tag}.png`, timeout: 240000 });
const fit = await page.evaluate(() => { const r = document.querySelector('.res'); const a = document.querySelector('.res .actions').getBoundingClientRect(); return { scrolls: r.scrollHeight > r.clientHeight + 1, actionsBottom: a.bottom, vh: innerHeight }; });
console.log('results', JSON.stringify(fit));
await browser.close();
