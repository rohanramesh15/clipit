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
        "http://localhost:8000",
    ]

    # Database
    DATABASE_URL: str

    # Security (example - uncomment and configure as needed)
    # SECRET_KEY: str = "your-secret-key-here"
    # ALGORITHM: str = "HS256"
    # ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # SQLite + subtitle cache
    SQLITE_DB_PATH: str = "deadbird.db"
    SUBTITLES_CACHE_DIR: str = "subtitles_cache"
      

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
