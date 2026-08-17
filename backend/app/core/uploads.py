from fastapi import UploadFile

from app.core.config import get_settings
from app.core.exceptions import AppError

ALLOWED_BY_EXTENSION = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".txt": "text/plain",
    ".zip": "application/zip",
}

MIME_ALIASES = {
    "application/x-zip-compressed": "application/zip",
    "application/x-zip": "application/zip",
}

MAGIC_CHECKS = {
    "image/jpeg": lambda data: data[:3] == b"\xff\xd8\xff",
    "image/png": lambda data: data[:8] == b"\x89PNG\r\n\x1a\n",
    "image/webp": lambda data: data[:4] == b"RIFF" and data[8:12] == b"WEBP",
    "text/plain": lambda data: b"\x00" not in data[:1024],
    "application/zip": lambda data: data[:4] in {b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"},
}


def validate_upload(file: UploadFile, data: bytes) -> tuple[str, str]:
    settings = get_settings()
    if not data:
        raise AppError("Arquivo vazio.")
    if len(data) > settings.upload_max_size_bytes:
        raise AppError(f"Arquivo excede o limite de {settings.upload_max_size_mb} MB.")

    original_name = (file.filename or "arquivo").strip()
    extension = ""
    if "." in original_name:
        extension = "." + original_name.rsplit(".", 1)[-1].lower()

    mime_type = ALLOWED_BY_EXTENSION.get(extension)
    if mime_type is None:
        raise AppError("Tipo de arquivo não permitido. Envie JPEG, PNG, WEBP, TXT ou ZIP.")

    declared = (file.content_type or "").split(";")[0].strip().lower()
    declared = MIME_ALIASES.get(declared, declared)
    if declared and declared not in {"application/octet-stream", mime_type}:
        raise AppError("A extensão do arquivo não corresponde ao tipo informado.")
    if not MAGIC_CHECKS[mime_type](data):
        raise AppError("O conteúdo do arquivo não corresponde ao tipo informado.")

    return mime_type, original_name
