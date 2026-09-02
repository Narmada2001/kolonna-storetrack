import enum
from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    Numeric,
    ForeignKey,
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship

from .database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    employee = "employee"


class RequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    fulfilled = "fulfilled"


class TransactionType(str, enum.Enum):
    received = "received"
    issued = "issued"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.employee)
    phone = Column(String(30), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    requests = relationship("ItemRequest", back_populates="employee", foreign_keys="ItemRequest.employee_id")


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    category = Column(String(100), nullable=True, index=True)
    description = Column(Text, nullable=True)
    unit = Column(String(30), nullable=True)
    quantity_in_stock = Column(Integer, nullable=False, default=0)
    reorder_level = Column(Integer, nullable=False, default=0)
    unit_price = Column(Numeric(10, 2), nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    requests = relationship("ItemRequest", back_populates="item")
    transactions = relationship("Transaction", back_populates="item")


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    contact_person = Column(String(150), nullable=True)
    phone = Column(String(30), nullable=True)
    email = Column(String(150), nullable=True)
    address = Column(String(255), nullable=True)

    transactions = relationship("Transaction", back_populates="supplier")


class ItemRequest(Base):
    __tablename__ = "item_requests"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    status = Column(SAEnum(RequestStatus), nullable=False, default=RequestStatus.pending)
    request_date = Column(DateTime, default=datetime.utcnow)
    response_date = Column(DateTime, nullable=True)
    admin_note = Column(String(255), nullable=True)

    employee = relationship("User", back_populates="requests", foreign_keys=[employee_id])
    item = relationship("Item", back_populates="requests")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    type = Column(SAEnum(TransactionType), nullable=False)
    quantity = Column(Integer, nullable=False)
    reference_no = Column(String(100), nullable=True)
    transaction_date = Column(DateTime, default=datetime.utcnow)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    notes = Column(Text, nullable=True)
    unit_cost = Column(Numeric(10, 2), nullable=True, default=0)
    total_cost = Column(Numeric(10, 2), nullable=True, default=0)
    issued_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    item = relationship("Item", back_populates="transactions")
    supplier = relationship("Supplier", back_populates="transactions")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])
    issued_to = relationship("User", foreign_keys=[issued_to_id])

