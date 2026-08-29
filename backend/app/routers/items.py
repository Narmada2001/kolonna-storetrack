from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import require_admin, require_any_role
from ..database import get_db
from ..models import Item

router = APIRouter(prefix="/items", tags=["items"])


def _to_out(item: Item) -> schemas.ItemOut:
    out = schemas.ItemOut.model_validate(item)
    out.is_low_stock = item.quantity_in_stock <= item.reorder_level
    return out


@router.get(
    "",
    response_model=list[schemas.ItemOut],
    dependencies=[Depends(require_any_role)],
    summary="List inventory items",
    description=(
        "Returns all inventory items. Supports optional filtering by name/description "
        "keyword (`search`), category, and low-stock flag. Accessible by both Admin and Employee."
    ),
)
def list_items(
    search: Optional[str] = None,
    category: Optional[str] = None,
    low_stock_only: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(Item)
    if search:
        like = f"%{search}%"
        query = query.filter(or_(Item.name.ilike(like), Item.description.ilike(like)))
    if category:
        query = query.filter(Item.category == category)

    items = query.order_by(Item.name).all()
    if low_stock_only:
        items = [i for i in items if i.quantity_in_stock <= i.reorder_level]
    return [_to_out(i) for i in items]


@router.post(
    "",
    response_model=schemas.ItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
    summary="Create a new inventory item",
    description=(
        "Creates a new item in the inventory. The item name must be unique (case-insensitive). "
        "Requires Admin role. Returns 409 if an item with the same name already exists."
    ),
)
def create_item(payload: schemas.ItemCreate, db: Session = Depends(get_db)):
    existing = db.query(Item).filter(Item.name.ilike(payload.name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An item named '{payload.name}' already exists",
        )
    item = Item(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.put(
    "/{item_id}",
    response_model=schemas.ItemOut,
    dependencies=[Depends(require_admin)],
    summary="Update an inventory item",
    description=(
        "Updates fields of an existing item by ID. Only the supplied fields are updated "
        "(partial update). Requires Admin role. Returns 404 if the item does not exist."
    ),
)
def update_item(item_id: int, payload: schemas.ItemUpdate, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Item with id {item_id} not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
    summary="Delete an inventory item",
    description=(
        "Permanently deletes an item by ID. Requires Admin role. "
        "Returns 404 if the item does not exist."
    ),
)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Item with id {item_id} not found")
    db.delete(item)
    db.commit()
