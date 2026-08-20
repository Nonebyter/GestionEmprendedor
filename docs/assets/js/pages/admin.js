import { auth, BUSINESS } from "../firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  listProducts,
  saveProduct,
  deleteProduct,
  listPurchases,
  subscribePurchases,
  registerPurchase,
  deletePurchase,
  listSales,
  registerSale,
  deleteSale,
  listOrders,
  updateOrderStatus,
  markOrderSold,
  deleteOrder,
  monthlySummary,
  todayStr,
} from "../store.js";
import {
  money,
  escapeHtml,
  fechaCorta,
  compressImage,
  showToast,
  loading,
  openImage,
  normalize,
  normalizePhone,
  filterList,
  renderNavbar,
  registerServiceWorker,
  confirmDialog,
  enhanceSelect,
  STATUSES,
  STATUS_LABEL,
  STATUS_COLOR,
} from "../ui.js";

renderNavbar({ active: "#resumen", admin: true });
registerServiceWorker();
document.getElementById("footer").textContent =
  `${BUSINESS.name} · Panel de administracion`;

const $ = (id) => document.getElementById(id);
const SECTIONS = ["resumen", "inventario", "compras", "ventas", "pedidos"];
// Pedidos que siguen requiriendo atencion; los vendidos salen de la vista por defecto.
const PEDIDOS_ACTIVOS = ["nuevo", "visto", "confirmado"];
let productos = [],
  chart = null,
  filtroPedidos = "",
  busquedaPedidos = "",
  unsubPurchases = null,
  comprasActuales = [];

// ------------------------------------------------------------------ sesion
document
  .getElementById("btn-logout")
  ?.addEventListener("click", () => signOut(auth));

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { email, password } = Object.fromEntries(
    new FormData(e.target).entries(),
  );
  loading(true, "Ingresando...");
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    showToast(
      err.code === "auth/invalid-credential"
        ? "Correo o contrasena incorrectos."
        : err.message,
      "danger",
    );
  } finally {
    loading(false);
  }
});

onAuthStateChanged(auth, (user) => {
  $("login-view").classList.toggle("d-none", !!user);
  $("admin-view").classList.toggle("d-none", !user);
  document
    .querySelector("#navbar .navbar-collapse")
    .classList.toggle("invisible", !user);
  if (unsubPurchases) {
    unsubPurchases();
    unsubPurchases = null;
  }
  if (user) {
    cargarTodo();
    unsubPurchases = subscribePurchases(
      renderCompras,
      (err) => showToast(`No se pudieron cargar las compras: ${err.message}`, "danger"),
    );
  }
});

// --------------------------------------------------------------- navegacion
function mostrarSeccion(name) {
  if (!SECTIONS.includes(name)) name = "resumen";
  SECTIONS.forEach((s) => $(`sec-${s}`).classList.toggle("d-none", s !== name));
  document.querySelectorAll("#navbar .nav-link").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === `#${name}`);
    a.classList.toggle("fw-semibold", a.getAttribute("href") === `#${name}`);
  });
  window.scrollTo({ top: 0 });
}
window.addEventListener("hashchange", () =>
  mostrarSeccion(location.hash.slice(1)),
);
mostrarSeccion(location.hash.slice(1));

