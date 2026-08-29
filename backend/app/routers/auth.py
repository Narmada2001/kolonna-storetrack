from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import (
    clear_failed_logins,
    create_access_token,
    get_current_user,
    is_login_locked,
    register_failed_login,
    verify_password,
)
from ..database import get_db
from ..models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/login",
    response_model=schemas.Token,
    summary="Login and obtain a JWT token",
    description=(
        "Authenticates the user with email and password. "
        "Returns a signed JWT access token that must be included in the "
        "`Authorization: Bearer <token>` header for all subsequent requests."
    ),
)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    if is_login_locked(payload.email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again in a few minutes.",
        )

    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        register_failed_login(payload.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    clear_failed_logins(payload.email)
    token = create_access_token(subject=str(user.id))
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))


@router.get(
    "/me",
    response_model=schemas.UserOut,
    summary="Get current authenticated user",
    description="Returns the profile of the currently authenticated user based on the Bearer token.",
)
def me(current_user: User = Depends(get_current_user)):
    return current_user
