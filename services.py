"""Logica de negocio: productos, compras, ventas, pedidos y reportes."""
from __future__ import annotations

import re
import unicodedata
import uuid
from datetime import datetime, timedelta

import config
from firebase_db import get_db

ORDER_STATUSES = ["nuevo", "visto", "confirmado", "entregado", "cancelado"]
STATUS_LABEL = {
    "nuevo": "Nuevo",
    "visto": "Visto por el vendedor",
    "confirmado": "Confirmado",
    "entregado": "Entregado",
    "cancelado": "Cancelado",
}
STATUS_COLOR = {
    "nuevo": "danger",
    "visto": "warning",
    "confirmado": "info",
    "entregado": "success",
    "cancelado": "secondary",
}


# ---------------------------------------------------------------- utilidades
def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def today_str() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def to_float(value, default: float = 0.0) -> float:
    try:
        return float(str(value).replace(",", ".").strip())
    except (TypeError, ValueError):
        return default


def to_int(value, default: int = 0) -> int:
    try:
        return int(float(str(value).replace(",", ".").strip()))
    except (TypeError, ValueError):
        return default


def normalize(text: str) -> str:
    """Minusculas sin acentos ni signos, para busquedas tolerantes."""
    text = unicodedata.normalize("NFKD", str(text or ""))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]+", " ", text.lower()).strip()


def normalize_phone(phone: str) -> str:
    return re.sub(r"\D", "", str(phone or ""))


def new_order_code() -> str:
    return uuid.uuid4().hex[:6].upper()


# ---------------------------------------------------------------- productos
def list_products(only_active: bool = False) -> list[dict]:
    items = get_db().list(config.COL_PRODUCTS)
    if only_active:
        items = [p for p in items if p.get("active", True)]
    items.sort(key=lambda p: normalize(p.get("name", "")))
    return items


def get_product(product_id: str) -> dict | None:
    return get_db().get(config.COL_PRODUCTS, product_id)


def save_product(data: dict, product_id: str | None = None) -> str:
    db = get_db()
    payload = {
        "name": data.get("name", "").strip(),
        "name_key": normalize(data.get("name", "")),
        "category": data.get("category", "").strip() or "General",
        "description": data.get("description", "").strip(),
        "price": to_float(data.get("price")),
        "cost": to_float(data.get("cost")),
        "stock": to_int(data.get("stock")),
        "image_url": data.get("image_url") or "",
        "active": bool(data.get("active", True)),
        "updated_at": now_iso(),
    }
    if product_id:
        if not payload["image_url"]:
            payload.pop("image_url")
        db.update(config.COL_PRODUCTS, product_id, payload)
        return product_id
    payload["created_at"] = now_iso()
    return db.add(config.COL_PRODUCTS, payload)


def delete_product(product_id: str) -> None:
    get_db().delete(config.COL_PRODUCTS, product_id)


def adjust_stock(product_id: str, delta: int) -> None:
    product = get_product(product_id)
    if not product:
        return
    new_stock = to_int(product.get("stock")) + delta
    get_db().update(
        config.COL_PRODUCTS, product_id, {"stock": max(new_stock, 0), "updated_at": now_iso()}
    )


def find_product_by_name(name: str) -> dict | None:
    key = normalize(name)
    for product in list_products():
        if product.get("name_key") == key or normalize(product.get("name", "")) == key:
            return product
    return None


def categories() -> list[str]:
    return sorted({(p.get("category") or "General") for p in list_products()})


# ---------------------------------------------------------------- compras
def list_purchases() -> list[dict]:
    items = get_db().list(config.COL_PURCHASES)
    items.sort(key=lambda x: x.get("date", ""), reverse=True)
    return items