// ------------------------------------------------------------------ resumen
async function cargarResumen() {
  const s = await monthlySummary();
  $("rango").textContent = s.range;

  $("alerta-pedidos").innerHTML = s.newOrders
    ? `<div class="alert alert-danger d-flex justify-content-between align-items-center">
         <span><i class="bi bi-bell"></i> Tienes <strong>${s.newOrders}</strong> pedido(s) nuevo(s) sin revisar.</span>
         <a href="#pedidos" class="btn btn-sm btn-danger">Ver</a></div>`
    : "";

  const badge = $("nav-new-orders");
  if (badge) {
    badge.textContent = s.newOrders;
    badge.classList.toggle("d-none", !s.newOrders);
  }

  const cards = [
    ["Ventas del mes", money(s.totalSales), "bi-graph-up-arrow", "primary"],
    ["Compras del mes", money(s.totalPurchases), "bi-cart-plus", "warning"],
    ["Ganancia estimada", money(s.profit), "bi-piggy-bank", "success"],
    ["Valor del inventario", money(s.inventoryValue), "bi-box-seam", "info"],
  ];
  $("tarjetas").innerHTML = cards
    .map(
      ([t, v, icon, color]) => `
    <div class="col-6 col-lg-3"><div class="card shadow-sm h-100 border-0 border-start border-4 border-${color}">
      <div class="card-body"><div class="text-muted small"><i class="bi ${icon}"></i> ${t}</div>
      <div class="fs-4 fw-bold">${v}</div></div></div></div>`,
    )
    .join("");

  $("top-productos").innerHTML = s.topProducts.length
    ? `<ul class="list-group list-group-flush">${s.topProducts
        .map(
          (p) => `
        <li class="list-group-item d-flex justify-content-between px-0">
          <span class="text-truncate">${escapeHtml(p.name)} <span class="text-muted small">x${p.qty}</span></span>
          <strong>${money(p.total)}</strong></li>`,
        )
        .join("")}</ul>`
    : '<p class="text-muted small mb-0">Aun no hay ventas este mes.</p>';

  $("stock-bajo").innerHTML = s.lowStock.length
    ? `<ul class="list-group list-group-flush">${s.lowStock
        .map(
          (p) => `
        <li class="list-group-item d-flex justify-content-between px-0">
          <span class="text-truncate">${escapeHtml(p.name)}</span>
          <span class="badge text-bg-${Number(p.stock) <= 0 ? "danger" : "warning"}">${Number(p.stock) || 0} u.</span></li>`,
        )
        .join("")}</ul>`
    : '<p class="text-muted small mb-0">Todo el inventario esta en buen nivel.</p>';

  $("actividad").innerHTML = `<ul class="list-group list-group-flush">
    <li class="list-group-item d-flex justify-content-between px-0">Ventas registradas <strong>${s.salesCount}</strong></li>
    <li class="list-group-item d-flex justify-content-between px-0">Pedidos recibidos <strong>${s.ordersCount}</strong></li>
    <li class="list-group-item d-flex justify-content-between px-0">Pedidos pendientes de venta <strong>${s.pendingOrders}</strong></li>
    <li class="list-group-item d-flex justify-content-between px-0">Productos en catalogo <strong>${s.productsCount}</strong></li></ul>`;

  chart?.destroy();
  chart = new Chart($("weekChart"), {
    type: "bar",
    data: {
      labels: s.labels,
      datasets: [
        { label: "Ventas", data: s.salesSeries, backgroundColor: "#c42d67" },
        {
          label: "Compras",
          data: s.purchaseSeries,
          backgroundColor: "#d77c72",
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(196,45,103,.15)" },
          ticks: { color: "#795667" },
        },
        x: { grid: { display: false }, ticks: { color: "#795667" } },
      },
      plugins: { legend: { labels: { color: "#35242d" } } },
    },
  });
}

