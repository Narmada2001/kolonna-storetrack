from app.models import RequestStatus


def test_admin_can_approve_pending_request(client, authenticate, users, pending_request):
    authenticate(users["admin"])
    response = client.post(
        f"/requests/{pending_request.id}/approve",
        json={"admin_note": "  Ready for collection  "},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "approved"
    assert response.json()["admin_note"] == "Ready for collection"
    assert response.json()["response_date"] is not None


def test_rejection_requires_reason(client, authenticate, users, pending_request):
    authenticate(users["admin"])
    response = client.post(
        f"/requests/{pending_request.id}/reject", json={"admin_note": "   "}
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "A rejection reason is required"
    assert pending_request.status == RequestStatus.pending


def test_admin_can_reject_with_reason(client, authenticate, users, pending_request):
    authenticate(users["admin"])
    response = client.post(
        f"/requests/{pending_request.id}/reject",
        json={"admin_note": "Not required for current duties"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    assert response.json()["admin_note"] == "Not required for current duties"
    assert response.json()["response_date"] is not None


def test_employee_cannot_decide_request(client, authenticate, users, pending_request):
    authenticate(users["employee"])
    response = client.post(
        f"/requests/{pending_request.id}/approve", json={"admin_note": None}
    )
    assert response.status_code == 403


def test_only_pending_request_can_be_decided(client, authenticate, users, pending_request, db_session):
    pending_request.status = RequestStatus.approved
    db_session.commit()
    authenticate(users["admin"])
    response = client.post(
        f"/requests/{pending_request.id}/reject", json={"admin_note": "Changed mind"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Only pending requests can be updated"
