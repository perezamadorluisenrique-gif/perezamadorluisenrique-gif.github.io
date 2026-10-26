// Checks for the Obsidian Plugin Inspector's logic (plugin-inspector/inspect.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const I = require('../plugin-inspector/inspect.js');

const PLUGINS = [
  { id: 'dataview', name: 'Dataview', author: 'Michael Brenan', description: 'Complex data views for the data-obsessed.', repo: 'blacksmithgu/obsidian-dataview' },
  { id: 'section-numbering', name: 'Section Numbering', author: 'Siulved54', description: 'Number headings as an outline and keep links working.', repo: 'perezamadorluisenrique-gif/section-numbering' },
  { id: 'number-headings-obsidian', name: 'Number Headings', author: 'k', description: 'Automatically number or re-number headings in an Obsidian document.', repo: 'k/number-headings' },
  { id: 'calendar', name: 'Calendar', author: 'Liam', description: 'Calendar view of your daily notes.', repo: 'liamcain/obsidian-calendar-plugin' },
];
const STATS = {
  dataview: { downloads: 3000000, updated: 1, '0.5.9': 10, '0.5.10': 20, '0.5.2': 5 },
  'section-numbering': { downloads: 2667, updated: 2, '0.1.0': 96, '0.8.2': 197 },
  'number-headings-obsidian': { downloads: 90000, updated: 3 },
  calendar: { downloads: 1500000, updated: 4 },
};

test('parseQuery tells ids from repos and URLs', () => {
  assert.deepStrictEqual(I.parseQuery(' Dataview '), { id: 'dataview' });
  assert.deepStrictEqual(I.parseQuery('owner/repo'), { repo: 'owner/repo' });
  assert.deepStrictEqual(I.parseQuery('https://github.com/owner/my.repo.git'), { repo: 'owner/my.repo' });
  assert.deepStrictEqual(I.parseQuery('github.com/owner/repo/releases'), { repo: 'owner/repo' });
  assert.deepStrictEqual(I.parseQuery(''), {});
});

test('versionsOf sorts numerically and drops the totals', () => {
  assert.deepStrictEqual(I.versionsOf(STATS.dataview).map((v) => v.version), ['0.5.2', '0.5.9', '0.5.10']);
  assert.deepStrictEqual(I.versionsOf(undefined), []);
  assert.deepStrictEqual(I.versionsOf({ downloads: 9, updated: 1, '1.0.0': 3, 'build/main.js': 2, '2.0.0-beta.1': 1 }).map((v) => v.version), ['1.0.0', '2.0.0-beta.1']);
  assert.ok(I.compareVersions('1.0.0-beta', '1.0.0') !== 0);
});

test('ranks orders by downloads', () => {
  const r = I.ranks(STATS);
  assert.strictEqual(r.get('dataview'), 1);
  assert.strictEqual(r.get('calendar'), 2);
  assert.strictEqual(r.get('section-numbering'), 4);
});

test('search: exact, then prefix, then substring, ties by downloads', () => {
  assert.strictEqual(I.search('dataview', PLUGINS, STATS)[0].id, 'dataview');
  assert.deepStrictEqual(I.search('num', PLUGINS, STATS).map((p) => p.id), ['number-headings-obsidian', 'section-numbering']);
  assert.deepStrictEqual(I.search('siulved54', PLUGINS, STATS).map((p) => p.id), ['section-numbering']);
  assert.deepStrictEqual(I.search('', PLUGINS, STATS), []);
});

test('similar finds the plugin doing the same job and skips itself', () => {
  const sims = I.similar(PLUGINS[1], PLUGINS);
  assert.strictEqual(sims[0].plugin.id, 'number-headings-obsidian');
  assert.ok(sims.every((s) => s.plugin.id !== 'section-numbering'));
});

const GOOD = { id: 'demo-tool', name: 'Demo Tool', version: '1.2.3', minAppVersion: '1.4.0', description: 'Does one thing well.', author: 'me', isDesktopOnly: false };
const levels = (checks) => checks.filter((c) => c.level !== 'pass').map((c) => c.level + ': ' + c.label);