// --------------------------------------------------------------- inventario
async function cargarProductos() {
  productos = await listProducts();

  $("tb-productos").innerHTML = productos.length
    ? productos
        .map(
          (p) => `
    <tr data-key="${escapeHtml(p.name + " " + (p.category || ""))}">
      <td style="width:56px">${
        p.image_url
          ? `<img src="${p.image_url}" class="thumb zoomable" data-zoom="${p.id}" alt="">`
          : '<div class="thumb bg-light d-flex align-items-center justify-content-center text-muted"><i class="bi bi-image"></i></div>'
      }</td>
      <td><div class="fw-semibold">${escapeHtml(p.name)}</div>
        <div class="small text-muted text-truncate" style="max-width:240px">${escapeHtml(p.description || "")}</div></td>
      <td><span class="badge text-bg-light text-muted">${escapeHtml(p.category || "General")}</span></td>
      <td class="text-end">${money(p.cost)}</td>
      <td class="text-end fw-semibold">${money(p.price)}</td>
      <td class="text-center"><span class="badge text-bg-${Number(p.stock) <= 0 ? "danger" : Number(p.stock) <= 3 ? "warning" : "success"}">${Number(p.stock) || 0}</span></td>
      <td class="text-center">${p.active === false ? '<i class="bi bi-eye-slash text-muted"></i>' : '<i class="bi bi-eye text-success"></i>'}</td>
      <td class="text-end text-nowrap">
        <button class="btn btn-sm btn-outline-secondary" data-edit="${p.id}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" data-del-prod="${p.id}"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`,
        )
        .join("")
    : '<tr><td colspan="8" class="text-center text-muted py-4">Aun no hay productos. Registra una compra o crea uno nuevo.</td></tr>';

  const cats = [
    ...new Set(productos.map((p) => p.category || "General")),
  ].sort();
  $("cats").innerHTML = cats
    .map((c) => `<option value="${escapeHtml(c)}">`)
    .join("");

  const opciones = productos
    .map(
      (p) =>
        `<option value="${p.id}" data-price="${p.price || 0}" data-cost="${p.cost || 0}" ${Number(p.stock) <= 0 ? "" : ""}>
      ${escapeHtml(p.name)} (stock ${Number(p.stock) || 0})</option>`,
    )
    .join("");
  $("c-producto").innerHTML =
    '<option value="">-- Producto nuevo --</option>' + opciones;
  $("v-producto").innerHTML =
    '<option value="">Selecciona...</option>' +
    productos
      .map(
        (p) =>
          `<option value="${p.id}" data-price="${p.price || 0}" data-stock="${Number(p.stock) || 0}" ${Number(p.stock) <= 0 ? "disabled" : ""}>
      ${escapeHtml(p.name)} (stock ${Number(p.stock) || 0})</option>`,
      )
      .join("");
  enhanceSelect($("c-producto"));
  enhanceSelect($("v-producto"));

  document
    .querySelectorAll("[data-edit]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        abrirProducto(productos.find((p) => p.id === b.dataset.edit)),
      ),
    );
  document.querySelectorAll("[data-zoom]").forEach((img) =>
    img.addEventListener("click", () => {
      const p = productos.find((x) => x.id === img.dataset.zoom);
      openImage(p.image_url, p.name);
    }),
  );
  document.querySelectorAll("[data-del-prod]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!(await confirmDialog("Eliminar este producto?"))) return;
      loading(true, "Eliminando...");
      await deleteProduct(b.dataset.delProd);
      loading(false);
      showToast("Producto eliminado");
      cargarTodo();
    }),
  );
}

const productModal = new bootstrap.Modal($("productModal"));

function abrirProducto(p = {}) {
  $("pm-title").textContent = p.id ? "Editar producto" : "Nuevo producto";
  $("p-id").value = p.id || "";
  $("p-name").value = p.name || "";
  $("p-category").value = p.category || "";
  $("p-description").value = p.description || "";
  $("p-cost").value = p.cost ?? "";
  $("p-price").value = p.price ?? "";
  $("p-stock").value = p.stock ?? 0;
  $("p-active").checked = p.id ? p.active !== false : true;
  $("form-producto").querySelector("[name=image]").value = "";
  productModal.show();
}

$("btn-nuevo-producto").addEventListener("click", () => abrirProducto());

$("form-producto").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  data.active = form.active.checked;
  loading(true, "Guardando...");
  try {
    data.image_url = await compressImage(form.image.files[0]);
    await saveProduct(data, data.id || null);
    productModal.hide();
    showToast("Producto guardado");
    await cargarTodo();
  } catch (err) {
    showToast(err.message, "danger");
  } finally {
    loading(false);
  }
});

// ------------------------------------------------------------------ compras
$("c-producto").addEventListener("change", () => {
  const sel = $("c-producto");
  const esNuevo = !sel.value;
  $("c-nuevos").classList.toggle("d-none", !esNuevo);
  $("c-nombre").required = esNuevo;
  if (!esNuevo) {
    $("c-precio").value = sel.selectedOptions[0].dataset.price || 0;
    $("c-costo").value = sel.selectedOptions[0].dataset.cost || 0;
  }
});

$("form-compra").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  loading(true, "Registrando compra...");
  try {
    data.image_url = await compressImage(form.image.files[0]);
    await registerPurchase(data);
    renderCompras(await listPurchases());
    form.reset();
    $("c-fecha").value = todayStr();
    $("c-producto").dispatchEvent(new Event("change"));
    showToast("Compra registrada y stock actualizado");
    await cargarTodo();
  } catch (err) {
    showToast(err.message, "danger");
  } finally {
    loading(false);
  }
});

