/* Cesta de compras guardada en el navegador (localStorage). */
const Cart = (() => {
  const KEY = 'cesta_v1';

  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  };
  const write = (items) => {
    localStorage.setItem(KEY, JSON.stringify(items));
    updateBadges();
  };
  const fmt = (n) => (window.CURRENCY || '$') + Number(n || 0).toFixed(2);

  function updateBadges() {
    const count = read().reduce((acc, i) => acc + i.qty, 0);
    ['cart-badge', 'fab-badge'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = count;
      el.classList.toggle('d-none', count === 0);
    });
  }

  function add(product) {
    const items = read();
    const found = items.find(i => i.id === product.id);
    if (found) found.qty += 1;
    else items.push({ ...product, qty: 1 });
    write(items);
    showToast(`"${product.name}" agregado a la cesta`);
  }

  function setQty(id, qty) {
    let items = read();
    qty = Math.max(0, parseInt(qty, 10) || 0);
    items = qty === 0 ? items.filter(i => i.id !== id) : items.map(i => i.id === id ? { ...i, qty } : i);
    write(items);
    renderCartPage();
  }

  const total = () => read().reduce((acc, i) => acc + i.price * i.qty, 0);
  const clear = () => write([]);

  function renderCartPage() {
    const list = document.getElementById('cart-items');
    if (!list) return;
    const items = read();
    document.getElementById('cart-empty').classList.toggle('d-none', items.length > 0);
    document.getElementById('cart-content').classList.toggle('d-none', items.length === 0);

    list.innerHTML = items.map(i => `
      <div class="list-group-item d-flex align-items-center gap-3">
        ${i.image
          ? `<img src="${i.image}" class="cart-thumb" alt="">`
          : `<div class="cart-thumb bg-light d-flex align-items-center justify-content-center text-muted"><i class="bi bi-image"></i></div>`}
        <div class="flex-grow-1">
          <div class="fw-semibold">${i.name}</div>
          <div class="small text-muted">${fmt(i.price)} c/u</div>
        </div>
        <div class="d-flex align-items-center gap-1">
          <button class="btn btn-sm btn-outline-secondary" onclick="Cart.setQty('${i.id}', ${i.qty - 1})">-</button>
          <span class="px-2">${i.qty}</span>
          <button class="btn btn-sm btn-outline-secondary" onclick="Cart.setQty('${i.id}', ${i.qty + 1})">+</button>
        </div>
        <strong class="ms-2 text-nowrap">${fmt(i.price * i.qty)}</strong>
        <button class="btn btn-sm btn-link text-danger" onclick="Cart.setQty('${i.id}', 0)"><i class="bi bi-trash"></i></button>
      </div>`).join('');

    const totalEl = document.getElementById('cart-total');
    if (totalEl) totalEl.textContent = fmt(total());
  }

  document.addEventListener('DOMContentLoaded', updateBadges);
  return { add, setQty, clear, total, items: read, renderCartPage, updateBadges };
})();
