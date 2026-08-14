"""Creates the default admin account and a small set of sample data so the
UI isn't empty on first run. Safe to run multiple times - skips anything
that already exists.

Usage: python -m app.seed
"""
from decimal import Decimal

from .auth import hash_password
from .config import settings
from .database import Base, SessionLocal, engine
from .models import Item, Supplier, User, UserRole

Base.metadata.create_all(bind=engine)


def run():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == settings.default_admin_email).first()
        if not admin:
            admin = User(
                full_name="System Administrator",
                email=settings.default_admin_email,
                password_hash=hash_password(settings.default_admin_password),
                role=UserRole.admin,
            )
            db.add(admin)
            print(f"Created default admin: {settings.default_admin_email} / {settings.default_admin_password}")
        else:
            print("Default admin already exists, skipping.")

        if not db.query(User).filter(User.email == "employee@kolonna.lk").first():
            db.add(
                User(
                    full_name="Sample Employee",
                    email="employee@kolonna.lk",
                    password_hash=hash_password("Employee@123"),
                    role=UserRole.employee,
                )
            )
            print("Created sample employee: employee@kolonna.lk / Employee@123")

        if db.query(Item).count() == 0:
            db.add_all(
                [
                    Item(
                        name="A4 Printing Paper (Ream)",
                        category="Stationery",
                        unit="ream",
                        quantity_in_stock=50,
                        reorder_level=10,
                        unit_price=Decimal("850.00"),
                    ),
                    Item(
                        name="Ballpoint Pen (Box of 50)",
                        category="Stationery",
                        unit="box",
                        quantity_in_stock=8,
                        reorder_level=5,
                        unit_price=Decimal("1200.00"),
                    ),
                    Item(
                        name="Toner Cartridge (HP 12A)",
                        category="Office Equipment",
                        unit="unit",
                        quantity_in_stock=3,
                        reorder_level=4,
                        unit_price=Decimal("6500.00"),
                    ),
                    Item(
                        name="File Folders (Pack of 25)",
                        category="Stationery",
                        unit="pack",
                        quantity_in_stock=25,
                        reorder_level=8,
                        unit_price=Decimal("950.00"),
                    ),
                ]
            )
            print("Created sample inventory items.")

        if db.query(Supplier).count() == 0:
            db.add_all(
                [
                    Supplier(
                        name="Ratnapura Stationers (Pvt) Ltd",
                        contact_person="M. Perera",
                        phone="045-2222222",
                        email="sales@ratnapurastationers.lk",
                        address="Main Street, Ratnapura",
                    ),
                    Supplier(
                        name="Kolonna Office Supplies",
                        contact_person="S. Fernando",
                        phone="045-2260123",
                        email="info@kolonnaoffice.lk",
                        address="Kolonna Town",
                    ),
                ]
            )
            print("Created sample suppliers.")

        db.commit()
        print("Seeding complete.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