function renderCompras(compras) {
  const tbody = $("tb-compras");
  comprasActuales = compras || [];

  if (!comprasActuales.length) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center text-muted py-4">Sin compras registradas.</td></tr>';
    actualizarFiltroCompras();
    return;
  }

  tbody.innerHTML = comprasActuales
    .map(
      (c) => `
    <tr data-key="${escapeHtml(`${c.product_name} ${c.supplier || ""} ${c.date}`)}">
      <td class="small text-muted">${escapeHtml(c.date)}</td>
      <td>
        <div class="fw-semibold">${escapeHtml(c.product_name)}</div>
        ${c.supplier ? `<div class="small text-muted">${escapeHtml(c.supplier)}</div>` : ""}
        ${c.note ? `<div class="small text-muted">${escapeHtml(c.note)}</div>` : ""}
      </td>
      <td class="text-center">${Number(c.quantity) || 0}</td>
      <td class="text-end fw-semibold">${money(c.total)}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger" data-del-compra="${c.id}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>`,
    )
    .join("");
  actualizarFiltroCompras();
}

function actualizarFiltroCompras() {
  const terminos = normalize($("f-compras").value).split(/\s+/).filter(Boolean);
  const filas = [...$("tb-compras").querySelectorAll("tr[data-key]")];
  let visibles = 0;

  filas.forEach((fila) => {
    const coincide = terminos.every((termino) =>
      normalize(fila.dataset.key).includes(termino),
    );
    fila.classList.toggle("d-none", !coincide);
    if (coincide) visibles++;
  });

  $("compras-contador").textContent = comprasActuales.length
    ? `Mostrando ${visibles} de ${comprasActuales.length} compras`
    : "";
}

$("tb-compras").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-del-compra]");
  if (!btn) return;

  const idCompra = btn.dataset.delCompra;

  if (!(await confirmDialog("¿Eliminar la compra? Se descontará el stock.")))
    return;

  loading(true, "Eliminando...");
  try {
    await deletePurchase(idCompra);
    showToast("Compra eliminada");
    cargarTodo();
  } catch (error) {
    showToast("Error al eliminar la compra", "error");
  } finally {
    loading(false);
  }
});

function abrirAvisoDePedido(order, status, whatsappWindow = null) {
  const estado = STATUS_LABEL[status] || status;
  const mensaje = `Hola ${order.customer_name}, tu pedido #${order.code} ahora esta: ${estado}.`;
  const telefono = order.phone_key || normalizePhone(order.phone);

  if (telefono) {
    const whatsappUrl = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
    if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
    else window.open(whatsappUrl, "_blank", "noopener");
  } else {
    whatsappWindow?.close();
  }

  if (order.email) {
    const asunto = `Estado de tu pedido #${order.code}`;
    const copia = BUSINESS.email ? `&cc=${encodeURIComponent(BUSINESS.email)}` : "";
    window.location.href = `mailto:${encodeURIComponent(order.email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}${copia}`;
  }
}

// ------------------------------------------------------------------- ventas
$("v-producto").addEventListener("change", () => {
  const opcion = $("v-producto").selectedOptions[0];
  $("v-precio").value = opcion?.dataset.price || "";
  const cantidad = $("form-venta").quantity;
  const stock = Number(opcion?.dataset.stock) || 0;
  cantidad.max = stock || "";
  if (Number(cantidad.value) > stock) cantidad.value = stock || 1;
});

$("form-venta").addEventListener("submit", async (e) => {
  e.preventDefault();
  loading(true, "Registrando venta...");
  try {
    await registerSale(Object.fromEntries(new FormData(e.target).entries()));
    e.target.reset();
    $("v-fecha").value = todayStr();
    showToast("Venta registrada");
    await cargarTodo();
  } catch (err) {
    showToast(err.message, "danger");
  } finally {
    loading(false);
  }
});

async function cargarVentas() {
  const ventas = await listSales();
  $("tb-ventas").innerHTML = ventas.length
    ? ventas
        .map(
          (v) => `
    <tr data-key="${escapeHtml(`${v.product_name} ${v.customer || ""} ${v.date}`)}">
      <td class="small text-muted">${escapeHtml(v.date)}</td>
      <td><div class="fw-semibold">${escapeHtml(v.product_name)}</div>
        <div class="small text-muted">${escapeHtml(v.customer || "")}</div></td>
      <td class="text-center">${Number(v.quantity) || 0}</td>
      <td class="text-end fw-semibold">${money(v.total)}</td>
      <td class="text-end ${Number(v.profit) >= 0 ? "text-success" : "text-danger"}">${money(v.profit)}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-danger" data-del-venta="${v.id}"><i class="bi bi-trash"></i></button></td>
    </tr>`,
        )
        .join("")
    : '<tr><td colspan="6" class="text-center text-muted py-4">Sin ventas registradas.</td></tr>';

  document.querySelectorAll("[data-del-venta]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!(await confirmDialog("Eliminar la venta? Se devolvera el stock.")))
        return;
      loading(true, "Eliminando...");
      await deleteSale(b.dataset.delVenta);
      loading(false);
      showToast("Venta eliminada");
      cargarTodo();
    }),
  );
}

