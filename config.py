"""Configuracion central del sistema de gestion."""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # dotenv es opcional
    pass

BASE_DIR = Path(__file__).resolve().parent

# --- Firebase ---------------------------------------------------------------
FIREBASE_CONFIG = {
    "apiKey": os.environ.get("FIREBASE_API_KEY", "AIzaSyCdgVAiJfHiTPzDbiUx5ZX4lSfE7iDna1g"),
    "authDomain": os.environ.get("FIREBASE_AUTH_DOMAIN", "gestionemprendedor.firebaseapp.com"),
    "projectId": os.environ.get("FIREBASE_PROJECT_ID", "gestionemprendedor"),
    "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", "gestionemprendedor.firebasestorage.app"),
    "messagingSenderId": os.environ.get("FIREBASE_SENDER_ID", "270859244522"),
    "appId": os.environ.get("FIREBASE_APP_ID", "1:270859244522:web:a16176cdcc4f1d32631893"),
}

# Si existe un serviceAccountKey.json se usa el SDK admin (recomendado en produccion).
# Si no, se usa la API REST de Firestore con la apiKey publica.
SERVICE_ACCOUNT_FILE = os.environ.get(
    "FIREBASE_SERVICE_ACCOUNT", str(BASE_DIR / "serviceAccountKey.json")
)

# --- App --------------------------------------------------------------------
SECRET_KEY = os.environ.get("SECRET_KEY", "cambia-esta-clave-en-produccion")
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

BUSINESS_NAME = os.environ.get("BUSINESS_NAME", "Mi Emprendimiento")
BUSINESS_PHONE = os.environ.get("BUSINESS_PHONE", "")  # formato internacional para WhatsApp
CURRENCY = os.environ.get("CURRENCY", "$")

UPLOAD_DIR = BASE_DIR / "static" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_CONTENT_LENGTH = 8 * 1024 * 1024  # 8 MB por imagen

# Colecciones de Firestore
COL_PRODUCTS = "products"
COL_PURCHASES = "purchases"
COL_SALES = "sales"
COL_ORDERS = "orders"
