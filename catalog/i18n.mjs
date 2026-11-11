// Strings for the English and Spanish catalog pages. Product text itself (taglines, README
// intros) comes from each product's own repo in English; only the page frame is translated.
export const LANGS = ['en', 'es'];

const MONTHS = {
	en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
	es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
};

// "17 June 2022" / "17 de junio de 2022", always from UTC so a build never depends on the machine.
export function fmtDate(ms, lang = 'en') {
	const d = new Date(ms);
	const m = MONTHS[lang][d.getUTCMonth()];
	return lang === 'es' ? `${d.getUTCDate()} de ${m} de ${d.getUTCFullYear()}` : `${d.getUTCDate()} ${m} ${d.getUTCFullYear()}`;
}

export function fmtNum(n, lang = 'en') {
	const s = String(Math.round(Number(n) || 0));
	return s.replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'es' ? '.' : ',');
}

export const T = {
	en: {
		htmlLang: 'en',
		catalog: 'Catalog',
		inspector: 'Plugin Inspector',
		nouns: { obsidian: 'Obsidian plugin', wordpress: 'WordPress plugin', cli: 'command-line tool', web: 'web app' },
		freeNoun: (n) => `Free ${n}`,
		titleOf: (name, noun) => `${name}: free ${noun}`,
		categories: { 'Obsidian plugins': 'Obsidian plugins', 'WordPress plugins': 'WordPress plugins', 'Developer tools': 'Developer tools', 'Web apps': 'Web apps' },
		what: 'What it does',
		highlights: 'Highlights',
		details: 'Details',
		moreFree: 'More free tools',
		sameAuthor: 'From the same author',
		sameAuthorLead: 'Other free tools from Hidden Problems Lab:',
		notListed: (id) => `Not in the Obsidian directory yet: download <code>main.js</code>, <code>manifest.json</code> and <code>styles.css</code> from the latest release into <code>.obsidian/plugins/${id}/</code> in your vault.`,
		footer: "Everything in this catalog is free and open source. Pages are generated from each product's own README and manifest, so they match the latest release.",
		allProducts: 'All products',
		lab: 'Hidden Problems Lab',
		breadcrumb: 'Breadcrumb',
		main: 'Main',
		otherLang: 'Español',
		cameFrom: (name) => `Coming from ${name}?`,
		cameFromLink: 'See how they compare and how to switch',
		textLang: 'Text on this page that describes the product is in English, as in its repository.',
		indexTitle: 'Free Obsidian and WordPress plugins and tools',
		indexDesc: (n) => `${n} free, open source tools by Hidden Problems Lab: Obsidian plugins, WordPress plugins, a GitHub issue checker and a book-making web app. Each page has a demo and install links.`,
		indexH1: 'Free tools by Hidden Problems Lab',
		indexLead: (n) => `${n} free and open source tools. No accounts, no tracking, and each one does one job well.`,
		filter: 'Filter',
		filterPh: 'Type a name or a word',
		facts: {},
		labels: {},
		altSection: 'Compared with other plugins',
	},
	es: {
		htmlLang: 'es',
		catalog: 'Catálogo',
		inspector: 'Plugin Inspector',
		nouns: { obsidian: 'plugin de Obsidian', wordpress: 'plugin de WordPress', cli: 'herramienta de línea de comandos', web: 'aplicación web' },
		freeNoun: (n) => `${n[0].toUpperCase()}${n.slice(1)} gratis`,
		titleOf: (name, noun) => `${name}: ${noun} gratis`,
		categories: { 'Obsidian plugins': 'Plugins de Obsidian', 'WordPress plugins': 'Plugins de WordPress', 'Developer tools': 'Herramientas para desarrolladores', 'Web apps': 'Aplicaciones web' },
		what: 'Qué hace',
		highlights: 'Lo más destacado',
		details: 'Detalles',
		moreFree: 'Más herramientas gratuitas',
		sameAuthor: 'Del mismo autor',
		sameAuthorLead: 'Otras herramientas gratuitas de Hidden Problems Lab:',
		notListed: (id) => `Todavía no está en el directorio de Obsidian: descarga <code>main.js</code>, <code>manifest.json</code> y <code>styles.css</code> de la última versión a <code>.obsidian/plugins/${id}/</code> dentro de tu bóveda.`,
		footer: 'Todo este catálogo es gratuito y de código abierto. Las páginas se generan a partir del README y el manifiesto de cada producto, así que coinciden con la última versión.',
		allProducts: 'Todos los productos',
		lab: 'Hidden Problems Lab',
		breadcrumb: 'Ruta de navegación',
		main: 'Principal',
		otherLang: 'English',
		cameFrom: (name) => `¿Vienes de ${name}?`,
		cameFromLink: 'Mira cómo se comparan y cómo cambiar',
		textLang: 'El texto que describe el producto está en inglés, igual que en su repositorio.',
		indexTitle: 'Plugins y herramientas gratis de Obsidian y WordPress',
		indexDesc: (n) => `${n} herramientas gratuitas y de código abierto de Hidden Problems Lab: plugins de Obsidian y WordPress, un revisor de issues y una app para hacer libros. Con demo e instalación.`,
		indexH1: 'Herramientas gratuitas de Hidden Problems Lab',
		indexLead: (n) => `${n} herramientas gratuitas y de código abierto. Sin cuentas ni seguimiento, y cada una hace bien un solo trabajo.`,
		filter: 'Filtrar',
		filterPh: 'Escribe un nombre o una palabra',
		facts: {
			Version: 'Versión',
			'Needs Obsidian': 'Requiere Obsidian',
			Platforms: 'Plataformas',
			Author: 'Autor',
			Price: 'Precio',
			'Requires WordPress': 'Requiere WordPress',
			'Tested up to': 'Probado hasta',
			'Requires PHP': 'Requiere PHP',
			'Active installs': 'Instalaciones activas',
		},
		labels: {
			'Free and open source': 'Gratis y de código abierto',
			Desktop: 'Escritorio',
			'Desktop and mobile': 'Escritorio y móvil',
			'Install from the Obsidian directory': 'Instalar desde el directorio de Obsidian',
			'Download the latest release': 'Descargar la última versión',
			'Open in Obsidian': 'Abrir en Obsidian',
			'Source code and issues': 'Código fuente e incidencias',
			'Install from wordpress.org': 'Instalar desde wordpress.org',
			'Support forum': 'Foro de soporte',
			'Try it in WordPress Playground': 'Probarlo en WordPress Playground',
			'Open in your browser': 'Abrir en el navegador',
			'Open the web app': 'Abrir la aplicación web',
		},
		altSection: 'Comparado con otros plugins',
	},
};

// Translates a fact key/value or button label, leaving anything unknown as it is.
export function tr(lang, kind, s) {
	const t = T[lang][kind];
	if (t && t[s]) return t[s];
	if (lang === 'es' && kind === 'labels') {
		const m = /^(.+) or newer$/.exec(s);
		if (m) return `${m[1]} o posterior`;
	}
	return s;
}
