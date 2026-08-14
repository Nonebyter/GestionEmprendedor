# Sistema de Gestion (PWA + Firebase)

Catalogo publico, pedidos sin registro e inventario con compras, ventas y resumen semanal.
Es un sitio **100% estatico** (HTML + Bootstrap + Firebase Web SDK), pensado para GitHub Pages.

```
docs/            <- el sitio que publica GitHub Pages
firestore.rules  <- reglas de seguridad a pegar en la consola de Firebase
```

## 1. Publicar en GitHub Pages

En el repositorio: **Settings -> Pages -> Source: Deploy from a branch**,
rama `Main` y carpeta `/docs`. Guardar. La URL queda como
`https://<usuario>.github.io/<repositorio>/`.

## 2. Configurar Firebase

En [console.firebase.google.com](https://console.firebase.google.com/project/gestionemprendedor):

1. **Firestore Database -> Reglas**: pegar el contenido de `firestore.rules` y publicar.
2. **Authentication -> Sign-in method**: habilitar **Correo electronico/contrasena**.
3. **Authentication -> Users -> Agregar usuario**: crear el correo y contrasena del admin.
4. **Authentication -> Settings -> Dominios autorizados**: agregar `<usuario>.github.io`.

## 3. Personalizar

En `docs/assets/js/firebase.js`:

```js
export const BUSINESS = {
  name: "Mi Emprendimiento",
  phone: "",        // ej: 50588887777 para el boton de WhatsApp
  currency: "$"
};
```

## Como funciona

- **Compras**: al registrar una compra se crea o actualiza el producto (nombre, categoria,
  precio, descripcion, foto) y se **suma** el stock. Esa foto es la que aparece en el catalogo.
- **Catalogo** (publico): buscador, filtro por categoria, boton *Ordenar* y cesta en el navegador.
- **Pedido**: el cliente deja nombre, telefono y direccion. Sin pago en linea.
- **Estados**: nuevo -> visto -> confirmado -> entregado / cancelado.
  Al marcar **confirmado** se registra la venta y se **descuenta** el stock (solo una vez).
- **Mis pedidos**: consulta publica con nombre + telefono, sin login.
- **Resumen semanal**: ventas, compras, ganancia, valor del inventario, mas vendidos y stock bajo.

Colecciones en Firestore: `products`, `purchases`, `sales`, `orders`.
Las fotos se comprimen en el navegador y se guardan dentro del documento del producto,
asi no hace falta activar Firebase Storage.

## Probar en local

```powershell
cd docs
python -m http.server 5500
```
