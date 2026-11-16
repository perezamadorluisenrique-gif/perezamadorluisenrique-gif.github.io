// Checks for the "alternative to" pages: facts come only from the directory data, both languages are valid.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const loadAlt = () => import('../catalog/alternatives.mjs');
const loadBuild = () => import('../catalog/build.mjs');

const dirList = [
  { id: 'old-case', name: 'Old Case & 2', author: 'Someone', description: 'Format text in 3 ways. - This plugin has not been manually reviewed by Obsidian staff.', repo: 'someone/old-case' },
  { id: 'demo', name: 'Demo', author: 'Siulved54', description: 'Does a demo thing in your vault.', repo: 'o/demo' },
];
const stats = {
  'old-case': { downloads: 123456, updated: Date.UTC(2022, 5, 17), '1.0.9': 5, '1.0.18': 100, '1.0.2': 3 },
  demo: { downloads: 42, updated: Date.UTC(2026, 10, 2), '1.2.3': 42 },
};

function makeSource() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alt-'));
  const local = path.join(tmp, 'src');
  fs.mkdirSync(path.join(local, 'demo'), { recursive: true });
  fs.writeFileSync(path.join(local, 'demo', 'manifest.json'), JSON.stringify({ id: 'demo', name: 'Demo', version: '1.2.3', minAppVersion: '1.4.0', description: 'Does a demo thing in your vault, with enough words to be a decent description.', author: 'Siulved54', isDesktopOnly: false }));
  fs.writeFileSync(path.join(local, 'demo', 'README.md'), '# Demo\n\nA short intro paragraph that explains the plugin in plain words, version 9.9 included.\n\nSecond paragraph with 500 downloads claimed.\n');
  return { tmp, local };
}

test('pluginFacts takes the highest semver and drops the review suffix', async () => {
  const { pluginFacts } = await loadAlt();
  const f = pluginFacts(dirList[0], stats['old-case']);
  assert.strictEqual(f.version, '1.0.18');
  assert.strictEqual(f.downloads, 123456);
  assert.strictEqual(f.description, 'Format text in 3 ways.');
  assert.strictEqual(pluginFacts(dirList[0], undefined), null);
});

test('every number on an alternative page comes from the facts, in both languages', async () => {
  const { pluginFacts, renderAlternative, unsupportedNumbers } = await loadAlt();
  const { validate } = await loadBuild();
  const { tmp, local } = makeSource();
  const { build } = await loadBuild();
  const out = path.join(tmp, 'out');
  const r = await build({
    out, local, dirList, stats, directory: new Set(['demo']), log: () => {}, ffmpeg: false, date: '2026-11-11',
    products: [{ slug: 'demo', kind: 'obsidian', repo: 'demo', name: 'Demo' }],
    alternatives: [{ slug: 'old-case', ours: 'demo', rival: 'old-case' }],
  });
  assert.strictEqual(r.alternatives.length, 1);
  const facts = r.alternatives[0].facts;
  for (const lang of ['en', 'es']) {
    const html = renderAlternative(r.alternatives[0].page, facts, lang, '2026-11-11');
    assert.deepStrictEqual(unsupportedNumbers(html, facts, '2026-11-11'), [], lang);
    assert.match(html, lang === 'es' ? /123\.456/ : /123,456/);
    assert.match(html, /17 (June|de junio de) 2022/);
    assert.match(html, /1\.0\.18/);
    assert.ok(!html.includes('Second paragraph with 500'), 'only the first README paragraph is used');
    // a claim that is not in the data is caught
    assert.deepStrictEqual(unsupportedNumbers(html.replace('<h1>', '<p>Over 9,999 users.</p><h1>'), facts, '2026-11-11'), ['9,999']);
  }
  const v = validate(out);
  assert.deepStrictEqual(v.errors, []);
  for (const f of ['catalog/alternatives/old-case/index.html', 'catalog/es/alternativas/old-case/index.html', 'catalog/alternatives/index.html', 'catalog/es/alternativas/index.html', 'catalog/es/demo/index.html', 'catalog/es/index.html']) {
    assert.ok(fs.existsSync(path.join(out, f)), f);
  }
  const sitemap = fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /catalog\/alternatives\/old-case\//);
  assert.match(sitemap, /catalog\/es\/alternativas\/old-case\//);
  // the product page links to the comparison
  assert.match(fs.readFileSync(path.join(out, 'catalog/demo/index.html'), 'utf8'), /href="\/catalog\/alternatives\/old-case\/"/);
  assert.match(fs.readFileSync(path.join(out, 'catalog/es/demo/index.html'), 'utf8'), /href="\/catalog\/es\/alternativas\/old-case\/"/);
});

test('a missing rival skips its page and the build still finishes', async () => {
  const { build, validate } = await loadBuild();
  const { tmp, local } = makeSource();
  const out = path.join(tmp, 'out');
  const r = await build({
    out, local, dirList, stats, directory: new Set(['demo']), log: () => {}, ffmpeg: false,
    products: [{ slug: 'demo', kind: 'obsidian', repo: 'demo', name: 'Demo' }],
    alternatives: [{ slug: 'gone', ours: 'demo', rival: 'not-in-directory' }],
  });
  assert.strictEqual(r.alternatives.length, 0);
  assert.ok(r.warns.some((w) => /missing data/.test(w)));
  assert.deepStrictEqual(validate(out).errors, []);
});

test('alternatives.json points at real catalog products and unique slugs', () => {
  const conf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'catalog', 'alternatives.json'), 'utf8'));
  const prods = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'catalog', 'products.json'), 'utf8')).products;
  const slugs = conf.pages.map((p) => p.slug);
  assert.strictEqual(new Set(slugs).size, slugs.length);
  for (const p of conf.pages) assert.ok(prods.some((x) => x.slug === p.ours && x.kind === (p.kind || 'obsidian')), p.ours);
});

