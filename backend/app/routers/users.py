from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import get_current_user, hash_password, require_admin
from ..database import get_db
from ..models import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "",
    response_model=list[schemas.UserOut],
    dependencies=[Depends(require_admin)],
    summary="List all users",
    description="Returns all user accounts ordered by creation date (newest first). Requires Admin role.",
)
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post(
    "",
    response_model=schemas.UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
    summary="Create a new user account",
    description=(
        "Creates a new Admin or Employee user account. The email address must be unique. "
        "Password must be at least 8 characters. Requires Admin role. "
        "Returns 400 if the email is already registered."
    ),
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


@router.put(
    "/{user_id}",
    response_model=schemas.UserOut,
    dependencies=[Depends(require_admin)],
    summary="Update a user account",
    description=(
        "Updates fields of an existing user by ID (partial update). "
        "Optionally resets the password if `password` is supplied. "
        "Requires Admin role. Returns 404 if the user does not exist."
    ),
)
def update_user(user_id: int, payload: schemas.UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User with id {user_id} not found")

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


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a user account",
    description=(
        "Permanently deletes a user account by ID. Requires Admin role. "
        "Returns 404 if the user does not exist. "
        "Returns 400 if the admin attempts to delete their own account."
    ),
)
def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User with id {user_id} not found")
    db.delete(user)
    db.commit()