// ------------------------------------------------------------------ pedidos
function renderFiltrosPedidos() {
  const opciones = [
    ["", "Pendientes"],
    ...STATUSES.map((s) => [s, STATUS_LABEL[s]]),
    ["all", "Todos"],
  ];
  $("filtros-pedidos").innerHTML = opciones
    .map(
      ([valor, texto]) =>
        `<button class="btn btn-outline-secondary ${filtroPedidos === valor ? "active" : ""}" data-filtro="${valor}">${texto}</button>`,
    )
    .join("");
  document.querySelectorAll("[data-filtro]").forEach((b) =>
    b.addEventListener("click", () => {
      filtroPedidos = b.dataset.filtro;
      cargarPedidos();
    }),
  );
}

function filtrarPedidos(todos) {
  const texto = busquedaPedidos.trim();
  if (texto) {
    const terminos = normalize(texto).split(/\s+/).filter(Boolean);
    const digitos = normalizePhone(texto);
    return todos.filter((o) => {
      const telefono = o.phone_key || normalizePhone(o.phone);
      if (digitos.length >= 4 && telefono.includes(digitos)) return true;
      const clave = normalize(
        `${o.code} ${o.customer_name} ${o.email || ""} ${o.phone}`,
      );
      return terminos.every((t) => clave.includes(t));
    });
  }
  if (filtroPedidos === "all") return todos;
  if (filtroPedidos) return todos.filter((o) => o.status === filtroPedidos);
  return todos.filter((o) => PEDIDOS_ACTIVOS.includes(o.status));
}

