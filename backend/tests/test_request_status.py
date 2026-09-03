from app.models import ItemRequest, RequestStatus


def test_employee_only_lists_own_requests(client, authenticate, users, item, db_session):
    other_employee = users["admin"]
    own = ItemRequest(employee_id=users["employee"].id, item_id=item.id, quantity=1)
    other = ItemRequest(employee_id=other_employee.id, item_id=item.id, quantity=1)
    db_session.add_all([own, other])
    db_session.commit()
    authenticate(users["employee"])

    response = client.get("/requests")

    assert response.status_code == 200
    assert [record["id"] for record in response.json()] == [own.id]


def test_admin_lists_requests_from_all_users(client, authenticate, users, item, db_session):
    db_session.add_all(
        [
            ItemRequest(employee_id=users["employee"].id, item_id=item.id, quantity=1),
            ItemRequest(employee_id=users["admin"].id, item_id=item.id, quantity=2),
        ]
    )
    db_session.commit()
    authenticate(users["admin"])

    response = client.get("/requests")

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_status_filter_returns_only_matching_requests(client, authenticate, users, item, db_session):
    db_session.add_all(
        [
            ItemRequest(
                employee_id=users["employee"].id,
                item_id=item.id,
                quantity=1,
                status=RequestStatus.pending,
            ),
            ItemRequest(
                employee_id=users["employee"].id,
                item_id=item.id,
                quantity=1,
                status=RequestStatus.rejected,
            ),
        ]
    )
    db_session.commit()
    authenticate(users["employee"])

    response = client.get("/requests", params={"status_filter": "rejected"})

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["status"] == "rejected"


def test_invalid_status_filter_is_rejected(client, authenticate, users):
    authenticate(users["employee"])

    response = client.get("/requests", params={"status_filter": "cancelled"})

    assert response.status_code == 422


def test_repeated_decision_does_not_change_final_status(
    client, authenticate, users, pending_request
):
    authenticate(users["admin"])
    first = client.post(
        f"/requests/{pending_request.id}/approve", json={"admin_note": None}
    )
    second = client.post(
        f"/requests/{pending_request.id}/reject", json={"admin_note": "Too late"}
    )

    assert first.status_code == 200
    assert second.status_code == 400
    assert pending_request.status == RequestStatus.approved
