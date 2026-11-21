"""Application settings, read once from the environment."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Every value the app reads from the environment."""

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    admin_username: str = Field(min_length=1)
    admin_password: SecretStr = Field(min_length=8)
    secret_key: SecretStr = Field(min_length=32)

    database_path: Path = Path("data/glancelab.db")
    static_dir: Path = Path("static")

    # Off only for plain-HTTP local development; production always sets the Secure flag.
    cookie_secure: bool = True
    admin_session_hours: int = Field(default=12, ge=1, le=168)
    login_max_failures: int = Field(default=5, ge=1)
    login_window_seconds: int = Field(default=300, ge=10)

    s3_endpoint_url: str | None = None
    s3_region: str = "us-east-1"
    s3_bucket: str = "glancelab"
    s3_access_key_id: SecretStr | None = None
    s3_secret_access_key: SecretStr | None = None

    max_upload_mb: int = Field(default=15, ge=1, le=50)
    image_max_edge_px: int = Field(default=2400, ge=600, le=6000)
    thumbnail_edge_px: int = Field(default=480, ge=100, le=1200)

    # A started session counts toward variant balance for this long without finishing.
    active_session_minutes: int = Field(default=30, ge=1, le=1440)


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings instance."""
    return Settings()  # pyright: ignore[reportCallIssue]
