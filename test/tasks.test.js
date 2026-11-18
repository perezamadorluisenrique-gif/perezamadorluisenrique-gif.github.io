// Checks for the "plugins by task" guides: facts only from the directory data, both languages valid.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const loadBuild = () => import('../catalog/build.mjs');
const loadTasks = () => import('../catalog/tasks.mjs');
const root = path.join(__dirname, '..', 'catalog');

const dirList = [
  { id: 'demo', name: 'Demo', author: 'Siulved54', description: 'Does a demo thing in your vault.', repo: 'o/demo' },
  { id: 'big-rival', name: 'Big Rival 2', author: 'Someone', description: 'Does the same demo thing. - This plugin has not been manually reviewed by Obsidian staff.', repo: 's/big-rival' },
  { id: 'small-rival', name: 'Small Rival', author: 'Other', description: 'Also does it.', repo: 'x/small-rival' },
];
const stats = {
  demo: { downloads: 42, updated: Date.UTC(2026, 10, 2), '1.2.3': 42 },
  'big-rival': { downloads: 123456, updated: Date.UTC(2022, 5, 17), '1.0.18': 100 },
  'small-rival': { downloads: 77, updated: Date.UTC(2026, 9, 5), '0.3.1': 5 },
};
const page = { slug: 'demo-task', ours: ['demo'], others: ['small-rival', 'big-rival'], en: { title: 'Obsidian plugins to do the demo', lead: 'Do the demo thing quickly.' }, es: { title: 'Plugins de Obsidian para hacer la demo', lead: 'Haz la demo rápido.' } };

function makeSource() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-'));
  const local = path.join(tmp, 'src');
  fs.mkdirSync(path.join(local, 'demo'), { recursive: true });
  fs.writeFileSync(path.join(local, 'demo', 'manifest.json'), JSON.stringify({ id: 'demo', name: 'Demo', version: '1.2.3', minAppVersion: '1.4.0', description: 'Does a demo thing in your vault, with enough words to be a decent description.', author: 'Siulved54', isDesktopOnly: false }));
  fs.writeFileSync(path.join(local, 'demo', 'README.md'), '# Demo\n\nA short intro paragraph that explains the plugin in plain words.\n');
  return { tmp, local };
}

test('a task page lists ours first, the others by downloads, with numbers only from the facts', async () => {
  const { build, validate } = await loadBuild();
  const { renderTask, unsupportedNumbers } = await loadTasks();
  const { tmp, local } = makeSource();
  const out = path.join(tmp, 'out');
  const r = await build({
    out, local, dirList, stats, directory: new Set(['demo']), log: () => {}, ffmpeg: false, date: '2026-11-17',
    products: [{ slug: 'demo', kind: 'obsidian', repo: 'demo', name: 'Demo' }],
    alternatives: [], tasks: [page],
  });
  assert.strictEqual(r.tasks.length, 1);
  const rows = r.tasks[0].rows;
  assert.deepStrictEqual(rows.map((x) => x.id), ['demo', 'big-rival', 'small-rival']);
  for (const lang of ['en', 'es']) {
    const html = renderTask(page, rows, lang, '2026-11-17', r.products);
    assert.deepStrictEqual(unsupportedNumbers(html, rows, '2026-11-17'), [], lang);
    assert.match(html, lang === 'es' ? /123\.456/ : /123,456/);
    assert.ok(!/reviewed by Obsidian staff/.test(html));
    assert.deepStrictEqual(unsupportedNumbers(html.replace('<h1>', '<p>Over 9,999 users.</p><h1>'), rows, '2026-11-17'), ['9,999'], 'a claim that is not in the data is caught');
  }
  assert.deepStrictEqual(validate(out).errors, []);
  for (const f of ['catalog/tasks/demo-task/index.html', 'catalog/es/tareas/demo-task/index.html', 'catalog/tasks/index.html', 'catalog/es/tareas/index.html']) assert.ok(fs.existsSync(path.join(out, f)), f);
  assert.match(fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8'), /catalog\/es\/tareas\/demo-task\//);
  assert.match(fs.readFileSync(path.join(out, 'catalog/demo/index.html'), 'utf8'), /href="\/catalog\/tasks\/demo-task\/"/);
  assert.match(fs.readFileSync(path.join(out, 'catalog/es/demo/index.html'), 'utf8'), /href="\/catalog\/es\/tareas\/demo-task\/"/);
});

test('a missing plugin skips its guide and the build still finishes', async () => {
  const { build, validate } = await loadBuild();
  const { tmp, local } = makeSource();
  const out = path.join(tmp, 'out');
  const r = await build({
    out, local, dirList, stats, directory: new Set(['demo']), log: () => {}, ffmpeg: false,
    products: [{ slug: 'demo', kind: 'obsidian', repo: 'demo', name: 'Demo' }],
    alternatives: [], tasks: [{ ...page, others: ['not-in-directory'] }],
  });
  assert.strictEqual(r.tasks.length, 0);
  assert.ok(r.warns.some((w) => /tasks\/demo-task: missing data/.test(w)));
  assert.deepStrictEqual(validate(out).errors, []);
});

test('tasks.json: unique slugs, real catalog products, both languages, no digits in the written text', () => {
  const conf = JSON.parse(fs.readFileSync(path.join(root, 'tasks.json'), 'utf8')).pages;
  const prods = JSON.parse(fs.readFileSync(path.join(root, 'products.json'), 'utf8')).products;
  assert.ok(conf.length >= 10, 'at least ten guides');
  assert.strictEqual(new Set(conf.map((p) => p.slug)).size, conf.length);
  for (const p of conf) {
    assert.ok(p.ours.length >= 1 && p.others.length >= 2, p.slug + ' lists ours and at least two others');
    for (const o of p.ours) assert.ok(prods.some((x) => x.slug === o && x.kind === 'obsidian'), p.slug + ' ' + o);
    assert.strictEqual(new Set([...p.others]).size, p.others.length);
    for (const lang of ['en', 'es']) {
      assert.ok(p[lang].title.length > 10 && p[lang].title.length <= 70, p.slug + ' ' + lang + ' title length');
      assert.ok(p[lang].lead.length > 20);
      assert.ok(!/\d/.test(p[lang].title + p[lang].lead), p.slug + ' ' + lang + ' has a number in hand-written text');
    }
  }
});

test('alternatives.json reaches at least forty pages', () => {
  const conf = JSON.parse(fs.readFileSync(path.join(root, 'alternatives.json'), 'utf8')).pages;
  assert.ok(conf.length >= 40, String(conf.length));
});
