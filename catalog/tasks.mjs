// "Plugins for <task>" pages: one per job people search for, listing our free plugin next to the other
// Obsidian plugins that do the same job. Every figure (downloads, versions, dates) comes from the
// Obsidian directory files at build time; the text written here has no numbers, and a test fails if a
// page shows a number that is not in the facts.
import { T, fmtDate, fmtNum } from './i18n.mjs';
import { esc, clip, head, footFor, SITE } from './build.mjs';
import { pluginFacts, tokensIn } from './alternatives.mjs';

const dir = (id) => `https://community.obsidian.md/plugins/${id}`;
export const segment = (lang) => (lang === 'es' ? 'tareas' : 'tasks');
export const taskUrl = (slug, lang) => `${SITE}/catalog/${lang === 'es' ? 'es/' : ''}${segment(lang)}/${slug}/`;

// Facts for every plugin of one page. `ours` are catalog product slugs, `others` directory ids.
export function taskFacts(page, { dirList, stats, products }) {
	const rows = [];
	for (const slug of page.ours) {
		const product = products.find((p) => p.slug === slug);
		const entry = product && dirList.find((x) => x.id === product.id);
		const f = product && pluginFacts(entry || { id: product.id, name: product.name, author: 'Siulved54', description: product.tagline }, stats[product.id]);
		if (!f) return null;
		if (product.version) f.version = product.version;
		rows.push({ ...f, ours: true, slug });
	}
	for (const id of page.others) {
		const f = pluginFacts(dirList.find((x) => x.id === id), stats[id]);
		if (!f) return null;
		rows.push({ ...f, ours: false });
	}
	// Biggest first among the others; ours always on top so nobody is misled about whose page this is.
	return [...rows.filter((r) => r.ours), ...rows.filter((r) => !r.ours).sort((a, b) => b.downloads - a.downloads)];
}