def register_purchase(data: dict) -> str:
    """Registra una compra y aumenta el stock del producto.

    Si no se envia product_id se crea (o se reutiliza) el producto por nombre.
    """
    product_id = (data.get("product_id") or "").strip()
    quantity = max(to_int(data.get("quantity"), 1), 1)
    unit_cost = to_float(data.get("unit_cost"))
    sale_price = to_float(data.get("price"))

    if product_id:
        product = get_product(product_id)
        if not product:
            raise ValueError("El producto seleccionado no existe.")
        update = {"updated_at": now_iso()}
        if sale_price > 0:
            update["price"] = sale_price
        if unit_cost > 0:
            update["cost"] = unit_cost
        if data.get("image_url"):
            update["image_url"] = data["image_url"]
        if data.get("category"):
            update["category"] = data["category"].strip()
        if data.get("description"):
            update["description"] = data["description"].strip()
        get_db().update(config.COL_PRODUCTS, product_id, update)
    else:
        existing = find_product_by_name(data.get("name", ""))
        if existing:
            product_id = existing["id"]
            get_db().update(
                config.COL_PRODUCTS,
                product_id,
                {
                    "price": sale_price or to_float(existing.get("price")),
                    "cost": unit_cost or to_float(existing.get("cost")),
                    "category": data.get("category") or existing.get("category", "General"),
                    "description": data.get("description") or existing.get("description", ""),
                    "image_url": data.get("image_url") or existing.get("image_url", ""),
                    "updated_at": now_iso(),
                },
            )
            product = existing
        else:
            product_id = save_product({**data, "stock": 0, "cost": unit_cost, "price": sale_price})
            product = get_product(product_id) or {}

    adjust_stock(product_id, quantity)
    product = get_product(product_id) or {}

    purchase = {
        "product_id": product_id,
        "product_name": product.get("name", data.get("name", "")),
        "category": product.get("category", "General"),
        "quantity": quantity,
        "unit_cost": unit_cost,
        "total": round(unit_cost * quantity, 2),
        "supplier": (data.get("supplier") or "").strip(),
        "note": (data.get("note") or "").strip(),
        "date": data.get("date") or today_str(),
        "created_at": now_iso(),
    }
    return get_db().add(config.COL_PURCHASES, purchase)


def delete_purchase(purchase_id: str) -> None:
    purchase = get_db().get(config.COL_PURCHASES, purchase_id)
    if purchase and purchase.get("product_id"):
        adjust_stock(purchase["product_id"], -to_int(purchase.get("quantity")))
    get_db().delete(config.COL_PURCHASES, purchase_id)


# ---------------------------------------------------------------- ventas
def list_sales() -> list[dict]:
    items = get_db().list(config.COL_SALES)
    items.sort(key=lambda x: x.get("date", ""), reverse=True)
    return items


def register_sale(data: dict) -> str:
    product_id = (data.get("product_id") or "").strip()
    product = get_product(product_id) if product_id else None
    if not product:
        raise ValueError("Selecciona un producto valido.")

    quantity = max(to_int(data.get("quantity"), 1), 1)
    unit_price = to_float(data.get("unit_price")) or to_float(product.get("price"))
    unit_cost = to_float(product.get("cost"))

    sale = {
        "product_id": product_id,
        "product_name": product.get("name", ""),
        "category": product.get("category", "General"),
        "quantity": quantity,
        "unit_price": unit_price,
        "unit_cost": unit_cost,
        "total": round(unit_price * quantity, 2),
        "profit": round((unit_price - unit_cost) * quantity, 2),
        "customer": (data.get("customer") or "Venta directa").strip(),
        "order_id": data.get("order_id", ""),
        "date": data.get("date") or today_str(),
        "created_at": now_iso(),
    }
    sale_id = get_db().add(config.COL_SALES, sale)
    adjust_stock(product_id, -quantity)
    return sale_id


def delete_sale(sale_id: str) -> None:
    sale = get_db().get(config.COL_SALES, sale_id)
    if sale and sale.get("product_id"):
        adjust_stock(sale["product_id"], to_int(sale.get("quantity")))
    get_db().delete(config.COL_SALES, sale_id)


# ---------------------------------------------------------------- pedidos
def list_orders(status: str | None = None) -> list[dict]:
    items = get_db().list(config.COL_ORDERS)
    if status:
        items = [o for o in items if o.get("status") == status]
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return items


def get_order(order_id: str) -> dict | None:
    return get_db().get(config.COL_ORDERS, order_id)


