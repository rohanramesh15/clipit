from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Project info
    PROJECT_NAME: str = "Deadbird API"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "Deadbird language learning backend"

    # Server config
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True

    # CORS — includes Vite dev server (5173) and CRA (3000)
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:8000",
        "https://project-deadbird-frontend.fly.dev",
        "https://theclipitapp.com",
        "https://www.theclipitapp.com",
    ]

    # Database
    DATABASE_URL: str

    # DeepL
    DEEPL_API_KEY: str = ""

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # SQLite + subtitle cache
    SQLITE_DB_PATH: str = "deadbird.db"
    SUBTITLES_CACHE_DIR: str = "subtitles_cache"

    # Email (Resend)
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Clip It <noreply@theclipitapp.com>"
    FRONTEND_URL: str = "https://www.theclipitapp.com"

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""

    # Gemini (chat, embeddings, STT, TTS)
    GEMINI_API_KEY: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
