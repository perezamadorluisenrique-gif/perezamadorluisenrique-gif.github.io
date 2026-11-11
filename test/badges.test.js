// Checks for the Plugin Inspector health badge: the daily generator and the snippet builders.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { badgeFor, generate, SAFE_ID } = require('../plugin-inspector/badges.js');
const I = require('../plugin-inspector/inspect.js');

const good = { id: 'good-one', name: 'Good One', version: '1.0.0', minAppVersion: '1.4.0', description: 'Does one good thing in your notes.', author: 'A', isDesktopOnly: false };

test('a clean manifest is healthy, advice is notes, a missing key is an issue', () => {
  assert.strictEqual(badgeFor(good, { id: 'good-one' }).message, 'healthy');
  const note = badgeFor(Object.assign({}, good, { description: 'Does one good thing in your notes' }), { id: 'good-one' });
  assert.deepStrictEqual([note.message, note.color], ['1 note', 'yellow']);
  const bad = badgeFor({ id: 'x', name: 'X', version: '1.0.0', description: 'Fine.', author: 'A', isDesktopOnly: true }, { id: 'x' });
  assert.deepStrictEqual([bad.message, bad.color], ['1 issue', 'red']);
  const b = badgeFor(good, { id: 'good-one' });
  assert.strictEqual(b.schemaVersion, 1);
  assert.strictEqual(b.label, 'Plugin Inspector');
});

test('the manifest cannot be read: unknown, never healthy', () => {
  const b = badgeFor(null, { id: 'gone' });
  assert.deepStrictEqual([b.message, b.color], ['unknown', 'lightgrey']);
});

test('naming rules that gate new submissions do not mark down a listed plugin', () => {
  const m = Object.assign({}, good, { id: 'obsidian-old-thing', name: 'Old Obsidian Plugin' });
  assert.strictEqual(badgeFor(m, { id: 'obsidian-old-thing' }).message, 'healthy');
});

test('the generator writes one JSON per safe id from fixture plugins and never trusts a failed fetch', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'badge-'));
  const plugins = [
    { id: 'good-one', repo: 'a/good-one' },
    { id: 'no-manifest', repo: 'a/no-manifest' },
    { id: 'flaky', repo: 'a/flaky' },
    { id: '../escape', repo: 'a/escape' },
  ];
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    if (url.includes('a/good-one/')) return { ok: true, status: 200, text: async () => JSON.stringify(good) };
    if (url.includes('a/no-manifest/')) return { ok: false, status: 404, text: async () => '' };
    throw new Error('network down');
  };
  const counts = await generate({ plugins, outDir: out, fetchImpl, concurrency: 2 });
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(out, 'good-one.json'), 'utf8')).message, 'healthy');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(out, 'no-manifest.json'), 'utf8')).message, 'unknown');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(out, 'flaky.json'), 'utf8')).message, 'unknown');
  assert.ok(!fs.existsSync(path.join(out, '..', 'escape.json')), 'unsafe id is not written');
  assert.deepStrictEqual([counts.total, counts.healthy, counts.unknown, counts.skipped], [3, 1, 2, 1]);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(out, '_summary.json'), 'utf8')).total, 3);
}, { timeout: 20000 });

test('when the time budget runs out the rest are written as unknown without fetching', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'badge-'));
  let t = 0;
  let fetched = 0;
  const fetchImpl = async () => { fetched++; return { ok: true, status: 200, text: async () => JSON.stringify(good) }; };
  const plugins = ['a', 'b', 'c'].map((id) => ({ id, repo: 'o/' + id }));
  const counts = await generate({ plugins, outDir: out, fetchImpl, concurrency: 1, budgetMs: 10, now: () => (t += 8) });
  assert.ok(counts.outOfTime >= 1);
  assert.ok(fetched < 3);
  for (const id of ['a', 'b', 'c']) assert.ok(fs.existsSync(path.join(out, id + '.json')));
});

test('SAFE_ID accepts plain ids only', () => {
  for (const ok of ['section-numbering', 'a', 'x.y_z-1']) assert.ok(SAFE_ID.test(ok), ok);
  for (const bad of ['', '../x', 'a/b', '-lead', 'UPPER', 'a b', '_summary']) assert.ok(!SAFE_ID.test(bad), bad);
});

test('health badge snippets point at our JSON and at that plugin in the Inspector', () => {
  const md = I.healthBadgeMarkdown('section-numbering');
  assert.match(md, /^\[!\[Plugin Inspector\]\(https:\/\/img\.shields\.io\/endpoint\?url=/);
  assert.ok(md.includes(encodeURIComponent('https://perezamadorluisenrique-gif.github.io/plugin-inspector/badge/section-numbering.json')));
  assert.ok(md.endsWith('(https://perezamadorluisenrique-gif.github.io/plugin-inspector/?q=section-numbering)'));
  assert.match(I.healthBadgeHtml('a b'), /q=a%20b/);
});

test('the "Add the badge" page uses the shared snippet code and writes only through .value', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'plugin-inspector', 'badge', 'index.html'), 'utf8');
  assert.match(html, /<script src="\.\.\/inspect\.js">/);
  assert.match(html, /I\.healthBadgeMarkdown\(id\)/);
  assert.doesNotMatch(html, /innerHTML/);
  assert.match(html, /<h1>Add the Plugin Inspector badge<\/h1>/);
});

test('the daily workflow generates the badges into the deployed folder and the live check reads one', () => {
  const wf = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'pages.yml'), 'utf8');
  assert.match(wf, /plugin-inspector\/badges\.js --out _site\/plugin-inspector\/badge/);
  assert.match(wf, /plugin-inspector\/badge\/section-numbering\.json/);
});