async function cargarPedidos() {
  renderFiltrosPedidos();
  const pedidos = filtrarPedidos(await listOrders());
  $("pedidos-vacio").classList.toggle("d-none", pedidos.length > 0);
  $("pedidos-vacio-msg").textContent = busquedaPedidos.trim()
    ? "Ningun pedido coincide con esa busqueda."
    : "No hay pedidos pendientes. Los vendidos se consultan con el buscador.";

  $("lista-pedidos").innerHTML = pedidos
    .map(
      (o) => `
    <div class="col-12 col-lg-6">
      <div class="card shadow-sm h-100 ${o.status === "nuevo" ? "border-danger" : ""}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <h2 class="h6 mb-1">Pedido #${escapeHtml(o.code)}
                ${o.status === "nuevo" ? '<span class="badge text-bg-danger">NUEVO</span>' : ""}</h2>
              <div class="small text-muted">${fechaCorta(o.created_at)}</div>
            </div>
            <span class="badge text-bg-${STATUS_COLOR[o.status] || "secondary"}">${STATUS_LABEL[o.status] || o.status}</span>
          </div>
          <div class="mt-2 small">
            <div><i class="bi bi-person"></i> ${escapeHtml(o.customer_name)}</div>
            <div><i class="bi bi-telephone"></i> <a href="tel:${escapeHtml(o.phone)}">${escapeHtml(o.phone)}</a>
              <a class="ms-2 text-success" target="_blank"
                 href="https://wa.me/${o.phone_key || ""}?text=${encodeURIComponent(`Hola ${o.customer_name}, sobre tu pedido #${o.code}`)}">
                 <i class="bi bi-whatsapp"></i> WhatsApp</a></div>
            ${o.email ? `<div><i class="bi bi-envelope"></i> <a href="mailto:${escapeHtml(o.email)}">${escapeHtml(o.email)}</a></div>` : ""}
            ${o.address ? `<div><i class="bi bi-geo-alt"></i> ${escapeHtml(o.address)}</div>` : ""}
            ${o.note ? `<div class="text-muted"><i class="bi bi-chat-left-text"></i> ${escapeHtml(o.note)}</div>` : ""}
          </div>
          <ul class="list-group list-group-flush mt-2">
            ${(o.items || [])
              .map(
                (
                  i,
                ) => `<li class="list-group-item d-flex justify-content-between px-0 py-1 small">
              <span>${i.qty} x ${escapeHtml(i.name)}</span><span>${money(i.subtotal)}</span></li>`,
              )
              .join("")}
            <li class="list-group-item d-flex justify-content-between px-0 py-1">
              <strong>Total</strong><strong class="text-primary">${money(o.total)}</strong></li>
          </ul>
          <div class="d-flex gap-2 mt-3">
            <select class="form-select form-select-sm" data-status-select="${o.id}">
              ${STATUSES.map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${STATUS_LABEL[s]}</option>`).join("")}
            </select>
            <button class="btn btn-sm btn-outline-secondary text-nowrap" data-status-save="${o.id}"><i class="bi bi-check2"></i> Actualizar</button>
          </div>
          ${
            o.sales_registered
              ? '<div class="form-text mt-2 text-success"><i class="bi bi-check-circle"></i> Venta registrada y stock descontado.</div>'
              : `<button class="btn btn-success w-100 mt-2" data-vendido="${o.id}">
                 <i class="bi bi-cash-coin"></i> Marcar como vendido</button>
               <div class="form-text mt-1">Registra la venta en el resumen y descuenta el stock.</div>`
          }
          <button class="btn btn-sm btn-outline-danger w-100 mt-2" data-del-pedido="${o.id}">
            <i class="bi bi-trash"></i> Eliminar pedido</button>
        </div>
      </div>
    </div>`,
    )
    .join("");

  document
    .querySelectorAll("[data-status-select]")
    .forEach((sel) => enhanceSelect(sel));

  document.querySelectorAll("[data-vendido]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (
        !(await confirmDialog(
          "Marcar el pedido como vendido? Se registrara la venta y se descontara el stock.",
          { okVariant: "success", okText: "Marcar vendido" },
        ))
      )
        return;
      loading(true, "Registrando venta...");
      try {
        await markOrderSold(b.dataset.vendido);
        showToast("Venta registrada");
        await cargarTodo();
      } catch (err) {
        showToast(err.message, "danger");
      } finally {
        loading(false);
      }
    }),
  );

  document.querySelectorAll("[data-del-pedido]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (
        !(await confirmDialog(
          "Eliminar este pedido? Esta accion no se puede deshacer.",
        ))
      )
        return;
      loading(true, "Eliminando...");
      try {
        await deleteOrder(b.dataset.delPedido);
        showToast("Pedido eliminado");
        await cargarTodo();
      } catch (err) {
        showToast(err.message, "danger");
      } finally {
        loading(false);
      }
    }),
  );

  document.querySelectorAll("[data-status-save]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.dataset.statusSave;
      const status = document.querySelector(
        `[data-status-select="${id}"]`,
      ).value;
      const pedido = pedidos.find((o) => o.id === id);
      const avisarVisto = status === "visto" && pedido?.status !== "visto";
      const whatsappWindow = avisarVisto && (pedido?.phone_key || normalizePhone(pedido?.phone))
        ? window.open("", "_blank")
        : null;
      loading(true, "Actualizando pedido...");
      try {
        await updateOrderStatus(id, status);
        if (avisarVisto) abrirAvisoDePedido(pedido, status, whatsappWindow);
        showToast("Pedido actualizado");
        await cargarTodo();
      } catch (err) {
        whatsappWindow?.close();
        showToast(err.message, "danger");
      } finally {
        loading(false);
      }
    }),
  );
}

// -------------------------------------------------------------------- carga
async function cargarTodo() {
  loading(true, "Cargando datos...");
  try {
    await cargarProductos();
    // Compras se mantiene aparte via subscribePurchases (tiempo real, ver onAuthStateChanged).
    await Promise.all([cargarResumen(), cargarVentas(), cargarPedidos()]);
  } catch (err) {
    showToast("Error al cargar datos: " + err.message, "danger");
  } finally {
    loading(false);
  }
}

$("btn-refresh").addEventListener("click", cargarTodo);
$("c-fecha").value = todayStr();
$("v-fecha").value = todayStr();
filterList("f-productos", "tb-productos", "tr[data-key]");
filterList("f-ventas", "tb-ventas", "tr[data-key]");
$("f-compras").addEventListener("input", actualizarFiltroCompras);

let debouncePedidos;
$("f-pedidos").addEventListener("input", (e) => {
  busquedaPedidos = e.target.value;
  clearTimeout(debouncePedidos);
  debouncePedidos = setTimeout(cargarPedidos, 250);
});
$("f-pedidos-limpiar").addEventListener("click", () => {
  $("f-pedidos").value = "";
  busquedaPedidos = "";
  cargarPedidos();
});
