"""
test_users.py — Test cases for the user management module.

Covers: creating users, duplicate email, short password, updating,
deleting, and the self-deletion guard.
"""
import pytest


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _new_user_payload(**overrides):
    return {
        "full_name": "Jane Doe",
        "email": "jane@test.lk",
        "password": "SecurePass1",
        "role": "employee",
        **overrides,
    }


class TestCreateUser:
    def test_create_user_success(self, client, admin_token):
        """Admin can create a new employee account."""
        resp = client.post("/users", json=_new_user_payload(), headers=_auth(admin_token))
        assert resp.status_code == 201
        body = resp.json()
        assert body["email"] == "jane@test.lk"
        assert body["full_name"] == "Jane Doe"
        assert "password_hash" not in body  # password must never be returned

    def test_create_user_duplicate_email_returns_400(self, client, admin_token):
        """Creating a user with an already-registered email returns HTTP 400."""
        client.post("/users", json=_new_user_payload(email="dup@test.lk"), headers=_auth(admin_token))
        resp = client.post("/users", json=_new_user_payload(email="dup@test.lk"), headers=_auth(admin_token))
        assert resp.status_code == 400

    def test_create_user_short_password_returns_422(self, client, admin_token):
        """Passwords shorter than 8 characters are rejected with HTTP 422."""
        resp = client.post(
            "/users",
            json=_new_user_payload(email="short@test.lk", password="abc"),
            headers=_auth(admin_token),
        )
        assert resp.status_code == 422

    def test_create_user_blank_name_returns_422(self, client, admin_token):
        """A blank full_name is rejected with HTTP 422."""
        resp = client.post(
            "/users",
            json=_new_user_payload(full_name="   ", email="blank@test.lk"),
            headers=_auth(admin_token),
        )
        assert resp.status_code == 422

    def test_employee_cannot_create_user(self, client, employee_token):
        """An employee JWT cannot create a new user account (403)."""
        resp = client.post("/users", json=_new_user_payload(email="new@test.lk"), headers=_auth(employee_token))
        assert resp.status_code == 403


class TestUpdateUser:
    def test_update_user_success(self, client, admin_token):
        """Admin can update a user's full name."""
        create_resp = client.post("/users", json=_new_user_payload(email="upd@test.lk"), headers=_auth(admin_token))
        user_id = create_resp.json()["id"]
        resp = client.put(f"/users/{user_id}", json={"full_name": "Updated Name"}, headers=_auth(admin_token))
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Updated Name"

    def test_update_user_not_found_returns_404(self, client, admin_token):
        """Updating a non-existent user returns HTTP 404."""
        resp = client.put("/users/99999", json={"full_name": "Ghost"}, headers=_auth(admin_token))
        assert resp.status_code == 404

    def test_update_user_short_password_returns_422(self, client, admin_token):
        """Setting a too-short password on update returns HTTP 422."""
        create_resp = client.post("/users", json=_new_user_payload(email="pw@test.lk"), headers=_auth(admin_token))
        user_id = create_resp.json()["id"]
        resp = client.put(f"/users/{user_id}", json={"password": "short"}, headers=_auth(admin_token))
        assert resp.status_code == 422


class TestDeleteUser:
    def test_delete_user_success(self, client, admin_token):
        """Admin can delete another user (204 No Content)."""
        create_resp = client.post("/users", json=_new_user_payload(email="del@test.lk"), headers=_auth(admin_token))
        user_id = create_resp.json()["id"]
        resp = client.delete(f"/users/{user_id}", headers=_auth(admin_token))
        assert resp.status_code == 204

    def test_delete_user_not_found_returns_404(self, client, admin_token):
        """Deleting a non-existent user returns HTTP 404."""
        resp = client.delete("/users/99999", headers=_auth(admin_token))
        assert resp.status_code == 404

    def test_admin_cannot_delete_own_account(self, client, admin_token, db):
        """An admin is prevented from deleting their own account (400)."""
        # Retrieve own ID from the /users list
        users_resp = client.get("/users", headers=_auth(admin_token))
        own_id = users_resp.json()[0]["id"]
        resp = client.delete(f"/users/{own_id}", headers=_auth(admin_token))
        assert resp.status_code == 400
