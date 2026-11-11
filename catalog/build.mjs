#!/usr/bin/env node
// Builds the product catalog: one static page per free product, an index,
// sitemap.xml and robots.txt. Everything comes from each product's own manifest
// and README (or the wordpress.org API), so a release is reflected on the next run.
//
//   node catalog/build.mjs --out _site                 # reads GitHub (CI)
//   node catalog/build.mjs --out _site --local ~/code  # reads sibling clones, no network except the Obsidian directory
//
// Pro products are deliberately absent: no prices and no sales copy here.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { T, tr } from './i18n.mjs';
import { pluginFacts, renderAlternative, renderAlternativesIndex } from './alternatives.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SITE = 'https://perezamadorluisenrique-gif.github.io';

// ---------- small text helpers ----------
export const esc = (s) =>
	String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Inline Markdown to HTML. Escapes first, so source text can never inject markup.
export function inline(md, base = '') {
	let s = esc(md);
	s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
	s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
	s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
	s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => (base && !/^(#|\.|\/)/.test(u) ? `<a href="${base}${u}" rel="noopener">${t}</a>` : t));
	return s;
}

export const plain = (md) =>
	md
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/[`*_]/g, '')
		.replace(/\s+/g, ' ')
		.trim();

const decode = (s) =>
	s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ');

const stripTags = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// Anything about paid editions stays out of the catalog (Pro sales are paused).
const PAID = /\bpro\b|pricing|\bprice|\bUSD\b|\$\s?\d|purchase|licen[cs]e key|buy\b|coming soon/i;
const SKIP_HEADING = /pro\b|pricing|licen[cs]e|develop|build|contribut|install|translat|changelog|support|more plugins|privacy|network|disclos|settings|command|faq/i;

export function short(t) {
	const m = /^(.{25,110}?[.!?])(\s|$)/.exec(t);
	return m ? m[1] : clip(t, 100);
}

export function clip(s, n) {
	if (s.length <= n) return s;
	const cut = s.slice(0, n - 1);
	return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\s]+$/, '') + '…';
}

// ---------- README parsing ----------
export function parseReadme(md) {
	const lines = md.replace(/\r/g, '').replace(/<img\b[^>]*>/gi, (t) => t.replace(/\s*\n\s*/g, ' ')).split('\n');
	const intro = [];
	const features = [];
	const images = [];
	let fence = false;
	let section = '';
	let para = [];
	let seenH2 = false;
	let list = null;
	const flush = () => {
		if (para.length && !seenH2) {
			const t = para.join(' ').replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1').trim();
			if (t && !PAID.test(t) && intro.length < 3 && !/^(\*\*)?interface languages/i.test(t)) intro.push(t);
		}
		para = [];
	};
	const lists = [];
	const flushList = () => {
		if (list && list.length >= 3 && !SKIP_HEADING.test(section)) lists.push({ section, items: list.filter((it) => !PAID.test(it)) });
		list = null;
	};
	for (const raw of lines) {
		const line = raw.trimEnd();
		if (/^\s*(```|~~~)/.test(line)) {
			fence = !fence;
			flush();
			flushList();
			continue;
		}
		if (fence) continue;
		for (const m of line.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)) images.push({ alt: m[1], url: m[2] });
		const tag = /<img\b[^>]*>/i.exec(line);
		if (tag) {
			const u = /\bsrc="([^"]+)"/i.exec(tag[0]);
			const a = /\balt="([^"]*)"/i.exec(tag[0]);
			if (u) images.push({ alt: a ? a[1] : '', url: u[1] });
		}
		const h = /^(#{1,6})\s+(.*)$/.exec(line);
		if (h) {
			flush();
			flushList();
			if (h[1].length === 2) seenH2 = true;
			if (h[1].length >= 2) section = h[2];
			continue;
		}
		const li = /^\s{0,3}[-*]\s+(.*)$/.exec(line);
		if (li) {
			flush();
			(list ||= []).push(li[1].trim());
			continue;
		}
		if (list && /^\s+\S/.test(line) && list.length) {
			list[list.length - 1] += ' ' + line.trim();
			continue;
		}
		if (!line.trim()) {
			flush();
			flushList();
			continue;
		}
		flushList();
		if (/^\s*(<|\[!\[|!\[|\|)/.test(line) || /^\s*>/.test(line) || /^\s*\[[^\]]+\]:\s+\S+/.test(line)) continue;
		para.push(line.trim());
	}
	flush();
	flushList();
	// Highlights: a list under a "why / features / what" heading, else the first list of real sentences.
	const avg = (l) => l.items.reduce((n, i) => n + i.length, 0) / (l.items.length || 1);
	const good = lists.filter((l) => l.items.length >= 3 && avg(l) >= 45);
	const pick = good.find((l) => /why|feature|what|highlight|includes|how it works|capabilit/i.test(l.section)) || good[0];
	if (pick) features.push(...pick.items.slice(0, 7));
	return { intro, features, images };
}

// ---------- wordpress.org ----------
export function parseWp(info) {
	const desc = (info.sections && info.sections.description) || '';
	const paras = [...desc.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => stripTags(m[1])).filter((t) => t && !PAID.test(t));
	const lis = [...desc.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => stripTags(m[1])).filter((t) => !PAID.test(t));
	const shots = Object.values(info.screenshots || {}).map((s) => ({ url: s.src, alt: stripTags(s.caption || '') }));
	return { intro: paras.slice(0, 3), features: lis.slice(0, 7), shots };
}

// ---------- sources ----------
export function makeSource({ local, owner }) {
	const raw = (repo, p) => `https://raw.githubusercontent.com/${owner}/${repo}/main/${p}`;
	async function getBuf(url) {
		const r = await fetch(url, { headers: { 'user-agent': 'catalog-build' } });
		if (!r.ok) throw Object.assign(new Error(`${r.status} ${url}`), { status: r.status });
		return Buffer.from(await r.arrayBuffer());
	}
	return {
		async file(repo, p) {
			if (local) {
				const f = path.join(local, repo, p);
				if (!fs.existsSync(f)) throw Object.assign(new Error(`missing ${f}`), { status: 404 });
				return fs.readFileSync(f);
			}
			return getBuf(raw(repo, p));
		},
		async text(repo, p) {
			return (await this.file(repo, p)).toString('utf8');
		},
		async url(u) {
			return getBuf(u);
		},
		async json(u) {
			return JSON.parse((await getBuf(u)).toString('utf8'));
		},
		owner,
	};
}

// A README image URL as a path inside the repo, or null when it points elsewhere.
export function repoPath(url, owner, repo) {
	const m = new RegExp(`^https://raw\\.githubusercontent\\.com/${owner}/${repo}/(?:main|master)/(.+)$`).exec(url);
	if (m) return m[1];
	if (/^[a-z]+:/i.test(url)) return null;
	return url.replace(/^\.?\//, '');
}

export function pickMedia(images, owner, repo, mediaFrom) {
	if (mediaFrom) return { path: mediaFrom, alt: '' };
	const own = images
		.filter((i) => !/shields\.io|badge|actions\/workflows/i.test(i.url))
		.map((i) => ({ path: repoPath(i.url, owner, repo), alt: i.alt }))
		.filter((i) => i.path && /\.(gif|png|jpe?g|webp|svg)$/i.test(i.path));
	return own.find((i) => /\.gif$/i.test(i.path)) || own[0] || null;
}

// ---------- ffmpeg ----------
export const hasFfmpeg = () => spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
function ff(args) {
	const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...args], { encoding: 'utf8' });
	return r.status === 0;
}