const wpInfo = {
  'rival-wp': { slug: 'rival-wp', name: 'Rival &amp; Co Checker', version: '2.4.15', author: '<a href="https://profiles.wordpress.org/x/">Rival Team</a>', requires: '6.2', tested: '7.1.4', requires_php: '7.4', rating: 76, num_ratings: 604, active_installs: 500000, last_updated: '2026-10-13 4:53am GMT' },
  'ours-wp': { slug: 'ours-wp', name: 'Ours – Link Checker &amp; More', version: '1.7.4', author: '<a href="https://profiles.wordpress.org/y/">someone</a>', requires: '6.2', tested: '7.1.4', requires_php: '8.0', rating: 0, num_ratings: 0, active_installs: 0, last_updated: '2026-11-07 11:12pm GMT' },
};

test('a WordPress comparison page uses only wordpress.org API facts, in both languages', async () => {
  const { wpFacts, renderWpAlternative, wpUnsupportedNumbers } = await import('../catalog/wp-alternatives.mjs');
  const { build, validate } = await loadBuild();
  const { tmp, local } = makeSource();
  const out = path.join(tmp, 'out');
  // WordPress product pages read the API too; serve them from the same map
  const realFetch = global.fetch;
  global.fetch = async (u) => {
    const m = /request\[slug\]=([\w-]+)/.exec(String(u));
    if (m && wpInfo[m[1]]) return new Response(JSON.stringify({ ...wpInfo[m[1]], sections: { description: '<p>A short intro paragraph that explains the plugin in plain words.</p>' } }), { status: 200 });
    return realFetch(u);
  };
  try {
    const r = await build({
      out, local, dirList, stats, wpInfo, directory: new Set(), log: () => {}, ffmpeg: false, date: '2026-11-16',
      products: [{ slug: 'ours-wp', kind: 'wordpress', wpSlug: 'ours-wp', name: 'Ours' }],
      alternatives: [{ slug: 'rival-wp', kind: 'wordpress', ours: 'ours-wp', rival: 'rival-wp' }],
    });
    assert.strictEqual(r.alternatives.length, 1);
    const f = r.alternatives[0].facts;
    assert.strictEqual(f.rival.name, 'Rival & Co Checker');
    assert.strictEqual(f.rival.stars, 3.8);
    assert.strictEqual(f.ours.stars, null);
    for (const lang of ['en', 'es']) {
      const html = renderWpAlternative(r.alternatives[0].page, f, lang, '2026-11-16');
      assert.deepStrictEqual(wpUnsupportedNumbers(html, f, '2026-11-16'), [], lang);
      assert.match(html, lang === 'es' ? /500\.000\+/ : /500,000\+/);
      assert.match(html, lang === 'es' ? /Menos de 10/ : /Fewer than 10/);
      assert.match(html, /13 (October|de octubre de) 2026/);
      assert.deepStrictEqual(wpUnsupportedNumbers(html.replace('<h1>', '<p>Over 9,999 users.</p><h1>'), f, '2026-11-16'), ['9,999']);
    }
    assert.deepStrictEqual(validate(out).errors, []);
    assert.ok(fs.existsSync(path.join(out, 'catalog/alternatives/rival-wp/index.html')));
    assert.ok(fs.existsSync(path.join(out, 'catalog/es/alternativas/rival-wp/index.html')));
    assert.match(fs.readFileSync(path.join(out, 'catalog/ours-wp/index.html'), 'utf8'), /href="\/catalog\/alternatives\/rival-wp\/"/);
  } finally {
    global.fetch = realFetch;
  }
  assert.strictEqual(wpFacts({ error: 'x' }), null);
});
