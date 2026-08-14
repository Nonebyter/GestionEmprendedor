# Sistema de Gestion (PWA)

Inventario, compras, ventas, catalogo y pedidos para un emprendimiento.
Flask + Firebase Firestore + Bootstrap 5, instalable como app (PWA).

## Puesta en marcha

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python app.py
```

Abrir http://localhost:5000

## Configurar Firebase (obligatorio la primera vez)

1. En la [consola de Firebase](https://console.firebase.google.com/project/gestionemprendedor/firestore) crear la base de datos **Firestore**.
2. En **Reglas**, mientras se prueba:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} { allow read, write: if true; }
     }
   }
   ```

3. Recargar la app.

Opcion mas segura para produccion: descargar `serviceAccountKey.json`
(Configuracion del proyecto -> Cuentas de servicio), guardarlo en la raiz e instalar
`firebase-admin`. La app lo detecta y deja de usar la API publica.

## Acceso admin

Definido en `.env` (copiar de `.env.example`). Por defecto `admin` / `admin123`.

## Como funciona

- **Compras**: al registrar una compra se crea o actualiza el producto (nombre, categoria,
  precio, foto, descripcion) y se **suma** el stock. La foto es la que se ve en el catalogo.
- **Catalogo** (publico): tarjetas con foto, nombre, precio, descripcion, boton *Ordenar* y cesta
  guardada en el navegador.
- **Pedido**: el cliente pone nombre, telefono y direccion. No hay pago en linea.
  El pedido entra como **Nuevo**; el admin lo pasa a Visto / Confirmado / Entregado / Cancelado.
- **Confirmado** registra automaticamente la venta y **descuenta** el stock (una sola vez).
- **Mis pedidos** (publico): sin login, con nombre + telefono se consulta el estado.
- **Resumen semanal**: ventas, compras, ganancia, valor del inventario, mas vendidos y stock bajo.

## Colecciones en Firestore

`products`, `purchases`, `sales`, `orders`.

## Imagenes

Se guardan en `static/uploads/`. En hosting efimero (Render, Heroku) conviene montar un
disco persistente o migrar a Firebase Storage.
