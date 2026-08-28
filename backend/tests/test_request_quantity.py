import pytest

from app.models import RequestStatus, Transaction, TransactionType


@pytest.mark.parametrize("quantity", [0, -1, 1.5, "2"])
def test_creation_rejects_non_positive_or_non_integer_quantity(
    client, authenticate, users, item, quantity
):
    authenticate(users["employee"])

    response = client.post(
        "/requests", json={"item_id": item.id, "quantity": quantity}
    )

    assert response.status_code == 422


def test_creation_allows_quantity_above_current_stock(
    client, authenticate, users, item
):
    authenticate(users["employee"])

    response = client.post(
        "/requests", json={"item_id": item.id, "quantity": item.quantity_in_stock + 5}
    )

    assert response.status_code == 201
    assert response.json()["status"] == "pending"


def test_fulfillment_rechecks_available_stock(
    client, authenticate, users, pending_request, item, db_session
):
    pending_request.status = RequestStatus.approved
    pending_request.quantity = item.quantity_in_stock + 1
    db_session.commit()
    authenticate(users["admin"])

    response = client.post(f"/requests/{pending_request.id}/fulfill")

    assert response.status_code == 400
    assert response.json()["detail"] == "Not enough stock to fulfill this request"
    db_session.refresh(item)
    assert item.quantity_in_stock == 10
    assert db_session.query(Transaction).count() == 0


def test_fulfillment_deducts_stock_and_records_single_issue(
    client, authenticate, users, pending_request, item, db_session
):
    pending_request.status = RequestStatus.approved
    db_session.commit()
    authenticate(users["admin"])

    first = client.post(f"/requests/{pending_request.id}/fulfill")
    second = client.post(f"/requests/{pending_request.id}/fulfill")

    assert first.status_code == 200
    assert first.json()["status"] == "fulfilled"
    assert second.status_code == 400
    db_session.refresh(item)
    assert item.quantity_in_stock == 8
    issues = db_session.query(Transaction).all()
    assert len(issues) == 1
    assert issues[0].type == TransactionType.issued
    assert issues[0].quantity == 2
    assert issues[0].reference_no == f"REQ-{pending_request.id}"