def create_order(payload: dict) -> dict:
    raw_items = payload.get("items") or []
    if not raw_items:
        raise ValueError("El carrito esta vacio.")

    name = (payload.get("customer_name") or "").strip()
    phone = (payload.get("phone") or "").strip()
    if not name or not normalize_phone(phone):
        raise ValueError("Nombre y telefono son obligatorios.")

    items = []
    total = 0.0
    for raw in raw_items:
        product = get_product(str(raw.get("id", "")))
        if not product or not product.get("active", True):
            continue
        quantity = max(to_int(raw.get("qty"), 1), 1)
        price = to_float(product.get("price"))
        subtotal = round(price * quantity, 2)
        total += subtotal
        items.append(
            {
                "product_id": product["id"],
                "name": product.get("name", ""),
                "price": price,
                "qty": quantity,
                "subtotal": subtotal,
                "image_url": product.get("image_url", ""),
            }
        )

    if not items:
        raise ValueError("Los productos del carrito ya no estan disponibles.")

    order = {
        "code": new_order_code(),
        "customer_name": name,
        "customer_key": normalize(name),
        "phone": phone,
        "phone_key": normalize_phone(phone),
        "address": (payload.get("address") or "").strip(),
        "note": (payload.get("note") or "").strip(),
        "items": items,
        "total": round(total, 2),
        "status": "nuevo",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    order_id = get_db().add(config.COL_ORDERS, order)
    order["id"] = order_id
    return order


def update_order_status(order_id: str, status: str) -> dict | None:
    if status not in ORDER_STATUSES:
        raise ValueError("Estado invalido.")
    order = get_order(order_id)
    if not order:
        return None

    previous = order.get("status", "nuevo")
    get_db().update(
        config.COL_ORDERS, order_id, {"status": status, "updated_at": now_iso()}
    )

    # Al confirmar se descuenta stock y se registran las ventas (una sola vez).
    if status == "confirmado" and previous != "confirmado" and not order.get("sales_registered"):
        for item in order.get("items", []):
            register_sale(
                {
                    "product_id": item.get("product_id"),
                    "quantity": item.get("qty"),
                    "unit_price": item.get("price"),
                    "customer": order.get("customer_name"),
                    "order_id": order_id,
                }
            )
        get_db().update(config.COL_ORDERS, order_id, {"sales_registered": True})

    order["status"] = status
    return order


def mark_order_seen(order_id: str) -> None:
    order = get_order(order_id)
    if order and order.get("status") == "nuevo":
        get_db().update(
            config.COL_ORDERS, order_id, {"status": "visto", "updated_at": now_iso()}
        )


def find_orders(name: str, phone: str) -> list[dict]:
    """Consulta publica de pedidos: telefono exacto + nombre tolerante."""
    phone_key = normalize_phone(phone)
    name_key = normalize(name)
    if not phone_key or not name_key:
        return []

    results = []
    for order in list_orders():
        if order.get("phone_key") != phone_key and not order.get("phone_key", "").endswith(phone_key[-8:]):
            continue
        stored = order.get("customer_key") or normalize(order.get("customer_name", ""))
        if stored == name_key or name_key in stored or stored in name_key:
            results.append(order)
    return results


def count_new_orders() -> int:
    return sum(1 for o in list_orders() if o.get("status") == "nuevo")


# ---------------------------------------------------------------- reportes
def _in_range(date_str: str, start: datetime, end: datetime) -> bool:
    try:
        value = datetime.strptime((date_str or "")[:10], "%Y-%m-%d")
    except ValueError:
        return False
    return start <= value <= end


def weekly_summary(days: int = 7) -> dict:
    end = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    start = end - timedelta(days=days - 1)

    sales = [s for s in list_sales() if _in_range(s.get("date", ""), start, end)]
    purchases = [p for p in list_purchases() if _in_range(p.get("date", ""), start, end)]
    orders = [o for o in list_orders() if _in_range(o.get("created_at", ""), start, end)]

    labels, sales_series, purchase_series = [], [], []
    for offset in range(days):
        day = start + timedelta(days=offset)
        key = day.strftime("%Y-%m-%d")
        labels.append(day.strftime("%d/%m"))
        sales_series.append(round(sum(to_float(s.get("total")) for s in sales if (s.get("date") or "")[:10] == key), 2))
        purchase_series.append(
            round(sum(to_float(p.get("total")) for p in purchases if (p.get("date") or "")[:10] == key), 2)
        )

    top: dict[str, dict] = {}
    for sale in sales:
        entry = top.setdefault(
            sale.get("product_name", "-"), {"name": sale.get("product_name", "-"), "qty": 0, "total": 0.0}
        )
        entry["qty"] += to_int(sale.get("quantity"))
        entry["total"] = round(entry["total"] + to_float(sale.get("total")), 2)

    products = list_products()
    total_sales = round(sum(to_float(s.get("total")) for s in sales), 2)
    total_purchases = round(sum(to_float(p.get("total")) for p in purchases), 2)

    return {
        "range": f"{start.strftime('%d/%m/%Y')} - {end.strftime('%d/%m/%Y')}",
        "labels": labels,
        "sales_series": sales_series,
        "purchase_series": purchase_series,
        "total_sales": total_sales,
        "total_purchases": total_purchases,
        "profit": round(sum(to_float(s.get("profit")) for s in sales), 2),
        "sales_count": len(sales),
        "orders_count": len(orders),
        "new_orders": sum(1 for o in orders if o.get("status") == "nuevo"),
        "top_products": sorted(top.values(), key=lambda x: x["total"], reverse=True)[:5],
        "inventory_value": round(sum(to_float(p.get("cost")) * to_int(p.get("stock")) for p in products), 2),
        "products_count": len(products),
        "low_stock": sorted(
            [p for p in products if to_int(p.get("stock")) <= 3], key=lambda p: to_int(p.get("stock"))
        )[:8],
    }
