// Capa de datos y logica de negocio sobre Firestore.
import { db } from './firebase.js';
import { normalize, normalizePhone } from './ui.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const COL = { products: 'products', purchases: 'purchases', sales: 'sales', orders: 'orders' };

const nowIso = () => new Date().toISOString().slice(0, 19);
export const todayStr = () => new Date().toISOString().slice(0, 10);
const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const int = (v) => Math.trunc(num(v));
const newCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

async function all(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ------------------------------------------------------------------ productos
export async function listProducts({ onlyActive = false } = {}) {
  let items = await all(COL.products);
  if (onlyActive) items = items.filter((p) => p.active !== false);
  return items.sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));
}

export async function getProduct(id) {
  const snap = await getDoc(doc(db, COL.products, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveProduct(data, id = null) {
  const payload = {
    name: (data.name || '').trim(),
    name_key: normalize(data.name),
    category: (data.category || '').trim() || 'General',
    description: (data.description || '').trim(),
    price: num(data.price),
    cost: num(data.cost),
    stock: int(data.stock),
    active: data.active !== false,
    updated_at: nowIso()
  };
  if (data.image_url) payload.image_url = data.image_url;

  if (id) {
    await updateDoc(doc(db, COL.products, id), payload);
    return id;
  }
  payload.image_url = payload.image_url || '';
  payload.created_at = nowIso();
  const ref = await addDoc(collection(db, COL.products), payload);
  return ref.id;
}

export const deleteProduct = (id) => deleteDoc(doc(db, COL.products, id));

async function adjustStock(productId, delta) {
  const product = await getProduct(productId);
  if (!product) return;
  const stock = Math.max(0, int(product.stock) + delta);
  await updateDoc(doc(db, COL.products, productId), { stock, updated_at: nowIso() });
}

export async function categories() {
  const items = await listProducts();
  return [...new Set(items.map((p) => p.category || 'General'))].sort();
}

// -------------------------------------------------------------------- compras
export async function listPurchases() {
  const items = await all(COL.purchases);
  return items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export async function registerPurchase(data) {
  const quantity = Math.max(1, int(data.quantity) || 1);
  const unitCost = num(data.unit_cost);
  const salePrice = num(data.price);
  let productId = (data.product_id || '').trim();

  if (productId) {
    const update = { updated_at: nowIso() };
    if (salePrice > 0) update.price = salePrice;
    if (unitCost > 0) update.cost = unitCost;
    if (data.image_url) update.image_url = data.image_url;
    if (data.category) update.category = data.category.trim();
    if (data.description) update.description = data.description.trim();
    await updateDoc(doc(db, COL.products, productId), update);
  } else {
    if (!(data.name || '').trim()) throw new Error('Escribe el nombre del producto.');
    const key = normalize(data.name);
    const existing = (await listProducts()).find((p) => (p.name_key || normalize(p.name)) === key);
    if (existing) {
      productId = existing.id;
      await updateDoc(doc(db, COL.products, productId), {
        price: salePrice || num(existing.price),
        cost: unitCost || num(existing.cost),
        category: (data.category || existing.category || 'General').trim(),
        description: (data.description || existing.description || '').trim(),
        image_url: data.image_url || existing.image_url || '',
        updated_at: nowIso()
      });
    } else {
      productId = await saveProduct({ ...data, stock: 0, cost: unitCost, price: salePrice });
    }
  }

  await adjustStock(productId, quantity);
  const product = await getProduct(productId);

  await addDoc(collection(db, COL.purchases), {
    product_id: productId,
    product_name: product?.name || data.name || '',
    category: product?.category || 'General',
    quantity,
    unit_cost: unitCost,
    total: Number((unitCost * quantity).toFixed(2)),
    supplier: (data.supplier || '').trim(),
    note: (data.note || '').trim(),
    date: data.date || todayStr(),
    created_at: nowIso()
  });
}

export async function deletePurchase(id) {
  const snap = await getDoc(doc(db, COL.purchases, id));
  if (snap.exists()) {
    const p = snap.data();
    if (p.product_id) await adjustStock(p.product_id, -int(p.quantity));
  }
  await deleteDoc(doc(db, COL.purchases, id));
}

// --------------------------------------------------------------------- ventas
export async function listSales() {
  const items = await all(COL.sales);
  return items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export async function registerSale(data) {
  const product = await getProduct((data.product_id || '').trim());
  if (!product) throw new Error('Selecciona un producto valido.');

  const quantity = Math.max(1, int(data.quantity) || 1);
  const unitPrice = num(data.unit_price) || num(product.price);
  const unitCost = num(product.cost);

  await addDoc(collection(db, COL.sales), {
    product_id: product.id,
    product_name: product.name || '',
    category: product.category || 'General',
    quantity,
    unit_price: unitPrice,
    unit_cost: unitCost,
    total: Number((unitPrice * quantity).toFixed(2)),
    profit: Number(((unitPrice - unitCost) * quantity).toFixed(2)),
    customer: (data.customer || 'Venta directa').trim(),
    order_id: data.order_id || '',
    date: data.date || todayStr(),
    created_at: nowIso()
  });
  await adjustStock(product.id, -quantity);
}

export async function deleteSale(id) {
  const snap = await getDoc(doc(db, COL.sales, id));
  if (snap.exists()) {
    const v = snap.data();
    if (v.product_id) await adjustStock(v.product_id, int(v.quantity));
  }
  await deleteDoc(doc(db, COL.sales, id));
}

// -------------------------------------------------------------------- pedidos
export async function listOrders(status = '') {
  let items = await all(COL.orders);
  if (status) items = items.filter((o) => o.status === status);
  return items.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

export async function getOrder(id) {
  const snap = await getDoc(doc(db, COL.orders, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createOrder(payload) {
  const name = (payload.customer_name || '').trim();
  const phone = (payload.phone || '').trim();
  if (!name || !normalizePhone(phone)) throw new Error('Nombre y telefono son obligatorios.');
  if (!payload.items?.length) throw new Error('Tu cesta esta vacia.');

  const items = [];
  let total = 0;
  for (const raw of payload.items) {
    const product = await getProduct(String(raw.id));
    if (!product || product.active === false) continue;
    const qty = Math.max(1, int(raw.qty) || 1);
    const price = num(product.price);
    const subtotal = Number((price * qty).toFixed(2));
    total += subtotal;
    items.push({ product_id: product.id, name: product.name || '', price, qty, subtotal });
  }
  if (!items.length) throw new Error('Los productos ya no estan disponibles.');

  const order = {
    code: newCode(),
    customer_name: name,
    customer_key: normalize(name),
    phone,
    phone_key: normalizePhone(phone),
    address: (payload.address || '').trim(),
    note: (payload.note || '').trim(),
    items,
    total: Number(total.toFixed(2)),
    status: 'nuevo',
    created_at: nowIso(),
    updated_at: nowIso()
  };
  const ref = await addDoc(collection(db, COL.orders), order);
  return { id: ref.id, ...order };
}

export async function updateOrderStatus(orderId, status) {
  const order = await getOrder(orderId);
  if (!order) return null;

  await updateDoc(doc(db, COL.orders, orderId), { status, updated_at: nowIso() });

  if (status === 'confirmado' && !order.sales_registered) {
    for (const item of order.items || []) {
      await registerSale({
        product_id: item.product_id,
        quantity: item.qty,
        unit_price: item.price,
        customer: order.customer_name,
        order_id: orderId
      });
    }
    await updateDoc(doc(db, COL.orders, orderId), { sales_registered: true });
  }
  return { ...order, status };
}

export async function findOrders(name, phone) {
  const phoneKey = normalizePhone(phone);
  const nameKey = normalize(name);
  if (!phoneKey || !nameKey) return [];
  const tail = phoneKey.slice(-8);

  return (await listOrders()).filter((o) => {
    const stored = o.phone_key || normalizePhone(o.phone);
    if (stored !== phoneKey && !stored.endsWith(tail)) return false;
    const who = o.customer_key || normalize(o.customer_name);
    return who === nameKey || who.includes(nameKey) || nameKey.includes(who);
  });
}

// -------------------------------------------------------------------- reporte
const inRange = (value, start, end) => {
  const d = String(value || '').slice(0, 10);
  return d >= start && d <= end;
};

export async function weeklySummary(days = 7) {
  const [products, sales, purchases, orders] = await Promise.all([
    listProducts(), listSales(), listPurchases(), listOrders()
  ]);

  const end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - (days - 1));
  const iso = (d) => d.toISOString().slice(0, 10);
  const s0 = iso(start), s1 = iso(end);

  const weekSales = sales.filter((s) => inRange(s.date, s0, s1));
  const weekPurchases = purchases.filter((p) => inRange(p.date, s0, s1));
  const weekOrders = orders.filter((o) => inRange(o.created_at, s0, s1));

  const labels = [], salesSeries = [], purchaseSeries = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(start); day.setDate(start.getDate() + i);
    const key = iso(day);
    labels.push(`${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`);
    salesSeries.push(Number(weekSales.filter((s) => String(s.date).slice(0, 10) === key)
      .reduce((a, s) => a + num(s.total), 0).toFixed(2)));
    purchaseSeries.push(Number(weekPurchases.filter((p) => String(p.date).slice(0, 10) === key)
      .reduce((a, p) => a + num(p.total), 0).toFixed(2)));
  }

  const top = {};
  for (const s of weekSales) {
    const k = s.product_name || '-';
    top[k] = top[k] || { name: k, qty: 0, total: 0 };
    top[k].qty += int(s.quantity);
    top[k].total = Number((top[k].total + num(s.total)).toFixed(2));
  }

  return {
    range: `${s0.split('-').reverse().join('/')} - ${s1.split('-').reverse().join('/')}`,
    labels, salesSeries, purchaseSeries,
    totalSales: Number(weekSales.reduce((a, s) => a + num(s.total), 0).toFixed(2)),
    totalPurchases: Number(weekPurchases.reduce((a, p) => a + num(p.total), 0).toFixed(2)),
    profit: Number(weekSales.reduce((a, s) => a + num(s.profit), 0).toFixed(2)),
    salesCount: weekSales.length,
    ordersCount: weekOrders.length,
    newOrders: orders.filter((o) => o.status === 'nuevo').length,
    topProducts: Object.values(top).sort((a, b) => b.total - a.total).slice(0, 5),
    inventoryValue: Number(products.reduce((a, p) => a + num(p.cost) * int(p.stock), 0).toFixed(2)),
    productsCount: products.length,
    lowStock: products.filter((p) => int(p.stock) <= 3).sort((a, b) => int(a.stock) - int(b.stock)).slice(0, 8)
  };
}
