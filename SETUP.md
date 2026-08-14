# Kolonna StoreTrack — Setup Guide for Team Members

Quick guide to get the project running on your own machine after cloning it. For the full
project overview, deployment instructions, and design decisions, see [README.md](README.md).

## 1. Prerequisites

Install these first if you don't already have them:

- **Python 3.10+** — https://www.python.org/downloads/
- **Node.js 18+** (includes npm) — https://nodejs.org/
- **Git** — https://git-scm.com/downloads

You do **not** need MySQL installed to get started — see step 2, we'll use SQLite for local
development so everyone can run it without setting up a database server.

## 2. Clone the project

```bash
git clone https://github.com/Narmada2001/kolonna-storetrack.git
cd kolonna-storetrack
```

## 3. Backend setup

Open a terminal in the project folder:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```bash
# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create your local config file:

```bash
# Windows
copy .env.example .env

# macOS/Linux
cp .env.example .env
```

Open the new `.env` file and change this one line so it uses SQLite (no MySQL server needed
locally):

```
DATABASE_URL=sqlite:///./storetrack.db
```

Create the database tables and load sample data:

```bash
python -m app.seed
```

You should see output confirming a default admin account was created. Now start the backend:

```bash
uvicorn app.main:app --reload
```

Leave this terminal running. The API is now live at **http://localhost:8000** (check
http://localhost:8000/docs to confirm it's up).

## 4. Frontend setup

Open a **second, separate terminal** (keep the backend one running) in the project folder:

```bash
cd frontend
npm install
```

Create your local config file:

```bash
# Windows
copy .env.example .env

# macOS/Linux
cp .env.example .env
```

The default value (`VITE_API_URL=http://localhost:8000`) is already correct — no need to edit
it unless your backend is running somewhere else.

Start the frontend:

```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

## 5. Log in

| Role     | Email                | Password      |
|----------|-----------------------|---------------|
| Admin    | admin@kolonna.lk      | Admin@123     |
| Employee | employee@kolonna.lk   | Employee@123  |

Log in as **admin** to see everything (inventory, requests, suppliers, transactions, reports,
user management). Log in as **employee** to see the limited staff view (browse inventory, submit
item requests).

## Troubleshooting

**"Login failed. Please try again."** — This usually means the backend isn't running or isn't
reachable. Check:
- Is the `uvicorn` terminal from step 3 still running without errors?
- Does http://localhost:8000/health show `{"status":"ok"}` in your browser?
- Does `frontend/.env` have `VITE_API_URL=http://localhost:8000` (matching the backend's port)?

**`ModuleNotFoundError` when running the backend** — You likely forgot to activate the virtual
environment (step 3) before running `pip install` or `uvicorn`. Re-run the activate command for
your OS, then try again.

**Port already in use** — Something else on your machine is using port 8000 or 5173. Either stop
that process, or run the backend with `uvicorn app.main:app --reload --port 8001` (and update
`frontend/.env`'s `VITE_API_URL` to match).

**Changes to the database while testing** — `storetrack.db` is your own local SQLite file, not
shared with your teammates. If you want to reset it, stop the backend, delete
`backend/storetrack.db`, and re-run `python -m app.seed`.

## Project structure

```
backend/    FastAPI API — see backend/app/routers/ for one file per module
frontend/   React app — see frontend/src/pages/ for one file per screen
```

Each module in the proposal maps to a router + page pair:

| Module (from proposal) | Backend | Frontend |
|---|---|---|
| User Management | `backend/app/routers/auth.py`, `users.py` | `frontend/src/pages/Login.jsx`, `Users.jsx` |
| Inventory Management | `backend/app/routers/items.py` | `frontend/src/pages/Inventory.jsx` |
| Request Management | `backend/app/routers/requests.py` | `frontend/src/pages/Requests.jsx` |
| Transaction & Supplier Management | `backend/app/routers/transactions.py`, `suppliers.py` | `frontend/src/pages/Transactions.jsx`, `Suppliers.jsx` |
| Reporting | `backend/app/routers/reports.py` | `frontend/src/pages/Reports.jsx` |
