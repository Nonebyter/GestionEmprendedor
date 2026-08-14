import { findOrders } from '../store.js';
import { BUSINESS } from '../firebase.js';
import { money, escapeHtml, fechaCorta, STATUS_LABEL, STATUS_COLOR, renderNavbar, loading, showToast, registerServiceWorker } from '../ui.js';

renderNavbar({ active: './mis-pedidos.html' });
registerServiceWorker();
document.getElementById('footer').textContent = `${BUSINESS.name} · Sistema de gestion`;

const form = document.getElementById('buscar');
const box = document.getElementById('resultados');

async function buscar(name, phone) {
  loading(true, 'Buscando...');
  try {
    const orders = await findOrders(name, phone);
    if (!orders.length) {
      box.innerHTML = `<div class="alert alert-warning">
        No encontramos pedidos con esos datos. Revisa que el nombre y telefono sean los mismos que usaste.</div>`;
      return;
    }
    box.innerHTML = orders.map((o) => `
      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <h2 class="h6 mb-1">Pedido #${escapeHtml(o.code)}</h2>
              <small class="text-muted">${fechaCorta(o.created_at)}</small>
            </div>
            <span class="badge text-bg-${STATUS_COLOR[o.status] || 'secondary'}">${STATUS_LABEL[o.status] || o.status}</span>
          </div>
          <ul class="list-unstyled small mt-2 mb-2">
            ${(o.items || []).map((i) => `<li>${i.qty} x ${escapeHtml(i.name)} — ${money(i.subtotal)}</li>`).join('')}
          </ul>
          <div class="d-flex justify-content-between align-items-center">
            <strong class="text-primary">${money(o.total)}</strong>
            <a href="./pedido.html?id=${o.id}" class="btn btn-sm btn-outline-primary">Ver detalle</a>
          </div>
        </div>
      </div>`).join('');
  } catch (e) {
    showToast('Error al buscar: ' + e.message, 'danger');
  } finally {
    loading(false);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(form).entries());
  buscar(d.name, d.phone);
});

const params = new URLSearchParams(location.search);
if (params.get('name') && params.get('phone')) {
  form.name.value = params.get('name');
  form.phone.value = params.get('phone');
  buscar(params.get('name'), params.get('phone'));
}
