from app.models import ItemRequest, RequestStatus, Transaction, TransactionType


def test_complete_employee_to_admin_issue_workflow(
    client, authenticate, users, item, db_session
):
    authenticate(users["employee"])
    created = client.post(
        "/requests", json={"item_id": item.id, "quantity": 3}
    )
    request_id = created.json()["id"]

    authenticate(users["admin"])
    approved = client.post(
        f"/requests/{request_id}/approve",
        json={"admin_note": "Collect from the stores desk"},
    )
    fulfilled = client.post(f"/requests/{request_id}/fulfill")

    assert created.status_code == 201
    assert approved.status_code == 200
    assert fulfilled.status_code == 200
    assert fulfilled.json()["status"] == "fulfilled"

    db_session.refresh(item)
    request = db_session.get(ItemRequest, request_id)
    issue = db_session.query(Transaction).filter_by(reference_no=f"REQ-{request_id}").one()
    assert request.status == RequestStatus.fulfilled
    assert item.quantity_in_stock == 7
    assert issue.type == TransactionType.issued
    assert issue.quantity == 3
