// Filters the catalog cards as you type. The page works without it.
(function () {
  var q = document.getElementById('q');
  if (!q) return;
  q.addEventListener('input', function () {
    var v = q.value.trim().toLowerCase();
    document.querySelectorAll('.cards li').forEach(function (li) {
      li.hidden = v !== '' && li.getAttribute('data-t').indexOf(v) === -1;
    });
    document.querySelectorAll('.group').forEach(function (g) {
      g.hidden = !g.querySelector('.cards li:not([hidden])');
    });
  });
})();
