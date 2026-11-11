// Checks for the Pro sales pages under pro/: config, language twins, button logic, wording rules.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const proDir = path.join(root, 'pro');
const read = (f) => fs.readFileSync(path.join(proDir, f), 'utf8');
const core = require('../pro/pro-core.js');
const config = JSON.parse(read('config.json'));

const PRODUCTS = {
  'book-studio': 'book-studio-pro',
  'section-numbering': 'section-numbering-pro',
  'update-radar': 'update-radar-pro',
  linkvane: 'linkvane-pro',
  'kdp-book-vault': 'kdp-book-vault',
  'thesis-vault': 'thesis-report-vault',
};
const PACKS = ['kdp-book-vault', 'thesis-vault'];
const PRICES = {
  'book-studio-pro': '39 USD', 'section-numbering-pro': '29 USD', 'update-radar-pro': '19 USD',
  'linkvane-pro': '', 'kdp-book-vault': '19 USD', 'thesis-report-vault': '12 USD',
};

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? htmlFiles(p) : e.name.endsWith('.html') ? [p] : [];
  });
}

test('config.json has the agreed shape and no ids filled in yet', () => {
  assert.deepStrictEqual(Object.keys(config).sort(), ['provider', 'providers', 'products'].sort());
  assert.strictEqual(config.provider, '');
  assert.deepStrictEqual(Object.keys(config.providers).sort(), ['gumroad', 'lemonsqueezy', 'polar']);
  assert.ok(['polar', 'lemonsqueezy', 'gumroad'].every((k) => typeof config.providers[k] === 'object'));
  assert.deepStrictEqual(Object.keys(config.products), Object.values(PRODUCTS));
  const prices = PRICES;
  for (const [id, p] of Object.entries(config.products)) {
    assert.deepStrictEqual(Object.keys(p).sort(), ['checkoutUrl', 'name', 'price', 'productId']);
    assert.strictEqual(p.price, prices[id]);
    assert.ok(p.name.length > 0);
    if (!p.checkoutUrl) continue;
    assert.ok(core.safeHttpsUrl(p.checkoutUrl), id + ' checkoutUrl must be https://');
  }
});

test('index and every product page have an es twin that links both ways', () => {
  const pairs = [['index.html', 'es/index.html', '/pro/', '/pro/es/']];
  for (const dir of Object.keys(PRODUCTS)) {
    pairs.push([dir + '/index.html', dir + '/es/index.html', `/pro/${dir}/`, `/pro/${dir}/es/`]);
  }
  for (const [en, es, enUrl, esUrl] of pairs) {
    assert.ok(fs.existsSync(path.join(proDir, en)), en);
    assert.ok(fs.existsSync(path.join(proDir, es)), es);
    const a = read(en), b = read(es);
    assert.match(a, /<html lang="en">/);
    assert.match(b, /<html lang="es">/);
    assert.ok(a.includes(`href="${esUrl}" hreflang="es"`), en + ' links to its Spanish twin');
    assert.ok(b.includes(`href="${enUrl}" hreflang="en"`), es + ' links to its English twin');
  }
});

test('product pages carry the sections, the buy hook and the signature', () => {
  for (const [dir, id] of Object.entries(PRODUCTS)) {
    for (const f of [dir + '/index.html', dir + '/es/index.html']) {
      const h = read(f);
      assert.ok(h.includes(`data-buy="${id}"`), f + ' has its Buy button');
      assert.ok(h.includes(`data-price="${id}"`), f + ' has its price');
      assert.ok(h.includes(config.products[id].price), f + ' static price matches config.json');
      assert.ok(config.products[id].price || /Price announced at launch|Precio al abrir las ventas/.test(h), f + ' says when the price comes');
      assert.match(h, /<details>/, f + ' has a FAQ');
      assert.match(h, /Siulved54/);
      assert.match(h, /<img [^>]*onerror=/, f + ' screenshot slot hides itself on error');
    }
  }
});

test('every pro page links in its footer to every product', () => {
  for (const f of htmlFiles(proDir)) {
    const h = fs.readFileSync(f, 'utf8');
    const rel = path.relative(proDir, f);
    const es = h.includes('<html lang="es">');
    const foot = h.slice(h.indexOf('<footer>'));
    for (const dir of Object.keys(PRODUCTS)) {
      assert.ok(foot.includes(`href="/pro/${dir}/${es ? 'es/' : ''}"`), rel + ' footer links ' + dir);
    }
  }
});

