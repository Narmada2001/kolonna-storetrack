# Kolonna StoreTrack

Store Management System for the Kolonna Divisional Secretariat — built from the approved
IS5109 Community Project proposal (`Community Project Group 18 (Approved ) (1).pdf`).

- **Backend:** FastAPI + SQLAlchemy + MySQL (PostgreSQL/SQLite also supported), JWT auth
- **Frontend:** React (Vite) + Tailwind CSS
- **Modules:** User Management, Inventory Management, Request Management, Transaction & Supplier Management, Reporting

> **New to this repo?** See [SETUP.md](SETUP.md) for a quick clone-to-running-app guide.

## Scope decision

The proposal's use-case diagram includes a "Customer" actor and a "Register" flow, but the
functional requirements (§6.1.1) only describe role-based access for **Admin** and **Staff/Employee**,
and the whole system is an internal store for Secretariat staff. This build implements
**Admin** and **Employee** roles only — there's no public customer registration. If a
customer-facing portal is needed later, it can be added as its own module without touching
the existing schema.

## Project structure

```
backend/    FastAPI API, SQLAlchemy models, JWT auth, PDF/Excel report export
frontend/   React + Tailwind single-page app
```

## Prerequisites

- Python 3.10+ (tested with 3.14)
- Node.js 18+ (tested with 22)
- A MySQL server (8.0+) — or use SQLite for local testing, see below

## Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt

copy .env.example .env          # then edit DATABASE_URL, SECRET_KEY, etc.
```

Create the database in MySQL first:

```sql
CREATE DATABASE kolonna_storetrack CHARACTER SET utf8mb4;
```

Set `DATABASE_URL` in `.env` to match, e.g.:

```
DATABASE_URL=mysql+pymysql://root:yourpassword@localhost:3306/kolonna_storetrack
```

Seed the default admin account and sample data (tables are created automatically):

```bash
python -m app.seed
```

Run the API:

```bash
uvicorn app.main:app --reload
```

- API docs: http://localhost:8000/docs
- Default admin login: `admin@kolonna.lk` / `Admin@123` (from `.env`, change after first login)
- Sample employee login: `employee@kolonna.lk` / `Employee@123`

**No MySQL server handy?** Set `DATABASE_URL=sqlite:///./storetrack.db` in `.env` instead —
everything else works unchanged. Switch back to MySQL for deployment.

## Frontend setup

```bash
cd frontend
npm install
copy .env.example .env          # VITE_API_URL should point at the backend, default http://localhost:8000
npm run dev
```

Open http://localhost:5173 and log in with the admin credentials above.

## Free demo hosting (Neon + Render + Vercel)

This gets you a public URL at no cost — good for showing mentors/staff a live demo. It is
**not** suitable for the Secretariat's real production use (see the caveats below and §8 Cost
Estimate in the proposal, which budgets paid hosting/domain for that). PostgreSQL is used here
instead of MySQL only because it's what's available for free across these providers — the
proposal explicitly lists "MySQL / PostgreSQL" as acceptable (§4.2), and the code is already
database-agnostic.

**1. Push this project to GitHub** (both Render and Vercel deploy from a Git repo) — already
done if you followed along earlier in this project.

**2. Database on [Neon](https://neon.tech)** (free forever tier, no card required)

- Sign up (GitHub login works) → **Create a project** → name it `kolonna-storetrack`
- On the project dashboard, copy the **connection string** shown (starts with `postgresql://`)
- Change its scheme from `postgresql://` to `postgresql+psycopg2://` — SQLAlchemy needs the
  `+psycopg2` driver suffix. This full string is your `DATABASE_URL` for the next step.

**3. Backend on [Render](https://render.com)** (free, sign up with GitHub)

- **New → Web Service** → connect your GitHub repo → Root Directory: `backend`
  - Build Command: `pip install -r requirements.txt`
  - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  - Environment variables:
    - `DATABASE_URL` = the Neon connection string from step 2 (with `+psycopg2` added)
    - `SECRET_KEY` = any long random string
    - `CORS_ORIGINS` = your Vercel URL (you'll get this in step 4 — come back and set it after)
  - Deploy. Once live, open the Render service's **Shell** tab and run `python -m app.seed`
    once to create the admin account and sample data.
- Note the backend's public URL, e.g. `https://kolonna-storetrack-api.onrender.com`.

**4. Frontend on [Vercel](https://vercel.com)** (free, sign up with GitHub)

- **New Project** → import the same repo → Root Directory: `frontend` (Vite is auto-detected)
- Environment variable: `VITE_API_URL` = the Render backend URL from step 3
- Deploy. You'll get a URL like `https://kolonna-storetrack.vercel.app`.

**5. Close the loop:** go back to the Render backend's environment variables, set
`CORS_ORIGINS` to the Vercel URL, and redeploy — otherwise the browser blocks requests with a
CORS error.

**Free-tier caveats:**
- Render's free web service spins down after 15 minutes of inactivity; the first request after
  idling takes ~30-50s to wake back up.
- Neon's free database auto-suspends after inactivity too, with a similar brief wake-up delay
  on the next query — but unlike Render Postgres, it doesn't expire after a fixed number of days.
- Neither tier is meant for real end-user reliability.

## What was verified

- Backend: dependency install, server startup, login → JWT issuance, full inventory
  CRUD, the create → approve → fulfill request workflow (confirms stock is decremented and a
  transaction is logged), admin-only route enforcement (403 for employees), and PDF report
  generation — all tested end-to-end via the running API (against SQLite locally, since no
  MySQL server was available in the dev sandbox; the code targets MySQL via `DATABASE_URL`).
- Frontend: `npm run build` completes with no errors; the dev server serves the app and the
  backend/frontend were run together successfully. The click-through UI flows (login, add
  item, submit/approve/fulfill a request, download a report) were **not** verified in an
  actual browser in this session — there was no browser tool available. Please run
  `npm run dev` and click through it yourself before treating the UI as fully verified.

## Security notes (per proposal §6.1.3)

- Passwords are hashed with bcrypt.
- JWTs expire after 60 minutes by default (`ACCESS_TOKEN_EXPIRE_MINUTES` in `.env`); the
  frontend logs the user out automatically on any 401 response.
- Role-based access control is enforced on the backend for every admin-only endpoint (not
  just hidden in the UI).
- For production: serve over HTTPS (e.g. behind Nginx/Caddy with a TLS cert), and set up
  regular `mysqldump` backups of the database — both are deployment-environment concerns
  outside what this codebase can enforce on its own.

## Default accounts (from `seed.py`)

| Role     | Email                 | Password      |
|----------|------------------------|---------------|
| Admin    | admin@kolonna.lk       | Admin@123     |
| Employee | employee@kolonna.lk    | Employee@123  |

Change these passwords (via the Users page as admin) before any real deployment.
