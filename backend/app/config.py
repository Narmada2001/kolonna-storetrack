import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    database_url: str = os.getenv(
        "DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/kolonna_storetrack"
    )
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    cors_origins: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ]
    default_admin_email: str = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@kolonna.lk")
    default_admin_password: str = os.getenv("DEFAULT_ADMIN_PASSWORD", "Admin@123")


settings = Settings()
