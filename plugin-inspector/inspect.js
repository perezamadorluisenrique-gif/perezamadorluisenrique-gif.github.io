// Obsidian Plugin Inspector: pure logic shared by the page and the Node tests.
// No DOM and no network here; the page fetches, this file reasons.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Inspect = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RAW = 'https://raw.githubusercontent.com/';
  var DIRECTORY = RAW + 'obsidianmd/obsidian-releases/HEAD/';
  var FORBIDDEN = ['obsidian', 'plugin'];
  var STOP = new Set(('a an and are as at be by can for from in into is it its of on or that the this to with your you ' +
    'obsidian plugin plugins note notes vault file files add adds allow allows using use simple easily easy').split(' '));

  // "owner/repo", a GitHub URL, or a plugin id. Returns {repo} or {id}.
  function parseQuery(input) {
    var q = String(input || '').trim();
    var url = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#]|$)/i.exec(q);
    if (url) return { repo: url[1] + '/' + url[2] };
    if (/^[\w.-]+\/[\w.-]+$/.test(q)) return { repo: q.replace(/\.git$/, '') };
    return q ? { id: q.toLowerCase() } : {};
  }

  // Versions in a stats entry, sorted ascending by semver-ish comparison.
  function versionsOf(stat) {
    if (!stat) return [];
    return Object.keys(stat)
      .filter(function (k) { return /^v?\d+(\.\d+)*([-+][\w.]+)?$/.test(k); })
      .sort(compareVersions)
      .map(function (v) { return { version: v, downloads: stat[v] }; });
  }

  function compareVersions(a, b) {
    var pa = String(a).replace(/^v/, '').split(/[.-]/);
    var pb = String(b).replace(/^v/, '').split(/[.-]/);
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      var x = pa[i] === undefined ? -1 : pa[i];
      var y = pb[i] === undefined ? -1 : pb[i];
      var nx = Number(x), ny = Number(y);
      if (!isNaN(nx) && !isNaN(ny)) { if (nx !== ny) return nx - ny; }
      else if (String(x) !== String(y)) return String(x) < String(y) ? -1 : 1;
    }
    return 0;
  }

  // Rank of every plugin by total downloads: Map id -> 1-based rank.
  function ranks(stats) {
    var ids = Object.keys(stats).sort(function (a, b) { return (stats[b].downloads || 0) - (stats[a].downloads || 0); });
    var m = new Map();
    ids.forEach(function (id, i) { m.set(id, i + 1); });
    return m;
  }

  function tokens(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/)
      .filter(function (w) { return w.length > 2 && !STOP.has(w); })
      .map(function (w) { return w.replace(/(ies)$/, 'y').replace(/([^s])s$/, '$1'); });
  }

  // Plugins most like `target` by weighted word overlap of name and description
  // (rarer shared words weigh more), nudged towards plugins people actually use
  // when `stats` is given. Returns [{plugin, score}] best first.
  var indexCache = null;
  function wordIndex(plugins) {
    if (indexCache && indexCache.plugins === plugins) return indexCache;
    var df = new Map();
    var docs = plugins.map(function (p) {
      var set = new Set(tokens(p.name + ' ' + p.name + ' ' + p.description));
      set.forEach(function (w) { df.set(w, (df.get(w) || 0) + 1); });
      return set;
    });
    indexCache = { plugins: plugins, df: df, docs: docs };
    return indexCache;
  }

  function similar(target, plugins, limit, stats) {
    limit = limit || 6;
    var idx = wordIndex(plugins);
    var mine = new Set(tokens(target.name + ' ' + target.name + ' ' + target.description));
    var n = plugins.length;
    var out = [];
    plugins.forEach(function (p, i) {
      if (p.id === target.id) return;
      var s = 0;
      mine.forEach(function (w) { if (idx.docs[i].has(w)) s += Math.log(n / (idx.df.get(w) || 1)); });
      if (s <= 0) return;
      var d = stats && stats[p.id] ? stats[p.id].downloads || 0 : 0;
      out.push({ plugin: p, score: (s / Math.sqrt(idx.docs[i].size + 1)) * (1 + 0.12 * Math.log10(1 + d)) });
    });
    return out.sort(function (a, b) { return b.score - a.score; }).slice(0, limit);
  }

  // Search the directory by id or name: exact first, then prefix, then substring.
  function search(query, plugins, stats, limit) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    var hits = [];
    plugins.forEach(function (p) {
      var id = p.id.toLowerCase(), name = p.name.toLowerCase();
      var tier = id === q || name === q ? 0 : id.indexOf(q) === 0 || name.indexOf(q) === 0 ? 1 :
        id.indexOf(q) >= 0 || name.indexOf(q) >= 0 ? 2 : (p.author || '').toLowerCase() === q ? 3 : -1;
      if (tier >= 0) hits.push({ p: p, tier: tier, d: (stats && stats[p.id] && stats[p.id].downloads) || 0 });
    });
    hits.sort(function (a, b) { return a.tier - b.tier || b.d - a.d; });
    return hits.slice(0, limit || 8).map(function (h) { return h.p; });
  }

  // Checks the directory and its review apply to manifest.json.
  // Each result: {level: 'pass'|'warn'|'fail', label, detail}.
  function checkManifest(m, ctx) {
    ctx = ctx || {};
    var r = [];
    if (!m || typeof m !== 'object') return [fail('manifest.json', 'Not found at the repository root on the default branch. The directory reads it from there.')];
    ['id', 'name', 'version', 'minAppVersion', 'description', 'author'].forEach(function (k) {
      if (!m[k]) r.push(fail('manifest.json has "' + k + '"', 'Required by the directory.'));
    });
    ['id', 'name', 'description'].forEach(function (k) {
      var v = String(m[k] || '').toLowerCase();
      var bad = FORBIDDEN.filter(function (w) { return v.indexOf(w) >= 0; });
      r.push(bad.length ? fail('No "' + bad.join('" or "') + '" in ' + k, 'The review rejects these words in id, name and description: "' + m[k] + '".') :
        pass('No "obsidian" or "plugin" in ' + k));
    });
    if (m.id) r.push(/^[a-z0-9-]+$/.test(m.id) ? pass('id uses lowercase letters, digits and dashes') : fail('id format', '"' + m.id + '" must use only lowercase letters, digits and dashes.'));
    var d = String(m.description || '').trim();
    if (d) {
      r.push(/[.!?)]$/.test(d) ? pass('Description ends with punctuation') : warn('Description ends with punctuation', 'The guidelines ask for a sentence ending in a period.'));
      r.push(d.length <= 250 ? pass('Description is ' + d.length + ' characters (≤ 250)') : warn('Description length', d.length + ' characters; keep it under 250.'));
      if (/^(this|a|an)\s+(plugin|tool)\b/i.test(d)) r.push(warn('Description starts with an action', 'Start with a verb ("Number headings...") rather than "This plugin...".'));
    }
    if (m.version && !/^\d+\.\d+\.\d+$/.test(m.version)) r.push(fail('version is x.y.z', '"' + m.version + '" is not plain semver.'));
    if (typeof m.isDesktopOnly !== 'boolean') r.push(warn('isDesktopOnly is set', 'Say explicitly whether the plugin works on mobile.'));
    if (ctx.listed && ctx.listed.id !== m.id) r.push(fail('id matches the directory entry', 'manifest says "' + m.id + '", the directory lists "' + ctx.listed.id + '".'));
    if (!ctx.listed && ctx.ids && m.id) {
      r.push(ctx.ids.has(m.id) ? fail('id is free', '"' + m.id + '" is already taken by another plugin in the directory.') : pass('id "' + m.id + '" is free in the directory'));
    }
    if (!ctx.listed && ctx.removed && ctx.removed.has(m.id)) r.push(fail('id was never removed', '"' + m.id + '" belongs to a plugin removed from the directory; pick another.'));
    if (!ctx.listed && ctx.names && m.name && ctx.names.has(m.name.toLowerCase())) r.push(warn('Name is unique', 'Another plugin is already called "' + m.name + '".'));
    return r;
  }

  // Checks on versions.json, the latest release and the repo files.
  function checkRepo(info) {
    var m = info.manifest || {};
    var r = [];
    if (info.versions === undefined) {}
    else if (!info.versions) r.push(warn('versions.json', 'Missing. Obsidian uses it to offer older users a version their app supports.'));
    else if (m.version && info.versions[m.version] === undefined) r.push(warn('versions.json lists ' + m.version, 'The current version is not in versions.json.'));
    else if (m.version) r.push(info.versions[m.version] === m.minAppVersion ? pass('versions.json matches manifest.json') :
      warn('versions.json matches manifest.json', 'versions.json says ' + info.versions[m.version] + ', manifest says minAppVersion ' + m.minAppVersion + '.'));
    var rel = info.release;
    if (rel === undefined) {}
    else if (rel === null) r.push(fail('A GitHub release exists', 'No published release. Obsidian installs from release assets, not from the repository files.'));
    else if (rel.error) r.push(warn('Latest release', rel.error));
    else {
      var tag = String(rel.tag_name || '');
      r.push(tag === m.version ? pass('Latest release tag is ' + tag) :
        fail('Release tag equals manifest version', 'Latest release is "' + tag + '" but manifest.json says "' + m.version + '"' + (tag === 'v' + m.version ? ' (drop the "v").' : '.')));
      var names = (rel.assets || []).map(function (a) { return a.name; });
      ['main.js', 'manifest.json'].forEach(function (f) {
        r.push(names.indexOf(f) >= 0 ? pass('Release has ' + f) : fail('Release has ' + f, 'Attach ' + f + ' as a release asset; Obsidian downloads it from there.'));
      });
      if (rel.draft || rel.prerelease) r.push(warn('Release is published', 'The latest release is a ' + (rel.draft ? 'draft' : 'pre-release') + '.'));
    }
    if (info.license !== undefined) r.push(info.license ? pass('LICENSE file') : warn('LICENSE file', 'No LICENSE at the root. The guidelines ask for one.'));
    if (info.readme !== undefined) {
      if (!info.readme) r.push(fail('README.md', 'The directory shows the README as the plugin page.'));
      else {
        r.push(/!\[[^\]]*\]\(|<img\s/i.test(info.readme) ? pass('README shows an image') : warn('README shows an image', 'A screenshot or GIF is what people look at first.'));
        r.push(info.readme.length >= 600 ? pass('README explains the plugin') : warn('README explains the plugin', 'Only ' + info.readme.length + ' characters. Say what it does, how to use it and its settings.'));
      }
    }
    return r;
  }

  function pass(label) { return { level: 'pass', label: label, detail: '' }; }
  function warn(label, detail) { return { level: 'warn', label: label, detail: detail }; }
  function fail(label, detail) { return { level: 'fail', label: label, detail: detail }; }

  function summary(checks) {
    var s = { pass: 0, warn: 0, fail: 0 };
    checks.forEach(function (c) { s[c.level]++; });
    return s;
  }

  // shields.io badge reading the directory's own stats file.
  function badgeMarkdown(id) {
    var url = DIRECTORY + 'community-plugin-stats.json';
    var src = 'https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads' +
      '&query=' + encodeURIComponent("$['" + id + "'].downloads") + '&url=' + encodeURIComponent(url);
    return '[![Obsidian downloads](' + src + ')](https://obsidian.md/plugins?id=' + encodeURIComponent(id) + ')';
  }

  function formatNumber(n) {
    return Number(n || 0).toLocaleString('en-US');
  }

  // "3 days ago", "5 months ago" from a ms timestamp.
  function ago(ms, now) {
    var s = Math.max(0, ((now || Date.now()) - ms) / 1000);
    var units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600]];
    for (var i = 0; i < units.length; i++) {
      var v = Math.floor(s / units[i][1]);
      if (v >= 1) return v + ' ' + units[i][0] + (v > 1 ? 's' : '') + ' ago';
    }
    return 'just now';
  }

  return {
    DIRECTORY: DIRECTORY, RAW: RAW,
    parseQuery: parseQuery, versionsOf: versionsOf, compareVersions: compareVersions, ranks: ranks,
    tokens: tokens, similar: similar, search: search, checkManifest: checkManifest, checkRepo: checkRepo,
    summary: summary, badgeMarkdown: badgeMarkdown, formatNumber: formatNumber, ago: ago,
  };
});
