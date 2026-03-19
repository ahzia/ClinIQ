from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Smart Health Mapping Backend"
    app_env: str = "dev"
    app_version: str = "0.1.0"
    api_prefix: str = "/api/v1"
    case_link_window_hours: int = 6
    identity_conflict_high_threshold: int = 2
    processed_db_path: str = "data/processed/harmonized.sqlite"
    ai_enabled: bool = True
    ai_provider: str = "openai"
    ai_model: str = "gpt-4o-mini"
    ai_api_key: str | None = None
    ai_api_base_url: str = "https://api.openai.com/v1"
    ai_timeout_seconds: int = 25

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
