// "Alternative to" pages for WordPress plugins. Numbers and dates come from the public
// wordpress.org plugin API at build time; the feature rows are plain statements taken from
// each plugin's own wordpress.org readme (no numbers typed by hand). A test fails on any
// number that is not in the facts.
import { T, fmtDate, fmtNum } from './i18n.mjs';
import { esc, clip, head, footFor, SITE } from './build.mjs';
import { tokensIn } from './alternatives.mjs';

const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#8211;/g, '–').replace(/&#8217;/g, '’').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export const wpApi = (slug) => `https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]=${slug}`;

// Facts for one plugin, from the wordpress.org API response.
export function wpFacts(info) {
	if (!info || info.error || !info.slug) return null;
	const author = decode(String(info.author || '').replace(/<[^>]+>/g, '')).trim();
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(info.last_updated || '');
	return {
		id: info.slug,
		name: decode(info.name),
		author,
		version: info.version,
		updated: m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null,
		installs: Number(info.active_installs) || 0,
		stars: info.num_ratings > 0 ? Math.round(info.rating) / 20 : null,
		ratings: Number(info.num_ratings) || 0,
		requires: info.requires || '',
		tested: info.tested || '',
		php: info.requires_php || '',
		url: `https://wordpress.org/plugins/${info.slug}/`,
		reviews: `https://wordpress.org/support/plugin/${info.slug}/reviews/`,
	};
}

// wordpress.org rounds installs down to a bucket; below the first bucket it says "Fewer than 10".
const FEWER = 10;
const installsText = (n, lang) => (n < FEWER ? (lang === 'es' ? `Menos de ${FEWER}` : `Fewer than ${FEWER}`) : `${fmtNum(n, lang)}+`);
const ratingText = (f, lang) =>
	f.stars === null
		? lang === 'es' ? 'Aún sin valoraciones' : 'No ratings yet'
		: lang === 'es' ? `${String(f.stars).replace('.', ',')} de 5 (${fmtNum(f.ratings, lang)} valoraciones)` : `${f.stars} out of 5 (${fmtNum(f.ratings, lang)} ratings)`;

export function wpUnsupportedNumbers(html, facts, built) {
	const ok = new Set([String(FEWER)]);
	if (built) {
		const d = new Date(built);
		ok.add(String(d.getUTCDate()));
		ok.add(String(d.getUTCFullYear()));
	}
	for (const f of [facts.rival, facts.ours]) {
		for (const lang of ['en', 'es']) {
			for (const s of [f.version, f.requires, f.tested, f.php, installsText(f.installs, lang), ratingText(f, lang), f.updated ? fmtDate(f.updated, lang) : '']) {
				for (const t of tokensIn(String(s))) ok.add(t);
			}
		}
	}
	const names = [facts.rival.name, facts.ours.name].map((n) => esc(n));
	let h = html;
	for (const n of names) h = h.split(n).join(' ');
	return tokensIn(h).filter((t) => !ok.has(t));
}

