import { listProducts } from '../store.js';
import { BUSINESS } from '../firebase.js';
import { money, escapeHtml, normalize, renderNavbar, showToast, loading, openImage, enhanceSelect, registerServiceWorker } from '../ui.js';
import * as Cart from '../cart.js';

renderNavbar({ active: './index.html' });
registerServiceWorker();
document.getElementById('footer').textContent = `${BUSINESS.name} · Sistema de gestion`;

let products = [];

function card(p) {
  const sinStock = Number(p.stock || 0) <= 0;
  return `
  <div class="col-6 col-md-4 col-lg-3">
    <div class="card h-100 product-card shadow-sm" data-detail="${p.id}">
      <div class="product-img-wrap${p.image_url ? ' zoomable' : ''}${sinStock ? ' agotado' : ''}" ${p.image_url ? `data-zoom="${p.id}"` : ''}>
        ${p.image_url
          ? `<img src="${p.image_url}" class="product-img" alt="${escapeHtml(p.name)}" loading="lazy">
             <span class="zoom-hint"><i class="bi bi-arrows-fullscreen"></i></span>`
          : '<div class="product-img d-flex align-items-center justify-content-center bg-light text-muted"><i class="bi bi-image fs-1"></i></div>'}
        ${sinStock ? '<div class="agotado-banner">Agotado</div>' : ''}
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

// Modal con la descripcion completa del producto (las cards la recortan a 2 lineas).
function productModalEl() {
  let el = document.getElementById('product-detail-modal');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'product-detail-modal';
  el.className = 'modal fade';
  el.tabIndex = -1;
  el.innerHTML = `
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="pd-title"></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
        </div>
        <div class="modal-body">
          <div class="row g-3">
            <div class="col-12 col-sm-5" id="pd-img-wrap"></div>
            <div class="col-12 col-sm-7">
              <span class="badge text-bg-light text-muted mb-2" id="pd-cat"></span>
              <p id="pd-desc" class="mb-3"></p>
              <div class="d-flex justify-content-between align-items-center">
                <span class="fw-bold fs-5 text-primary" id="pd-price"></span>
                <button class="btn btn-primary" id="pd-add"><i class="bi bi-bag-plus"></i> Ordenar</button>
              </div>
              <div class="form-text mt-2" id="pd-stock"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);
  return el;
}

function openProduct(p) {
  const sinStock = Number(p.stock || 0) <= 0;
  const el = productModalEl();
  el.querySelector('#pd-title').textContent = p.name;
  el.querySelector('#pd-cat').textContent = p.category || 'General';
  el.querySelector('#pd-desc').textContent = p.description || 'Sin descripcion';
  el.querySelector('#pd-price').textContent = money(p.price);
  el.querySelector('#pd-img-wrap').innerHTML = p.image_url
    ? `<img src="${p.image_url}" class="product-img rounded" alt="${escapeHtml(p.name)}" style="width:100%;aspect-ratio:1/1;object-fit:cover;">`
    : '<div class="product-img rounded d-flex align-items-center justify-content-center bg-light text-muted" style="aspect-ratio:1/1;"><i class="bi bi-image fs-1"></i></div>';
  el.querySelector('#pd-stock').textContent = sinStock ? 'Producto agotado.' : `Stock disponible: ${Number(p.stock) || 0}`;
  const addBtn = el.querySelector('#pd-add');
  addBtn.disabled = sinStock;
  addBtn.onclick = () => Cart.add({
    id: p.id, name: p.name, price: Number(p.price || 0), image: p.image_url || '', stock: Number(p.stock) || 0
  });
  bootstrap.Modal.getOrCreateInstance(el).show();
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
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = products.find((x) => x.id === btn.dataset.add);
      Cart.add({
        id: p.id,
        name: p.name,
        price: Number(p.price || 0),
        image: p.image_url || '',
        stock: Number(p.stock) || 0
      });
    });
  });

  document.querySelectorAll('[data-zoom] .zoom-hint').forEach((hint) => {
    hint.addEventListener('click', (e) => {
      e.stopPropagation();
      const box = hint.closest('[data-zoom]');
      const p = products.find((x) => x.id === box.dataset.zoom);
      openImage(p.image_url, p.name);
    });
  });

  document.querySelectorAll('[data-detail]').forEach((el) => {
    el.addEventListener('click', () => {
      const p = products.find((x) => x.id === el.dataset.detail);
      if (p) openProduct(p);
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
    enhanceSelect(document.getElementById('cat'));
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
