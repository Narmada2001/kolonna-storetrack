def test_employee_can_create_request(client, authenticate, users, item):
    authenticate(users["employee"])

    response = client.post("/requests", json={"item_id": item.id, "quantity": 3})

    assert response.status_code == 201
    assert response.json()["employee_id"] == users["employee"].id
    assert response.json()["item_id"] == item.id
    assert response.json()["quantity"] == 3
    assert response.json()["status"] == "pending"


def test_request_creation_requires_authentication(client, item):
    response = client.post("/requests", json={"item_id": item.id, "quantity": 1})

    assert response.status_code == 401


def test_admin_cannot_create_employee_request(client, authenticate, users, item):
    authenticate(users["admin"])

    response = client.post("/requests", json={"item_id": item.id, "quantity": 1})

    assert response.status_code == 403
    assert response.json()["detail"] == "Only employees can create item requests"


def test_request_rejects_unknown_item(client, authenticate, users):
    authenticate(users["employee"])

    response = client.post("/requests", json={"item_id": 9999, "quantity": 1})

    assert response.status_code == 404
    assert response.json()["detail"] == "Item not found"
