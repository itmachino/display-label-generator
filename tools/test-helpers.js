// Shared by the tests: opens index.html in a phone-sized browser with a test sheet (no internet sheet needed).
// The page still loads its libraries (PDF, barcode, QR) from the internet, so the PC must be online.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGE = process.env.PAGE || path.join(ROOT, 'index.html');
const SHEET = process.env.SHEET || path.join(ROOT, 'test-data', 'search-test-sheet.csv');

function findBrowser() {
  const list = [process.env.BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  const found = list.find((f) => f && fs.existsSync(f));
  if (!found) throw new Error('No Edge or Chrome found. Set the BROWSER environment variable to its full path.');
  return found;
}

// The test sheet, repeated `scale` times (names and SKUs changed a little) to make a longer list.
function sheetText(scale) {
  const csv = fs.readFileSync(SHEET, 'utf8').replace(/^\uFEFF/, '');
  if (!scale || scale < 2) return csv;
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const head = lines.shift();
  const out = [head];
  for (let k = 0; k < scale; k++) {
    lines.forEach((l) => {
      if (!k) return out.push(l);
      const c = l.split(',');
      c[0] = c[0] + ' v' + k;
      c[2] = c[2].replace(/^([A-Z]*\d+)/, (m) => m + String(k).padStart(2, '0'));
      out.push(c.join(','));
    });
  }
  return out.join('\n');
}

async function open(opts) {
  opts = opts || {};
  const browser = await puppeteer.launch({
    executablePath: findBrowser(), headless: true,
    defaultViewport: { width: 390, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  const body = sheetText(opts.scale);
  await page.setRequestInterception(true);
  page.on('request', (r) => (r.url().startsWith('https://docs.google.com/')
    ? r.respond({ status: 200, contentType: 'text/csv', headers: { 'access-control-allow-origin': '*' }, body })
    : r.continue()));
  // start with an empty phone memory, but keep it when the page is reloaded
  await page.evaluateOnNewDocument(() => {
    try { if (!sessionStorage.getItem('t')) { localStorage.clear(); sessionStorage.setItem('t', '1'); } } catch (e) {}
  });
  const ready = async () => {
    await page.waitForFunction(() => /ready/.test(document.getElementById('sheetStatus').textContent), { timeout: 30000 });
  };
  await page.goto('file:///' + PAGE.split(path.sep).join('/'), { waitUntil: 'networkidle0' });
  await ready();
  return { browser, page, errors, ready };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { open, sleep, ROOT, PAGE };
