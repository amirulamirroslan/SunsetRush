// Measures draw calls and triangles for the world scene at several points on the circuit, for each graphics tier.
// "main" = camera pass only (shadow map off); "full" = whole frame through the real pipeline (shadow pass + bloom/output passes).
// Usage: node tools/measure.mjs <baseUrl> [tiers=low,medium,high] [w=640] [h=360] [positions=0,9,9,9]   (positions = seconds fast-forwarded between samples)
import { chromium } from 'playwright-core';
const [base = 'http://127.0.0.1:4173/', tiers = 'low,medium,high', W = '640', H = '360', steps = '0,9,9,9'] = process.argv.slice(2);
const chromePath = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const all = {};
for (const tier of tiers.split(',')) {
  const page = await (await browser.newContext({ viewport: { width: +W, height: +H } })).newPage();
  await page.goto(`${base}?debug&q=${tier}`);
  await page.waitForSelector('#menu.on', { timeout: 180000 });
  await page.waitForTimeout(500);
  await page.locator('#menu .btn', { hasText: 'Race' }).first().click();
  await page.waitForSelector('.setup');
  await page.locator('.setup .btn.good').click();
  await page.waitForSelector('#hud.on');
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) { if ((await page.evaluate(() => window.__rush.debugState().stage)) === 'racing') break; await page.waitForTimeout(200); }
  const rows = [];
  for (const s of steps.split(',')) {
    if (+s > 0) await page.evaluate(sec => window.__rush.debugFastForward(+sec, true), s);
    await page.waitForTimeout(700);
    rows.push(await page.evaluate(() => {
      const g = window.__rush, r = g.gfx.renderer; r.info.autoReset = false;
      const meas = fn => { r.info.reset(); fn(); return { calls: r.info.render.calls, tris: r.info.render.triangles }; };
      const full = meas(() => g.gfx.render(g.world.scene, g.rig.camera));
      const wasOn = r.shadowMap.enabled; r.shadowMap.enabled = false; r.render(g.world.scene, g.rig.camera);
      const main = meas(() => r.render(g.world.scene, g.rig.camera)); r.shadowMap.enabled = wasOn;
      return { dist: +(g.debugState().raceTime ?? 0).toFixed(1), main, full, geometries: r.info.memory.geometries, textures: r.info.memory.textures, programs: r.info.programs?.length };
    }));
  }
  all[tier] = rows; console.log(tier, JSON.stringify(rows));
  await page.context().close();
}
console.log('RESULT ' + JSON.stringify(all));
await browser.close();
