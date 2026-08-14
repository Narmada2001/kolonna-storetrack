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


@router.get("", response_model=list[schemas.ItemOut], dependencies=[Depends(require_any_role)])
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
)
def create_item(payload: schemas.ItemCreate, db: Session = Depends(get_db)):
    item = Item(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.put("/{item_id}", response_model=schemas.ItemOut, dependencies=[Depends(require_admin)])
def update_item(item_id: int, payload: schemas.ItemUpdate, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
