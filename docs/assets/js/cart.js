// Cesta guardada en el navegador (localStorage).
import { money, showToast, escapeHtml } from './ui.js';

const KEY = 'cesta_v1';

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };

function write(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
  updateBadge();
}

export function updateBadge() {
  const count = read().reduce((a, i) => a + i.qty, 0);
  ['cart-badge', 'fab-badge'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = count;
    el.classList.toggle('d-none', count === 0);
  });
}

export const items = read;
export const total = () => read().reduce((a, i) => a + i.price * i.qty, 0);
export const clear = () => write([]);

export function add(product) {
  const list = read();
  const found = list.find((i) => i.id === product.id);
  if (found) found.qty += 1;
  else list.push({ ...product, qty: 1 });
  write(list);
  showToast(`"${product.name}" agregado a la cesta`);
}

export function setQty(id, qty) {
  qty = Math.max(0, parseInt(qty, 10) || 0);
  const list = qty === 0
    ? read().filter((i) => i.id !== id)
    : read().map((i) => (i.id === id ? { ...i, qty } : i));
  write(list);
  renderCartPage();
}

export function renderCartPage() {
  const list = document.getElementById('cart-items');
  if (!list) return;
  const data = read();
  document.getElementById('cart-empty').classList.toggle('d-none', data.length > 0);
  document.getElementById('cart-content').classList.toggle('d-none', data.length === 0);

  list.innerHTML = data.map((i) => `
    <div class="list-group-item d-flex align-items-center gap-3">
      ${i.image
        ? `<img src="${i.image}" class="cart-thumb" alt="">`
        : '<div class="cart-thumb bg-light d-flex align-items-center justify-content-center text-muted"><i class="bi bi-image"></i></div>'}
      <div class="flex-grow-1 min-w-0">
        <div class="fw-semibold text-truncate">${escapeHtml(i.name)}</div>
        <div class="small text-muted">${money(i.price)} c/u</div>
      </div>
      <div class="d-flex align-items-center gap-1">
        <button class="btn btn-sm btn-outline-secondary" data-qty="${i.id}" data-value="${i.qty - 1}">-</button>
        <span class="px-2">${i.qty}</span>
        <button class="btn btn-sm btn-outline-secondary" data-qty="${i.id}" data-value="${i.qty + 1}">+</button>
      </div>
      <strong class="ms-2 text-nowrap">${money(i.price * i.qty)}</strong>
      <button class="btn btn-sm btn-link text-danger" data-qty="${i.id}" data-value="0"><i class="bi bi-trash"></i></button>
    </div>`).join('');

  list.querySelectorAll('[data-qty]').forEach((btn) => {
    btn.addEventListener('click', () => setQty(btn.dataset.qty, btn.dataset.value));
  });

  const totalEl = document.getElementById('cart-total');
  if (totalEl) totalEl.textContent = money(total());
}

document.addEventListener('DOMContentLoaded', updateBadge);
