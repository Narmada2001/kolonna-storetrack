from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import get_current_user, require_admin
from ..database import get_db
from ..models import Item, Supplier, Transaction, TransactionType, User

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _to_out(txn: Transaction) -> schemas.TransactionOut:
    out = schemas.TransactionOut.model_validate(txn)
    out.item_name = txn.item.name if txn.item else None
    out.supplier_name = txn.supplier.name if txn.supplier else None
    out.recorded_by_name = txn.recorded_by.full_name if txn.recorded_by else None
    return out


@router.get(
    "",
    response_model=list[schemas.TransactionOut],
    dependencies=[Depends(require_admin)],
    summary="List all stock transactions",
    description=(
        "Returns all stock transactions in reverse chronological order. "
        "Supports optional filtering by item, supplier, and transaction type. "
        "Requires Admin role."
    ),
)
def list_transactions(
    item_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    type_filter: Optional[TransactionType] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Transaction)
    if item_id:
        query = query.filter(Transaction.item_id == item_id)
    if supplier_id:
        query = query.filter(Transaction.supplier_id == supplier_id)
    if type_filter:
        query = query.filter(Transaction.type == type_filter)
    txns = query.order_by(Transaction.transaction_date.desc()).all()
    return [_to_out(t) for t in txns]


@router.post(
    "",
    response_model=schemas.TransactionOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
    summary="Record a stock transaction",
    description=(
        "Manually records a stock movement (received or issued). "
        "For `received` transactions, stock is incremented. "
        "For `issued` transactions, stock is decremented — fails with 400 if insufficient. "
        "Quantity must be greater than zero. Requires Admin role."
    ),
)
def create_transaction(
    payload: schemas.TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(Item).filter(Item.id == payload.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if payload.supplier_id:
        supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    if payload.type == TransactionType.received:
        item.quantity_in_stock += payload.quantity
    else:
        if item.quantity_in_stock < payload.quantity:
            raise HTTPException(status_code=400, detail="Not enough stock to issue")
        item.quantity_in_stock -= payload.quantity

    txn = Transaction(
        item_id=payload.item_id,
        supplier_id=payload.supplier_id,
        type=payload.type,
        quantity=payload.quantity,
        reference_no=payload.reference_no,
        recorded_by_id=current_user.id,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return _to_out(txn)
