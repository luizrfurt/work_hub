from __future__ import annotations

import argparse
import getpass
import sys

from app.database.connection import SessionLocal
from app.services.auth_service import AuthService


def main() -> None:
    parser = argparse.ArgumentParser(description="Redefine a senha de um usuário do WorkHub.")
    parser.add_argument("--username", help="Nome de usuário")
    parser.add_argument("--password", help="Nova senha")
    args = parser.parse_args()

    username = args.username or input("Usuário: ").strip()
    password = args.password or getpass.getpass("Nova senha: ")

    if not username or not password:
        print("Usuário e senha são obrigatórios.", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    try:
        user = AuthService(db).reset_password(username=username, password=password)
        print(f"Senha redefinida: {user.username}")
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
