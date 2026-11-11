// "Alternative to" pages: one per popular plugin that does the same job as one of ours.
// Only public facts, taken from the Obsidian directory files (name, author, description,
// latest version, last update, downloads) at build time. A test fails if a page states a
// number that is not in those facts.
import { T, tr, fmtDate, fmtNum } from './i18n.mjs';
import { esc, inline, clip, head, footFor, SITE } from './build.mjs';

const semver = (v) => v.split('.').map(Number);
const cmp = (a, b) => {
	const x = semver(a), y = semver(b);
	for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
	return 0;
};

// Facts for one directory plugin, from community-plugins.json and community-plugin-stats.json.
export function pluginFacts(entry, stat) {
	if (!entry || !stat || typeof stat.downloads !== 'number') return null;
	const versions = Object.keys(stat).filter((k) => /^\d+\.\d+\.\d+$/.test(k));
	return {
		id: entry.id,
		name: entry.name,
		author: entry.author,
		description: String(entry.description || '').replace(/\s*-\s*This plugin has not been manually reviewed by Obsidian staff\.\s*$/, ''),
		repo: entry.repo,
		version: versions.sort(cmp).pop() || null,
		updated: typeof stat.updated === 'number' ? stat.updated : null,
		downloads: stat.downloads,
	};
}

