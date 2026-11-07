// Checks for the catalog generator: README parsing, escaping, and a full offline build.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const load = () => import('../catalog/build.mjs');

test('parseReadme takes the intro, the best list and the images, and drops paid copy', async () => {
  const { parseReadme } = await load();
  const md = [
    '# Thing',
    '[![CI](https://img.shields.io/x.svg)](x)',
    '',
    'Does one useful thing in your notes.',
    '',
    'Book Studio Pro costs 59 USD.',
    '',
    '![Demo of the thing](https://raw.githubusercontent.com/o/thing/main/docs/demo.gif)',
    '',
    '## Why this one',
    '',
    '- **Live and clickable.** Builds the list from the headings and updates as you type.',
    '- **Plain Markdown.** The same list can be written between two comment markers.',
    '- **Foldable.** Collapse the block or a single branch of it, with the current one lit.',
    '',
    '## Pro',
    '- one two three four five six seven eight nine ten eleven twelve thirteen fourteen',
  ].join('\n');
  const r = parseReadme(md);
  assert.deepStrictEqual(r.intro, ['Does one useful thing in your notes.']);
  assert.strictEqual(r.features.length, 3);
  assert.match(r.features[0], /Live and clickable/);
  assert.ok(r.images.some((i) => i.alt === 'Demo of the thing'));
});

test('inline Markdown escapes HTML and only links http(s)', async () => {
  const { inline } = await load();
  assert.strictEqual(inline('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.ok(!inline('[x](javascript:alert(1))').includes('href'));
  assert.match(inline('**a** `b` [c](https://example.com)'), /<strong>a<\/strong> <code>b<\/code> <a href="https:\/\/example.com"/);
});

test('repoPath accepts the repo own raw URLs and relative paths only', async () => {
  const { repoPath } = await load();
  assert.strictEqual(repoPath('https://raw.githubusercontent.com/o/r/main/docs/a.png', 'o', 'r'), 'docs/a.png');
  assert.strictEqual(repoPath('docs/a.png', 'o', 'r'), 'docs/a.png');
  assert.strictEqual(repoPath('https://example.com/a.png', 'o', 'r'), null);
});

test('a full offline build writes valid pages, sitemap and robots', async () => {
  const { build, validate } = await load();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-'));
  const local = path.join(tmp, 'src');
  fs.mkdirSync(path.join(local, 'demo', 'docs'), { recursive: true });
  fs.writeFileSync(path.join(local, 'demo', 'manifest.json'), JSON.stringify({ id: 'demo', name: 'Demo <b>Plugin</b>', version: '1.2.3', minAppVersion: '1.4.0', description: 'Does a demo thing in your vault, with enough words to be a decent description.', author: 'Siulved54', isDesktopOnly: false }));
  fs.writeFileSync(path.join(local, 'demo', 'README.md'), '# Demo\n\nA short intro paragraph that explains the plugin in plain words.\n\n![Shot](docs/shot.svg)\n');
  fs.writeFileSync(path.join(local, 'demo', 'docs', 'shot.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  const out = path.join(tmp, 'out');
  const { products } = await build({
    out, local, directory: new Set(['demo']), log: () => {}, ffmpeg: false, date: '2026-01-01',
    products: [{ slug: 'demo', kind: 'obsidian', repo: 'demo', name: 'Demo' }],
  });
  assert.strictEqual(products.length, 1);
  const html = fs.readFileSync(path.join(out, 'catalog', 'demo', 'index.html'), 'utf8');
  assert.ok(!html.includes('<b>Plugin</b>'), 'manifest text must be escaped');
  assert.match(html, /community\.obsidian\.md\/plugins\/demo/);
  assert.match(fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8'), /catalog\/demo\//);
  assert.match(fs.readFileSync(path.join(out, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/perezamadorluisenrique-gif\.github\.io\/sitemap\.xml/);
  const v = validate(out);
  assert.deepStrictEqual(v.errors, []);
  assert.strictEqual(v.pages, 2);
});

test('an unpublished optional product is skipped, a missing required one fails the build', async () => {
  const { build } = await load();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-'));
  const opts = { out: path.join(tmp, 'o'), local: tmp, directory: new Set(), log: () => {}, ffmpeg: false };
  const r = await build({ ...opts, products: [{ slug: 'x', kind: 'obsidian', repo: 'nope', name: 'X', optional: true }] });
  assert.strictEqual(r.products.length, 0);
  await assert.rejects(build({ ...opts, products: [{ slug: 'x', kind: 'obsidian', repo: 'nope', name: 'X' }] }));
});

test('products.json has unique slugs and no paid products', () => {
  const conf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'catalog', 'products.json'), 'utf8'));
  const slugs = conf.products.map((p) => p.slug);
  assert.strictEqual(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.doesNotMatch(s, /pro$|vault$/);
});
