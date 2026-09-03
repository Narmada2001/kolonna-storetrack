"""
test_items.py — Test cases for the inventory items module.

Covers: CRUD operations, duplicate-name validation, negative quantity
validation, search/category filtering, and the low-stock flag.
"""
import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _create_item(client, admin_token, **kwargs):
    payload = {
        "name": "Test Item",
        "quantity_in_stock": 10,
        "reorder_level": 2,
        "unit_price": "5.00",
        **kwargs,
    }
    return client.post("/items", json=payload, headers=_auth(admin_token))


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
class TestCreateItem:
    def test_create_item_success(self, client, admin_token):
        """Admin can create a new inventory item successfully."""
        resp = _create_item(client, admin_token, name="Office Chair")
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "Office Chair"
        assert body["quantity_in_stock"] == 10
        assert "id" in body

    def test_create_item_duplicate_name_returns_409(self, client, admin_token):
        """Creating an item with a duplicate name (case-insensitive) returns HTTP 409."""
        _create_item(client, admin_token, name="Stapler")
        resp = _create_item(client, admin_token, name="stapler")  # same name, different case
        assert resp.status_code == 409

    def test_create_item_negative_quantity_returns_422(self, client, admin_token):
        """A negative quantity_in_stock is rejected with HTTP 422 (validation error)."""
        resp = _create_item(client, admin_token, name="Eraser", quantity_in_stock=-5)
        assert resp.status_code == 422

    def test_create_item_negative_price_returns_422(self, client, admin_token):
        """A negative unit_price is rejected with HTTP 422 (validation error)."""
        resp = _create_item(client, admin_token, name="Pen", unit_price="-1.00")
        assert resp.status_code == 422

    def test_create_item_blank_name_returns_422(self, client, admin_token):
        """An empty or blank item name is rejected with HTTP 422."""
        resp = _create_item(client, admin_token, name="   ")
        assert resp.status_code == 422

    def test_employee_cannot_create_item(self, client, employee_token):
        """An employee JWT is rejected when attempting to create an item (403)."""
        resp = _create_item(client, employee_token, name="Notepad")
        assert resp.status_code == 403


class TestReadItems:
    def test_list_items_returns_list(self, client, admin_token):
        """GET /items returns a list (possibly empty) of items."""
        resp = client.get("/items", headers=_auth(admin_token))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_search_filter(self, client, admin_token):
        """The `search` query param filters items by name or description."""
        _create_item(client, admin_token, name="Blue Pen", description="ball-point pen")
        _create_item(client, admin_token, name="Red Marker")
        resp = client.get("/items?search=pen", headers=_auth(admin_token))
        assert resp.status_code == 200
        names = [i["name"] for i in resp.json()]
        assert "Blue Pen" in names
        assert "Red Marker" not in names

    def test_low_stock_flag_is_true_when_stock_at_reorder_level(self, client, admin_token):
        """An item at or below its reorder_level should have is_low_stock=True."""
        _create_item(client, admin_token, name="Low Paper", quantity_in_stock=5, reorder_level=5)
        resp = client.get("/items", headers=_auth(admin_token))
        low_paper = next(i for i in resp.json() if i["name"] == "Low Paper")
        assert low_paper["is_low_stock"] is True

    def test_low_stock_flag_is_false_above_reorder_level(self, client, admin_token):
        """An item above its reorder_level should have is_low_stock=False."""
        _create_item(client, admin_token, name="Plenty Paper", quantity_in_stock=50, reorder_level=5)
        resp = client.get("/items", headers=_auth(admin_token))
        item = next(i for i in resp.json() if i["name"] == "Plenty Paper")
        assert item["is_low_stock"] is False


class TestUpdateDeleteItem:
    def test_update_item_success(self, client, admin_token):
        """Admin can update an existing item's fields."""
        create_resp = _create_item(client, admin_token, name="Old Desk")
        item_id = create_resp.json()["id"]
        resp = client.put(
            f"/items/{item_id}",
            json={"name": "New Desk", "quantity_in_stock": 20},
            headers=_auth(admin_token),
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Desk"
        assert resp.json()["quantity_in_stock"] == 20

    def test_update_item_not_found_returns_404(self, client, admin_token):
        """Updating a non-existent item returns HTTP 404."""
        resp = client.put("/items/99999", json={"name": "Ghost"}, headers=_auth(admin_token))
        assert resp.status_code == 404

    def test_delete_item_success(self, client, admin_token):
        """Admin can delete an existing item (204 No Content)."""
        create_resp = _create_item(client, admin_token, name="Disposable Pen")
        item_id = create_resp.json()["id"]
        resp = client.delete(f"/items/{item_id}", headers=_auth(admin_token))
        assert resp.status_code == 204

    def test_delete_item_not_found_returns_404(self, client, admin_token):
        """Deleting a non-existent item returns HTTP 404."""
        resp = client.delete("/items/99999", headers=_auth(admin_token))
        assert resp.status_code == 404