export function allowedTokens(rows, built) {
	const ok = new Set();
	if (built) {
		const d = new Date(built);
		ok.add(String(d.getUTCDate()));
		ok.add(String(d.getUTCFullYear()));
	}
	for (const f of rows) {
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

export function unsupportedNumbers(html, rows, built) {
	let h = html;
	for (const r of rows) for (const n of [r.name, r.author]) h = h.split(esc(n)).join(' ');
	const ok = allowedTokens(rows, built);
	return tokensIn(h).filter((t) => !ok.has(t));
}

export function renderTask(page, rows, lang = 'en', built, prods = []) {
	const t = T[lang];
	const L = page[lang];
	const S = lang === 'es'
		? {
				titleOf: (x) => x,
				desc: `Compara plugins de Obsidian: ${L.title.toLowerCase()}. Descargas, versión y última actualización de cada uno, con datos públicos del directorio.`,
				lead: L.lead,
				cols: ['Plugin', 'Autor', 'Descargas totales', 'Última versión', 'Última actualización', 'Qué hace'],
				ours: 'Nuestro plugin, gratis y de código abierto',
				pick: 'Cómo elegir',
				pickText: 'Mira cuándo se actualizó cada plugin por última vez, si su descripción cubre justo lo que necesitas y si tu versión de Obsidian lo admite. Las descargas dicen cuánta gente lo instaló, no si funciona mejor. Prueba uno cada vez en una copia de tu bóveda.',
				dataH: 'De dónde salen estos datos',
				data: (d) => `Nombre, autor, descripción, versión, fecha de la última actualización y descargas vienen de los archivos públicos del directorio de Obsidian (<code>community-plugins.json</code> y <code>community-plugin-stats.json</code>), leídos el ${d}. Las descargas son las que publica Obsidian.`,
				disclose: (n) => `Esta página la escribe la persona que hace ${esc(n)}. Si mantienes uno de los plugins de la lista y quieres corregir o retirar algo, abre una incidencia en <a href="${esc('https://github.com/perezamadorluisenrique-gif/' + rowsRepo(rows))}/issues" rel="noopener">el repositorio</a> y se atiende.`,
				all: 'Todas las guías por tarea',
				page: 'Ficha',
				dirLink: 'En el directorio',
				inspect: 'Revisar en Plugin Inspector',
			}
		: {
				titleOf: (x) => x,
				desc: `Compare Obsidian plugins: ${L.title.toLowerCase()}. Downloads, version and last update for each one, from public directory data.`,
				lead: L.lead,
				cols: ['Plugin', 'Author', 'Total downloads', 'Latest version', 'Last update', 'What it does'],
				ours: 'Our plugin, free and open source',
				pick: 'How to choose',
				pickText: 'Check when each plugin was last updated, whether its description covers exactly what you need, and whether it supports your version of Obsidian. Downloads tell you how many people installed a plugin, not which one works better. Try one at a time on a copy of your vault.',
				dataH: 'Where these facts come from',
				data: (d) => `Name, author, description, version, last-update date and downloads come from the public Obsidian directory files (<code>community-plugins.json</code> and <code>community-plugin-stats.json</code>), read on ${d}. Download counts are the ones Obsidian publishes.`,
				disclose: (n) => `This page is written by the person who makes ${esc(n)}. If you maintain one of the listed plugins and want something corrected or removed, open an issue in <a href="${esc('https://github.com/perezamadorluisenrique-gif/' + rowsRepo(rows))}/issues" rel="noopener">the repository</a> and it will be handled.`,
				all: 'All guides by task',
				page: 'Page',
				dirLink: 'In the directory',
				inspect: 'Check in the Plugin Inspector',
			};
	function rowsRepo(r) {
		const p = prods.find((x) => x.id === r[0].id);
		return p && p.repo ? p.repo : r[0].id;
	}
	const url = taskUrl(page.slug, lang);
	const desc = clip(S.desc, 190);
	const home = `${lang === 'es' ? '/catalog/es/' : '/catalog/'}`;
	const jsonld = [
		{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: L.title, description: desc, url, inLanguage: lang, isPartOf: { '@type': 'WebSite', name: 'Hidden Problems Lab', url: SITE + '/' } },
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: t.catalog, item: lang === 'es' ? `${SITE}/catalog/es/` : `${SITE}/catalog/` },
				{ '@type': 'ListItem', position: 2, name: L.title, item: url },
			],
		},
	];
	const alts = [{ lang: lang === 'es' ? 'en' : 'es', url: taskUrl(page.slug, lang === 'es' ? 'en' : 'es') }];
	let h = head({ title: L.title, description: desc, canonical: url, image: `${SITE}/catalog/og-default.png`, jsonld, lang, alts });
	h += `<nav class="crumbs" aria-label="${t.breadcrumb}"><a href="${home}">${t.catalog}</a> <span aria-hidden="true">/</span> <span>${esc(L.title)}</span></nav>
<h1>${esc(L.title)}</h1>
<p class="lead">${esc(S.lead)}</p>
<section><div class="tablewrap" tabindex="0" role="region" aria-label="${esc(L.title)}"><table class="compare"><caption class="sr">${esc(L.title)}</caption>
<thead><tr>${S.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
<tbody>
`;
	for (const r of rows) {
		const prod = r.ours ? prods.find((p) => p.slug === r.slug) : null;
		const link = prod ? `<a href="${lang === 'es' ? '/catalog/es/' : '/catalog/'}${prod.slug}/">${esc(r.name)}</a><br><span class="note">${esc(S.ours)}</span>` : `<a href="${dir(r.id)}" rel="noopener">${esc(r.name)}</a>`;
		h += `<tr><th scope="row">${link}</th><td>${esc(r.author)}</td><td>${fmtNum(r.downloads, lang)}</td><td>${esc(r.version || '')}</td><td>${r.updated ? fmtDate(r.updated, lang) : ''}</td><td lang="en"><!--prose-->${esc(r.description)}<!--/prose--></td></tr>\n`;
	}
	h += `</tbody></table></div></section>
<section><h2>${S.pick}</h2>\n<p>${esc(S.pickText)}</p>\n<ul class="related">${rows
		.filter((r) => !r.ours)
		.map((r) => `<li><a href="/plugin-inspector/?q=${encodeURIComponent(r.id)}">${esc(S.inspect)}: ${esc(r.name)}</a></li>`)
		.join('')}</ul></section>
<section><h2>${S.dataH}</h2>\n<p>${S.data(fmtDate(Date.parse(built), lang))}</p>\n<p class="note">${S.disclose(rows.find((r) => r.ours).name)}</p>\n<p><a href="${home}${segment(lang)}/">${S.all}</a></p></section>\n`;
	return h + footFor(lang);
}

export function renderTasksIndex(items, lang = 'en') {
	const t = T[lang];
	const base = taskUrl('', lang).replace(/\/\/$/, '/');
	const title = lang === 'es' ? 'Plugins de Obsidian por tarea' : 'Obsidian plugins by task';
	const desc = lang === 'es'
		? 'Guías con datos públicos del directorio: qué plugins de Obsidian hacen cada tarea, con descargas, versión y última actualización de cada uno.'
		: 'Guides with public directory data: which Obsidian plugins do each job, with downloads, version and last update for every one.';
	const jsonld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description: desc, url: base, inLanguage: lang };
	const alts = [{ lang: lang === 'es' ? 'en' : 'es', url: taskUrl('', lang === 'es' ? 'en' : 'es').replace(/\/\/$/, '/') }];
	let h = head({ title, description: desc, canonical: base, image: `${SITE}/catalog/og-default.png`, jsonld, lang, alts });
	h += `<h1>${esc(title)}</h1>\n<ul class="related">${items.map((i) => `<li><a href="${base.replace(SITE, '')}${i.page.slug}/">${esc(i.page[lang].title)}</a></li>`).join('')}</ul>\n`;
	return h + footFor(lang);
}