// Writes the page media into outDir/media and returns what the page needs.
export function prepareMedia(slug, file, ext, outDir, curatedMp4, ffmpeg) {
	const media = path.join(outDir, 'media');
	fs.mkdirSync(media, { recursive: true });
	const res = { video: null, image: null, thumb: null, og: null };
	const tmp = path.join(media, `.${slug}.src${ext || '.bin'}`);
	if (file) fs.writeFileSync(tmp, file);
	let still = file ? tmp : null;
	let still2 = null;
	if (curatedMp4) {
		fs.copyFileSync(curatedMp4, path.join(media, `${slug}.mp4`));
		res.video = `media/${slug}.mp4`;
		if (ffmpeg && ff(['-ss', '1', '-i', curatedMp4, '-frames:v', '1', path.join(media, `.${slug}.frame.png`)])) {
			still = path.join(media, `.${slug}.frame.png`);
			still2 = still;
		}
	} else if (file && ext === '.gif' && ffmpeg) {
		const mp4 = path.join(media, `${slug}.mp4`);
		const ok = ff(['-i', tmp, '-movflags', '+faststart', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-crf', '24', '-an', mp4]);
		if (ok) res.video = `media/${slug}.mp4`;
	}
	if (still && ext !== '.svg' || still2) {
		if (ffmpeg) {
			const jpg = (name, w) => {
				const o = path.join(media, name);
				return ff(['-i', still, '-frames:v', '1', '-vf', `scale='min(${w},iw)':-2`, '-q:v', '4', o]) ? `media/${name}` : null;
			};
			res.thumb = jpg(`${slug}-thumb.jpg`, 480);
			res.og = jpg(`${slug}-og.jpg`, 1200);
		}
	}
	if (file && !res.thumb) {
		const name = `${slug}${ext}`;
		fs.writeFileSync(path.join(media, name), file);
		res.image = `media/${name}`;
		res.thumb = ext === '.svg' ? res.image : res.image;
		if (ext !== '.svg') res.og = res.image;
	} else if (file && ext !== '.gif') {
		const name = `${slug}${ext}`;
		fs.writeFileSync(path.join(media, name), file);
		res.image = `media/${name}`;
	} else if (file && ext === '.gif' && !res.video) {
		const name = `${slug}.gif`;
		fs.writeFileSync(path.join(media, name), file);
		res.image = `media/${name}`;
	}
	if (!res.image && res.thumb) res.image = res.og || res.thumb;
	for (const f of fs.readdirSync(media)) if (f.startsWith(`.${slug}.`)) fs.rmSync(path.join(media, f));
	return res;
}

// ---------- loading products ----------
const OBSIDIAN_DIRECTORY = 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json';
const OBSIDIAN_STATS = 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json';

export async function loadProduct(p, src, ctx) {
	const owner = src.owner;
	const out = {
		slug: p.slug,
		kind: p.kind,
		name: p.name,
		tagline: p.tagline || '',
		intro: p.intro || [],
		features: p.features || [],
		links: [],
		facts: [],
		mediaFile: null,
		mediaAlt: '',
		ext: '',
		repo: p.repo || null,
		web: p.web || null,
	};
	if (p.kind === 'wordpress') {
		const info = await src.json(`https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]=${p.wpSlug}`);
		if (info.error) throw Object.assign(new Error(info.error), { status: 404 });
		const w = parseWp(info);
		out.name = decode(info.name || p.name);
		out.version = info.version;
		out.intro = w.intro;
		out.features = w.features;
		out.tagline = clip(w.intro[0] || '', 160);
		out.install = { label: 'Install from wordpress.org', url: `https://wordpress.org/plugins/${p.wpSlug}/` };
		out.links.push({ label: 'Support forum', url: `https://wordpress.org/support/plugin/${p.wpSlug}/` });
		if (p.playground) out.links.push({ label: 'Try it in WordPress Playground', url: p.playground });
		out.facts.push(['Version', info.version], ['Requires WordPress', info.requires], ['Tested up to', info.tested], ['Requires PHP', info.requires_php]);
		if (info.active_installs) out.facts.push(['Active installs', `${info.active_installs.toLocaleString('en-US')}+`]);
		out.license = 'GPL-2.0-or-later';
		if (info.repository_url) out.repoUrl = info.repository_url;
		const shot = w.shots[0];
		if (shot) {
			out.mediaFile = await src.url(shot.url);
			out.mediaAlt = shot.alt;
			out.ext = path.extname(new URL(shot.url).pathname).toLowerCase();
		}
		out.category = 'WordPress plugins';
		out.appCategory = 'WebApplication';
		return out;
	}
	// GitHub-sourced products
	const readme = parseReadme(await src.text(p.repo, 'README.md'));
	let manifest = null;
	if (p.kind === 'obsidian') manifest = JSON.parse(await src.text(p.repo, 'manifest.json'));
	if (manifest) {
		out.name = manifest.name;
		out.tagline = manifest.description;
		out.version = manifest.version;
		out.id = manifest.id;
	}
	if (!p.intro) out.intro = readme.intro;
	if (!p.features) out.features = readme.features;
	const m = pickMedia(readme.images, owner, p.repo, p.mediaFrom);
	if (m) {
		try {
			out.mediaFile = await src.file(p.repo, m.path);
			out.mediaAlt = m.alt;
			out.ext = path.extname(m.path).toLowerCase();
		} catch (e) {
			ctx.warn(`${p.slug}: media ${m.path}: ${e.message}`);
		}
	}
	out.repoUrl = `https://github.com/${owner}/${p.repo}`;
	out.license = 'MIT';
	if (p.kind === 'obsidian') {
		const listed = ctx.directory.has(manifest.id);
		out.category = 'Obsidian plugins';
		out.appCategory = 'ProductivityApplication';
		out.install = listed
			? { label: 'Install from the Obsidian directory', url: `https://community.obsidian.md/plugins/${manifest.id}` }
			: { label: 'Download the latest release', url: `${out.repoUrl}/releases/latest` };
		if (listed) out.links.push({ label: 'Open in Obsidian', url: `obsidian://show-plugin?id=${manifest.id}` });
		out.facts.push(['Version', manifest.version], ['Needs Obsidian', `${manifest.minAppVersion} or newer`], ['Platforms', manifest.isDesktopOnly ? 'Desktop' : 'Desktop and mobile'], ['Author', manifest.author]);
		out.facts.push(['Price', 'Free and open source']);
		out.listed = listed;
	} else {
		out.category = p.kind === 'web' ? 'Web apps' : 'Developer tools';
		out.appCategory = p.kind === 'web' ? 'BrowserApplication' : 'DeveloperApplication';
		if (p.install) out.install = p.install;
		if (p.web) out.links.unshift({ label: 'Open in your browser', url: p.web });
		if (p.kind === 'web') out.install = { label: 'Open the web app', url: p.web };
		out.facts.push(['Price', 'Free and open source']);
	}
	out.links.push({ label: 'Source code and issues', url: out.repoUrl });
	return out;
}

// ---------- HTML ----------
const FAVICON =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%231f2937'/%3E%3Ccircle cx='16' cy='16' r='8' fill='none' stroke='%23fbbf24' stroke-width='3'/%3E%3Cpath d='M22 22 L27 27' stroke='%23fbbf24' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E";

// alts: [{ lang, url }] other-language versions of the page, used for hreflang and the language link.
export function head({ title, description, canonical, image, jsonld, lang = 'en', alts = [] }) {
	const t = T[lang];
	const hreflang = alts.length
		? [{ lang, url: canonical }, ...alts].map((a) => `<link rel="alternate" hreflang="${a.lang}" href="${a.url}">`).join('\n') +
			`\n<link rel="alternate" hreflang="x-default" href="${[{ lang, url: canonical }, ...alts].find((a) => a.lang === 'en').url}">\n`
		: '';
	const other = alts[0] ? `<a href="${alts[0].url.replace(SITE, '')}" hreflang="${alts[0].lang}" lang="${alts[0].lang}">${esc(T[alts[0].lang].otherLang)}</a>` : '';
	return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
${hreflang}<meta name="theme-color" content="#1f2937">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Hidden Problems Lab">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${FAVICON}">
<link rel="stylesheet" href="/catalog/catalog.css">
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<header class="top"><a class="brand" href="/">Hidden Problems Lab</a><nav aria-label="${t.main}"><a href="${lang === 'es' ? '/catalog/es/' : '/catalog/'}">${t.catalog}</a><a href="/plugin-inspector/">${t.inspector}</a>${other}</nav></header>
<main>
`;
}

export const footFor = (lang = 'en') => {
	const t = T[lang];
	const home = lang === 'es' ? '/catalog/es/' : '/catalog/';
	return `</main>
<footer><p>${t.footer}</p><p><a href="${home}">${t.allProducts}</a> · <a href="/">${t.lab}</a></p></footer>
</body>
</html>
`;
};
const foot = footFor('en');

// The six products worth a click from any page: the big ones and the three web apps.
export const SAME_AUTHOR = [
	{ slug: 'book-studio-web', href: '/catalog/book-studio-web/' },
	{ slug: 'update-radar', href: '/catalog/update-radar/' },
	{ slug: 'claimable', href: '/catalog/claimable/' },
	{ slug: 'cert-radar', href: '/cert-radar/', name: '47-Day Cert Radar', text: 'See every public TLS certificate for a domain and when each one breaks under the shorter lifetimes coming from 2026.' },
	{ slug: 'same-pill-new-look', href: '/same-pill-new-look/', name: 'Same Pill, New Look', text: 'Warns you when a refill comes from a different generic maker and will look different.' },
	{ slug: 'recall-radar', href: '/recall-radar/', name: 'RecallRadar', text: 'Checks products, food and cars you own against U.S. recalls.' },
];

export function renderSameAuthor(prods, selfSlug, lang = 'en') {
	const t = T[lang];
	const items = SAME_AUTHOR.filter((a) => a.slug !== selfSlug)
		.map((a) => {
			const p = prods.find((x) => x.slug === a.slug);
			const name = a.name || (p && p.name);
			const text = a.text || (p && short(p.tagline || p.intro[0] || ''));
			if (!name) return '';
			const href = lang === 'es' && a.href.startsWith('/catalog/') ? a.href.replace('/catalog/', '/catalog/es/') : a.href;
			return `<li><a href="${href}">${esc(name)}</a>: <span lang="en">${esc(text)}</span></li>`;
		})
		.filter(Boolean);
	if (!items.length) return '';
	return `<section class="same-author"><h2>${t.sameAuthor}</h2>\n<p>${t.sameAuthorLead}</p>\n<ul class="related">${items.join('')}</ul></section>\n`;
}

// opts: { lang, prods (all loaded products, for the same-author block), alt: { name, url } | null }
export function renderPage(prod, ctx, related, opts = {}) {
	const lang = opts.lang || 'en';
	const t = T[lang];
	const base = lang === 'es' ? `${SITE}/catalog/es/` : `${SITE}/catalog/`;
	const url = `${base}${prod.slug}/`;
	const enUrl = `${SITE}/catalog/${prod.slug}/`;
	const esUrl = `${SITE}/catalog/es/${prod.slug}/`;
	const noun = t.nouns[prod.kind];
	let title = t.titleOf(prod.name, noun);
	if (esc(title).length > 70) title = clip(esc(prod.name).length > 60 ? prod.name : `${prod.name}: ${lang === 'es' ? 'gratis' : 'free'}`, 66);
	const description = clip(prod.tagline || prod.intro[0] || prod.name, 158);
	const mediaBase = `/catalog/${prod.slug}/`;
	const mp = (f) => (lang === 'es' && f ? mediaBase + f : f);
	const image = prod.media && prod.media.og ? `${SITE}/catalog/${prod.slug}/${prod.media.og}` : `${SITE}/catalog/og-default.png`;
	const jsonld = {
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: prod.name,
		description,
		applicationCategory: prod.appCategory,
		operatingSystem: prod.kind === 'obsidian' ? 'Windows, macOS, Linux, iOS, Android (Obsidian)' : prod.kind === 'wordpress' ? 'WordPress' : 'Any',
		url,
		image,
		inLanguage: lang,
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
		license: prod.license === 'MIT' ? 'https://opensource.org/licenses/MIT' : 'https://www.gnu.org/licenses/gpl-2.0.html',
		author: { '@type': 'Organization', name: 'Hidden Problems Lab', url: SITE + '/' },
	};
	if (prod.version) jsonld.softwareVersion = prod.version;
	if (prod.repoUrl) jsonld.codeRepository = prod.repoUrl;
	const crumbs = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{ '@type': 'ListItem', position: 1, name: t.catalog, item: base },
			{ '@type': 'ListItem', position: 2, name: prod.name, item: url },
		],
	};
	const alts = [{ lang: lang === 'es' ? 'en' : 'es', url: lang === 'es' ? enUrl : esUrl }];
	let h = head({ title, description, canonical: url, image, jsonld: [jsonld, crumbs], lang, alts });
	const en = (s) => (lang === 'es' ? `<span lang="en">${s}</span>` : s);
	h += `<nav class="crumbs" aria-label="${t.breadcrumb}"><a href="${base}">${t.catalog}</a> <span aria-hidden="true">/</span> <span>${esc(t.categories[prod.category] || prod.category)}</span></nav>
<p class="eyebrow">${t.freeNoun(noun)}</p>
<h1>${esc(prod.name)}</h1>
<p class="lead">${en(esc(prod.tagline || prod.intro[0] || ''))}</p>
<p class="actions">`;
	if (prod.install) h += `<a class="btn" href="${esc(prod.install.url)}" rel="noopener">${esc(tr(lang, 'labels', prod.install.label))}</a>`;
	for (const l of prod.links.slice(0, 3)) h += ` <a class="btn alt" href="${esc(l.url)}" rel="noopener">${esc(tr(lang, 'labels', l.label))}</a>`;
	h += `</p>\n`;
	if (prod.media) {
		const alt = esc(prod.mediaAlt || `${prod.name} in use`);
		if (prod.media.video)
			h += `<figure class="media"><video autoplay loop muted playsinline controls preload="metadata"${prod.media.thumb ? ` poster="${mp(prod.media.thumb)}"` : ''} aria-label="${alt}"><source src="${mp(prod.media.video)}" type="video/mp4"><img src="${mp(prod.media.image)}" alt="${alt}"></video><figcaption>${alt}</figcaption></figure>\n`;
		else if (prod.media.image) h += `<figure class="media"><img src="${mp(prod.media.image)}" alt="${alt}" loading="lazy"><figcaption>${alt}</figcaption></figure>\n`;
	}
	h += `<section><h2>${t.what}</h2>\n`;
	if (lang === 'es') h += `<p class="note">${t.textLang}</p>\n`;
	for (const x of prod.intro) h += `<p${lang === 'es' ? ' lang="en"' : ''}>${inline(x)}</p>\n`;
	h += `</section>\n`;
	if (prod.features.length) h += `<section><h2>${t.highlights}</h2>\n<ul${lang === 'es' ? ' lang="en"' : ''}>${prod.features.map((f) => `<li>${inline(f)}</li>`).join('')}</ul></section>\n`;
	h += `<section><h2>${t.details}</h2>\n<dl class="facts">${prod.facts.filter((f) => f[1]).map(([k, v]) => `<dt>${esc(tr(lang, 'facts', k))}</dt><dd>${esc(tr(lang, 'labels', v))}</dd>`).join('')}</dl>\n`;
	if (prod.kind === 'obsidian' && !prod.listed) h += `<p class="note">${t.notListed(esc(prod.id))}</p>\n`;
	h += `</section>\n`;
	if (opts.alt) h += `<section><h2>${t.cameFrom(esc(opts.alt.name))}</h2>\n<p><a href="${opts.alt.url}">${t.cameFromLink}</a>.</p></section>\n`;
	if (related.length) {
		const rel = (r) => (lang === 'es' ? `/catalog/es/${r.slug}/` : `/catalog/${r.slug}/`);
		h += `<section><h2>${t.moreFree}</h2>\n<ul class="related">${related.map((r) => `<li><a href="${rel(r)}">${esc(r.name)}</a>: ${en(esc(short(r.tagline || r.intro[0] || '')))}</li>`).join('')}</ul></section>\n`;
	}
	if (opts.prods) h += renderSameAuthor(opts.prods, prod.slug, lang);
	return h + footFor(lang);
}

export function renderIndex(prods, lang = 'en') {
	const t = T[lang];
	const base = lang === 'es' ? `${SITE}/catalog/es/` : `${SITE}/catalog/`;
	const url = base;
	const title = t.indexTitle;
	const description = t.indexDesc(prods.length);
	const jsonld = {
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name: title,
		description,
		url,
		inLanguage: lang,
		mainEntity: {
			'@type': 'ItemList',
			itemListElement: prods.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${base}${p.slug}/`, name: p.name })),
		},
	};
	const alts = [{ lang: lang === 'es' ? 'en' : 'es', url: lang === 'es' ? `${SITE}/catalog/` : `${SITE}/catalog/es/` }];
	let h = head({ title, description, canonical: url, image: `${SITE}/catalog/og-default.png`, jsonld, lang, alts });
	h += `<h1>${t.indexH1}</h1>
<p class="lead">${t.indexLead(prods.length)}</p>
<p><label class="filter">${t.filter} <input id="q" type="search" placeholder="${t.filterPh}" autocomplete="off"></label></p>
`;
	for (const cat of ['Obsidian plugins', 'WordPress plugins', 'Developer tools', 'Web apps']) {
		const list = prods.filter((p) => p.category === cat);
		if (!list.length) continue;
		h += `<section class="group"><h2>${t.categories[cat]} <span class="count">${list.length}</span></h2>\n<ul class="cards">\n`;
		for (const p of list) {
			const thumb = p.media && p.media.thumb ? `<img src="/catalog/${p.slug}/${p.media.thumb}" alt="" width="240" height="150" loading="lazy">` : '<div class="ph" aria-hidden="true"></div>';
			h += `<li data-t="${esc((p.name + ' ' + (p.tagline || '')).toLowerCase())}"><a class="card" href="${base.replace(SITE, '')}${p.slug}/">${thumb}<span class="t">${esc(p.name)}</span><span class="d"${lang === 'es' ? ' lang="en"' : ''}>${esc(clip(p.tagline || p.intro[0] || '', 120))}</span></a></li>\n`;
		}
		h += `</ul></section>\n`;
	}
	h += `<script src="/catalog/catalog.js" defer></script>\n`;
	return h + footFor(lang);
}

