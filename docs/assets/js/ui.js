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

// Lee la etiqueta EXIF de orientacion (1-8) de un JPEG; 1 si no aplica o no se pudo leer.
function getExifOrientation(buffer) {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xFFD8) return 1;
    let offset = 2;
    while (offset < view.byteLength) {
      const marker = view.getUint16(offset);
      offset += 2;
      if (marker === 0xFFE1) {
        if (view.getUint32(offset + 2) !== 0x45786966) return 1; // "Exif"
        const little = view.getUint16(offset + 8) === 0x4949;
        const tiffOffset = offset + 8;
        const dirOffset = tiffOffset + view.getUint32(tiffOffset + 4, little);
        const tags = view.getUint16(dirOffset, little);
        for (let i = 0; i < tags; i++) {
          const entryOffset = dirOffset + 2 + i * 12;
          if (view.getUint16(entryOffset, little) === 0x0112) return view.getUint16(entryOffset + 8, little);
        }
        return 1;
      }
      if ((marker & 0xFF00) !== 0xFF00) break;
      offset += view.getUint16(offset);
    }
  } catch {
    // ignora archivos sin EXIF valido
  }
  return 1;
}

// Dibuja un source (ImageBitmap o HTMLImageElement) aplicando la orientacion EXIF y devuelve el dataURL comprimido.
function drawToCompressedDataUrl(source, w, h, maxSize, quality, orientation = 1) {
  const swapped = orientation >= 5 && orientation <= 8;
  const scale = Math.min(1, maxSize / Math.max(swapped ? h : w, swapped ? w : h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((swapped ? h : w) * scale);
  canvas.height = Math.round((swapped ? w : h) * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, h, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, h, w); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, w); break;
    default: break;
  }
  ctx.drawImage(source, 0, 0, w, h);
  let out = canvas.toDataURL('image/jpeg', quality);
  let q = quality;
  while (out.length > 700000 && q > 0.3) {
    q -= 0.12;
    out = canvas.toDataURL('image/jpeg', q);
  }
  return out;
}

// Reduce y comprime la imagen en el navegador para guardarla en Firestore.
// Usa createImageBitmap directo sobre el archivo (soporta blobs grandes de selectores tipo
// Google Fotos) y corrige la orientacion EXIF para que la foto no quede rotada en ningun dispositivo.
// Si createImageBitmap no esta disponible o falla, usa un ObjectURL (mas tolerante que un dataURL
// con archivos sin tipo MIME correcto, como los que a veces entrega el picker de Google Fotos)
// aplicando manualmente la rotacion EXIF leida del propio archivo.
// WebP y AVIF ya los decodifica el navegador via createImageBitmap/Image sin nada especial.
// HEIC/HEIF (fotos de iPhone) no lo decodifica ningun navegador salvo Safari/iOS: si ambos intentos
// fallan y el archivo es HEIC/HEIF se convierte a JPEG con heic2any (cargado solo si hace falta).
export async function compressImage(file, maxSize = 700, quality = 0.72) {
  if (!file) return '';
  try {
    return await decodeAndCompress(file, maxSize, quality);
  } catch (err) {
    if (looksLikeHeic(file)) {
      let jpegBlob;
      try {
        jpegBlob = await convertHeicToJpeg(file);
      } catch {
        throw new Error('Esta foto es HEIC/HEIF y no se pudo convertir. Prueba exportarla como JPEG.');
      }
      return decodeAndCompress(jpegBlob, maxSize, quality);
    }
    throw err;
  }
}

// Intenta decodificar con createImageBitmap y, si falla, con un ObjectURL + <img>.
async function decodeAndCompress(file, maxSize, quality) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const out = drawToCompressedDataUrl(bitmap, bitmap.width, bitmap.height, maxSize, quality);
      bitmap.close?.();
      return out;
    } catch {
      // Sigue con el metodo alternativo si el navegador no puede decodificar asi.
    }
  }
  let orientation = 1;
  try {
    orientation = getExifOrientation(await file.arrayBuffer());
  } catch {
    orientation = 1;
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Archivo de imagen invalido.'));
      img.onload = () => resolve(drawToCompressedDataUrl(img, img.naturalWidth, img.naturalHeight, maxSize, quality, orientation));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function looksLikeHeic(file) {
  const type = (file.type || '').toLowerCase();
  if (type.includes('heic') || type.includes('heif')) return true;
  const name = (file.name || '').toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif');
}

const HEIC2ANY_CDN = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';

function loadScriptOnce(src) {
  if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar el conversor HEIC.'));
    document.head.appendChild(s);
  });
}

async function convertHeicToJpeg(file) {
  if (typeof window.heic2any !== 'function') await loadScriptOnce(HEIC2ANY_CDN);
  const result = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
  return Array.isArray(result) ? result[0] : result;
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
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // Revisa si hay una version nueva al abrir/volver a la app (util en PWA instalada).
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch(() => {});
    // Cuando el nuevo service worker toma el control, recarga para usar la version fresca
    // (evita quedarse con un dispositivo/instalacion viendo datos o codigo desactualizado).
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}
