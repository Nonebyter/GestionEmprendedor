// Utilidades de interfaz compartidas.
import { BUSINESS } from './firebase.js';

export const money = (n) => BUSINESS.currency + Number(n || 0).toFixed(2);

export const escapeHtml = (t) => String(t ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const normalize = (t) => String(t ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();

export const normalizePhone = (t) => String(t ?? '').replace(/\D/g, '');

export const fechaCorta = (iso) => String(iso || '').replace('T', ' ').slice(0, 16);

export const STATUS_LABEL = {
  nuevo: 'Nuevo',
  visto: 'Visto por el vendedor',
  confirmado: 'Confirmado',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};
export const STATUS_COLOR = {
  nuevo: 'danger', visto: 'warning', confirmado: 'info', entregado: 'success', cancelado: 'secondary'
};
export const STATUSES = Object.keys(STATUS_LABEL);

export function showToast(message, variant = 'dark') {
  let host = document.querySelector('.toast-container');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${variant} border-0`;
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${escapeHtml(message)}</div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  host.appendChild(el);
  const toast = new bootstrap.Toast(el, { delay: 2800 });
  toast.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

export function loading(show, text = 'Cargando...') {
  let el = document.getElementById('app-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-loader';
    el.className = 'app-loader';
    el.innerHTML = `<div class="text-center"><div class="spinner-border text-primary"></div>
      <div class="mt-2 small text-muted" id="app-loader-text"></div></div>`;
    document.body.appendChild(el);
  }
  el.querySelector('#app-loader-text').textContent = text;
  el.classList.toggle('d-none', !show);
}

export function filterList(inputId, containerId, itemSelector = '[data-key]') {
  const input = document.getElementById(inputId);
  const box = document.getElementById(containerId);
  if (!input || !box) return;
  input.addEventListener('input', () => {
    const terms = normalize(input.value).split(/\s+/).filter(Boolean);
    box.querySelectorAll(itemSelector).forEach((el) => {
      const key = normalize(el.dataset.key);
      el.classList.toggle('d-none', !terms.every((t) => key.includes(t)));
    });
  });
}

// Reduce y comprime la imagen en el navegador para guardarla en Firestore.
export function compressImage(file, maxSize = 700, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Archivo de imagen invalido.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        let out = canvas.toDataURL('image/jpeg', quality);
        let q = quality;
        while (out.length > 700000 && q > 0.3) {
          q -= 0.12;
          out = canvas.toDataURL('image/jpeg', q);
        }
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function renderNavbar({ active = '', admin = false } = {}) {
  const links = admin
    ? [['#resumen', 'Resumen', 'bi-speedometer2'], ['#inventario', 'Inventario', 'bi-box-seam'],
       ['#compras', 'Compras', 'bi-cart-plus'], ['#ventas', 'Ventas', 'bi-cash-coin'],
       ['#pedidos', 'Pedidos', 'bi-bag-check']]
    : [['./index.html', 'Catalogo', 'bi-grid'], ['./mis-pedidos.html', 'Mis pedidos', 'bi-search']];

  const nav = document.getElementById('navbar');
  if (!nav) return;
  nav.innerHTML = `
  <nav class="navbar navbar-expand-lg navbar-dark sticky-top shadow-sm">
    <div class="container">
      <a class="navbar-brand fw-bold" href="./index.html"><i class="bi bi-shop"></i> ${escapeHtml(BUSINESS.name)}</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu"><span class="navbar-toggler-icon"></span></button>
      <div class="collapse navbar-collapse" id="navMenu">
        <ul class="navbar-nav me-auto">
          ${links.map(([href, label, icon]) => `
            <li class="nav-item"><a class="nav-link ${active === href ? 'active fw-semibold' : ''}" href="${href}">
              <i class="bi ${icon}"></i> ${label}
              ${label === 'Pedidos' ? '<span id="nav-new-orders" class="badge text-bg-danger rounded-pill d-none">0</span>' : ''}
            </a></li>`).join('')}
        </ul>
        <ul class="navbar-nav align-items-lg-center gap-lg-2">
          ${admin ? '' : `<li class="nav-item">
            <a class="nav-link position-relative" href="./carrito.html"><i class="bi bi-basket2 fs-5"></i>
              <span class="d-lg-none">Cesta</span>
              <span id="cart-badge" class="badge text-bg-primary rounded-pill position-absolute top-0 start-100 translate-middle d-none">0</span>
            </a></li>`}
          <li class="nav-item">
            ${admin
              ? '<button id="btn-logout" class="btn btn-outline-secondary btn-sm"><i class="bi bi-box-arrow-right"></i> Salir</button>'
              : '<a class="btn btn-outline-primary btn-sm" href="./admin.html"><i class="bi bi-person-lock"></i> Admin</a>'}
          </li>
        </ul>
      </div>
    </div>
  </nav>`;
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
}
