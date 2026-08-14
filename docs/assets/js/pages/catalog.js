import { listProducts } from '../store.js';
import { BUSINESS } from '../firebase.js';
import { money, escapeHtml, normalize, renderNavbar, showToast, loading, registerServiceWorker } from '../ui.js';
import * as Cart from '../cart.js';

renderNavbar({ active: './index.html' });
registerServiceWorker();
document.getElementById('footer').textContent = `${BUSINESS.name} · Sistema de gestion`;

let products = [];

function card(p) {
  const sinStock = Number(p.stock || 0) <= 0;
  return `
  <div class="col-6 col-md-4 col-lg-3">
    <div class="card h-100 product-card shadow-sm">
      <div class="product-img-wrap">
        ${p.image_url
          ? `<img src="${p.image_url}" class="product-img" alt="${escapeHtml(p.name)}" loading="lazy">`
          : '<div class="product-img d-flex align-items-center justify-content-center bg-light text-muted"><i class="bi bi-image fs-1"></i></div>'}
        ${sinStock ? '<span class="badge text-bg-secondary position-absolute top-0 start-0 m-2">Sin stock</span>' : ''}
      </div>
      <div class="card-body d-flex flex-column">
        <span class="badge text-bg-light text-muted align-self-start mb-1">${escapeHtml(p.category || 'General')}</span>
        <h2 class="h6 card-title mb-1">${escapeHtml(p.name)}</h2>
        <p class="card-text small text-muted flex-grow-1 product-desc">${escapeHtml(p.description || 'Sin descripcion')}</p>
        <div class="d-flex justify-content-between align-items-center mt-2">
          <span class="fw-bold text-primary">${money(p.price)}</span>
          <button class="btn btn-sm btn-primary" data-add="${p.id}" ${sinStock ? 'disabled' : ''}>
            <i class="bi bi-bag-plus"></i> Ordenar
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

function render() {
  const q = normalize(document.getElementById('q').value).split(/\s+/).filter(Boolean);
  const cat = document.getElementById('cat').value;
  const list = products.filter((p) => {
    if (cat && (p.category || 'General') !== cat) return false;
    const key = normalize(`${p.name} ${p.category} ${p.description}`);
    return q.every((t) => key.includes(t));
  });

  document.getElementById('grid').innerHTML = list.map(card).join('');
  document.getElementById('empty').classList.toggle('d-none', list.length > 0);

  document.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = products.find((x) => x.id === btn.dataset.add);
      Cart.add({ id: p.id, name: p.name, price: Number(p.price || 0), image: p.image_url || '' });
    });
  });
}

(async () => {
  loading(true, 'Cargando catalogo...');
  try {
    products = await listProducts({ onlyActive: true });
    const cats = [...new Set(products.map((p) => p.category || 'General'))].sort();
    document.getElementById('cat').insertAdjacentHTML('beforeend',
      cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join(''));
    render();
  } catch (e) {
    showToast('No se pudo cargar el catalogo: ' + e.message, 'danger');
  } finally {
    loading(false);
  }
  document.getElementById('q').addEventListener('input', render);
  document.getElementById('cat').addEventListener('change', render);
  Cart.updateBadge();
})();
