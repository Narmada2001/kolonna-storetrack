"""
test_auth.py — Test cases for the authentication module.

Covers: login success/failure, inactive users, unauthenticated access,
and role-based access control enforcement.
"""
import pytest
from app.auth import hash_password
from app.models import User, UserRole


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _make_user(db, email, password, role=UserRole.employee, is_active=True):
    user = User(
        full_name="Test User",
        email=email,
        password_hash=hash_password(password),
        role=role,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
class TestLogin:
    def test_login_success_returns_token(self, client, db):
        """A valid email/password combination returns a JWT access token."""
        _make_user(db, "user@test.lk", "ValidPass1")
        resp = client.post("/auth/login", json={"email": "user@test.lk", "password": "ValidPass1"})
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"

    def test_login_wrong_password_returns_401(self, client, db):
        """Submitting a wrong password is rejected with HTTP 401."""
        _make_user(db, "user2@test.lk", "CorrectPass1")
        resp = client.post("/auth/login", json={"email": "user2@test.lk", "password": "WrongPass1"})
        assert resp.status_code == 401

    def test_login_unknown_email_returns_401(self, client, db):
        """A login attempt for a non-existent email is rejected with HTTP 401."""
        resp = client.post("/auth/login", json={"email": "nobody@test.lk", "password": "AnyPass1"})
        assert resp.status_code == 401

    def test_login_inactive_user_returns_401(self, client, db):
        """Deactivated users cannot log in even with correct credentials."""
        _make_user(db, "inactive@test.lk", "ValidPass1", is_active=False)
        resp = client.post("/auth/login", json={"email": "inactive@test.lk", "password": "ValidPass1"})
        assert resp.status_code == 401


class TestAccessControl:
    def test_protected_route_without_token_returns_401(self, client, db):
        """Accessing a protected route without a Bearer token returns HTTP 401."""
        resp = client.get("/items")
        assert resp.status_code == 401

    def test_employee_cannot_access_admin_only_route(self, client, employee_token):
        """An employee JWT is rejected on an admin-only endpoint with HTTP 403."""
        headers = {"Authorization": f"Bearer {employee_token}"}
        resp = client.get("/users", headers=headers)
        assert resp.status_code == 403

    def test_admin_can_access_admin_only_route(self, client, admin_token):
        """An admin JWT is accepted on admin-only endpoints."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = client.get("/users", headers=headers)
        assert resp.status_code == 200
