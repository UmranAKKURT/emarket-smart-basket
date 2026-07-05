from __future__ import annotations

import argparse
import getpass

from pydantic import EmailStr, TypeAdapter, ValidationError

from src.api import ApplicationContainer
from src.auth_service import AuthServiceError


def main() -> None:
    parser = argparse.ArgumentParser(description="E-Market admin hesabı oluşturur.")
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    try:
        email = str(TypeAdapter(EmailStr).validate_python(args.email))
    except ValidationError:
        print("Geçerli bir e-posta adresi girin.")
        return
    password = getpass.getpass("Parola: ")
    confirmation = getpass.getpass("Parola tekrar: ")
    if password != confirmation:
        print("Parolalar eşleşmiyor; kullanıcı oluşturulmadı.")
        return
    try:
        user = ApplicationContainer().auth_service.create_admin(email, password)
    except AuthServiceError as exception:
        print(str(exception))
        return
    print(f"Admin hesabı başarıyla oluşturuldu: {user['email']}")


if __name__ == "__main__":
    main()
