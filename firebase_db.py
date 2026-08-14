"""Capa de acceso a Firestore.

Usa el SDK admin si hay un serviceAccountKey.json disponible; de lo contrario
cae a la API REST de Firestore usando la apiKey publica del proyecto.

El volumen de datos de un emprendimiento es pequeno, por lo que las consultas
traen la coleccion completa y se filtra/ordena en Python. Asi se evita tener que
crear indices compuestos en Firestore.
"""
from __future__ import annotations

import os
import threading
from typing import Any

import requests

import config


class FirestoreError(RuntimeError):
    pass


# --------------------------------------------------------------------------
# Conversion de valores Firestore REST <-> Python
# --------------------------------------------------------------------------
def _to_value(value: Any) -> dict:
    if value is None:
        return {"nullValue": None}
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if isinstance(value, str):
        return {"stringValue": value}
    if isinstance(value, (list, tuple)):
        return {"arrayValue": {"values": [_to_value(v) for v in value]}}
    if isinstance(value, dict):
        return {"mapValue": {"fields": {k: _to_value(v) for k, v in value.items()}}}
    return {"stringValue": str(value)}


def _from_value(value: dict) -> Any:
    if not value:
        return None
    key = next(iter(value))
    raw = value[key]
    if key == "nullValue":
        return None
    if key == "integerValue":
        return int(raw)
    if key == "doubleValue":
        return float(raw)
    if key == "booleanValue":
        return bool(raw)
    if key == "arrayValue":
        return [_from_value(v) for v in raw.get("values", [])]
    if key == "mapValue":
        return {k: _from_value(v) for k, v in raw.get("fields", {}).items()}
    return raw


class BaseDB:
    """Interfaz comun."""

    backend = "base"

    def list(self, collection: str) -> list[dict]:
        raise NotImplementedError

    def get(self, collection: str, doc_id: str) -> dict | None:
        raise NotImplementedError

    def add(self, collection: str, data: dict) -> str:
        raise NotImplementedError

    def update(self, collection: str, doc_id: str, data: dict) -> None:
        raise NotImplementedError

    def delete(self, collection: str, doc_id: str) -> None:
        raise NotImplementedError


class AdminDB(BaseDB):
    """Firestore mediante firebase-admin (service account)."""

    backend = "admin-sdk"

    def __init__(self, credentials_path: str):
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            cred = credentials.Certificate(credentials_path)
            firebase_admin.initialize_app(cred, {"projectId": config.FIREBASE_CONFIG["projectId"]})
        self._client = firestore.client()

    def list(self, collection: str) -> list[dict]:
        docs = self._client.collection(collection).stream()
        return [{**d.to_dict(), "id": d.id} for d in docs]

    def get(self, collection: str, doc_id: str) -> dict | None:
        snap = self._client.collection(collection).document(doc_id).get()
        if not snap.exists:
            return None
        return {**snap.to_dict(), "id": snap.id}

    def add(self, collection: str, data: dict) -> str:
        ref = self._client.collection(collection).document()
        ref.set(data)
        return ref.id

    def update(self, collection: str, doc_id: str, data: dict) -> None:
        self._client.collection(collection).document(doc_id).set(data, merge=True)

    def delete(self, collection: str, doc_id: str) -> None:
        self._client.collection(collection).document(doc_id).delete()


class RestDB(BaseDB):
    """Firestore mediante la API REST publica (requiere reglas abiertas)."""

    backend = "rest"

    def __init__(self, project_id: str, api_key: str):
        self.base = (
            f"https://firestore.googleapis.com/v1/projects/{project_id}"
            "/databases/(default)/documents"
        )
        self.api_key = api_key
        self.session = requests.Session()

    def _check(self, resp: requests.Response) -> dict:
        if resp.status_code == 404:
            return {}
        if not resp.ok:
            detail = resp.json().get("error", {}).get("message", resp.text) if resp.content else resp.text
            raise FirestoreError(f"Firestore {resp.status_code}: {detail}")
        return resp.json() if resp.content else {}

    @staticmethod
    def _doc_to_dict(doc: dict) -> dict:
        data = {k: _from_value(v) for k, v in doc.get("fields", {}).items()}
        data["id"] = doc["name"].rsplit("/", 1)[-1]
        return data

    def list(self, collection: str) -> list[dict]:
        results: list[dict] = []
        token = None
        while True:
            params = {"key": self.api_key, "pageSize": 300}
            if token:
                params["pageToken"] = token
            payload = self._check(self.session.get(f"{self.base}/{collection}", params=params, timeout=20))
            results.extend(self._doc_to_dict(d) for d in payload.get("documents", []))
            token = payload.get("nextPageToken")
            if not token:
                return results

    def get(self, collection: str, doc_id: str) -> dict | None:
        payload = self._check(
            self.session.get(f"{self.base}/{collection}/{doc_id}", params={"key": self.api_key}, timeout=20)
        )
        if not payload:
            return None
        return self._doc_to_dict(payload)

    def add(self, collection: str, data: dict) -> str:
        body = {"fields": {k: _to_value(v) for k, v in data.items()}}
        payload = self._check(
            self.session.post(
                f"{self.base}/{collection}", params={"key": self.api_key}, json=body, timeout=20
            )
        )
        return payload["name"].rsplit("/", 1)[-1]

    def update(self, collection: str, doc_id: str, data: dict) -> None:
        body = {"fields": {k: _to_value(v) for k, v in data.items()}}
        params = [("key", self.api_key)] + [("updateMask.fieldPaths", k) for k in data]
        self._check(
            self.session.patch(
                f"{self.base}/{collection}/{doc_id}", params=params, json=body, timeout=20
            )
        )

    def delete(self, collection: str, doc_id: str) -> None:
        self._check(
            self.session.delete(
                f"{self.base}/{collection}/{doc_id}", params={"key": self.api_key}, timeout=20
            )
        )


_db: BaseDB | None = None
_lock = threading.Lock()


def get_db() -> BaseDB:
    global _db
    if _db is None:
        with _lock:
            if _db is None:
                if os.path.exists(config.SERVICE_ACCOUNT_FILE):
                    try:
                        _db = AdminDB(config.SERVICE_ACCOUNT_FILE)
                    except Exception as exc:  # pragma: no cover
                        print(f"[firebase] No se pudo usar el SDK admin ({exc}); se usara REST.")
                if _db is None:
                    _db = RestDB(
                        config.FIREBASE_CONFIG["projectId"], config.FIREBASE_CONFIG["apiKey"]
                    )
    return _db
