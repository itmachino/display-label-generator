// Full check of the sticker website: search behaviour + every sticker function.
// Run (in this folder):  npm install   then   npm test
// Exit code 0 = all passed. It never touches the real Google Sheet, Shopify or any printer.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { open, sleep } = require('./test-helpers');

let pass = 0, fail = 0;
const fails = [];
const ok = (name, cond, detail) => { if (cond) pass++; else { fail++; fails.push(name + (detail ? '  [' + detail + ']' : '')); } };

(async () => {
  const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'sticker-test-'));
  const { browser, page: p, errors, ready } = await open();
  const cdp = await p.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });

  const type = async (q) => { await p.$eval('#search', (e) => { e.value = ''; }); await p.focus('#search'); await p.keyboard.type(q, { delay: 20 }); await sleep(250); };
  const names = () => p.$$eval('#list .card .name', (n) => n.map((x) => x.textContent));
  const text = (sel) => p.$eval(sel, (e) => e.textContent.trim());
  const sizedCount = await p.evaluate(() => designs.filter((d) => d.single == null).length);

  // ── SEARCH ──
  await type('alba 38');
  let n = await names();
  ok('name + size: finds the 3 Alba shoes', n.length === 3 && n.every((x) => /Alba/.test(x)), n.join('|'));
  ok('searched size 38 is outlined on every card', (await p.$$eval('#list .size.match', (e) => e.map((x) => x.textContent))).join() === '38,38,38');
  ok('matched text is highlighted', (await p.$$('#list .card mark')).length >= 3);
  ok('searched size is NOT solid pink (only outlined)', (await p.$$eval('#list .size.match', (e) => e.every((x) => !x.classList.contains('on')))));
  await p.click('#searchClear'); await sleep(80);
  ok('clear button empties the search', (await p.$eval('#search', (e) => e.value)) === '' && (await p.$eval('#searchClear', (e) => e.hidden)));
  ok('after clear the whole list shows', (await names()).length === 24);

  await type('balerina'); n = await names();
  ok('typo "balerina" finds the 3 Ballerina flats, with a note', n.length === 3 && /ballerina/i.test(await text('.search-note')), n.length + '');
  await type('sandle');
  ok('unsure typo "sandle" is not swapped', (await names()).length === 0 && !(await p.$eval('#emptyNote', (e) => e.hidden)));
  ok('"sandle" suggests sandals first, saddle second', (await p.$$eval('#emptyNote .dym', (e) => e.map((x) => x.textContent))).join() === 'sandals,saddle');
  await type('MA1001-2-B-20-38'); n = await names();
  ok('exact SKU: that shoe, size 38 outlined', n.length === 1 && /Alba Block Heels in Black/.test(n[0]) && (await text('#list .size.match')) === '38');
  await type('1800037001'); ok('SKU without a size: that shoe first', /Belle Ballerina Flats in Beige/.test((await names())[0]));
  await type('ma1001 2'); ok('SKU without dashes and capitals works', /Alba/.test((await names())[0]));
  await type('qwertyx');
  ok('no results: message, no suggestion', /No shoes match/.test(await text('#emptyNote')) && (await p.$$('#emptyNote .dym')).length === 0);
  await type('alba'); ok('search again after "no results"', (await names()).length === 3 && (await p.$eval('#emptyNote', (e) => e.hidden)));
  await type('kasut');
  ok('Malay "kasut" = all shoes with sizes, no bags or cases', (await p.evaluate(() => searchFor('kasut').list.length)) === sizedCount && !(await names()).some((x) => /Bag|Case|Pouch/.test(x)), '' + sizedCount);
  ok('alias note shown', /shoes.*kasut/.test(await text('.search-note')));
  await type('beg'); ok('Malay "beg" = bags', (await names()).length === 4 && (await names()).every((x) => /Bag|Pouch/.test(x)));
  await type('wedge'); ok('"wedge" finds Wedges', (await names()).length === 2);
  await type('flat'); ok('"flat" finds the 8 Flats (6 named Flats + 2 Mary Jane, a Flats type)', (await names()).length === 8, '' + (await names()).length);
  await type('maryjane'); ok('"maryjane" finds Mary Jane', (await names()).length === 2);
  await type('kiki og flats'); ok('name that starts with the words ranks first', /^Kiki OG Flats in/.test((await names())[0]));
  await type('kasut 99'); ok('size that no shoe has: no results', (await names()).length === 0);
  await type('bluss'); ok('uncertain typo gives suggestions', (await p.$$('#emptyNote .dym')).length >= 1);
  await p.click('#emptyNote .dym'); await sleep(150);
  ok('tapping a suggestion searches it', (await names()).length > 0 && (await p.$eval('#search', (e) => e.value)) !== 'bluss');
  await p.click('#searchClear');

  // ── STICKER GENERATOR ──
  await type('belle ballerina beige');          // new SKU: barcode
  let sizeBtns = await p.$$('#list .card:first-child .size');
  await sizeBtns[1].click(); await sleep(80);   // size 36
  ok('picking a size: count 1, Print on', /1/.test(await text('#barCount')) && !(await p.$eval('#openPrint', (e) => e.disabled)));
  await p.mouse.move(0, 0); await sleep(400);   // mouse off the button (hover is darker), colour fade done
  ok('picked size is solid pink', await p.$eval('#list .card:first-child .size.on', (e) => getComputedStyle(e).backgroundColor === 'rgb(168, 78, 100)' && getComputedStyle(e).color === 'rgb(255, 255, 255)'));
  ok('toast "Added"', /Added/.test(await text('#toastText')));
  await p.click('#toastUndo'); await sleep(80);
  ok('Undo removes it', (await p.$eval('#openPrint', (e) => e.disabled)) === true);
  sizeBtns = await p.$$('#list .card:first-child .size');
  await sizeBtns[1].click(); await sleep(80); await sizeBtns[1].click(); await sleep(80);
  ok('tapping again removes it', (await p.$eval('#openPrint', (e) => e.disabled)) === true);
  await sizeBtns[1].click(); await sleep(50); await sizeBtns[3].click(); await sleep(50);
  await type('alba 36');
  ok('a size that is searched AND picked later: outlined vs solid differ', await p.$eval('#list .card:first-child .size.match', (e) => getComputedStyle(e).backgroundColor !== 'rgb(168, 78, 100)'));
  await (await p.$$('#list .card:first-child .size'))[2].click(); await sleep(80);   // old SKU: QR code
  ok('3 stickers counted', /3/.test(await text('#barCount')), await text('#barCount'));
  await p.click('#openPrint'); await sleep(900);
  ok('print preview shows 3 stickers', (await p.$$('#printItems .item')).length === 3);
  const kinds = await p.$$eval('#printItems .item-info span', (e) => e.map((x) => x.textContent));
  ok('barcode and QR code both made', kinds.some((k) => /Barcode/.test(k)) && kinds.some((k) => /QR code/.test(k)), kinds.join('|'));
  const spec = await p.$$eval('#printItems .barcode-specs', (e) => e.map((x) => x.textContent));
  ok('read-back check passes on every code', spec.length === 3 && spec.every((s) => /reads/.test(s)));
  await (await p.$('#printItems .item [data-act="plus"]')).click(); await sleep(60);
  ok('copies +', (await p.$eval('#printItems .item output', (e) => e.textContent)) === '2' && /4/.test(await text('#printCount')));
  const shot = () => p.$eval('#printItems .item canvas', (e) => e.toDataURL());
  const c0 = await shot();
  await p.evaluate(() => { document.getElementById('stickerSettings').open = true; const e = document.getElementById('showSize'); e.checked = true; e.onchange && e.onchange(); }); await sleep(300);
  const c1 = await shot(); ok('Show size changes the sticker', c0 !== c1);
  await p.evaluate(() => { const e = document.getElementById('showPrice'); e.checked = false; e.onchange && e.onchange(); }); await sleep(300);
  const c2 = await shot(); ok('Show price off changes the sticker', c1 !== c2);
  await p.evaluate(() => resetSettings()); await sleep(300);
  ok('Reset to default restores the sticker', (await shot()) === c0);
  await p.click('#generateBtn'); await sleep(2500);
  const pdfs = fs.readdirSync(downloads).filter((f) => f.endsWith('.pdf'));
  ok('PDF downloaded', pdfs.length === 1, pdfs.join());
  if (pdfs.length) {
    const buf = fs.readFileSync(path.join(downloads, pdfs[0]));
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok('PDF has 4 pages (3 stickers, one twice)', buf.slice(0, 5).toString() === '%PDF-' && pages === 4, 'pages=' + pages);
  }
  await p.click('#printItems .item [data-act="remove"]'); await sleep(100);
  ok('remove a sticker with the x', (await p.$$('#printItems .item')).length === 2);
  await p.reload({ waitUntil: 'networkidle0' }); await ready(); await sleep(200);
  ok('saved selection after refresh', /^2 sticker/.test(await text('#barCount')) && !(await p.$eval('#openPrint', (e) => e.disabled)), await text('#barCount'));
  await p.click('#openPrint'); await sleep(700);
  ok('print list restored after refresh', (await p.$$('#printItems .item')).length === 2);
  await p.click('#clearBtn'); await sleep(200);
  ok('Clear empties the list', (await p.$$('#printItems .item')).length === 0 && (await p.$eval('#openPrint', (e) => e.disabled)));
  await p.reload({ waitUntil: 'networkidle0' }); await ready(); await sleep(200);
  ok('cleared list stays cleared after refresh', (await p.$eval('#openPrint', (e) => e.disabled)) === true);
  ok('no page errors', errors.length === 0, errors.join('|'));
  await browser.close();

  // ── LONG LIST: paging and typing (the sheet repeated 4 times = 96 shoes) ──
  const long = await open({ scale: 4 });
  const q = long.page;
  const lnames = () => q.$$eval('#list .card .name', (x) => x.map((y) => y.textContent));
  ok('long list: first page is 30 shoes + "Show more"', (await lnames()).length === 30 && !!(await q.$('#moreBtn')));
  await q.$eval('#list .card', (e) => { e.dataset.tag = 'keep'; });
  await q.evaluate(() => document.getElementById('moreBtn').click()); await sleep(100);
  ok('"Show more" adds 30 and leaves the old cards alone', (await lnames()).length === 60 && (await q.$eval('#list .card', (e) => e.dataset.tag)) === 'keep');
  await q.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(700);
  ok('scrolling to the end loads the rest by itself', (await lnames()).length === 96, '' + (await lnames()).length);
  await q.evaluate(() => { window.__r = 0; const f = renderList; window.renderList = function() { window.__r++; return f.apply(this, arguments); }; });
  await q.$eval('#search', (e) => { e.value = ''; }); await q.focus('#search'); await q.keyboard.type('balerina beige 38', { delay: 25 }); await sleep(300);
  const renders = await q.evaluate(() => window.__r);
  ok('typing 17 letters quickly redraws the list far fewer than 17 times', renders <= 6, 'redraws=' + renders);
  ok('...and the final list is right (2 shoes x 4 copies of the sheet)', (await lnames()).length === 8, '' + (await lnames()).length);
  ok('long list: no page errors', long.errors.length === 0, long.errors.join('|'));
  await long.browser.close();

  fs.rmSync(downloads, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  fails.forEach((f) => console.log('  FAIL:', f));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
