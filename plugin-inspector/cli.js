#!/usr/bin/env node
// Obsidian Plugin Inspector as a command line: the same checks as the web page,
// run on a local folder (before you push) or on a GitHub repo. Zero dependencies, Node 18+.
// Usage: node cli.js <folder | owner/repo | github url> [--json] [--offline]
// Exit code: 1 if any check fails, 0 otherwise.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const I = require('./inspect.js');

const readText = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const readJson = (p) => { const t = readText(p); try { return t === null ? null : JSON.parse(t); } catch { return null; } };

async function getJson(url) {
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(r.status === 403 || r.status === 429 ? 'GitHub rate limit reached; try again later.' : 'HTTP ' + r.status);
  return r.json();
}
async function getText(url) {
  try { const r = await fetch(url); return r.ok ? r.text() : null; } catch { return null; }
}

// Directory context (ids, names, removed ids) so the id/name uniqueness checks work.
async function directory() {
  const [list, removed] = await Promise.all([
    getJson(I.DIRECTORY + 'community-plugins.json'),
    getJson(I.DIRECTORY + 'community-plugins-removed.json').catch(() => []),
  ]);
  return {
    plugins: list || [],
    ids: new Set((list || []).map((p) => p.id)),
    names: new Set((list || []).map((p) => String(p.name || '').toLowerCase())),
    removed: new Set((removed || []).map((p) => p.id)),
  };
}

// Local folder: files on disk, plus main.js, which the release must carry.
function gatherLocal(dir) {
  const manifest = readJson(path.join(dir, 'manifest.json'));
  const extra = [];
  if (fs.existsSync(path.join(dir, 'package.json')) && !fs.existsSync(path.join(dir, 'main.js'))) {
    extra.push({ level: 'warn', label: 'main.js is built', detail: 'No main.js in the folder; build it before tagging the release.' });
  }
  return {
    manifest,
    repoInfo: {
      manifest,
      versions: readJson(path.join(dir, 'versions.json')),
      readme: readText(path.join(dir, 'README.md')) ?? readText(path.join(dir, 'readme.md')),
      license: readText(path.join(dir, 'LICENSE')) ?? readText(path.join(dir, 'LICENSE.md')),
      // release: left undefined on purpose, there is no release to read locally
    },
    extra,
  };
}

async function gatherRemote(repo) {
  const raw = (f) => I.RAW + repo + '/HEAD/' + f;
  const [manifest, versions, readme, readme2, license, license2, release] = await Promise.all([
    getJson(raw('manifest.json')).catch(() => null),
    getJson(raw('versions.json')).catch(() => null),
    getText(raw('README.md')), getText(raw('readme.md')),
    getText(raw('LICENSE')), getText(raw('LICENSE.md')),
    getJson('https://api.github.com/repos/' + repo + '/releases/latest').catch((e) => ({ error: e.message })),
  ]);
  return {
    manifest,
    repoInfo: { manifest, versions, readme: readme ?? readme2, license: license ?? license2, release },
    extra: [],
  };
}

function run(gathered, ctx) {
  const { manifest, repoInfo, extra } = gathered;
  const listed = ctx.listed;
  return I.checkManifest(manifest, { listed, ids: ctx.ids, names: ctx.names, removed: ctx.removed })
    .concat(manifest ? I.checkRepo(repoInfo) : [], extra);
}

const ICON = { pass: '✓', warn: '!', fail: '✗' };
function format(checks, label) {
  const order = { fail: 0, warn: 1, pass: 2 };
  const sorted = checks.slice().sort((a, b) => order[a.level] - order[b.level]);
  const s = I.summary(checks);
  const lines = [label + ': ' + s.fail + ' fail, ' + s.warn + ' warn, ' + s.pass + ' pass'];
  for (const c of sorted) {
    if (c.level === 'pass') continue; // keep the output short: only what needs action
    lines.push('  ' + ICON[c.level] + ' ' + c.label + (c.detail ? ' - ' + c.detail : ''));
  }
  return lines.join('\n');
}

async function main(argv) {
  const args = argv.filter((a) => !a.startsWith('--'));
  const json = argv.includes('--json');
  const offline = argv.includes('--offline');
  if (!args.length || argv.includes('--help')) {
    console.log('Usage: plugin-inspector <folder | owner/repo | github url> [--json] [--offline]\n  --offline skips the directory lookup (id/name uniqueness).');
    return args.length ? 0 : 2;
  }
  const target = args[0];
  const isDir = fs.existsSync(target) && fs.statSync(target).isDirectory();
  let ctx = { ids: undefined, names: undefined, removed: undefined };
  if (!offline) {
    try { ctx = await directory(); } catch (e) { console.error('Directory lookup skipped: ' + e.message); }
  }
  let gathered, label;
  if (isDir) {
    gathered = gatherLocal(target);
    label = path.resolve(target);
    ctx.listed = undefined;
  } else {
    const q = I.parseQuery(target);
    if (!q.repo) { console.error('Not a folder or a GitHub repo: ' + target); return 2; }
    gathered = await gatherRemote(q.repo);
    label = q.repo;
    const hit = ctx.plugins && ctx.plugins.find((p) => p.repo.toLowerCase() === q.repo.toLowerCase());
    ctx.listed = hit;
  }
  const checks = run(gathered, ctx);
  console.log(json ? JSON.stringify({ target: label, summary: I.summary(checks), checks }, null, 2) : format(checks, label));
  return I.summary(checks).fail ? 1 : 0;
}

module.exports = { gatherLocal, run, format, main };
if (require.main === module) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(e.message); process.exit(2); });
