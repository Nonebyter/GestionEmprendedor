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
  vendido: 'Vendido',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};
export const STATUS_COLOR = {
  nuevo: 'danger', visto: 'warning', confirmado: 'info',
  vendido: 'success', entregado: 'primary', cancelado: 'secondary'
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

// Muestra la foto del producto completa, sin recortes.
export function openImage(src, title = '') {
  if (!src) return;
  let el = document.getElementById('img-lightbox');
  if (!el) {
    el = document.createElement('div');
    el.id = 'img-lightbox';
    el.className = 'modal fade';
    el.tabIndex = -1;
    el.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content lightbox-content">
          <div class="modal-header border-0 pb-1">
            <h5 class="modal-title h6"></h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body text-center pt-0">
            <img class="lightbox-img" alt="">
          </div>
        </div>
      </div>`;
    document.body.appendChild(el);
  }
  el.querySelector('img').src = src;
  el.querySelector('img').alt = title;
  el.querySelector('.modal-title').textContent = title;
  bootstrap.Modal.getOrCreateInstance(el).show();
}

// Reemplazo del confirm() nativo, con los mismos componentes (modal Bootstrap) del proyecto.
export function confirmDialog(message, { title = 'Confirmar', okText = 'Aceptar', okVariant = 'danger', cancelText = 'Cancelar' } = {}) {
  return new Promise((resolve) => {
    let el = document.getElementById('confirm-dialog');
    if (!el) {
      el = document.createElement('div');
      el.id = 'confirm-dialog';
      el.className = 'modal fade';
      el.tabIndex = -1;
      el.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body"></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal"></button>
              <button type="button" class="btn" id="confirm-dialog-ok"></button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(el);
    }
    el.querySelector('.modal-title').textContent = title;
    el.querySelector('.modal-body').textContent = message;
    el.querySelector('.modal-footer .btn-outline-secondary').textContent = cancelText;
    const okBtn = el.querySelector('#confirm-dialog-ok');
    okBtn.textContent = okText;
    okBtn.className = `btn btn-${okVariant}`;
    const modal = bootstrap.Modal.getOrCreateInstance(el);

    let ok = false;
    const onOk = () => { ok = true; modal.hide(); };
    const onHidden = () => {
      okBtn.removeEventListener('click', onOk);
      el.removeEventListener('hidden.bs.modal', onHidden);
      resolve(ok);
    };
    okBtn.addEventListener('click', onOk);
    el.addEventListener('hidden.bs.modal', onHidden);
    modal.show();
  });
}

// Convierte un <select> nativo en un menu desplegable con los componentes del proyecto (Bootstrap).
export function enhanceSelect(select) {
  if (!select) return;
  if (!select.dataset.customSelect) {
    select.dataset.customSelect = '1';
    select.removeAttribute('required');

    const wrap = document.createElement('div');
    wrap.className = 'custom-select';
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('custom-select-native');
    select.tabIndex = -1;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `form-select custom-select-btn${select.classList.contains('form-select-sm') ? ' form-select-sm' : ''}`;

    const menu = document.createElement('div');
    menu.className = 'dropdown-menu custom-select-menu';

    wrap.append(btn, menu);

    btn.addEventListener('click', () => {
      const willOpen = !menu.classList.contains('show');
      document.querySelectorAll('.custom-select-menu.show').forEach((m) => m.classList.remove('show'));
      menu.classList.toggle('show', willOpen);
    });
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) menu.classList.remove('show');
    });

    select._customBtn = btn;
    select._customMenu = menu;
  }
  refreshSelect(select);
}

// Reconstruye el menu del selector personalizado cuando cambian las opciones del <select>.
export function refreshSelect(select) {
  if (!select?._customMenu) return;
  const btn = select._customBtn;
  const menu = select._customMenu;
  menu.innerHTML = [...select.options].map((opt, i) => `
    <button type="button" class="dropdown-item${opt.disabled ? ' disabled' : ''}${opt.selected ? ' active' : ''}" data-idx="${i}">${escapeHtml(opt.textContent)}</button>`).join('');
  menu.querySelectorAll('.dropdown-item').forEach((item) => {
    item.addEventListener('click', () => {
      if (item.classList.contains('disabled')) return;
      select.selectedIndex = Number(item.dataset.idx);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      menu.classList.remove('show');
      refreshSelect(select);
    });
  });
  btn.textContent = select.selectedOptions[0]?.textContent || '';
  btn.disabled = select.disabled;
  btn.classList.toggle('disabled', select.disabled);
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

  // El menu quedaba expandido al navegar entre secciones con anclas (#seccion);
  // se contrae solo tras elegir una opcion o al tocar fuera de el.
  const collapseEl = nav.querySelector('.navbar-collapse');
  if (collapseEl) {
    const closeMenu = () => {
      if (collapseEl.classList.contains('show')) {
        bootstrap.Collapse.getOrCreateInstance(collapseEl).hide();
      }
    };
    collapseEl.querySelectorAll('a.nav-link, .btn').forEach((el) => el.addEventListener('click', closeMenu));
    document.addEventListener('click', (e) => {
      if (collapseEl.classList.contains('show') && !collapseEl.contains(e.target) && !e.target.closest('.navbar-toggler')) {
        closeMenu();
      }
    });
  }
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
}
