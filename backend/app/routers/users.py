from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import hash_password, require_admin
from ..database import get_db
from ..models import User, ItemRequest, Transaction

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[schemas.UserOut], dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post(
    "",
    response_model=schemas.UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        role=payload.role,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=schemas.UserOut, dependencies=[Depends(require_admin)])
def update_user(user_id: int, payload: schemas.UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        user.password_hash = hash_password(data.pop("password"))
    else:
        data.pop("password", None)
    for field, value in data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Nullify transactions where this user was the recorder or recipient
    # (recorded_by_id and issued_to_id are nullable FKs — safe to set NULL)
    db.query(Transaction).filter(Transaction.recorded_by_id == user_id).update(
        {Transaction.recorded_by_id: None}, synchronize_session="fetch"
    )
    db.query(Transaction).filter(Transaction.issued_to_id == user_id).update(
        {Transaction.issued_to_id: None}, synchronize_session="fetch"
    )

    # Delete item requests belonging to this employee
    # (employee_id is NOT NULL so we must delete them, not null them)
    db.query(ItemRequest).filter(ItemRequest.employee_id == user_id).delete(
        synchronize_session="fetch"
    )

    db.delete(user)
    db.commit()
