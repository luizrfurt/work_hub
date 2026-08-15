from __future__ import annotations

import argparse
import getpass
import sys

from app.database.connection import SessionLocal
from app.services.auth_service import AuthService


def main() -> None:
    parser = argparse.ArgumentParser(description="Cria o primeiro administrador do WorkHub.")
    parser.add_argument("--name", help="Nome completo")
    parser.add_argument("--username", help="Nome de usuário")
    parser.add_argument("--password", help="Senha")
    parser.add_argument("--organization", help="Nome da organização")
    args = parser.parse_args()

    name = args.name or input("Nome: ").strip()
    username = args.username or input("Usuário: ").strip()
    password = args.password or getpass.getpass("Senha: ")
    organization = args.organization
    if organization is None and not args.name:
        organization = input("Organização (Enter para gerar automaticamente): ").strip() or None

    if not name or not username or not password:
        print("Nome, usuário e senha são obrigatórios.", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    try:
        user = AuthService(db).create_admin(
            name=name,
            username=username,
            password=password,
            organization_name=organization,
        )
        print(
            f"Administrador criado: {user.username} ({user.id}) "
            f"na organização {user.organization_id}"
        )
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
