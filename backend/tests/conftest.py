import os

os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import get_current_user
from app.database import Base, get_db
from app.main import app
from app.models import Item, User, UserRole


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