export const tokensIn = (html) => {
	const text = html.replace(/<!--prose-->[\s\S]*?<!--\/prose-->/g, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
	return [...text.matchAll(/\d[\d.,]*\d|\d/g)].map((m) => m[0]);
};

// Every number a page may show, in both languages.
export function allowedTokens({ rival, ours }, built) {
	const ok = new Set();
	if (built) {
		const d = new Date(built);
		ok.add(String(d.getUTCDate()));
		ok.add(String(d.getUTCFullYear()));
	}
	for (const f of [rival, ours]) {
		if (f.version) ok.add(f.version);
		for (const lang of ['en', 'es']) {
			ok.add(fmtNum(f.downloads, lang));
			if (f.updated) {
				const d = new Date(f.updated);
				ok.add(String(d.getUTCDate()));
				ok.add(String(d.getUTCFullYear()));
			}
		}
	}
	return ok;
}

// Numbers on the page that do not come from the facts (names are removed first: "Excel to Markdown" has none, but a plugin could).
export function unsupportedNumbers(html, facts, built) {
	const names = [facts.rival.name, facts.ours.name, facts.rival.author, facts.ours.author].map((n) => esc(n));
	let h = html;
	for (const n of names) h = h.split(n).join(' ');
	const ok = allowedTokens(facts, built);
	return tokensIn(h).filter((t) => !ok.has(t));
}

const dir = (id) => `https://community.obsidian.md/plugins/${id}`;

export function renderAlternative(page, facts, lang = 'en', built) {
	const t = T[lang];
	const { rival: r, ours: o } = facts;
	const prod = facts.product;
	const segment = lang === 'es' ? 'alternativas' : 'alternatives';
	const url = `${SITE}/catalog/${lang === 'es' ? 'es/' : ''}${segment}/${page.slug}/`;
	const enUrl = `${SITE}/catalog/alternatives/${page.slug}/`;
	const esUrl = `${SITE}/catalog/es/alternativas/${page.slug}/`;
	const S = lang === 'es'
		? {
				title: `${o.name}: alternativa a ${r.name}`,
				h1: `${o.name} como alternativa a ${r.name}`,
				desc: `Compara ${r.name} (de ${r.author}, ${fmtNum(r.downloads, lang)} descargas) con ${o.name}, un plugin gratuito de Obsidian: qué hace cada uno y cómo cambiar.`,
				lead: `¿Buscas una alternativa a ${r.name}? Estos son los datos públicos de los dos plugins y los pasos para cambiar sin perder tu trabajo.`,
				glance: 'De un vistazo',
				cols: ['', r.name, o.name],
				rows: { does: 'Qué hace', author: 'Autor', version: 'Última versión en el directorio', updated: 'Última actualización registrada', downloads: 'Descargas totales', price: 'Precio', detail: 'Dato' },
				free: 'Gratis y de código abierto',
				doesOurs: `Qué hace ${o.name}`,
				switchH: `Cómo cambiar de ${r.name} a ${o.name}`,
				steps: [
					`Instala ${o.name} desde <a href="${esc(prod.install ? prod.install.url : dir(o.id))}" rel="noopener">${esc(prod.install ? tr(lang, 'labels', prod.install.label) : 'el directorio de Obsidian')}</a>.`,
					`En Ajustes, Plugins de la comunidad, desactiva ${esc(r.name)} sin borrarlo. Así los dos no actúan a la vez sobre la misma acción.`,
					`Abre los ajustes de ${esc(o.name)} y revísalos una vez: los ajustes de ${esc(r.name)} no se copian.`,
					`Cuando todo te funcione como esperas, desinstala ${esc(r.name)}.`,
				],
				dataH: 'De dónde salen estos datos',
				data: (d) => `Nombre, autor, descripción, versión, fecha de la última actualización y descargas vienen de los archivos públicos del directorio de Obsidian (<code>community-plugins.json</code> y <code>community-plugin-stats.json</code>), leídos el ${d}. Las descargas son las que publica Obsidian.`,
				disclose: `Esta página la escribe la persona que hace ${esc(o.name)}. Si mantienes ${esc(r.name)} y quieres corregir o retirar algo, abre una incidencia en <a href="${esc(prod.repoUrl)}/issues" rel="noopener">el repositorio</a> y se atiende.`,
				links: 'Más sobre',
				inspect: `Revisar ${r.name} en Plugin Inspector`,
				theirPage: `${r.name} en el directorio de Obsidian`,
				ourPage: `Ficha de ${o.name}`,
				all: 'Todas las comparaciones',
			}
		: {
				title: `${o.name}: alternative to ${r.name}`,
				h1: `${o.name} as an alternative to ${r.name}`,
				desc: `Compare ${r.name} (by ${r.author}, ${fmtNum(r.downloads, lang)} downloads) with ${o.name}, a free Obsidian plugin: what each does and how to switch.`,
				lead: `Looking for an alternative to ${r.name}? Here are the public facts for both plugins and the steps to switch without losing your work.`,
				glance: 'At a glance',
				cols: ['', r.name, o.name],
				rows: { does: 'What it does', author: 'Author', version: 'Latest version in the directory', updated: 'Last update recorded', downloads: 'Total downloads', price: 'Price', detail: 'Detail' },
				free: 'Free and open source',
				doesOurs: `What ${o.name} does`,
				switchH: `How to switch from ${r.name} to ${o.name}`,
				steps: [
					`Install ${o.name} from <a href="${esc(prod.install ? prod.install.url : dir(o.id))}" rel="noopener">${esc(prod.install ? prod.install.label : 'the Obsidian directory')}</a>.`,
					`In Settings, Community plugins, turn ${esc(r.name)} off without deleting it, so the two do not act on the same action at once.`,
					`Open the ${esc(o.name)} settings and review them once: settings from ${esc(r.name)} are not copied over.`,
					`When everything works the way you expect, uninstall ${esc(r.name)}.`,
				],
				dataH: 'Where these facts come from',
				data: (d) => `Name, author, description, version, last-update date and downloads come from the public Obsidian directory files (<code>community-plugins.json</code> and <code>community-plugin-stats.json</code>), read on ${d}. Download counts are the ones Obsidian publishes.`,
				disclose: `This page is written by the person who makes ${esc(o.name)}. If you maintain ${esc(r.name)} and want something corrected or removed, open an issue in <a href="${esc(prod.repoUrl)}/issues" rel="noopener">the repository</a> and it will be handled.`,
				links: 'More about',
				inspect: `Check ${r.name} in the Plugin Inspector`,
				theirPage: `${r.name} in the Obsidian directory`,
				ourPage: `${o.name} page`,
				all: 'All comparisons',
			};
	const desc = clip(S.desc, 190);
	const ourPage = `${lang === 'es' ? '/catalog/es/' : '/catalog/'}${prod.slug}/`;
	const jsonld = [
		{
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			name: S.title,
			description: desc,
			url,
			inLanguage: lang,
			isPartOf: { '@type': 'WebSite', name: 'Hidden Problems Lab', url: SITE + '/' },
			about: { '@type': 'SoftwareApplication', name: o.name, applicationCategory: 'ProductivityApplication', url: `${SITE}/catalog/${prod.slug}/`, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: t.catalog, item: lang === 'es' ? `${SITE}/catalog/es/` : `${SITE}/catalog/` },
				{ '@type': 'ListItem', position: 2, name: S.title, item: url },
			],
		},
	];
	const alts = [{ lang: lang === 'es' ? 'en' : 'es', url: lang === 'es' ? enUrl : esUrl }];
	let h = head({ title: S.title, description: desc, canonical: url, image: `${SITE}/catalog/og-default.png`, jsonld, lang, alts });
	const home = lang === 'es' ? '/catalog/es/' : '/catalog/';
	h += `<nav class="crumbs" aria-label="${t.breadcrumb}"><a href="${home}">${t.catalog}</a> <span aria-hidden="true">/</span> <span>${esc(S.title)}</span></nav>
<h1>${esc(S.h1)}</h1>
<p class="lead">${S.lead}</p>
<section><h2>${S.glance}</h2>
<div class="tablewrap" tabindex="0" role="region" aria-label="${esc(S.glance)}"><table class="compare"><caption class="sr">${esc(S.h1)}</caption>
<thead><tr>${S.cols.map((c, i) => `<th scope="col"${i === 0 ? ' class="sr"' : ''}>${esc(c || S.rows.detail)}</th>`).join('')}</tr></thead>
<tbody>
<tr><th scope="row">${S.rows.does}</th><td lang="en"><!--prose-->${esc(r.description)}<!--/prose--></td><td lang="en"><!--prose-->${esc(o.description)}<!--/prose--></td></tr>
<tr><th scope="row">${S.rows.author}</th><td>${esc(r.author)}</td><td>${esc(o.author)}</td></tr>
<tr><th scope="row">${S.rows.version}</th><td>${esc(r.version || '')}</td><td>${esc(o.version || '')}</td></tr>
<tr><th scope="row">${S.rows.updated}</th><td>${r.updated ? fmtDate(r.updated, lang) : ''}</td><td>${o.updated ? fmtDate(o.updated, lang) : ''}</td></tr>
<tr><th scope="row">${S.rows.downloads}</th><td>${fmtNum(r.downloads, lang)}</td><td>${fmtNum(o.downloads, lang)}</td></tr>
<tr><th scope="row">${S.rows.price}</th><td></td><td>${S.free}</td></tr>
</tbody></table></div></section>
`;
	h += `<section><h2>${esc(S.doesOurs)}</h2>\n<!--prose-->`;
	for (const x of prod.intro.slice(0, 1)) h += `<p${lang === 'es' ? ' lang="en"' : ''}>${inline(x)}</p>\n`;
	h += `<!--/prose--></section>\n<section><h2>${esc(S.switchH)}</h2>\n<ol>${S.steps.map((s) => `<li>${s}</li>`).join('')}</ol></section>\n`;
	h += `<section><h2>${S.links}</h2>\n<ul class="related"><li><a href="${ourPage}">${esc(S.ourPage)}</a></li><li><a href="${dir(r.id)}" rel="noopener">${esc(S.theirPage)}</a></li><li><a href="/plugin-inspector/?q=${encodeURIComponent(r.id)}">${esc(S.inspect)}</a></li><li><a href="${home}${segment}/">${S.all}</a></li></ul></section>\n`;
	h += `<section><h2>${S.dataH}</h2>\n<p>${S.data(fmtDate(Date.parse(built), lang))}</p>\n<p class="note">${S.disclose}</p></section>\n`;
	return h + footFor(lang);
}

