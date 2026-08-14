"""Sistema de gestion para emprendedores: inventario, compras, ventas y pedidos."""
from __future__ import annotations

import uuid
from functools import wraps
from pathlib import Path

from flask import (
    Flask,
    abort,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from werkzeug.utils import secure_filename

import config
import services
from firebase_db import FirestoreError

app = Flask(__name__)
app.config["SECRET_KEY"] = config.SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_LENGTH


@app.context_processor
def inject_globals():
    return {
        "business_name": config.BUSINESS_NAME,
        "business_phone": config.BUSINESS_PHONE,
        "currency": config.CURRENCY,
        "is_admin": session.get("admin", False),
        "status_label": services.STATUS_LABEL,
        "status_color": services.STATUS_COLOR,
    }


@app.template_filter("money")
def money(value) -> str:
    return f"{config.CURRENCY}{services.to_float(value):,.2f}"


@app.template_filter("fecha")
def fecha(value) -> str:
    return str(value or "").replace("T", " ")[:16]


def login_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not session.get("admin"):
            return redirect(url_for("login", next=request.path))
        return view(*args, **kwargs)

    return wrapper


def save_image(file_storage) -> str:
    """Guarda la imagen subida y devuelve su URL publica."""
    if not file_storage or not file_storage.filename:
        return ""
    ext = Path(secure_filename(file_storage.filename)).suffix.lower()
    if ext not in config.ALLOWED_IMAGE_EXT:
        raise ValueError("Formato de imagen no permitido.")
    name = f"{uuid.uuid4().hex}{ext}"
    file_storage.save(config.UPLOAD_DIR / name)
    return url_for("static", filename=f"uploads/{name}")


# =========================================================== publico
@app.route("/")
def catalog():
    query = request.args.get("q", "").strip()
    category = request.args.get("cat", "").strip()
    products = [p for p in services.list_products(only_active=True)]
    if category:
        products = [p for p in products if (p.get("category") or "General") == category]
    if query:
        key = services.normalize(query)
        terms = key.split()
        products = [
            p
            for p in products
            if all(
                t in services.normalize(f"{p.get('name','')} {p.get('category','')} {p.get('description','')}")
                for t in terms
            )
        ]
    return render_template(
        "catalog.html",
        products=products,
        categories=services.categories(),
        query=query,
        category=category,
    )


@app.route("/carrito")
def cart():
    return render_template("cart.html")


@app.post("/api/pedidos")
def api_create_order():
    data = request.get_json(silent=True) or {}
    try:
        order = services.create_order(data)
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    return jsonify({"ok": True, "id": order["id"], "code": order["code"]})


@app.route("/pedido/<order_id>")
def order_detail(order_id: str):
    order = services.get_order(order_id)
    if not order:
        abort(404)
    return render_template("order_detail.html", order=order)


@app.route("/mis-pedidos", methods=["GET", "POST"])
def track_orders():
    orders, searched = [], False
    name = request.form.get("name", "") if request.method == "POST" else request.args.get("name", "")
    phone = request.form.get("phone", "") if request.method == "POST" else request.args.get("phone", "")
    if name and phone:
        searched = True
        orders = services.find_orders(name, phone)
    return render_template("track.html", orders=orders, searched=searched, name=name, phone=phone)


# =========================================================== auth
@app.route("/admin/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        user = request.form.get("user", "").strip()
        password = request.form.get("password", "")
        if user == config.ADMIN_USER and password == config.ADMIN_PASSWORD:
            session["admin"] = True
            session.permanent = True
            return redirect(request.args.get("next") or url_for("dashboard"))
        flash("Usuario o contrasena incorrectos.", "danger")
    return render_template("login.html")


@app.route("/admin/logout")
def logout():
    session.clear()
    return redirect(url_for("catalog"))


# =========================================================== admin
@app.route("/admin")
@login_required
def dashboard():
    summary = services.weekly_summary()
    return render_template("admin/dashboard.html", s=summary, new_orders=services.count_new_orders())


@app.route("/admin/productos")
@login_required
def products():
    return render_template(
        "admin/products.html",
        products=services.list_products(),
        categories=services.categories(),
        new_orders=services.count_new_orders(),
    )


@app.post("/admin/productos/guardar")
@login_required
def product_save():
    product_id = request.form.get("id") or None
    data = request.form.to_dict()
    data["active"] = request.form.get("active") == "on"
    try:
        data["image_url"] = save_image(request.files.get("image")) or request.form.get("image_url", "")
    except ValueError as exc:
        flash(str(exc), "danger")
        return redirect(url_for("products"))
    if not data.get("name", "").strip():
        flash("El nombre del producto es obligatorio.", "danger")
        return redirect(url_for("products"))
    services.save_product(data, product_id)
    flash("Producto guardado.", "success")
    return redirect(url_for("products"))


@app.post("/admin/productos/<product_id>/eliminar")
@login_required
def product_delete(product_id: str):
    services.delete_product(product_id)
    flash("Producto eliminado.", "info")
    return redirect(url_for("products"))


@app.route("/admin/compras")
@login_required
def purchases():
    return render_template(
        "admin/purchases.html",
        purchases=services.list_purchases(),
        products=services.list_products(),
        categories=services.categories(),
        today=services.today_str(),
        new_orders=services.count_new_orders(),
    )


@app.post("/admin/compras/nueva")
@login_required
def purchase_create():
    data = request.form.to_dict()
    try:
        data["image_url"] = save_image(request.files.get("image"))
        services.register_purchase(data)
        flash("Compra registrada y stock actualizado.", "success")
    except ValueError as exc:
        flash(str(exc), "danger")
    return redirect(url_for("purchases"))


@app.post("/admin/compras/<purchase_id>/eliminar")
@login_required
def purchase_delete(purchase_id: str):
    services.delete_purchase(purchase_id)
    flash("Compra eliminada y stock revertido.", "info")
    return redirect(url_for("purchases"))


@app.route("/admin/ventas")
@login_required
def sales():
    return render_template(
        "admin/sales.html",
        sales=services.list_sales(),
        products=services.list_products(),
        today=services.today_str(),
        new_orders=services.count_new_orders(),
    )


@app.post("/admin/ventas/nueva")
@login_required
def sale_create():
    try:
        services.register_sale(request.form.to_dict())
        flash("Venta registrada.", "success")
    except ValueError as exc:
        flash(str(exc), "danger")
    return redirect(url_for("sales"))


@app.post("/admin/ventas/<sale_id>/eliminar")
@login_required
def sale_delete(sale_id: str):
    services.delete_sale(sale_id)
    flash("Venta eliminada y stock devuelto.", "info")
    return redirect(url_for("sales"))


@app.route("/admin/pedidos")
@login_required
def orders():
    status = request.args.get("estado", "")
    return render_template(
        "admin/orders.html",
        orders=services.list_orders(status or None),
        status=status,
        statuses=services.ORDER_STATUSES,
        new_orders=services.count_new_orders(),
    )


@app.post("/admin/pedidos/<order_id>/estado")
@login_required
def order_status(order_id: str):
    try:
        services.update_order_status(order_id, request.form.get("status", ""))
        flash("Pedido actualizado.", "success")
    except ValueError as exc:
        flash(str(exc), "danger")
    return redirect(request.referrer or url_for("orders"))


@app.post("/admin/pedidos/<order_id>/visto")
@login_required
def order_seen(order_id: str):
    services.mark_order_seen(order_id)
    return redirect(url_for("orders"))


# =========================================================== PWA
@app.route("/manifest.webmanifest")
def manifest():
    return send_from_directory(app.static_folder, "manifest.webmanifest", mimetype="application/manifest+json")


@app.route("/sw.js")
def service_worker():
    response = send_from_directory(app.static_folder, "sw.js", mimetype="application/javascript")
    response.headers["Service-Worker-Allowed"] = "/"
    response.headers["Cache-Control"] = "no-cache"
    return response


@app.route("/offline")
def offline():
    return render_template("offline.html")


@app.errorhandler(404)
def not_found(_):
    return render_template("404.html"), 404


@app.errorhandler(FirestoreError)
def firestore_error(exc):
    return (
        render_template(
            "setup_error.html",
            project_id=config.FIREBASE_CONFIG["projectId"],
            detail=str(exc),
        ),
        503,
    )


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
