"""
conftest.py — Shared fixtures for all test modules.

Uses an in-memory SQLite database so no real MySQL/PostgreSQL server is needed.
Each test module gets a fresh database via the `db` fixture.
"""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Point to in-memory SQLite before importing the app
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_storetrack.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

from app.database import Base, get_db  # noqa: E402
from app.main import app               # noqa: E402
from app.auth import hash_password     # noqa: E402
from app.models import User, UserRole  # noqa: E402

SQLALCHEMY_TEST_URL = "sqlite:///./test_storetrack.db"

engine = create_engine(
    SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function", autouse=False)
def db():
    """Provide a clean database session for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """FastAPI TestClient with the test DB injected via dependency override."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _create_user(db, full_name, email, password, role=UserRole.employee, is_active=True):
    """Helper to directly insert a user into the test DB."""
    user = User(
        full_name=full_name,
        email=email,
        password_hash=hash_password(password),
        role=role,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def admin_token(client, db):
    """Returns a valid JWT token for an admin user."""
    _create_user(db, "Admin User", "admin@test.lk", "Admin@1234", role=UserRole.admin)
    resp = client.post("/auth/login", json={"email": "admin@test.lk", "password": "Admin@1234"})
    assert resp.status_code == 200, resp.json()
    return resp.json()["access_token"]


@pytest.fixture(scope="function")
def employee_token(client, db):
    """Returns a valid JWT token for an employee user."""
    _create_user(db, "Employee User", "emp@test.lk", "Emp@12345", role=UserRole.employee)
    resp = client.post("/auth/login", json={"email": "emp@test.lk", "password": "Emp@12345"})
    assert resp.status_code == 200, resp.json()
    return resp.json()["access_token"]