test('pack pages say the free plugin is enough and promise no licence key or trial', () => {
  const plugin = { 'kdp-book-vault': 'book-studio', 'thesis-vault': 'section-numbering' };
  for (const dir of PACKS) {
    for (const f of [dir + '/index.html', dir + '/es/index.html']) {
      const h = read(f);
      assert.ok(h.includes(`href="https://obsidian.md/plugins?id=${plugin[dir]}"`), f + ' links the free plugin in the directory');
      assert.ok(!/licen[cs]e key|clave de licencia|free trial|prueba gratuita|14.day|14 días/i.test(h), f + ' promises a key or a trial');
    }
  }
  assert.match(read('kdp-book-vault/index.html'), /Not affiliated with Amazon; KDP is a trademark of Amazon/);
  assert.match(read('kdp-book-vault/es/index.html'), /No afiliado a Amazon; KDP es una marca de Amazon/);
});

test('buyState: empty, bad and good checkout URLs', () => {
  const mk = (checkoutUrl) => ({ products: { x: { name: 'X', price: '9 USD', checkoutUrl } } });
  assert.deepStrictEqual(core.buyState(mk(''), 'x', 'en'), { enabled: false, href: '', label: 'Coming soon' });
  assert.deepStrictEqual(core.buyState(mk(''), 'x', 'es'), { enabled: false, href: '', label: 'Próximamente' });
  for (const bad of ['http://pay.example/x', 'javascript:alert(1)', '//pay.example', 'pay.example/x', 'https://', ' ', null, 42]) {
    assert.strictEqual(core.buyState(mk(bad), 'x', 'en').enabled, false, String(bad));
  }
  const good = core.buyState(mk('https://pay.example/checkout/abc?x=1'), 'x', 'en');
  assert.deepStrictEqual(good, { enabled: true, href: 'https://pay.example/checkout/abc?x=1', label: 'Buy for 9 USD' });
  assert.strictEqual(core.buyState(mk('https://pay.example/c'), 'x', 'es').label, 'Comprar por 9 USD');
  assert.strictEqual(core.buyState(mk('https://pay.example/c'), 'nope', 'en').enabled, false);
  assert.strictEqual(core.buyState(null, 'x', 'en').enabled, false);
  assert.strictEqual(core.buyState({ products: {} }, '__proto__', 'en').enabled, false);
});

test('priceText reads the price and tolerates bad config', () => {
  assert.strictEqual(core.priceText(config, 'book-studio-pro'), '39 USD');
  assert.strictEqual(core.priceText(config, 'missing'), '');
  assert.strictEqual(core.priceText(undefined, 'x'), '');
});

test('pro.js only writes external text with textContent', () => {
  const js = read('pro.js');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(js));
  assert.ok(js.includes('textContent'));
});

test('no real-name text, no claude.ai, no analytics or third-party resources in pro/', () => {
  const files = htmlFiles(proDir);
  assert.ok(files.length >= 12);
  for (const f of files) {
    const h = fs.readFileSync(f, 'utf8');
    const rel = path.relative(proDir, f);
    assert.ok(!/perezamador/i.test(h), rel + ' names the owner account');
    assert.ok(!/claude\.ai/i.test(h), rel + ' links claude.ai');
    assert.ok(!/goatcounter|stats\.js|gtag|googletagmanager|plausible/i.test(h), rel + ' has analytics');
    const srcs = [...h.matchAll(/<(?:script|link|img)\b[^>]*?(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    for (const s of srcs) {
      if (/^(https?:)?\/\//i.test(s)) assert.fail(rel + ' loads ' + s);
    }
  }
});

test('pages.yml publishes pro/', () => {
  const y = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
  assert.match(y, /^\s*cp -r .*\bpro\b.*_site\/$/m);
});

test('versions.json: flat map by product id, valid versions, short notes, Linkvane Pro present', () => {
  const v = JSON.parse(read('versions.json'));
  assert.ok(v['linkvane-pro'], 'linkvane-pro entry');
  for (const [id, p] of Object.entries(v)) {
    assert.ok(Object.values(PRODUCTS).includes(id), id + ' is a known product');
    assert.match(p.version, /^\d{1,4}\.\d{1,4}\.\d{1,4}$/, id);
    if (p.released !== undefined) assert.match(p.released, /^\d{4}-\d{2}-\d{2}$/, id);
    const notes = typeof p.notes === 'string' ? { en: p.notes } : p.notes;
    assert.ok(notes.en && notes.en.length <= 300, id + ' notes in English, short');
    if (notes.es) assert.ok(notes.es.length <= 300, id + ' Spanish notes short');
    assert.ok(Object.keys(p).every((k) => ['version', 'released', 'notes'].includes(k)), id + ' only version, released, notes');
  }
});

test('versions.json and the pages carry no code, no download links and no key material', () => {
  const v = read('versions.json');
  assert.ok(!/https?:\/\//.test(v), 'versions.json has no URLs');
  for (const f of htmlFiles(proDir)) {
    const h = fs.readFileSync(f, 'utf8');
    assert.ok(!/\.zip\b|PUBLIC_KEYS|BEGIN (PUBLIC|PRIVATE)/.test(h), path.relative(proDir, f) + ' links a zip or key');
  }
});
