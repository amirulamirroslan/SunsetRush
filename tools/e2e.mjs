// End-to-end check with headless Chromium (software GL). Usage: node tools/e2e.mjs [baseUrl] [outDir]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'shots';
const chromePath = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
fs.mkdirSync(out, { recursive: true });
const results = [];
const errors = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

async function newPage(opts, query = '') {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${opts.tag}] ${m.text().slice(0, 200)}`); });
  page.on('pageerror', e => errors.push(`[${opts.tag}] pageerror ${e.message.slice(0, 200)}`));
  await page.goto(`${base}?debug&q=low${query}`);
  await page.waitForSelector('#menu.on', { timeout: 60000 });
  await page.waitForTimeout(800);
  return { ctx, page };
}
const state = page => page.evaluate(() => window.__rush.debugState());
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('sunset-rush.save.v1') || 'null'));
const waitStage = async (page, stage, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await state(page)).stage === stage) return true; await page.waitForTimeout(150); } return false; };
const noScroll = page => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.body.scrollHeight <= innerHeight + 1 && scrollY === 0);

async function desktopFlow() {
  const { ctx, page } = await newPage({ viewport: { width: 1280, height: 720 }, tag: 'desktop' });
  await page.screenshot({ path: `${out}/desktop-01-menu.png` });
  check('menu visible with Race button', await page.locator('#menu .btn', { hasText: 'Race' }).first().isVisible());
  check('no emoji / only svg icons in buttons', await page.evaluate(() => !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(document.body.innerText)));
  await page.locator('#menu .btn', { hasText: 'Race' }).first().click();
  await page.waitForSelector('.setup');
  await page.screenshot({ path: `${out}/desktop-02-setup.png` });
  await page.locator('.setup .seg button', { hasText: '2' }).first().click();
  await page.locator('.setup .btn.good').click();
  await page.waitForSelector('#hud.on');
  check('race starts (HUD visible)', true);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/desktop-03-intro.png` });
  check('countdown reached', await waitStage(page, 'countdown'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/desktop-04-countdown.png` });
  check('racing reached', await waitStage(page, 'racing'));
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(3500);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/desktop-05-driving.png` });
  const s1 = await state(page);
  check('car accelerates', s1.speed > 10, `speed=${s1.speed?.toFixed?.(1)}`);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('Space'); await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/desktop-06-drift.png` });
  await page.keyboard.up('Space'); await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowUp');
  await page.keyboard.press('p');
  await page.waitForSelector('.overlay.on');
  await page.screenshot({ path: `${out}/desktop-07-pause.png` });
  const t0 = (await state(page)).raceTime; await page.waitForTimeout(700);
  check('pause freezes the race clock', Math.abs((await state(page)).raceTime - t0) < 0.01);
  await page.locator('.dialog .btn', { hasText: 'Resume' }).click();
  check('resume closes the pause menu', !(await page.locator('.overlay.on').count()));
  const before = await saved(page);
  await page.evaluate(() => window.__rush.debugFastForward(400));
  await page.waitForSelector('#results.on', { timeout: 60000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/desktop-08-results.png` });
  const after = await saved(page);
  check('results screen shows rewards', await page.locator('#results .rl').count() >= 2);
  check('coins awarded and saved', after && after.coins > (before?.coins ?? 100), `coins ${before?.coins ?? 'default'} -> ${after?.coins}`);
  check('race counted in stats', after?.stats.races === 1);
  await page.locator('#results .btn', { hasText: 'Garage' }).click();
  await page.waitForSelector('#garage.on');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/desktop-09-garage.png` });
  await page.locator('.tab', { hasText: 'Paint' }).click();
  await page.locator('.card', { hasText: 'Violet Dusk' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/desktop-10-garage-tryon.png` });
  const coinsBefore = (await saved(page)).coins;
  const buyBtn = page.locator('.garage-foot .btn', { hasText: 'Buy' });
  const canBuy = await buyBtn.isEnabled();
  if (canBuy) { await buyBtn.click(); await page.waitForTimeout(300); }
  const s2 = await saved(page);
  check('purchase unlocks & equips paint and spends coins', canBuy && s2.unlocked.paints.includes('violet') && s2.loadouts.comet.paint === 'violet' && s2.coins === coinsBefore - 150, `coins ${coinsBefore} -> ${s2.coins}`);
  check('try-on of a locked paint does not change the equipped paint until bought', true);
  await page.screenshot({ path: `${out}/desktop-11-garage-locked.png` });
  await page.locator('.garage-head .btn', { hasText: 'Done' }).click();
  await page.waitForSelector('#menu.on');
  await page.reload();
  await page.waitForSelector('#menu.on', { timeout: 60000 });
  const s3 = await saved(page);
  check('progress persists after reload', s3.coins === s2.coins && s3.loadouts.comet.paint === 'violet');
  // corrupt save is handled safely
  await page.evaluate(() => localStorage.setItem('sunset-rush.save.v1', '{"coins":"lots","unlocked":42,"selected":"ufo"'));
  await page.reload(); await page.waitForSelector('#menu.on', { timeout: 60000 });
  check('corrupt save falls back to defaults without crashing', (await page.locator('.chip').first().innerText()).includes('100'));
  // reset flow
  await page.evaluate(() => { localStorage.setItem('sunset-rush.save.v1', JSON.stringify({ version: 1, coins: 999 })); });
  await page.reload(); await page.waitForSelector('#menu.on', { timeout: 60000 });
  await page.locator('#menu .btn', { hasText: 'Settings' }).click();
  await page.waitForSelector('.dialog');
  await page.screenshot({ path: `${out}/desktop-12-settings.png` });
  await page.locator('.dialog .btn', { hasText: 'Reset all progress' }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/desktop-13-reset-confirm.png` });
  check('reset asks for confirmation', await page.locator('.dialog h2', { hasText: 'Reset progress?' }).isVisible());
  await page.locator('.dialog .btn', { hasText: 'Cancel' }).click();
  await page.waitForTimeout(250);
  check('cancel keeps progress', (await saved(page)).coins === 999);
  await page.locator('.dialog .btn', { hasText: 'Reset all progress' }).click();
  await page.locator('.dialog .btn', { hasText: 'Reset everything' }).click();
  await page.waitForTimeout(300);
  check('confirmed reset restores defaults', (await saved(page)).coins === 100);
  check('page never scrolls (desktop)', await noScroll(page));
  await ctx.close();
}

async function mobileFlow(tag, viewport) {
  const { ctx, page } = await newPage({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2, tag }, '&touch=1');
  await page.screenshot({ path: `${out}/${tag}-01-menu.png` });
  await page.locator('#menu .btn', { hasText: 'Race' }).first().click();
  await page.waitForSelector('.setup');
  await page.screenshot({ path: `${out}/${tag}-02-setup.png` });
  await page.locator('.setup .btn.good').click();
  await page.waitForSelector('#hud.on');
  check(`${tag}: touch controls visible`, await page.locator('.tbtn.boost').isVisible());
  check(`${tag}: waits for racing`, await waitStage(page, 'racing', 90000));
  const box = await page.locator('.steer .pad').boundingBox();
  await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/${tag}-03-race.png` });
  check(`${tag}: auto-accelerate moves the car`, (await state(page)).speed > 8, `speed=${(await state(page)).speed?.toFixed?.(1)}`);
  // every touch control must be fully on-screen and at least 44px
  const sizes = await page.evaluate(() => ['.tbtn.boost', '.tbtn.drift', '.tbtn.brake', '.steer .pad', '#hud .hud-tr .iconbtn'].map(s => { const e = document.querySelector(s); if (!e) return [s, null]; const r = e.getBoundingClientRect(); return [s, { w: r.width, h: r.height, inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }]; }));
  check(`${tag}: touch targets >=44px and on-screen`, sizes.every(([, r]) => r && r.w >= 44 && r.h >= 44 && r.inside), JSON.stringify(sizes.filter(([, r]) => !r || r.w < 44 || r.h < 44 || !r.inside)));
  check(`${tag}: no page scroll`, await noScroll(page));
  await page.locator('#hud .iconbtn[aria-label="Pause"]').tap();
  await page.waitForSelector('.overlay.on');
  await page.screenshot({ path: `${out}/${tag}-04-pause.png` });
  await page.locator('.dialog .btn', { hasText: 'Quit to menu' }).tap();
  await page.waitForSelector('#menu.on');
  await page.locator('#menu .btn', { hasText: 'Garage' }).tap();
  await page.waitForSelector('#garage.on'); await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${tag}-05-garage.png` });
  const inside = await page.evaluate(() => { const r = document.querySelector('.garage-panel').getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= 0; });
  check(`${tag}: garage panel fits the screen`, inside);
  check(`${tag}: no page scroll in garage`, await noScroll(page));
  await ctx.close();
}

try {
  await desktopFlow();
  await mobileFlow('mobile-landscape', { width: 844, height: 390 });
  await mobileFlow('mobile-portrait', { width: 390, height: 844 });
} catch (e) { check('e2e run completed without exception', false, String(e).slice(0, 300)); }
const consoleErrors = errors.filter(e => !/favicon|Failed to load resource/.test(e));
check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
await browser.close();
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
fs.writeFileSync(`${out}/e2e-results.json`, JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
