from pathlib import Path

from app.core.config import get_settings
from app.storage.base import StorageBackend


class LocalStorage(StorageBackend):
    def __init__(self, base_dir: str | None = None) -> None:
        settings = get_settings()
        self.base_path = Path(base_dir or settings.upload_directory).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _resolve(self, storage_key: str) -> Path:
        target = (self.base_path / storage_key).resolve()
        if not str(target).startswith(str(self.base_path)):
            raise ValueError("Invalid storage key")
        return target

    def save(self, storage_key: str, data: bytes) -> None:
        path = self._resolve(storage_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def load(self, storage_key: str) -> bytes:
        return self._resolve(storage_key).read_bytes()

    def delete(self, storage_key: str) -> None:
        path = self._resolve(storage_key)
        if path.exists():
            path.unlink()

    def delete_prefix(self, prefix: str) -> None:
        directory = self._resolve(prefix)
        if not directory.is_dir():
            return
        for path in directory.iterdir():
            if path.is_file():
                path.unlink()
        try:
            directory.rmdir()
        except OSError:
            pass

    def path_for(self, storage_key: str) -> str:
        return str(self._resolve(storage_key))
