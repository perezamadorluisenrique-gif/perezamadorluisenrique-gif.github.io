// Fills prices and Buy buttons from config.json. All text goes in with textContent.
(function () {
  'use strict';
  var core = window.ProCore;
  var script = document.currentScript;
  if (!core || !script) return;
  var lang = (document.documentElement.lang || 'en').slice(0, 2);
  var url = new URL('config.json', script.src).href;

  fetch(url, { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('config ' + r.status)); })
    .then(function (config) {
      document.querySelectorAll('[data-price]').forEach(function (el) {
        var text = core.priceText(config, el.getAttribute('data-price'));
        if (text) el.textContent = text;
      });
      document.querySelectorAll('[data-buy]').forEach(function (el) {
        var s = core.buyState(config, el.getAttribute('data-buy'), lang);
        el.textContent = s.label;
        if (s.enabled) {
          el.setAttribute('href', s.href);
          el.setAttribute('rel', 'noopener');
          el.removeAttribute('aria-disabled');
          el.classList.remove('is-disabled');
        } else {
          el.removeAttribute('href');
          el.setAttribute('aria-disabled', 'true');
          el.classList.add('is-disabled');
        }
      });
    })
    .catch(function () { /* keep the static "Coming soon" buttons and prices */ });
})();