export function renderSitemap(urls, date) {
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc><lastmod>${date}</lastmod></url>`).join('\n')}\n</urlset>\n`;
}

// Static checks on a finished build: the same things a crawler or Lighthouse would flag.
export function validate(out) {
	const errs = [];
	const pages = [];
	const walk = (d) => {
		for (const f of fs.readdirSync(d, { withFileTypes: true })) {
			const p = path.join(d, f.name);
			if (f.isDirectory()) walk(p);
			else if (f.name === 'index.html') pages.push(p);
		}
	};
	walk(path.join(out, 'catalog'));
	const sitemap = fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8');
	for (const p of pages) {
		const rel = path.relative(out, p);
		const h = fs.readFileSync(p, 'utf8');
		const need = (ok, msg) => ok || errs.push(`${rel}: ${msg}`);
		const title = /<title>([^<]+)<\/title>/.exec(h);
		need(title && title[1].length <= 70, 'title missing or over 70 chars');
		const d = /<meta name="description" content="([^"]*)"/.exec(h);
		need(d && d[1].length >= 50 && d[1].length <= 200, 'description missing or not 50-200 chars');
		need((h.match(/<h1[ >]/g) || []).length === 1, 'needs exactly one h1');
		for (const k of ['og:title', 'og:description', 'og:image', 'og:url']) need(h.includes(`property="${k}"`), `missing ${k}`);
		const can = /rel="canonical" href="([^"]+)"/.exec(h);
		need(can && sitemap.includes(`<loc>${can[1]}</loc>`), 'canonical not in sitemap');
		for (const m of h.matchAll(/<img\b[^>]*>/g)) need(/\balt="/.test(m[0]), 'img without alt');
		for (const m of h.matchAll(/application\/ld\+json">([\s\S]*?)<\/script>/g)) {
			try {
				JSON.parse(m[1]);
			} catch {
				errs.push(`${rel}: invalid JSON-LD`);
			}
		}
		const dir = path.dirname(p);
		for (const m of h.matchAll(/(?:src|poster|href)="([^"#:]+)"/g)) {
			const t = m[1];
			if (/^https?:|^\/\//.test(t) || (t.startsWith('/') && !t.startsWith('/catalog/'))) continue;
			const f = t.startsWith('/') ? path.join(out, t) : path.join(dir, t);
			if (!fs.existsSync(f)) errs.push(`${rel}: broken link ${t}`);
		}
	}
	return { pages: pages.length, errors: errs };
}

// ---------- main ----------
export async function build({ out, local, products, directory, dirList, stats, alternatives, log = console.log, ffmpeg = hasFfmpeg(), date = new Date().toISOString().slice(0, 10) }) {
	const conf = JSON.parse(fs.readFileSync(path.join(HERE, 'products.json'), 'utf8'));
	const src = makeSource({ local, owner: conf.owner });
	const warns = [];
	const ctx = { warn: (m) => (warns.push(m), log(`warn: ${m}`)), directory: new Set() };
	try {
		if (directory) ctx.directory = directory;
		else {
			dirList = dirList || (await src.json(OBSIDIAN_DIRECTORY));
			ctx.directory = new Set(dirList.map((p) => p.id));
		}
	} catch (e) {
		ctx.warn(`Obsidian directory unavailable (${e.message}); every plugin links to its release`);
	}
	const list = (products || conf.products).filter(Boolean);
	const loaded = [];
	for (const p of list) {
		try {
			loaded.push(await loadProduct(p, src, ctx));
		} catch (e) {
			if (p.optional && e.status === 404) {
				log(`skip ${p.slug}: not published yet`);
				continue;
			}
			throw new Error(`${p.slug}: ${e.message}`);
		}
	}
	const root = path.join(out, 'catalog');
	fs.rmSync(root, { recursive: true, force: true });
	fs.mkdirSync(root, { recursive: true });
	for (const f of ['catalog.css', 'catalog.js', 'og-default.png']) if (fs.existsSync(path.join(HERE, f))) fs.copyFileSync(path.join(HERE, f), path.join(root, f));
	const order = ['Obsidian plugins', 'WordPress plugins', 'Developer tools', 'Web apps'];
	loaded.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name));
	for (const prod of loaded) {
		const dir = path.join(root, prod.slug);
		fs.mkdirSync(dir, { recursive: true });
		const cur = path.join(HERE, 'video', `${prod.slug}.mp4`);
		prod.media = prod.mediaFile || fs.existsSync(cur) ? prepareMedia(prod.slug, prod.mediaFile, prod.ext, dir, fs.existsSync(cur) ? cur : null, ffmpeg) : null;
		delete prod.mediaFile;
	}
	// "Alternative to" pages. They need the directory files; if those are unreachable the pages are skipped, never half-written.
	const altConf = alternatives === undefined ? JSON.parse(fs.readFileSync(path.join(HERE, 'alternatives.json'), 'utf8')).pages : alternatives;
	const altItems = [];
	if (altConf.length) {
		try {
			dirList = dirList || (await src.json(OBSIDIAN_DIRECTORY));
			stats = stats || (await src.json(OBSIDIAN_STATS));
			for (const page of altConf) {
				const product = loaded.find((x) => x.slug === page.ours);
				const find = (id) => dirList.find((x) => x.id === id);
				const rival = pluginFacts(find(page.rival), stats[page.rival]);
				const oursId = product && product.id;
				const ours = oursId ? pluginFacts(find(oursId) || { id: oursId, name: product.name, author: 'Siulved54', description: product.tagline }, stats[oursId]) : null;
				if (!product || !rival || !ours) {
					ctx.warn(`alternatives/${page.slug}: missing data, page skipped`);
					continue;
				}
				ours.version = product.version || ours.version;
				altItems.push({ page, facts: { rival, ours, product } });
			}
		} catch (e) {
			ctx.warn(`alternatives skipped: ${e.message}`);
		}
	}
	const altFor = new Map(altItems.map((i) => [i.page.ours, i]));
	loaded.forEach((prod, i) => {
		const peers = loaded.filter((x) => x.category === prod.category && x !== prod);
		const k = peers.indexOf(loaded[(i + 1) % loaded.length]);
		const start = Math.max(0, k);
		const related = peers.length ? Array.from({ length: Math.min(4, peers.length) }, (_, j) => peers[(start + j) % peers.length]) : [];
		const a = altFor.get(prod.slug);
		for (const lang of ['en', 'es']) {
			const seg = lang === 'es' ? 'es/alternativas' : 'alternatives';
			const alt = a ? { name: a.facts.rival.name, url: `/catalog/${seg}/${a.page.slug}/` } : null;
			const dest = lang === 'es' ? path.join(root, 'es', prod.slug) : path.join(root, prod.slug);
			fs.mkdirSync(dest, { recursive: true });
			fs.writeFileSync(path.join(dest, 'index.html'), renderPage(prod, ctx, related, { lang, prods: loaded, alt }));
		}
	});
	fs.mkdirSync(path.join(root, 'es'), { recursive: true });
	fs.writeFileSync(path.join(root, 'index.html'), renderIndex(loaded));
	fs.writeFileSync(path.join(root, 'es', 'index.html'), renderIndex(loaded, 'es'));
	const altUrls = [];
	if (altItems.length) {
		for (const lang of ['en', 'es']) {
			const seg = lang === 'es' ? path.join('es', 'alternativas') : 'alternatives';
			const urlSeg = lang === 'es' ? 'es/alternativas' : 'alternatives';
			fs.mkdirSync(path.join(root, seg), { recursive: true });
			fs.writeFileSync(path.join(root, seg, 'index.html'), renderAlternativesIndex(altItems, lang));
			altUrls.push(`${SITE}/catalog/${urlSeg}/`);
			for (const it of altItems) {
				fs.mkdirSync(path.join(root, seg, it.page.slug), { recursive: true });
				fs.writeFileSync(path.join(root, seg, it.page.slug, 'index.html'), renderAlternative(it.page, it.facts, lang, date));
				altUrls.push(`${SITE}/catalog/${urlSeg}/${it.page.slug}/`);
			}
		}
	}
	const urls = [`${SITE}/`, `${SITE}/catalog/`, `${SITE}/catalog/es/`, ...loaded.flatMap((p) => [`${SITE}/catalog/${p.slug}/`, `${SITE}/catalog/es/${p.slug}/`]), ...altUrls, `${SITE}/plugin-inspector/`, `${SITE}/plugin-inspector/badge/`];
	fs.writeFileSync(path.join(out, 'sitemap.xml'), renderSitemap(urls, date));
	fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
	log(`catalog: ${loaded.length} products, ${loaded.filter((p) => p.media && p.media.video).length} with video`);
	return { products: loaded, warns, alternatives: altItems, alternativesWanted: altConf.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const arg = (n) => {
		const i = process.argv.indexOf(n);
		return i > 0 ? process.argv[i + 1] : null;
	};
	const out = path.resolve(arg('--out') || '_site');
	const local = arg('--local') ? path.resolve(arg('--local')) : null;
	fs.mkdirSync(out, { recursive: true });
	const { alternatives, alternativesWanted } = await build({ out, local });
	const v = validate(out);
	if (alternatives.length < alternativesWanted) {
		console.log(`  alternatives: ${alternatives.length} of ${alternativesWanted} pages built; not publishing a site that drops the others`);
		v.errors.push('alternatives incomplete');
	}
	console.log(`validate: ${v.pages} pages, ${v.errors.length} problems`);
	for (const e of v.errors) console.log('  ' + e);
	process.exit(v.errors.length ? 1 : 0);
}
