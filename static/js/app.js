/* Utilidades generales + registro del service worker (PWA). */
function showToast(message) {
  const el = document.getElementById('app-toast');
  if (!el) return alert(message);
  document.getElementById('app-toast-body').textContent = message;
  bootstrap.Toast.getOrCreateInstance(el, { delay: 2500 }).show();
}

/* Filtra filas de una tabla por el atributo data-key. */
function filterTable(inputId, tbodyId) {
  const input = document.getElementById(inputId);
  const tbody = document.getElementById(tbodyId);
  if (!input || !tbody) return;
  const clean = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  input.addEventListener('input', () => {
    const terms = clean(input.value).split(/\s+/).filter(Boolean);
    tbody.querySelectorAll('tr[data-key]').forEach(row => {
      const key = clean(row.dataset.key);
      row.style.display = terms.every(t => key.includes(t)) ? '' : 'none';
    });
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
