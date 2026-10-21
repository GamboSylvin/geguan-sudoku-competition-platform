# Sudoku Arena

A live Sudoku competition platform (individual and team stages, judge supervision, real-time ranking, big-screen display). Built with Node.js/TypeScript/Express on the backend, React/TypeScript/Vite on the frontend, PostgreSQL and Redis for storage.

## For the project owner — how to test this app

You do not need any coding experience to follow this. You'll need a terminal (Command Prompt or PowerShell on Windows, Terminal on Mac) to run a few commands that are copy-pasted for you below — nothing to write yourself.

1. **Install Docker Desktop.** Download it from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) and install it like any other application. Open it and wait until it says it's running (it needs to stay open in the background the whole time you're testing).
2. **Get the project onto your computer.** Either:
   - the simplest way: on the project's GitHub page, click the green **Code** button → **Download ZIP**, then unzip it anywhere on your computer; **or**
   - if you have Git installed:
     ```bash
     git clone https://github.com/GamboSylvin/geguan-sudoku-competition-platform.git
     cd geguan-sudoku-competition-platform
     ```
3. **Open a terminal inside that folder** and follow the **Quick start (Docker — recommended)** steps below — just that section; ignore "Running without Docker" and "Tests, lint and type check" further down, those are for developers only.
4. Once `http://localhost:5173` opens in your browser and shows the app's login page, **you're ready to test.** Open [`testing/manual-test-scenarios.md`](testing/manual-test-scenarios.md) and follow it from the top — it's a complete, click-by-click script written for someone testing the app, not someone coding it, and it doesn't assume you've read anything else first.
5. **Whenever something doesn't match what that guide says you should see**, write it down in [`testing/ANOMALIES-TROUVEES.md`](testing/ANOMALIES-TROUVEES.md) — a blank template with an example is already there; just copy it and fill in one entry per problem. You don't need to explain *why* it's wrong, only describe what you saw.

If a step in the Quick start below genuinely doesn't work on your machine (not just "something in the app itself looks wrong," which goes in the file above), that's worth a direct message rather than a line in that file.

## Start here if you're about to code

**Read [`CLAUDE.md`](CLAUDE.md) at the project root next — before writing anything.** It's the entry point for this project's build methodology ([`building-with-ai/`](building-with-ai/)): it states the exact current status (what's built, what's approved, what's blocked and why, what to build next), and the rules every change must follow.

**If your coding agent isn't Claude Code**, rename or copy `CLAUDE.md` to your agent's convention — the content is agent-agnostic:

| Agent | Entry point filename |
|---|---|
| Claude Code | `CLAUDE.md` (already named correctly) |
| Codex / GitHub Copilot | `AGENTS.md` |
| Cursor | `.cursorrules` |
| Windsurf | `.windsurfrules` |

**Project status:** this section is deliberately short, on purpose — a specific unit-by-unit claim here has gone stale and wrong before. `CLAUDE.md`'s "Current status" section and [`context/progress-tracker.md`](context/progress-tracker.md) are the two places the real, current picture is kept accurate day to day; read those rather than trusting anything more detailed written here. In short: all 15 originally-planned units have shipped code (a complete Individual **and** Team competition flow — setup, question import, judges, round runtime, scoring, ranking, big-screen display, live controller commands, results/export, both team-stage formats, school ranking — not a skeleton), plus several post-build additions (school management, competition deletion, a language switcher, a visual design pass). Deployment to a single Alibaba Cloud ECS instance is decided (BLD-048) — see [`DEPLOY.md`](DEPLOY.md) for where that stands.

Full product and technical documentation lives in [`context/`](context/) (start at [`context/README.md`](context/README.md)) and is the source of truth for what is decided, open, or still to be built.

---

## Prerequisites

- **Docker Desktop** (includes Docker Compose) — the supported way to run the project, since the same containers are used for development and deployment.
- Alternatively, to run the services without Docker: **Node.js 20+** (22 recommended) and **npm**, plus a local PostgreSQL 16 and Redis 7.
- **Git**, to clone the repository.

## Quick start (Docker — recommended)

1. Clone the repository and move into it (skip this if you already have the folder, e.g. from a ZIP download):
   ```bash
   git clone https://github.com/GamboSylvin/geguan-sudoku-competition-platform.git
   cd geguan-sudoku-competition-platform
   ```
2. Create your local environment file from the template, if you don't already have a `.env` file in this folder:
   ```bash
   cp .env.example .env
   ```
   The defaults in `.env.example` work as-is for local development. `.env` is git-ignored and must never be committed. **Note the port:** `.env.example` defaults `BACKEND_PORT` to `3000`; if this folder already came with a working `.env` (some checkouts do, for historical reasons), it may instead be set to `3001`. Step 4 below tells you how to tell which one you actually got.
3. Start the whole stack with one command:
   ```bash
   docker compose up
   ```
   This starts PostgreSQL 16 and Redis 7, waits until both report healthy, applies the Prisma database migration, then starts the backend and frontend dev servers.
4. Once the logs settle (backend prints `backend listening`), check which port the backend is actually on — open **http://localhost:3000/api/health**, and if that doesn't answer, try **http://localhost:3001/api/health** instead (see the port note in step 2). Whichever one responds with `{"status":"ok", ...}` is the one to use for the rest of this guide and for `testing/manual-test-scenarios.md`. Then open the frontend: **http://localhost:5173**.

### What to expect

- The backend health check returns HTTP 200 with a JSON body like:
  ```json
  { "status": "ok", "uptimeSeconds": 12, "dependencies": { "database": "up", "redis": "up" } }
  ```
  (HTTP 503 with `"status": "error"` if the database or Redis isn't reachable — check the Docker logs.)
- `http://localhost:5173` serves the real app: login (with a role picker), competition setup, participant and question import, judge management, the round runtime and gameplay screens (Individual active round, Team rotation relay, Team partition collaboration), submission, individual ranking, the big-screen leaderboard, the judge supervision dashboard, the controller live-command dashboard, the results/corrections/export screen and the school-ranking screen — a complete Individual **and** Team competition flow, not a skeleton. See [`testing/manual-test-scenarios.md`](testing/manual-test-scenarios.md) for exactly how to exercise every one of these.

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
docker-compose.yml   One command to run the full development stack (Postgres, Redis, backend, frontend)
docker-compose.prod.yml  The separate production stack (BLD-048) — see DEPLOY.md
DEPLOY.md    The deployment runbook for the single Alibaba Cloud ECS instance
```

The two compose files are **separate projects**, not an override pair: `docker-compose.prod.yml` carries an explicit top-level `name: sudoku-prod` so bringing it up can never treat the running development containers as orphans and destroy them. Only port 80 is published in production, and the built frontend is served same-origin by the Express backend.

For what is decided, proposed, or still open — and the full build plan — read [`context/README.md`](context/README.md) first, then `context/progress-tracker.md` for current phase and next steps.
