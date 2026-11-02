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

  // What the Buy button of one product should show: {enabled, href, label}.
  function buyState(config, id, lang) {
    const L = LABELS[lang === 'es' ? 'es' : 'en'];
    const p = lookup(config, id);
    const href = p ? safeHttpsUrl(p.checkoutUrl) : '';
    if (!href) return { enabled: false, href: '', label: L.soon };
    const price = priceText(config, id);
    return { enabled: true, href, label: price ? L.buy + ' ' + price : L.buy };
  }

  return { safeHttpsUrl, priceText, buyState, LABELS };
});
