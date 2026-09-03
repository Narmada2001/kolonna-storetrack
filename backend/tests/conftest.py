"""
Shared fixtures for all test modules.

Uses an in-memory SQLite database so no real MySQL/PostgreSQL server is needed.
Each test gets a fresh database and a shared SQLAlchemy session.
"""
import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import get_current_user, hash_password  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Item, ItemRequest, User, UserRole  # noqa: E402


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db(db_session):
    """Compatibility alias used by the broader backend test suite."""
    yield db_session


@pytest.fixture()
def users(db_session):
    employee = User(
        full_name="Test Employee",
        email="employee@test.local",
        password_hash="unused",
        role=UserRole.employee,
    )
    admin = User(
        full_name="Test Admin",
        email="admin@test.local",
        password_hash="unused",
        role=UserRole.admin,
    )
    db_session.add_all([employee, admin])
    db_session.commit()
    db_session.refresh(employee)
    db_session.refresh(admin)
    return {"employee": employee, "admin": admin}


@pytest.fixture()
def item(db_session):
    record = Item(name="A4 Paper", quantity_in_stock=10, reorder_level=2, unit_price=100)
    db_session.add(record)
    db_session.commit()
    db_session.refresh(record)
    return record


@pytest.fixture()
def pending_request(db_session, users, item):
    record = ItemRequest(employee_id=users["employee"].id, item_id=item.id, quantity=2)
    db_session.add(record)
    db_session.commit()
    db_session.refresh(record)
    return record


@pytest.fixture()
def client(db_session):
    def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def authenticate():
    def apply(user):
        app.dependency_overrides[get_current_user] = lambda: user

    return apply


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
