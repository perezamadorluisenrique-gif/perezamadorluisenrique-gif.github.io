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
  const prices = { 'book-studio-pro': '59 USD', 'section-numbering-pro': '15 USD', 'update-radar-pro': '9 USD' };
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
      assert.match(h, /<details>/, f + ' has a FAQ');
      assert.match(h, /Siulved54/);
      assert.match(h, /<img [^>]*onerror=/, f + ' screenshot slot hides itself on error');
    }
  }
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
  assert.strictEqual(core.priceText(config, 'book-studio-pro'), '59 USD');
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
  assert.ok(files.length >= 8);
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
