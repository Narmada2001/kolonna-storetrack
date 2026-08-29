from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import get_current_user, require_admin
from ..database import get_db
from ..models import Item, ItemRequest, RequestStatus, Transaction, TransactionType, User, UserRole

router = APIRouter(prefix="/requests", tags=["requests"])


def _to_out(req: ItemRequest) -> schemas.ItemRequestOut:
    out = schemas.ItemRequestOut.model_validate(req)
    out.employee_name = req.employee.full_name if req.employee else None
    out.item_name = req.item.name if req.item else None
    return out


@router.get(
    "",
    response_model=list[schemas.ItemRequestOut],
    summary="List item requests",
    description=(
        "Returns item requests. Admins see all requests; Employees see only their own. "
        "Optionally filter by status: pending, approved, rejected, fulfilled."
    ),
)
def list_requests(
    status_filter: Optional[RequestStatus] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ItemRequest)
    if current_user.role != UserRole.admin:
        query = query.filter(ItemRequest.employee_id == current_user.id)
    if status_filter:
        query = query.filter(ItemRequest.status == status_filter)
    requests = query.order_by(ItemRequest.request_date.desc()).all()
    return [_to_out(r) for r in requests]


@router.post(
    "",
    response_model=schemas.ItemRequestOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an item request",
    description=(
        "Submits a request for an inventory item. The request is created in `pending` status. "
        "Quantity must be greater than zero, and the item must exist."
    ),
)
def create_request(
    payload: schemas.ItemRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(Item).filter(Item.id == payload.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    req = ItemRequest(
        employee_id=current_user.id,
        item_id=payload.item_id,
        quantity=payload.quantity,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return _to_out(req)


def _get_pending_request(request_id: int, db: Session) -> ItemRequest:
    req = db.query(ItemRequest).filter(ItemRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != RequestStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending requests can be updated")
    return req


@router.post(
    "/{request_id}/approve",
    response_model=schemas.ItemRequestOut,
    dependencies=[Depends(require_admin)],
    summary="Approve a pending request",
    description=(
        "Admin-only. Sets the request status to `approved`. "
        "Only requests currently in `pending` state can be approved."
    ),
)
def approve_request(
    request_id: int,
    payload: schemas.ItemRequestDecision,
    db: Session = Depends(get_db),
):
    req = _get_pending_request(request_id, db)
    req.status = RequestStatus.approved
    req.admin_note = payload.admin_note
    req.response_date = datetime.utcnow()
    db.commit()
    db.refresh(req)
    return _to_out(req)


@router.post(
    "/{request_id}/reject",
    response_model=schemas.ItemRequestOut,
    dependencies=[Depends(require_admin)],
    summary="Reject a pending request",
    description=(
        "Admin-only. Sets the request status to `rejected`. "
        "Only requests currently in `pending` state can be rejected."
    ),
)
def reject_request(
    request_id: int,
    payload: schemas.ItemRequestDecision,
    db: Session = Depends(get_db),
):
    req = _get_pending_request(request_id, db)
    req.status = RequestStatus.rejected
    req.admin_note = payload.admin_note
    req.response_date = datetime.utcnow()
    db.commit()
    db.refresh(req)
    return _to_out(req)


@router.post(
    "/{request_id}/fulfill",
    response_model=schemas.ItemRequestOut,
    dependencies=[Depends(require_admin)],
    summary="Fulfill an approved request",
    description=(
        "Admin-only. Marks an approved request as fulfilled, deducts the requested quantity from "
        "the item's stock, and records an issued transaction. Fails with 400 if stock is insufficient."
    ),
)
def fulfill_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    req = db.query(ItemRequest).filter(ItemRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != RequestStatus.approved:
        raise HTTPException(
            status_code=400, detail="Only approved requests can be fulfilled"
        )

    item = db.query(Item).filter(Item.id == req.item_id).first()
    if item.quantity_in_stock < req.quantity:
        raise HTTPException(status_code=400, detail="Not enough stock to fulfill this request")

    item.quantity_in_stock -= req.quantity
    req.status = RequestStatus.fulfilled
    req.response_date = datetime.utcnow()

    db.add(
        Transaction(
            item_id=item.id,
            type=TransactionType.issued,
            quantity=req.quantity,
            reference_no=f"REQ-{req.id}",
            recorded_by_id=current_user.id,
        )
    )
    db.commit()
    db.refresh(req)
    return _to_out(req)
