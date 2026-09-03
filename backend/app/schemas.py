from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator, model_validator

from .models import UserRole, RequestStatus, TransactionType


# ---------- Auth ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# ---------- User ----------
class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    role: UserRole = UserRole.employee

    @field_validator("full_name")
    @classmethod
    def full_name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("full_name must not be blank")
        return v


class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def full_name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("full_name must not be blank")
        return v

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime


Token.model_rebuild()


# ---------- Item ----------
# Matches the `unit_price` column's Numeric(10, 2): 8 digits before the
# decimal point, 2 after.
_MAX_UNIT_PRICE = Decimal("99999999.99")

# Sanity ceiling for a physical store's stock counts, well within the
# `quantity_in_stock`/`reorder_level` Integer columns' range — catches
# fat-finger entry (an extra digit or two) as a clean 422 instead of
# letting an implausible value into reports and low-stock calculations.
_MAX_STOCK_QUANTITY = 1_000_000


class ItemBase(BaseModel):
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    quantity_in_stock: int = 0
    reorder_level: int = 0
    unit_price: Decimal = Decimal("0")


class ItemCreate(ItemBase):
    name: str = Field(..., min_length=1, max_length=150)
    category: Optional[str] = Field(None, max_length=100)
    unit: Optional[str] = Field(None, max_length=30)
    quantity_in_stock: int = Field(0, ge=0, le=_MAX_STOCK_QUANTITY)
    reorder_level: int = Field(0, ge=0, le=_MAX_STOCK_QUANTITY)
    unit_price: Decimal = Field(Decimal("0"), ge=0, le=_MAX_UNIT_PRICE)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Item name cannot be blank")
        return v

    @field_validator("category", "unit", "description")
    @classmethod
    def _blank_to_none(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("unit_price")
    @classmethod
    def _round_price(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class ItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    unit: Optional[str] = Field(None, max_length=30)
    quantity_in_stock: Optional[int] = Field(None, ge=0, le=_MAX_STOCK_QUANTITY)
    reorder_level: Optional[int] = Field(None, ge=0, le=_MAX_STOCK_QUANTITY)
    unit_price: Optional[Decimal] = Field(None, ge=0, le=_MAX_UNIT_PRICE)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("Item name cannot be blank")
        return v

    @field_validator("category", "unit", "description")
    @classmethod
    def _blank_to_none(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("unit_price")
    @classmethod
    def _round_price(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is None:
            return None
        return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class ItemOut(ItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    is_low_stock: bool = False
    # Richer than is_low_stock (kept as-is for existing callers): distinguishes
    # a merely-below-reorder-point item from one that's fully out of stock.
    # One of "ok" | "low_stock" | "out_of_stock".
    stock_status: str = "ok"


# ---------- Supplier ----------
class SupplierBase(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Supplier name must not be blank")
        return v


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(SupplierBase):
    name: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:  # type: ignore[override]
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Supplier name must not be blank")
        return v


class SupplierOut(SupplierBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


# ---------- Item Request ----------
class ItemRequestCreate(BaseModel):
    item_id: int
    quantity: int

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Quantity must be greater than zero")
        return v


class ItemRequestDecision(BaseModel):
    admin_note: Optional[str] = None


class ItemRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    employee_name: Optional[str] = None
    item_id: int
    item_name: Optional[str] = None
    quantity: int
    status: RequestStatus
    request_date: datetime
    response_date: Optional[datetime] = None
    admin_note: Optional[str] = None


# ---------- Transaction ----------
class TransactionCreate(BaseModel):
    item_id: int
    supplier_id: Optional[int] = None
    type: TransactionType
    quantity: int
    reference_no: Optional[str] = None
    notes: Optional[str] = None
    unit_cost: Optional[Decimal] = None
    total_cost: Optional[Decimal] = None
    issued_to_id: Optional[int] = None

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Quantity must be greater than zero")
        return v


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: int
    item_name: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    type: TransactionType
    quantity: int
    reference_no: Optional[str] = None
    notes: Optional[str] = None
    unit_cost: Optional[Decimal] = None
    total_cost: Optional[Decimal] = None
    issued_to_id: Optional[int] = None
    issued_to_name: Optional[str] = None
    transaction_date: datetime
    recorded_by_id: Optional[int] = None
    recorded_by_name: Optional[str] = None


# ---------- Reports ----------
class DashboardStats(BaseModel):
    total_items: int
    low_stock_items: int
    pending_requests: int
    total_suppliers: int
    transactions_this_month: int


class TransactionTimeseriesPoint(BaseModel):
    date: str
    received: int
    issued: int


# ---------- Admin / Backups ----------
class BackupOut(BaseModel):
    filename: str
    size_bytes: int
    created_at: datetime