export function renderWpAlternative(page, facts, lang = 'en', built) {
	const t = T[lang];
	const { rival: r } = facts;
	// "Linkvane – Link Checker & Internal Links" is the listing title; text and titles use the brand part.
	const o = { ...facts.ours, name: facts.ours.name.split(/\s[–-]\s/)[0] };
	const prod = facts.product;
	const es = lang === 'es';
	const segment = es ? 'alternativas' : 'alternatives';
	const url = `${SITE}/catalog/${es ? 'es/' : ''}${segment}/${page.slug}/`;
	const enUrl = `${SITE}/catalog/alternatives/${page.slug}/`;
	const esUrl = `${SITE}/catalog/es/alternativas/${page.slug}/`;
	const S = es
		? {
				title: `${o.name} frente a ${r.name}: comparación`,
				h1: `${o.name} o ${r.name}: cuál elegir`,
				desc: `Comparación honesta de ${o.name} y ${r.name}, dos plugins gratuitos de WordPress para enlaces rotos: datos públicos, diferencias y cuándo conviene cada uno.`,
				lead: `Los dos buscan enlaces rotos en tu contenido. ${r.name} es mucho más usado y tiene alertas por correo y un motor en la nube opcional; ${o.name} es nuevo y funciona entero en tu servidor. Estos son los datos públicos y las diferencias.`,
				glance: 'De un vistazo',
				cols: ['', r.name, o.name],
				facts: { author: 'Autor', version: 'Última versión', updated: 'Última actualización', installs: 'Instalaciones activas', rating: 'Valoración', req: 'Requisitos', price: 'Precio' },
				req: (f) => `WordPress ${f.requires}+, PHP ${f.php}+`,
				freeLine: { r: 'Gratis; el motor en la nube pide una cuenta gratuita de WPMU DEV Hub', o: 'Gratis, sin cuenta' },
				diffH: 'Qué hace distinto cada uno',
				diffCols: ['', r.name, o.name],
				diff: [
					['Dónde se revisan los enlaces', 'Motor local en tu servidor o motor en la nube de WPMU DEV (opcional). El de la nube necesita conexión con WPMU DEV.', 'Siempre en tu servidor. Sin cuenta, sin clave de API, sin servicio del autor del plugin.'],
					['Avisos', 'Alertas por correo y avisos en el escritorio de WordPress.', 'No tiene alertas por correo.'],
					['Falsos positivos', 'Su ficha no describe cómo evita falsos positivos.', 'Marca un enlace como roto solo tras varias comprobaciones fallidas espaciadas en el tiempo; un límite de peticiones o un desafío anti-bots se trata como «no se pudo verificar».'],
					['Enlaces internos y SEO', 'No aparecen en su ficha.', 'Mapa de enlaces internos, páginas huérfanas, callejones sin salida y una auditoría SEO.'],
					['Corregir un enlace', 'Editar, quitar el enlace o ignorarlo desde su panel.', 'Corrige solo el atributo con la URL, sin tocar el resto del bloque; también reglas para reescribir dominios caducados.'],
					['Multisitio', 'Sí.', 'Sí: al activarlo en la red prepara todos los sitios.'],
					['WP-CLI', 'No aparece en su ficha.', 'Sí: escaneo, lista, nueva comprobación y auditoría.'],
				],
				pickH: 'Cuál elegir',
				pickR: (n) => `Elige ${n} si quieres alertas por correo o un escáner alojado fuera de tu servidor, o si prefieres un plugin muy probado con muchísimos sitios detrás.`,
				pickO: (n) => `Elige ${n} si no quieres cuentas ni servicios de terceros, si te importa que un enlace solo se marque tras varios fallos, o si además quieres revisar los enlaces internos de tu sitio.`,
				honest: (n, f) => (f.ratings === 0 ? `${n} es un plugin joven y todavía no tiene valoraciones. ` : '') + 'Lee las reseñas de los dos antes de decidir.',
				switchH: `Cómo probar ${o.name} sin quitar ${r.name}`,
				steps: [
					`Instala ${o.name} desde <a href="${esc(o.url)}" rel="noopener">wordpress.org</a> y ábrelo en Herramientas, Link Health.`,
					`Pulsa «Run Scan Now». ${esc(o.name)} analiza tu contenido desde cero: no importa los resultados ni la lista de ignorados de ${esc(r.name)}.`,
					`Para que no haya dos escáneres pidiendo los mismos enlaces a la vez, desactiva ${esc(r.name)} sin borrarlo mientras comparas.`,
					`Si te quedas con ${esc(o.name)}, desinstala ${esc(r.name)}; si no, vuelve a activarlo.`,
				],
				dataH: 'De dónde salen estos datos',
				data: (d) => `Versión, fecha de actualización, instalaciones activas, valoración y requisitos vienen de la API pública de wordpress.org, leída el ${d}. Las instalaciones las redondea wordpress.org. Las filas de diferencias resumen lo que cada plugin dice en su propia ficha de wordpress.org.`,
				disclose: `Esta página la escribe la persona que hace ${esc(o.name)}. Si mantienes ${esc(r.name)} y quieres corregir o retirar algo, abre una incidencia o un hilo en <a href="${esc(prod.repoUrl || `https://wordpress.org/support/plugin/${o.id}/`)}" rel="noopener">el foro de soporte</a> y se atiende.`,
				links: 'Más sobre',
				theirPage: `${r.name} en wordpress.org`,
				theirReviews: `Reseñas de ${r.name}`,
				ourPage: `Ficha de ${o.name}`,
				ourWp: `${o.name} en wordpress.org`,
				all: 'Todas las comparaciones',
			}
		: {
				title: `${o.name} vs ${r.name}: comparison`,
				h1: `${o.name} vs ${r.name}: which to pick`,
				desc: `An honest comparison of ${o.name} and ${r.name}, two free WordPress broken link checkers: public facts, the differences and when each one fits.`,
				lead: `Both find broken links in your content. ${r.name} is far more widely used and has email alerts and an optional cloud engine; ${o.name} is new and runs entirely on your own server. Here are the public facts and the differences.`,
				glance: 'At a glance',
				cols: ['', r.name, o.name],
				facts: { author: 'Author', version: 'Latest version', updated: 'Last updated', installs: 'Active installs', rating: 'Rating', req: 'Requirements', price: 'Price' },
				req: (f) => `WordPress ${f.requires}+, PHP ${f.php}+`,
				freeLine: { r: 'Free; the cloud engine asks for a free WPMU DEV Hub account', o: 'Free, no account' },
				diffH: 'What each one does differently',
				diffCols: ['', r.name, o.name],
				diff: [
					['Where links are checked', 'A local engine on your server, or an optional WPMU DEV cloud engine. The cloud engine needs a connection to WPMU DEV.', 'Always on your own server. No account, no API key, no service run by the plugin author.'],
					['Alerts', 'Email alerts and dashboard notifications.', 'No email alerts.'],
					['False positives', 'Its listing does not describe how it avoids them.', 'Reports a link as broken only after several failed checks spaced out over time; a rate limit or a bot challenge counts as “could not verify”.'],
					['Internal links and SEO', 'Not in its listing.', 'Internal link map, orphan pages, dead ends and an SEO audit.'],
					['Fixing a link', 'Edit, unlink or ignore from its dashboard.', 'Edits only the attribute that holds the URL and leaves the rest of the block alone; also rules that rewrite known bad domains.'],
					['Multisite', 'Yes.', 'Yes: network activation sets up every site.'],
					['WP-CLI', 'Not in its listing.', 'Yes: scan, list, re-check and audit.'],
				],
				pickH: 'Which one to pick',
				pickR: (n) => `Pick ${n} if you want email alerts or a scanner hosted off your server, or if you prefer a long-established plugin with a very large user base.`,
				pickO: (n) => `Pick ${n} if you want no accounts or third-party services, if you care that a link is only flagged after repeated failures, or if you also want to review your site’s internal links.`,
				honest: (n, f) => (f.ratings === 0 ? `${n} is a young plugin and has no ratings yet. ` : '') + 'Read the reviews of both before deciding.',
				switchH: `How to try ${o.name} without removing ${r.name}`,
				steps: [
					`Install ${o.name} from <a href="${esc(o.url)}" rel="noopener">wordpress.org</a> and open it under Tools, Link Health.`,
					`Click “Run Scan Now”. ${esc(o.name)} scans your content from scratch: it does not import ${esc(r.name)}’s results or ignore list.`,
					`So two scanners are not asking for the same links at once, deactivate ${esc(r.name)} (do not delete it) while you compare.`,
					`If you stay with ${esc(o.name)}, uninstall ${esc(r.name)}; if not, reactivate it.`,
				],
				dataH: 'Where these facts come from',
				data: (d) => `Version, update date, active installs, rating and requirements come from the public wordpress.org plugin API, read on ${d}. wordpress.org rounds install counts. The difference rows summarise what each plugin says in its own wordpress.org listing.`,
				disclose: `This page is written by the person who makes ${esc(o.name)}. If you maintain ${esc(r.name)} and want something corrected or removed, open an issue or a support thread at <a href="${esc(prod.repoUrl || `https://wordpress.org/support/plugin/${o.id}/`)}" rel="noopener">the support forum</a> and it will be handled.`,
				links: 'More about',
				theirPage: `${r.name} on wordpress.org`,
				theirReviews: `${r.name} reviews`,
				ourPage: `${o.name} page`,
				ourWp: `${o.name} on wordpress.org`,
				all: 'All comparisons',
			};
	const desc = clip(S.desc, 190);
	const home = es ? '/catalog/es/' : '/catalog/';
	const jsonld = [
		{
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			name: S.title,
			description: desc,
			url,
			inLanguage: lang,
			isPartOf: { '@type': 'WebSite', name: 'Hidden Problems Lab', url: SITE + '/' },
			about: { '@type': 'SoftwareApplication', name: o.name, applicationCategory: 'WebApplication', operatingSystem: 'WordPress', url: `${SITE}/catalog/${prod.slug}/`, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: t.catalog, item: es ? `${SITE}/catalog/es/` : `${SITE}/catalog/` },
				{ '@type': 'ListItem', position: 2, name: S.title, item: url },
			],
		},
	];
	const alts = [{ lang: es ? 'en' : 'es', url: es ? enUrl : esUrl }];
	const row = (label, a, b) => `<tr><th scope="row">${esc(label)}</th><td>${a}</td><td>${b}</td></tr>`;
	let h = head({ title: S.title, description: desc, canonical: url, image: `${SITE}/catalog/og-default.png`, jsonld, lang, alts });
	h += `<nav class="crumbs" aria-label="${t.breadcrumb}"><a href="${home}">${t.catalog}</a> <span aria-hidden="true">/</span> <span>${esc(S.title)}</span></nav>
<h1>${esc(S.h1)}</h1>
<p class="lead">${esc(S.lead)}</p>
<section><h2>${S.glance}</h2>
<div class="tablewrap" tabindex="0" role="region" aria-label="${esc(S.glance)}"><table class="compare"><caption class="sr">${esc(S.h1)}</caption>
<thead><tr>${S.cols.map((c, i) => `<th scope="col"${i === 0 ? ' class="sr"' : ''}>${esc(c || S.glance)}</th>`).join('')}</tr></thead>
<tbody>
${row(S.facts.author, esc(r.author), esc(o.author))}
${row(S.facts.version, esc(r.version), esc(o.version))}
${row(S.facts.updated, r.updated ? fmtDate(r.updated, lang) : '', o.updated ? fmtDate(o.updated, lang) : '')}
${row(S.facts.installs, installsText(r.installs, lang), installsText(o.installs, lang))}
${row(S.facts.rating, ratingText(r, lang), ratingText(o, lang))}
${row(S.facts.req, esc(S.req(r)), esc(S.req(o)))}
${row(S.facts.price, esc(S.freeLine.r), esc(S.freeLine.o))}
</tbody></table></div></section>
<section><h2>${S.diffH}</h2>
<div class="tablewrap" tabindex="0" role="region" aria-label="${esc(S.diffH)}"><table class="compare"><caption class="sr">${esc(S.diffH)}</caption>
<thead><tr>${S.diffCols.map((c, i) => `<th scope="col"${i === 0 ? ' class="sr"' : ''}>${esc(c || S.diffH)}</th>`).join('')}</tr></thead>
<tbody>
${S.diff.map(([k, a, b]) => row(k, esc(a), esc(b))).join('\n')}
</tbody></table></div></section>
<section><h2>${S.pickH}</h2>
<ul><li>${esc(S.pickR(r.name))}</li><li>${esc(S.pickO(o.name))}</li></ul>
<p>${esc(S.honest(o.name, o))}</p></section>
<section><h2>${esc(S.switchH)}</h2>
<ol>${S.steps.map((s) => `<li>${s}</li>`).join('')}</ol></section>
<section><h2>${S.links}</h2>
<ul class="related"><li><a href="${es ? '/catalog/es/' : '/catalog/'}${prod.slug}/">${esc(S.ourPage)}</a></li><li><a href="${o.url}" rel="noopener">${esc(S.ourWp)}</a></li><li><a href="${r.url}" rel="noopener">${esc(S.theirPage)}</a></li><li><a href="${r.reviews}" rel="noopener">${esc(S.theirReviews)}</a></li><li><a href="${home}${segment}/">${S.all}</a></li></ul></section>
<section><h2>${S.dataH}</h2>
<p>${S.data(fmtDate(Date.parse(built), lang))}</p>
<p class="note">${S.disclose}</p></section>
`;
	return h + footFor(lang);
}
