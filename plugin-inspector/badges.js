#!/usr/bin/env node
// Writes one shields.io "endpoint" JSON per plugin in the Obsidian directory, so any author can
// show a "Plugin Inspector: healthy" badge in their README. Runs in the daily deploy.
//
//   node plugin-inspector/badges.js --out _site/plugin-inspector/badge [--limit 200] [--budget-min 8] [--concurrency 32]
//
// The badge summarises the manifest checks (the same ones as the Inspector page and CLI, minus the
// naming rules that only apply to new submissions) for
// the plugin's manifest.json on its default branch. A manifest that cannot be fetched gives
// "unknown", never "healthy". The release and README checks stay on the full Inspector page.
// Zero dependencies, Node 18+.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const I = require('./inspect.js');

const LABEL = 'Plugin Inspector';
// Ids become file names, so only plain ones are written.
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,99}$/;

function badge(message, color) {
  return { schemaVersion: 1, label: LABEL, message, color, cacheSeconds: 86400 };
}

// Pure: manifest (or null) + directory entry -> badge JSON.
function badgeFor(manifest, entry, ctx) {
  if (!manifest || typeof manifest !== 'object') return badge('unknown', 'lightgrey');
  // The "no obsidian/plugin in the name" rules only gate new submissions; plugins already listed are not marked down for them.
  const checks = I.checkManifest(manifest, Object.assign({ listed: entry }, ctx || {})).filter((c) => !/^No "/.test(c.label));
  const s = I.summary(checks);
  if (s.fail) return badge(s.fail + (s.fail === 1 ? ' issue' : ' issues'), 'red');
  if (s.warn) return badge(s.warn + (s.warn === 1 ? ' note' : ' notes'), 'yellow');
  return badge('healthy', 'brightgreen');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchManifest(repo, fetchImpl) {
  const url = I.RAW + repo + '/HEAD/manifest.json';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetchImpl(url);
      if (r.status === 404) return null;
      if (r.status === 429 || r.status >= 500) { await sleep(1000 * (attempt + 1)); continue; }
      if (!r.ok) return null;
      return JSON.parse(await r.text());
    } catch (e) {
      await sleep(500 * (attempt + 1));
    }
  }
  return null;
}

// plugins: community-plugins.json entries. Returns counts; files are written to outDir.
async function generate({ plugins, outDir, fetchImpl = fetch, concurrency = 32, budgetMs = 8 * 60 * 1000, now = Date.now }) {
  fs.mkdirSync(outDir, { recursive: true });
  const started = now();
  const counts = { total: 0, healthy: 0, notes: 0, issues: 0, unknown: 0, skipped: 0, outOfTime: 0 };
  let next = 0;
  const write = (id, b) => {
    fs.writeFileSync(path.join(outDir, id + '.json'), JSON.stringify(b) + '\n');
    counts.total++;
    if (b.message === 'healthy') counts.healthy++;
    else if (b.message === 'unknown') counts.unknown++;
    else if (b.color === 'red') counts.issues++;
    else counts.notes++;
  };
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= plugins.length) return;
      const p = plugins[i];
      if (!p || !SAFE_ID.test(String(p.id)) || !/^[\w.-]+\/[\w.-]+$/.test(String(p.repo || ''))) { counts.skipped++; continue; }
      if (now() - started > budgetMs) { counts.outOfTime++; write(p.id, badge('unknown', 'lightgrey')); continue; }
      write(p.id, badgeFor(await fetchManifest(p.repo, fetchImpl), p));
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  fs.writeFileSync(path.join(outDir, '_summary.json'), JSON.stringify(Object.assign({ generated: new Date(now()).toISOString().slice(0, 10) }, counts)) + '\n');
  return counts;
}

async function main(argv) {
  const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const out = arg('--out');
  if (!out) { console.error('Usage: badges.js --out <dir> [--limit n] [--budget-min m] [--concurrency c]'); return 2; }
  const r = await fetch(I.DIRECTORY + 'community-plugins.json');
  if (!r.ok) { console.error('Directory unavailable: HTTP ' + r.status); return 1; }
  let plugins = await r.json();
  if (arg('--limit')) plugins = plugins.slice(0, Number(arg('--limit')));
  const t0 = Date.now();
  const counts = await generate({ plugins, outDir: path.resolve(out), concurrency: Number(arg('--concurrency', 32)), budgetMs: Number(arg('--budget-min', 8)) * 60000 });
  console.log('badges: ' + JSON.stringify(counts) + ' in ' + Math.round((Date.now() - t0) / 1000) + 's');
  return 0;
}

module.exports = { badgeFor, generate, SAFE_ID };
if (require.main === module) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(e.message); process.exit(1); });
