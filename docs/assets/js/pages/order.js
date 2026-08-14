import { getOrder } from '../store.js';
import { BUSINESS } from '../firebase.js';
import { money, escapeHtml, fechaCorta, STATUS_LABEL, STATUS_COLOR, renderNavbar, loading, registerServiceWorker } from '../ui.js';

renderNavbar();
registerServiceWorker();
document.getElementById('footer').textContent = `${BUSINESS.name} · Sistema de gestion`;

const id = new URLSearchParams(location.search).get('id');
const box = document.getElementById('detalle');

(async () => {
  if (!id) { box.innerHTML = '<div class="alert alert-warning">Pedido no indicado.</div>'; return; }
  loading(true, 'Buscando pedido...');
  try {
    const o = await getOrder(id);
    if (!o) { box.innerHTML = '<div class="alert alert-warning">No encontramos ese pedido.</div>'; return; }

    box.innerHTML = `
    <div class="card shadow-sm">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <h1 class="h4 mb-1">Pedido #${escapeHtml(o.code)}</h1>
            <p class="text-muted mb-0">${fechaCorta(o.created_at)}</p>
          </div>
          <span class="badge text-bg-${STATUS_COLOR[o.status] || 'secondary'} fs-6">${STATUS_LABEL[o.status] || o.status}</span>
        </div>
        <hr>
        <dl class="row mb-0 small">
          <dt class="col-4 col-sm-3">Cliente</dt><dd class="col-8 col-sm-9">${escapeHtml(o.customer_name)}</dd>
          <dt class="col-4 col-sm-3">Telefono</dt><dd class="col-8 col-sm-9">${escapeHtml(o.phone)}</dd>
          ${o.email ? `<dt class="col-4 col-sm-3">Correo</dt><dd class="col-8 col-sm-9">${escapeHtml(o.email)}</dd>` : ''}
          ${o.address ? `<dt class="col-4 col-sm-3">Entrega</dt><dd class="col-8 col-sm-9">${escapeHtml(o.address)}</dd>` : ''}
          ${o.note ? `<dt class="col-4 col-sm-3">Nota</dt><dd class="col-8 col-sm-9">${escapeHtml(o.note)}</dd>` : ''}
        </dl>
        <hr>
        <ul class="list-group list-group-flush">
          ${(o.items || []).map((i) => `
            <li class="list-group-item d-flex justify-content-between px-0">
              <span>${i.qty} x ${escapeHtml(i.name)}</span><strong>${money(i.subtotal)}</strong>
            </li>`).join('')}
          <li class="list-group-item d-flex justify-content-between px-0 fs-5">
            <strong>Total</strong><strong class="text-primary">${money(o.total)}</strong>
          </li>
        </ul>
        <div class="alert alert-info mt-3 mb-0 small">
          <i class="bi bi-info-circle"></i> Guarda tu nombre y telefono para consultar el estado en
          <a href="./mis-pedidos.html?name=${encodeURIComponent(o.customer_name)}&phone=${encodeURIComponent(o.phone)}">Mis pedidos</a>.
        </div>
        ${BUSINESS.phone ? `<a class="btn btn-success w-100 mt-3" target="_blank"
          href="https://wa.me/${BUSINESS.phone}?text=${encodeURIComponent('Hola, hice el pedido #' + o.code)}">
          <i class="bi bi-whatsapp"></i> Escribir al vendedor</a>` : ''}
      </div>
    </div>
    <div class="text-center mt-3"><a href="./index.html" class="btn btn-outline-primary">Volver al catalogo</a></div>`;
  } finally {
    loading(false);
  }
})();
