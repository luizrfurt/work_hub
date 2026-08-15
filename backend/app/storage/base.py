from abc import ABC, abstractmethod


class StorageBackend(ABC):
    @abstractmethod
    def save(self, storage_key: str, data: bytes) -> None:
        raise NotImplementedError

    @abstractmethod
    def load(self, storage_key: str) -> bytes:
        raise NotImplementedError

    @abstractmethod
    def delete(self, storage_key: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def delete_prefix(self, prefix: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def path_for(self, storage_key: str) -> str:
        raise NotImplementedError
