from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict

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


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


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


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    quantity_in_stock: Optional[int] = None
    reorder_level: Optional[int] = None
    unit_price: Optional[Decimal] = None


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


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(SupplierBase):
    name: Optional[str] = None


class SupplierOut(SupplierBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


# ---------- Item Request ----------
class ItemRequestCreate(BaseModel):
    item_id: int
    quantity: int


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
