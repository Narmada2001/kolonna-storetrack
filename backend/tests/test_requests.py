"""
test_requests.py — Test cases for the item request module.

Covers: submitting requests, invalid quantities, admin approval/rejection,
fulfillment stock decrement, and insufficient-stock guard.
"""
import pytest
from app.models import Item, UserRole
from app.auth import hash_password
from app.models import User


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _seed_item(db, name="A4 Paper", quantity=20, reorder_level=5):
    item = Item(name=name, quantity_in_stock=quantity, reorder_level=reorder_level, unit_price=10)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


class TestCreateRequest:
    def test_employee_can_create_request(self, client, employee_token, db):
        """An employee can submit a valid item request."""
        item = _seed_item(db)
        resp = client.post(
            "/requests",
            json={"item_id": item.id, "quantity": 3},
            headers=_auth(employee_token),
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["status"] == "pending"
        assert body["quantity"] == 3

    def test_create_request_zero_quantity_returns_422(self, client, employee_token, db):
        """Requesting zero quantity is rejected with HTTP 422 by the schema validator."""
        item = _seed_item(db)
        resp = client.post(
            "/requests",
            json={"item_id": item.id, "quantity": 0},
            headers=_auth(employee_token),
        )
        assert resp.status_code == 422

    def test_create_request_negative_quantity_returns_422(self, client, employee_token, db):
        """Requesting a negative quantity is rejected with HTTP 422."""
        item = _seed_item(db)
        resp = client.post(
            "/requests",
            json={"item_id": item.id, "quantity": -5},
            headers=_auth(employee_token),
        )
        assert resp.status_code == 422

    def test_create_request_nonexistent_item_returns_404(self, client, employee_token, db):
        """Requesting an item that doesn't exist returns HTTP 404."""
        resp = client.post(
            "/requests",
            json={"item_id": 99999, "quantity": 1},
            headers=_auth(employee_token),
        )
        assert resp.status_code == 404


class TestApproveRejectRequest:
    def test_admin_can_approve_pending_request(self, client, admin_token, employee_token, db):
        """An admin can approve a pending item request."""
        item = _seed_item(db)
        req_resp = client.post(
            "/requests",
            json={"item_id": item.id, "quantity": 2},
            headers=_auth(employee_token),
        )
        req_id = req_resp.json()["id"]
        resp = client.post(
            f"/requests/{req_id}/approve",
            json={"admin_note": "Approved"},
            headers=_auth(admin_token),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"

    def test_admin_can_reject_pending_request(self, client, admin_token, employee_token, db):
        """An admin can reject a pending item request."""
        item = _seed_item(db)
        req_resp = client.post(
            "/requests",
            json={"item_id": item.id, "quantity": 2},
            headers=_auth(employee_token),
        )
        req_id = req_resp.json()["id"]
        resp = client.post(
            f"/requests/{req_id}/reject",
            json={"admin_note": "Budget issue"},
            headers=_auth(admin_token),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"

    def test_cannot_approve_already_rejected_request(self, client, admin_token, employee_token, db):
        """A rejected request cannot be approved again (400)."""
        item = _seed_item(db)
        req_resp = client.post(
            "/requests",
            json={"item_id": item.id, "quantity": 1},
            headers=_auth(employee_token),
        )
        req_id = req_resp.json()["id"]
        client.post(
            f"/requests/{req_id}/reject",
            json={"admin_note": "No longer required"},
            headers=_auth(admin_token),
        )
        resp = client.post(f"/requests/{req_id}/approve", json={}, headers=_auth(admin_token))
        assert resp.status_code == 400


class TestFulfillRequest:
    def test_fulfill_request_decrements_stock(self, client, admin_token, employee_token, db):
        """Fulfilling an approved request reduces the item's stock by the requested quantity."""
        item = _seed_item(db, quantity=20)
        req_resp = client.post(
            "/requests",
            json={"item_id": item.id, "quantity": 5},
            headers=_auth(employee_token),
        )
        req_id = req_resp.json()["id"]
        client.post(f"/requests/{req_id}/approve", json={}, headers=_auth(admin_token))
        fulfill_resp = client.post(f"/requests/{req_id}/fulfill", headers=_auth(admin_token))
        assert fulfill_resp.status_code == 200
        assert fulfill_resp.json()["status"] == "fulfilled"

        # Verify stock was decremented
        items_resp = client.get("/items", headers=_auth(admin_token))
        updated_item = next(i for i in items_resp.json() if i["id"] == item.id)
        assert updated_item["quantity_in_stock"] == 15

    def test_fulfill_request_insufficient_stock_returns_400(self, client, admin_token, employee_token, db):
        """Fulfilling a request when stock is insufficient returns HTTP 400."""
        item = _seed_item(db, quantity=2)
        req_resp = client.post(
            "/requests",
            json={"item_id": item.id, "quantity": 10},
            headers=_auth(employee_token),
        )
        req_id = req_resp.json()["id"]
        client.post(f"/requests/{req_id}/approve", json={}, headers=_auth(admin_token))
        resp = client.post(f"/requests/{req_id}/fulfill", headers=_auth(admin_token))
        assert resp.status_code == 400
