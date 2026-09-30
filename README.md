# Sudoku Arena

A live Sudoku competition platform (individual and team stages, judge supervision, real-time ranking, big-screen display). Built with Node.js/TypeScript/Express on the backend, React/TypeScript/Vite on the frontend, PostgreSQL and Redis for storage.

**Project status:** pre-build documentation phase is complete; **Unit 01 (Foundation) is implemented** — the repository, Docker environment, CI, backend/frontend skeletons, database migration, health check and i18n scaffold. No feature (login, competition setup, gameplay, etc.) exists yet; those are built unit by unit per `context/specs/00-build-plan.md`. Anyone pulling this repository today will see a running skeleton with a health check and a placeholder page, not a finished product.

Full product and technical documentation lives in [`context/`](context/) (start at [`context/README.md`](context/README.md)) and is the source of truth for what is decided, open, or still to be built.

---

## Prerequisites

- **Docker Desktop** (includes Docker Compose) — the supported way to run the project, since the same containers are used for development and deployment.
- Alternatively, to run the services without Docker: **Node.js 20+** (22 recommended) and **npm**, plus a local PostgreSQL 16 and Redis 7.
- **Git**, to clone the repository.

## Quick start (Docker — recommended)

1. Clone the repository and move into it:
   ```bash
   git clone <repository-url>
   cd geguan-sudoku-competition-platform
   ```
2. Create your local environment file from the template:
   ```bash
   cp .env.example .env
   ```
   The defaults in `.env.example` work as-is for local development. `.env` is git-ignored and must never be committed.
3. Start the whole stack with one command:
   ```bash
   docker compose up
   ```
   This starts PostgreSQL 16 and Redis 7, waits until both report healthy, applies the Prisma database migration, then starts the backend and frontend dev servers.
4. Once the logs settle (backend prints `backend listening`), open:
   - Backend health check: **http://localhost:3000/api/health**
   - Frontend: **http://localhost:5173**

### What to expect

- `GET http://localhost:3000/api/health` returns HTTP 200 with a JSON body like:
  ```json
  { "status": "ok", "uptimeSeconds": 12, "dependencies": { "database": "up", "redis": "up" } }
  ```
  (HTTP 503 with `"status": "error"` if the database or Redis isn't reachable — check the Docker logs.)
- `http://localhost:5173` shows a **placeholder page** with the i18n scaffold (English/Chinese) wired up. There is no login, no competition setup, no gameplay yet — those are later build units.

To stop the stack:
```bash
docker compose down
```
Add `-v` only if you intentionally want to delete the database/Redis data volumes as well.

## Running without Docker

Useful for faster local iteration on one service. You still need PostgreSQL 16 and Redis 7 reachable somewhere (you can start just those two via Docker: `docker compose up postgres redis`).

**Backend:**
```bash
cd backend
cp .env.example .env   # adjust POSTGRES_HOST/REDIS_HOST to localhost if not using Docker for them
npm install
npx prisma migrate deploy
npm run dev
```
Backend runs on **http://localhost:3000**.

**Frontend** (in a separate terminal):
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on **http://localhost:5173**.

## Tests, lint and type check

Run inside each service's folder (`backend/` or `frontend/`):
```bash
npm run lint
npm run typecheck
npm test
npm run build
```
These are the same checks CI runs on every push and pull request (see `.github/workflows/ci.yml`); a pull request cannot merge unless all four pass.

## Project structure

```text
backend/     Express + TypeScript API, Prisma schema/migrations, module-first structure
frontend/    React + TypeScript + Vite app
context/     Product and technical documentation a coding agent (or developer) builds from
context-feeders/  Requirements and decision-tracking record that feeds context/
docker-compose.yml   One command to run the full stack (Postgres, Redis, backend, frontend)
```

For what is decided, proposed, or still open — and the full build plan — read [`context/README.md`](context/README.md) first, then `context/progress-tracker.md` for current phase and next steps.
