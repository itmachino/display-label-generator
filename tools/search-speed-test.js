// How much work the page does while someone types a search (real key presses, CPU made 4x slower like a shop phone).
// Run:  npm run speed            (96 shoes)
//       node search-speed-test.js 20      (20 x the test sheet = 480 shoes)
// To compare with another version of the page:  PAGE=C:/path/old-index.html npm run speed
const { open, sleep } = require('./test-helpers');

const scale = +process.argv[2] || 4;
const TYPED = ['alba 38', 'balerina beige 38', 'classic sandals', 'kiki og flats white', 'wedge'];

(async () => {
  const { browser, page: p, errors } = await open({ scale });
  const shoes = await p.evaluate(() => designs.length);
  await p.evaluate(() => { window.__r = 0; const f = renderList; window.renderList = function() { window.__r++; return f.apply(this, arguments); }; });
  const cdp = await p.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Performance.enable');
  const work = async () => {
    const m = (await cdp.send('Performance.getMetrics')).metrics;
    const g = (n) => m.find((x) => x.name === n).value;
    return g('ScriptDuration') + g('LayoutDuration') + g('RecalcStyleDuration');
  };
  let ms = 0, keys = 0, redraws = 0;
  for (const w of TYPED) {
    await p.$eval('#search', (e) => { e.value = ''; e.dispatchEvent(new Event('input')); });
    await sleep(400);
    await p.evaluate(() => { window.__r = 0; });
    const t0 = await work();
    await p.focus('#search');
    await p.keyboard.type(w, { delay: 70 });
    await sleep(400);
    ms += (await work() - t0) * 1000;
    keys += w.length;
    redraws += await p.evaluate(() => window.__r);
  }
  console.log(`${shoes} shoes: ${(ms / keys).toFixed(1)} ms of work per key press (${keys} key presses, ${redraws} list redraws)`);
  if (errors.length) console.log('PAGE ERRORS:', errors.join('|'));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
