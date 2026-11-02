"""Sample of reasonably secure code: expect few or no findings."""

import hashlib
import hmac
import secrets
import sqlite3
import subprocess
from pathlib import Path

BASE_DIR = Path("/srv/app/files").resolve()


def get_user(conn: sqlite3.Connection, username: str):
    # Parameterised query: no SQL injection
    cur = conn.execute("SELECT id, username FROM users WHERE username = ?", (username,))
    return cur.fetchone()


def list_directory(name: str) -> str:
    # No shell, argument list, input validated
    if not name.isalnum():
        raise ValueError("Invalid directory name")
    result = subprocess.run(
        ["ls", "-l", name], capture_output=True, text=True, check=True, timeout=10
    )
    return result.stdout


def read_user_file(filename: str) -> str:
    # Resolve the path and make sure it stays inside BASE_DIR
    path = (BASE_DIR / filename).resolve()
    if not path.is_relative_to(BASE_DIR):
        raise PermissionError("Path traversal attempt blocked")
    return path.read_text(encoding="utf-8")


def hash_password(password: str, salt: bytes | None = None) -> tuple[bytes, bytes]:
    # Salted, slow key derivation
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 600_000)
    return salt, digest


def verify_password(password: str, salt: bytes, expected: bytes) -> bool:
    _, digest = hash_password(password, salt)
    return hmac.compare_digest(digest, expected)  # constant-time comparison


def new_session_token() -> str:
    return secrets.token_urlsafe(32)
