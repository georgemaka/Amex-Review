from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import PostgresDsn, validator
import secrets


class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "AMEX Coding Portal"
    VERSION: str = "1.0.0"
    
    # Security
    SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440  # 24 hours
    
    # Database
    DATABASE_URL: PostgresDsn | str
    REDIS_URL: str = "redis://localhost:6379"
    
    # Email
    SMTP_HOST: str = "smtp.office365.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "GL@sukut.com"
    SMTP_PASSWORD: str = ""
    USE_OUTLOOK_AUTOMATION: bool = True
    EMAIL_FROM: str = "GL@sukut.com"
    
    # File Upload
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_SIZE: int = 104857600  # 100MB
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".xlsx", ".xls", ".csv"]
    
    # AMEX Configuration
    AMEX_VENDOR_CODE: str = "19473"
    
    # Feature Flags
    ENABLE_AUTO_SUGGESTIONS: bool = False
    ENABLE_BULK_CODING: bool = True
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]
    
    # Development
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    
    # First superuser
    FIRST_SUPERUSER_EMAIL: str = "admin@sukut.com"
    FIRST_SUPERUSER_PASSWORD: str = "admin123"
    FIRST_SUPERUSER_FIRST_NAME: str = "Admin"
    FIRST_SUPERUSER_LAST_NAME: str = "User"

    @validator("DATABASE_URL", pre=True)
    def validate_database_url(cls, v: Optional[str]) -> str:
        if isinstance(v, str):
            return v
        return str(v)

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()