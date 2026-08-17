from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    database_url: str
    jwt_secret_key: str
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30
    upload_max_size_mb: int = 5
    upload_directory: str = "./uploads"
    storage_quota_gb: int = 10
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_pool_timeout: int = 30
    db_pool_recycle: int = 1800
    frontend_url: str = "http://localhost:5173"

    @property
    def upload_max_size_bytes(self) -> int:
        return self.upload_max_size_mb * 1024 * 1024

    @property
    def storage_quota_bytes(self) -> int:
        return self.storage_quota_gb * 1024 * 1024 * 1024

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_url.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
