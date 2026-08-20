// Capa de datos y logica de negocio sobre Firestore.
import { db } from './firebase.js';
import { normalize, normalizePhone } from './ui.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const COL = { products: 'products', purchases: 'purchases', sales: 'sales', orders: 'orders' };

// Fechas en hora local: con UTC las ventas de la tarde caian en el dia siguiente
// y quedaban fuera del resumen.
const pad = (n) => String(n).padStart(2, '0');
const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nowIso = () => `${localDay()}T${pad(new Date().getHours())}:${pad(new Date().getMinutes())}:${pad(new Date().getSeconds())}`;
export const todayStr = () => localDay();
const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const int = (v) => Math.trunc(num(v));
const newCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
export const categoryKey = (value) => normalize(value || 'General');
export const normalizeCategory = (value) => {
  const category = String(value ?? '').normalize('NFC').trim()
    .replace(/\s+/g, ' ').toLocaleLowerCase('es-ES');
  return category
    ? category.charAt(0).toLocaleUpperCase('es-ES') + category.slice(1)
    : 'General';
};

async function all(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ------------------------------------------------------------------ productos
export async function listProducts({ onlyActive = false } = {}) {
  let items = await all(COL.products);
  items = items.map((product) => ({
    ...product,
    category: normalizeCategory(product.category),
    category_key: product.category_key || categoryKey(product.category)
  }));
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
    category: normalizeCategory(data.category),
    category_key: categoryKey(data.category),
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
  return [...new Set(items.map((p) => p.category))].sort();
}

// -------------------------------------------------------------------- compras
export async function listPurchases() {
  const items = await all(COL.purchases);
  return items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

// Escucha cambios en tiempo real: asi se ven las compras registradas desde cualquier
// dispositivo sin depender de que este dispositivo haga su propia lectura/refresco.
export function subscribePurchases(cb) {
  return onSnapshot(collection(db, COL.purchases), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    cb(items);
  });
}

// Nota: se evitan idas y vueltas extra a Firestore (cada await es un round-trip de red que en
// tablets/wifi lentos se nota mucho); se hace una sola lectura de producto y una sola escritura
// combinada (metadatos + stock) en vez de leer/escribir el producto varias veces por separado.
export async function registerPurchase(data) {
  const quantity = Math.max(1, int(data.quantity) || 1);
  const unitCost = num(data.unit_cost);
  const salePrice = num(data.price);
  let productId = (data.product_id || '').trim();
  let product = null;

  if (productId) {
    product = await getProduct(productId);
    if (!product) throw new Error('El producto seleccionado ya no existe.');
  } else {
    if (!(data.name || '').trim()) throw new Error('Escribe el nombre del producto.');
    const key = normalize(data.name);
    product = (await listProducts()).find((p) => (p.name_key || normalize(p.name)) === key) || null;
    if (product) productId = product.id;
  }

  const category = normalizeCategory(data.category || product?.category);
  const category_key = categoryKey(category);
  const description = (data.description || product?.description || '').trim();
  const image_url = data.image_url || product?.image_url || '';

  if (productId) {
    await updateDoc(doc(db, COL.products, productId), {
      stock: Math.max(0, int(product.stock) + quantity),
      price: salePrice > 0 ? salePrice : num(product.price),
      cost: unitCost > 0 ? unitCost : num(product.cost),
      category, category_key, description, image_url,
      updated_at: nowIso()
    });
  } else {
    productId = await saveProduct({ ...data, category, description, image_url, stock: quantity, cost: unitCost, price: salePrice });
  }

  await addDoc(collection(db, COL.purchases), {
    product_id: productId,
    product_name: product?.name || data.name || '',
    category, category_key,
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

  const disponible = int(product.stock);
  if (quantity > disponible) {
    throw new Error(`Stock insuficiente de "${product.name}": pides ${quantity} y hay ${disponible}.`);
  }

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
  const sinStock = [];
  let total = 0;
  for (const raw of payload.items) {
    const product = await getProduct(String(raw.id));
    if (!product || product.active === false) continue;
    const qty = Math.max(1, int(raw.qty) || 1);
    const disponible = int(product.stock);
    if (qty > disponible) {
      sinStock.push(disponible > 0
        ? `${product.name}: solo quedan ${disponible}`
        : `${product.name}: agotado`);
      continue;
    }
    const price = num(product.price);
    const subtotal = Number((price * qty).toFixed(2));
    total += subtotal;
    items.push({ product_id: product.id, name: product.name || '', price, qty, subtotal });
  }
  if (sinStock.length) throw new Error(`Sin disponibilidad. ${sinStock.join('. ')}. Ajusta tu cesta.`);
  if (!items.length) throw new Error('Los productos ya no estan disponibles.');

  const order = {
    code: newCode(),
    customer_name: name,
    customer_key: normalize(name),
    phone,
    phone_key: normalizePhone(phone),
    email: (payload.email || '').trim().toLowerCase(),
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

  const registrarVenta = status === 'vendido' && !order.sales_registered;

  // Se valida todo el pedido antes de tocar nada para no dejar ventas a medias.
  if (registrarVenta) {
    const faltantes = [];
    for (const item of order.items || []) {
      const product = await getProduct(item.product_id);
      if (!product) {
        faltantes.push(`${item.name}: ya no existe en el inventario`);
        continue;
      }
      const disponible = int(product.stock);
      if (int(item.qty) > disponible) {
        faltantes.push(`${product.name}: pide ${int(item.qty)} y hay ${disponible}`);
      }
    }
    if (faltantes.length) {
      throw new Error(`No se puede vender por falta de stock. ${faltantes.join('. ')}. Registra la compra primero.`);
    }
  }

  await updateDoc(doc(db, COL.orders, orderId), { status, updated_at: nowIso() });

  if (registrarVenta) {
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

export const markOrderSold = (orderId) => updateOrderStatus(orderId, 'vendido');

export const deleteOrder = (id) => deleteDoc(doc(db, COL.orders, id));

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

export async function monthlySummary(reference = new Date()) {
  const [products, sales, purchases, orders] = await Promise.all([
    listProducts(), listSales(), listPurchases(), listOrders()
  ]);

  const year = reference.getFullYear();
  const month = reference.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const s0 = localDay(new Date(year, month, 1));
  const s1 = localDay(new Date(year, month, daysInMonth));

  const monthSales = sales.filter((s) => inRange(s.date, s0, s1));
  const monthPurchases = purchases.filter((p) => inRange(p.date, s0, s1));
  const monthOrders = orders.filter((o) => inRange(o.created_at, s0, s1));

  const labels = [], salesSeries = [], purchaseSeries = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const key = localDay(new Date(year, month, day));
    labels.push(String(day));
    salesSeries.push(Number(monthSales.filter((s) => String(s.date).slice(0, 10) === key)
      .reduce((a, s) => a + num(s.total), 0).toFixed(2)));
    purchaseSeries.push(Number(monthPurchases.filter((p) => String(p.date).slice(0, 10) === key)
      .reduce((a, p) => a + num(p.total), 0).toFixed(2)));
  }

  const top = {};
  for (const s of monthSales) {
    const k = s.product_name || '-';
    top[k] = top[k] || { name: k, qty: 0, total: 0 };
    top[k].qty += int(s.quantity);
    top[k].total = Number((top[k].total + num(s.total)).toFixed(2));
  }

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  return {
    range: `${MESES[month]} ${year}`,
    labels, salesSeries, purchaseSeries,
    totalSales: Number(monthSales.reduce((a, s) => a + num(s.total), 0).toFixed(2)),
    totalPurchases: Number(monthPurchases.reduce((a, p) => a + num(p.total), 0).toFixed(2)),
    profit: Number(monthSales.reduce((a, s) => a + num(s.profit), 0).toFixed(2)),
    salesCount: monthSales.length,
    ordersCount: monthOrders.length,
    newOrders: orders.filter((o) => o.status === 'nuevo').length,
    pendingOrders: orders.filter((o) => ['nuevo', 'visto', 'confirmado'].includes(o.status)).length,
    topProducts: Object.values(top).sort((a, b) => b.total - a.total).slice(0, 5),
    inventoryValue: Number(products.reduce((a, p) => a + num(p.cost) * int(p.stock), 0).toFixed(2)),
    productsCount: products.length,
    lowStock: products.filter((p) => int(p.stock) <= 3).sort((a, b) => int(a.stock) - int(b.stock)).slice(0, 8)
  };
}
