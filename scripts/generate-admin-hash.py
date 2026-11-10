#!/usr/bin/env python3
"""Generate a salted SHA-256 admin password hash for Google Apps Script.

Run locally: python scripts/generate-admin-hash.py
The password is requested without echo and is never written to a file.
"""
import getpass
import hashlib
import secrets
import sys

password = getpass.getpass("Buat password admin (minimal 16 karakter): ")
if len(password) < 16:
    print("Password terlalu pendek. Gunakan minimal 16 karakter.", file=sys.stderr)
    sys.exit(1)
confirm = getpass.getpass("Ulangi password admin: ")
if password != confirm:
    print("Password tidak sama.", file=sys.stderr)
    sys.exit(1)
salt = secrets.token_hex(24)
digest = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
print("\nSalin dua nilai berikut ke Apps Script > Project Settings > Script Properties:")
print("ADMIN_SALT=" + salt)
print("ADMIN_PASSWORD_SHA256=" + digest)
print("\nSimpan password di pengelola password sekolah. Jangan commit nilai ini ke GitHub.")
