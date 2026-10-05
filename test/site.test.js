// Checks for the user site: the asset links file Android reads, and the landing page.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// The three app packages from apk-plan.md. Asset links may only name these.
const PACKAGES = new Set([
  'io.github.perezamadorluisenrique.samepill',
  'io.github.perezamadorluisenrique.recallradar',
  'io.github.perezamadorluisenrique.certradar',
]);

test('assetlinks.json is valid Digital Asset Links', () => {
  const links = JSON.parse(read('.well-known/assetlinks.json'));
  assert.ok(Array.isArray(links), 'top level must be an array');
  for (const s of links) {
    assert.deepStrictEqual(s.relation, ['delegate_permission/common.handle_all_urls']);
    assert.strictEqual(s.target.namespace, 'android_app');
    assert.ok(PACKAGES.has(s.target.package_name), `unknown package ${s.target.package_name}`);
    assert.ok(s.target.sha256_cert_fingerprints.length > 0, 'each statement needs a fingerprint');
    for (const fp of s.target.sha256_cert_fingerprints) {
      assert.match(fp, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/, `bad SHA-256 fingerprint ${fp}`);
    }
  }
});

test('.nojekyll is present so GitHub Pages serves .well-known', () => {
  assert.ok(fs.existsSync(path.join(root, '.nojekyll')));
});

test('landing page links all three apps and their sources', () => {
  const html = read('index.html');
  for (const app of ['same-pill-new-look', 'recall-radar', 'cert-radar']) {
    assert.ok(html.includes(`href="/${app}/"`), `missing app link ${app}`);
    assert.ok(html.includes(`github.com/perezamadorluisenrique-gif/${app}"`), `missing repo link ${app}`);
  }
  assert.match(html, /<html lang="en">/);
  assert.match(html, /name="viewport"/);
});

test('landing page keeps the domain safety wording', () => {
  const html = read('index.html');
  assert.match(html, /confirm with your pharmacist/);
  assert.doesNotMatch(html, /\bis safe\b|\bare safe\b/i);
});

test('every local file the landing page references exists in this repo or is an app path', () => {
  const html = read('index.html');
  const refs = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1]);
  const appPaths = /^\/(same-pill-new-look|recall-radar|cert-radar)\//;
  for (const ref of refs) {
    if (appPaths.test(ref)) continue;
    assert.ok(fs.existsSync(path.join(root, ref)), `missing ${ref}`);
  }
});

test('stats.js only counts on the live host and never sends the query string', () => {
  const js = read('stats.js');
  assert.match(js, /location\.hostname !== 'perezamadorluisenrique-gif\.github\.io'/);
  assert.match(js, /encodeURIComponent\(location\.pathname\)/);
  assert.doesNotMatch(js, /location\.(search|href)/);
});
