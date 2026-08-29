from datetime import datetime
from decimal import Decimal
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
class ItemBase(BaseModel):
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    quantity_in_stock: int = 0
    reorder_level: int = 0
    unit_price: Decimal = Decimal("0")

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Item name must not be blank")
        return v

    @field_validator("quantity_in_stock")
    @classmethod
    def quantity_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("quantity_in_stock must be 0 or greater")
        return v

    @field_validator("reorder_level")
    @classmethod
    def reorder_level_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("reorder_level must be 0 or greater")
        return v

    @field_validator("unit_price")
    @classmethod
    def unit_price_non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("unit_price must be 0 or greater")
        return v


class ItemCreate(ItemBase):
    name: str = Field(..., min_length=1, max_length=150)
    category: Optional[str] = Field(None, max_length=100)
    unit: Optional[str] = Field(None, max_length=30)
    quantity_in_stock: int = Field(0, ge=0)
    reorder_level: int = Field(0, ge=0)
    unit_price: Decimal = Field(Decimal("0"), ge=0)

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


class ItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    unit: Optional[str] = Field(None, max_length=30)
    quantity_in_stock: Optional[int] = Field(None, ge=0)
    reorder_level: Optional[int] = Field(None, ge=0)
    unit_price: Optional[Decimal] = Field(None, ge=0)

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

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Item name must not be blank")
        return v

    @field_validator("quantity_in_stock")
    @classmethod
    def quantity_non_negative(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("quantity_in_stock must be 0 or greater")
        return v

    @field_validator("reorder_level")
    @classmethod
    def reorder_level_non_negative(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("reorder_level must be 0 or greater")
        return v

    @field_validator("unit_price")
    @classmethod
    def unit_price_non_negative(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v < 0:
            raise ValueError("unit_price must be 0 or greater")
        return v


class ItemOut(ItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    is_low_stock: bool = False


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
    transaction_date: datetime
    recorded_by_id: int
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