test('a good manifest passes every check', () => {
  assert.deepStrictEqual(levels(I.checkManifest(GOOD, { ids: new Set(['dataview']), names: new Set(), removed: new Set() })), []);
});

test('the review rules on manifest.json', () => {
  const bad = { ...GOOD, id: 'My_Obsidian', name: 'Cool Plugin', description: 'This plugin does things', version: 'v1.2', isDesktopOnly: undefined };
  const out = levels(I.checkManifest(bad, {}));
  for (const want of ['fail: No "obsidian" in id', 'fail: No "plugin" in name', 'fail: No "plugin" in description', 'fail: id format',
    'warn: Description ends with punctuation', 'warn: Description starts with an action', 'fail: version is x.y.z', 'warn: isDesktopOnly is set']) {
    assert.ok(out.includes(want), `missing "${want}" in ${JSON.stringify(out)}`);
  }
  assert.strictEqual(I.checkManifest(null)[0].level, 'fail');
});

test('pre-submission: taken and removed ids, duplicate names', () => {
  const ctx = { ids: new Set(['demo-tool']), names: new Set(['demo tool']), removed: new Set(['demo-tool']) };
  const out = levels(I.checkManifest(GOOD, ctx));
  assert.ok(out.includes('fail: id is free'));
  assert.ok(out.includes('fail: id was never removed'));
  assert.ok(out.includes('warn: Name is unique'));
  assert.ok(levels(I.checkManifest(GOOD, { listed: { id: 'other' } })).includes('fail: id matches the directory entry'));
});

test('release checks: tag, assets, versions.json, README and LICENSE', () => {
  const ok = I.checkRepo({
    manifest: GOOD, versions: { '1.2.3': '1.4.0' }, license: 'MIT', readme: '![shot](a.png)\n' + 'x'.repeat(700),
    release: { tag_name: '1.2.3', assets: [{ name: 'main.js' }, { name: 'manifest.json' }] },
  });
  assert.deepStrictEqual(levels(ok), []);
  const bad = levels(I.checkRepo({ manifest: GOOD, versions: null, license: null, readme: 'short', release: { tag_name: 'v1.2.3', assets: [{ name: 'main.js' }], prerelease: true } }));
  for (const want of ['warn: versions.json', 'fail: Release tag equals manifest version', 'fail: Release has manifest.json', 'warn: Release is published', 'warn: LICENSE file', 'warn: README shows an image', 'warn: README explains the plugin']) {
    assert.ok(bad.includes(want), `missing "${want}" in ${JSON.stringify(bad)}`);
  }
  assert.deepStrictEqual(levels(I.checkRepo({ manifest: GOOD, release: null })), ['fail: A GitHub release exists']);
  assert.deepStrictEqual(levels(I.checkRepo({ manifest: GOOD, release: { error: 'rate limit' } })), ['warn: Latest release']);
});

test('badge markdown reads the directory stats for that id', () => {
  const md = I.badgeMarkdown('section-numbering');
  assert.match(md, /^\[!\[Obsidian downloads\]\(https:\/\/img\.shields\.io\/badge\/dynamic\/json\?/);
  assert.ok(md.includes(encodeURIComponent("$['section-numbering'].downloads")));
  assert.ok(md.includes(encodeURIComponent('community-plugin-stats.json')));
});

test('ago and formatNumber', () => {
  const now = Date.UTC(2026, 9, 26);
  assert.strictEqual(I.ago(now - 3 * 86400000, now), '3 days ago');
  assert.strictEqual(I.ago(now - 86400000, now), '1 day ago');
  assert.strictEqual(I.ago(now, now), 'just now');
  assert.strictEqual(I.formatNumber(1234567), '1,234,567');
});

test('the page never injects external text as HTML', () => {
  const html = fs.readFileSync(path.join(__dirname, '../plugin-inspector/index.html'), 'utf8');
  assert.doesNotMatch(html, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /name="viewport"/);
});

test('the Pages deploy ships the inspector and the landing page links it', () => {
  const yml = fs.readFileSync(path.join(__dirname, '../.github/workflows/pages.yml'), 'utf8');
  assert.match(yml, /cp -r [^\n]*plugin-inspector[^\n]*_site\//);
  assert.ok(fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').includes('href="/plugin-inspector/"'));
});
