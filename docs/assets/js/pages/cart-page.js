import { createOrder } from '../store.js';
import { BUSINESS } from '../firebase.js';
import { renderNavbar, showToast, loading, registerServiceWorker } from '../ui.js';
import * as Cart from '../cart.js';

renderNavbar({ active: './carrito.html' });
registerServiceWorker();
document.getElementById('footer').textContent = `${BUSINESS.name} · Sistema de gestion`;
Cart.renderCartPage();

document.getElementById('order-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  loading(true, 'Enviando pedido...');
  try {
    const form = Object.fromEntries(new FormData(e.target).entries());
    form.items = Cart.items().map((i) => ({ id: i.id, qty: i.qty }));
    const order = await createOrder(form);
    Cart.clear();
    location.href = `./pedido.html?id=${order.id}`;
  } catch (err) {
    showToast(err.message, 'danger');
    btn.disabled = false;
  } finally {
    loading(false);
  }
});
