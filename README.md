# Sudoku Arena

A live Sudoku competition platform (individual and team stages, judge supervision, real-time ranking, big-screen display). Built with Node.js/TypeScript/Express on the backend, React/TypeScript/Vite on the frontend, PostgreSQL and Redis for storage.

## Start here if you're about to code

**Read [`CLAUDE.md`](CLAUDE.md) at the project root next — before writing anything.** It's the entry point for this project's build methodology ([`building-with-ai/`](building-with-ai/)): it states the exact current status (what's built, what's approved, what's blocked and why, what to build next), and the rules every change must follow.

**If your coding agent isn't Claude Code**, rename or copy `CLAUDE.md` to your agent's convention — the content is agent-agnostic:

| Agent | Entry point filename |
|---|---|
| Claude Code | `CLAUDE.md` (already named correctly) |
| Codex / GitHub Copilot | `AGENTS.md` |
| Cursor | `.cursorrules` |
| Windsurf | `.windsurfrules` |

**Project status:** actively being built, final push before the event. `CLAUDE.md`'s "Current status" section and [`context/progress-tracker.md`](context/progress-tracker.md) are the two places this is kept accurate day to day — read those for the real, current picture rather than trusting a summary here, which would only go stale again. In short: 10 of 15 units have shipped code (login, competition setup, judge management, round runtime, submission/scoring, individual ranking, big-screen display, judge supervision) — anyone pulling this repository will see a working Individual-stage competition flow, not just a skeleton.

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
- `http://localhost:5173` serves the real app: login (with a role picker), competition setup, judge management, the round runtime and gameplay screens, submission, individual ranking, the big-screen leaderboard, and the judge supervision dashboard — all with the i18n scaffold (English/Chinese) wired up. Question import, team-stage rounds, controller live commands, results/export and school ranking are not built yet — see `context/progress-tracker.md`.

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
