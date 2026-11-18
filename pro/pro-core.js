// Pure logic for the Pro sales pages. No DOM here, so it can be tested under Node.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const LABELS = {
    en: { soon: 'Coming soon', buy: 'Buy for' },
    es: { soon: 'Próximamente', buy: 'Comprar por' },
  };

  // Only absolute https:// URLs are ever used as a link target.
  function safeHttpsUrl(value) {
    if (typeof value !== 'string') return '';
    const v = value.trim();
    if (!/^https:\/\//i.test(v)) return '';
    try {
      const u = new URL(v);
      return u.protocol === 'https:' && u.hostname ? u.href : '';
    } catch (e) {
      return '';
    }
  }

  function lookup(config, id) {
    const products = config && typeof config === 'object' ? config.products : null;
    const p = products && Object.prototype.hasOwnProperty.call(products, id) ? products[id] : null;
    return p && typeof p === 'object' ? p : null;
  }

  function priceText(config, id) {
    const p = lookup(config, id);
    return p && typeof p.price === 'string' ? p.price.trim() : '';
  }

  // Where the visitor came from: ?ref=<letters, digits, hyphens> from a notice inside a plugin, else gh-pro.
  const DEFAULT_REF = 'gh-pro';
  function refFrom(search) {
    try {
      const v = new URLSearchParams(typeof search === 'string' ? search : '').get('ref');
      return v && /^[a-z0-9][a-z0-9-]{0,39}$/i.test(v) ? v.toLowerCase() : DEFAULT_REF;
    } catch (e) {
      return DEFAULT_REF;
    }
  }

  // The shop only sells when its switch is on. While it is off every Buy button says "Coming soon",
  // even if the product already has a checkout URL. Other providers have no switch.
  function shopOpen(config) {
    if (!config || config.provider !== 'bolsterfy') return true;
    const b = config.providers && config.providers.bolsterfy;
    return !!(b && b.open === true);
  }

  // What the Buy button of one product should show: {enabled, href, label}. `ref` is added to the shop URL.
  function buyState(config, id, lang, ref) {
    const L = LABELS[lang === 'es' ? 'es' : 'en'];
    const p = lookup(config, id);
    let href = p ? safeHttpsUrl(p.checkoutUrl) : '';
    if (!href || !shopOpen(config)) return { enabled: false, href: '', label: L.soon };
    if (config.provider === 'bolsterfy') {
      const u = new URL(href);
      u.searchParams.set('ref', typeof ref === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/i.test(ref) ? ref.toLowerCase() : DEFAULT_REF);
      href = u.href;
    }
    const price = priceText(config, id);
    return { enabled: true, href, label: price ? L.buy + ' ' + price : L.buy };
  }

  return { safeHttpsUrl, priceText, buyState, refFrom, shopOpen, DEFAULT_REF, LABELS };
});
