from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PAPERMAN_", env_file=".env", extra="ignore"
    )
    data_dir: Path = Path("data")
    model_api_key: str = "local"
    poll_seconds: float = Field(default=10, ge=1)
    settle_seconds: float = Field(default=5, ge=0)
    max_upload_mb: int = Field(default=100, ge=1)