export function renderAlternativesIndex(items, lang = 'en') {
	const t = T[lang];
	const segment = lang === 'es' ? 'alternativas' : 'alternatives';
	const base = `${SITE}/catalog/${lang === 'es' ? 'es/' : ''}${segment}/`;
	const title = lang === 'es' ? 'Alternativas gratis a plugins populares de Obsidian' : 'Free alternatives to popular Obsidian plugins';
	const desc = lang === 'es'
		? 'Comparaciones con datos públicos entre cuatro plugins populares de Obsidian y sus alternativas gratuitas, con pasos para cambiar sin perder tu trabajo.'
		: 'Side-by-side facts for four popular Obsidian plugins and their free alternatives, with steps to switch without losing your work.';
	const jsonld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description: desc, url: base, inLanguage: lang };
	const alts = [{ lang: lang === 'es' ? 'en' : 'es', url: lang === 'es' ? `${SITE}/catalog/alternatives/` : `${SITE}/catalog/es/alternativas/` }];
	let h = head({ title, description: desc, canonical: base, image: `${SITE}/catalog/og-default.png`, jsonld, lang, alts });
	h += `<h1>${esc(title)}</h1>\n<ul class="related">${items
		.map((i) => `<li><a href="${base.replace(SITE, '')}${i.page.slug}/">${esc(lang === 'es' ? `${i.facts.ours.name}: alternativa a ${i.facts.rival.name}` : `${i.facts.ours.name}: alternative to ${i.facts.rival.name}`)}</a></li>`)
		.join('')}</ul>\n`;
	return h + footFor(lang);
}
