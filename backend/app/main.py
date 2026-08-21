from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import auth, users, items, suppliers, requests, transactions, reports, admin

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Kolonna StoreTrack API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(items.router)
app.include_router(suppliers.router)
app.include_router(requests.router)
app.include_router(transactions.router)
app.include_router(reports.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {"service": "Kolonna StoreTrack API", "status": "running"}


@app.get("/health")
def health():
    return {"status": "ok"}
