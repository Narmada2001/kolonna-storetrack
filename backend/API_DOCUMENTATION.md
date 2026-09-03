# Kolonna StoreTrack — API Documentation

> **Base URL (local):** `http://localhost:8000`  
> **Interactive docs:** `http://localhost:8000/docs` (Swagger UI)  
> **Authentication:** All endpoints except `POST /auth/login` require a Bearer token in the `Authorization` header.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Items (Inventory)](#3-items-inventory)
4. [Suppliers](#4-suppliers)
5. [Requests](#5-requests)
6. [Transactions](#6-transactions)
7. [Reports](#7-reports)
8. [Admin / Backups](#8-admin--backups)
9. [Status Codes Reference](#9-status-codes-reference)

---

## 1. Authentication

### `POST /auth/login`

Authenticates a user and returns a JWT access token.

- **Auth required:** No
- **Role required:** None

**Request body:**
```json
{
  "email": "admin@kolonna.lk",
  "password": "Admin@123"
}
```

**Success response — `200 OK`:**
```json
{
  "access_token": "<jwt-token>",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "full_name": "System Admin",
    "email": "admin@kolonna.lk",
    "role": "admin",
    "is_active": true,
    "created_at": "2025-01-01T00:00:00"
  }
}
```

**Error responses:**

| Status | When |
|--------|------|
| `401 Unauthorized` | Wrong email, wrong password, or deactivated account |
| `422 Unprocessable Entity` | Invalid email format or missing fields |

---

## 2. Users

All `/users` endpoints require **Admin** role.

### `GET /users`

Returns all user accounts ordered by creation date (newest first).

- **Auth:** Bearer token (Admin only)

**Success response — `200 OK`:** Array of user objects.

```json
[
  {
    "id": 1,
    "full_name": "System Admin",
    "email": "admin@kolonna.lk",
    "phone": null,
    "role": "admin",
    "is_active": true,
    "created_at": "2025-01-01T00:00:00"
  }
]
```

---

### `POST /users`

Creates a new user account.

- **Auth:** Bearer token (Admin only)

**Request body:**
```json
{
  "full_name": "Nimal Perera",
  "email": "nimal@kolonna.lk",
  "password": "SecurePass1",
  "role": "employee",
  "phone": "0771234567"
}
```

**Validation rules:**
- `full_name` — must not be blank
- `email` — must be a valid email address and unique
- `password` — minimum 8 characters
- `role` — must be `"admin"` or `"employee"`

**Success response — `201 Created`:** The created user object (password never returned).

**Error responses:**

| Status | When |
|--------|------|
| `400 Bad Request` | Email already registered |
| `403 Forbidden` | Caller is not an Admin |
| `422 Unprocessable Entity` | Validation errors (blank name, short password, etc.) |

---

### `PUT /users/{user_id}`

Updates an existing user. Only the provided fields are changed (partial update).

- **Auth:** Bearer token (Admin only)
- **Path param:** `user_id` — integer ID of the user

**Request body (all fields optional):**
```json
{
  "full_name": "Updated Name",
  "phone": "0779876543",
  "role": "admin",
  "is_active": false,
  "password": "NewPass@123"
}
```

**Success response — `200 OK`:** The updated user object.

**Error responses:**

| Status | When |
|--------|------|
| `404 Not Found` | User ID does not exist |
| `422 Unprocessable Entity` | Password shorter than 8 chars |

---

### `DELETE /users/{user_id}`

Permanently deletes a user account.

- **Auth:** Bearer token (Admin only)
- **Path param:** `user_id` — integer ID of the user

**Success response — `204 No Content`**

**Error responses:**

| Status | When |
|--------|------|
| `400 Bad Request` | Admin is trying to delete their own account |
| `404 Not Found` | User ID does not exist |

---

## 3. Items (Inventory)

### `GET /items`

Returns all inventory items. Supports filtering.

- **Auth:** Bearer token (Admin or Employee)

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Case-insensitive keyword filter on name and description |
| `category` | string | Exact category filter |
| `low_stock_only` | boolean | If `true`, returns only items at or below their reorder level |

**Success response — `200 OK`:** Array of item objects including `is_low_stock` flag.

```json
[
  {
    "id": 1,
    "name": "A4 Paper (500 sheets)",
    "category": "Stationery",
    "description": "White A4 copy paper",
    "unit": "ream",
    "quantity_in_stock": 50,
    "reorder_level": 10,
    "unit_price": "250.00",
    "is_low_stock": false,
    "created_at": "2025-01-01T00:00:00",
    "updated_at": "2025-01-01T00:00:00"
  }
]
```

---

### `POST /items`

Creates a new inventory item.

- **Auth:** Bearer token (Admin only)

**Request body:**
```json
{
  "name": "Stapler",
  "category": "Stationery",
  "description": "Heavy-duty stapler",
  "unit": "pcs",
  "quantity_in_stock": 5,
  "reorder_level": 2,
  "unit_price": "350.00"
}
```

**Validation rules:**
- `name` — must not be blank; must be unique (case-insensitive)
- `quantity_in_stock` — must be ≥ 0
- `reorder_level` — must be ≥ 0
- `unit_price` — must be ≥ 0

**Success response — `201 Created`:** The created item object.

**Error responses:**

| Status | When |
|--------|------|
| `403 Forbidden` | Caller is not an Admin |
| `409 Conflict` | An item with the same name already exists |
| `422 Unprocessable Entity` | Validation errors |

---

### `PUT /items/{item_id}`

Updates an existing item (partial update).

- **Auth:** Bearer token (Admin only)
- **Path param:** `item_id` — integer ID of the item

**Success response — `200 OK`:** The updated item object.

**Error responses:**

| Status | When |
|--------|------|
| `404 Not Found` | Item ID does not exist |
| `422 Unprocessable Entity` | Validation errors |

---

### `DELETE /items/{item_id}`

Permanently deletes an inventory item.

- **Auth:** Bearer token (Admin only)
- **Path param:** `item_id` — integer ID of the item

**Success response — `204 No Content`**

**Error responses:**

| Status | When |
|--------|------|
| `404 Not Found` | Item ID does not exist |

---

## 4. Suppliers

### `GET /suppliers`

Returns all suppliers ordered by name.

- **Auth:** Bearer token (Admin or Employee)

**Success response — `200 OK`:** Array of supplier objects.

---

### `POST /suppliers`

Creates a new supplier.

- **Auth:** Bearer token (Admin only)

**Request body:**
```json
{
  "name": "Colombo Stationery Ltd",
  "contact_person": "Mr. Silva",
  "phone": "0112345678",
  "email": "info@colombostat.lk",
  "address": "No. 15, Main Street, Colombo 01"
}
```

**Validation rules:**
- `name` — must not be blank; must be unique (case-insensitive)

**Success response — `201 Created`:** The created supplier object.

**Error responses:**

| Status | When |
|--------|------|
| `409 Conflict` | A supplier with the same name already exists |
| `422 Unprocessable Entity` | Blank supplier name |

---

### `PUT /suppliers/{supplier_id}` / `DELETE /suppliers/{supplier_id}`

Same pattern as items — partial update returns `200`, delete returns `204`, missing resource returns `404`.

---

## 5. Requests

Item requests represent an employee asking for inventory to be issued to them.

**Status lifecycle:** `pending` → `approved` → `fulfilled`  
**Alternate path:** `pending` → `rejected`

### `GET /requests`

Returns item requests.

- **Auth:** Bearer token (Admin or Employee)
- **Admin** sees all requests; **Employee** sees only their own.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status_filter` | string | Filter by status: `pending`, `approved`, `rejected`, `fulfilled` |

---

### `POST /requests`

Submits a new item request.

- **Auth:** Bearer token (Admin or Employee)

**Request body:**
```json
{
  "item_id": 3,
  "quantity": 2
}
```

**Validation rules:**
- `quantity` — must be > 0
- `item_id` — must reference an existing item

**Success response — `201 Created`:** The created request object with `status: "pending"`.

**Error responses:**

| Status | When |
|--------|------|
| `404 Not Found` | Item does not exist |
| `422 Unprocessable Entity` | Quantity ≤ 0 |

---

### `POST /requests/{request_id}/approve`

Approves a pending request.

- **Auth:** Bearer token (Admin only)

**Request body (optional):**
```json
{ "admin_note": "Approved for Q3 budget" }
```

**Success response — `200 OK`:** Updated request with `status: "approved"`.

**Error responses:**

| Status | When |
|--------|------|
| `400 Bad Request` | Request is not in `pending` state |
| `404 Not Found` | Request ID does not exist |

---

### `POST /requests/{request_id}/reject`

Rejects a pending request.

- **Auth:** Bearer token (Admin only)

Same body and error responses as `/approve`, but sets `status: "rejected"`.

---

### `POST /requests/{request_id}/fulfill`

Fulfills an approved request: deducts stock and logs a transaction.

- **Auth:** Bearer token (Admin only)
- **No request body required.**

**Success response — `200 OK`:** Updated request with `status: "fulfilled"`.

**Error responses:**

| Status | When |
|--------|------|
| `400 Bad Request` | Request is not in `approved` state, or insufficient stock |
| `404 Not Found` | Request ID does not exist |

---

## 6. Transactions

Transactions are the audit trail of stock movements (received from supplier, issued to staff).

### `GET /transactions`

Returns all transactions in reverse chronological order.

- **Auth:** Bearer token (Admin only)

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `item_id` | integer | Filter by item |
| `supplier_id` | integer | Filter by supplier |
| `type_filter` | string | Filter by type: `received` or `issued` |

---

### `POST /transactions`

Manually records a stock movement.

- **Auth:** Bearer token (Admin only)

**Request body:**
```json
{
  "item_id": 1,
  "supplier_id": 2,
  "type": "received",
  "quantity": 100,
  "reference_no": "GRN-2025-001"
}
```

**Validation rules:**
- `quantity` — must be > 0
- `type` — must be `"received"` or `"issued"`
- For `issued` type: stock must be sufficient

**Success response — `201 Created`:** The created transaction object.

**Error responses:**

| Status | When |
|--------|------|
| `400 Bad Request` | Insufficient stock (for `issued` type) or quantity ≤ 0 |
| `404 Not Found` | Item or supplier does not exist |
| `422 Unprocessable Entity` | Validation errors |

---

## 7. Reports

All report endpoints require **Admin** role.

### `GET /reports/dashboard`

Returns aggregate system statistics for the dashboard.

**Success response — `200 OK`:**
```json
{
  "total_items": 42,
  "low_stock_items": 5,
  "pending_requests": 3,
  "total_suppliers": 8,
  "transactions_this_month": 17
}
```

---

### `GET /reports/dashboard/transactions`

Returns a daily timeseries of received vs. issued quantities.

**Query parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `days` | `30` | Number of past days to include (max 365) |

**Success response — `200 OK`:**
```json
[
  { "date": "2025-08-01", "received": 50, "issued": 20 },
  { "date": "2025-08-02", "received": 0, "issued": 5 }
]
```

---

### `GET /reports/{report_name}/pdf`

Downloads a PDF report.

- **Path param:** `report_name` — one of `inventory`, `requests`, `transactions`

**Success response — `200 OK`:** Binary PDF file download.  
**Error:** `404` if `report_name` is not recognised.

---

### `GET /reports/{report_name}/excel`

Downloads an Excel (.xlsx) report.

Same path param and error behaviour as the PDF endpoint.

---

## 8. Admin / Backups

### `POST /admin/backup`

Triggers an immediate database backup to `backend/backups/`.

- **Auth:** Bearer token (Admin only)

**Success response — `200 OK`:**
```json
{
  "filename": "backup_2025-08-29T12-00-00.sql",
  "size_bytes": 204800,
  "created_at": "2025-08-29T12:00:00"
}
```

---

### `GET /admin/backups`

Lists existing backups.

- **Auth:** Bearer token (Admin only)

**Success response — `200 OK`:** Array of backup metadata objects.

---

## 9. Status Codes Reference

| Code | Meaning | Common cause |
|------|---------|--------------|
| `200 OK` | Success | GET / PUT / POST returning data |
| `201 Created` | Resource created | Successful POST |
| `204 No Content` | Success, no body | Successful DELETE |
| `400 Bad Request` | Business logic error | Duplicate email, insufficient stock, self-deletion |
| `401 Unauthorized` | Not authenticated | Missing or invalid token |
| `403 Forbidden` | Not authorised | Employee accessing admin-only route |
| `404 Not Found` | Resource not found | Invalid ID in path |
| `409 Conflict` | Duplicate resource | Item/supplier with same name |
| `422 Unprocessable Entity` | Validation failure | Invalid field values (Pydantic) |
| `500 Internal Server Error` | Unexpected error | Unhandled exception |
