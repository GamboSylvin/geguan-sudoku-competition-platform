# Sudoku Arena — deployment runbook (BLD-048)

**Target:** one Alibaba Cloud ECS instance, Ubuntu, Mainland China region, reached by
its **public IP address**. No domain name, therefore no ICP备案, therefore **plain
HTTP, no TLS** — a deliberate current state, tracked as **I-40** (revisit before the
real event). Whether Alibaba Cloud is happy to serve plain HTTP on a bare IP without
ICP备案 is **I-39**, to be checked against the provider when the real instance exists;
it is not guessed here.

**Audience:** whoever holds the server, whether or not they do this for a living. Every
step is one command, and says what that command does.

**Redeploys are manual, by choice.** There is no CI/CD in front of this (declined
explicitly; see the decision register, BLD-048). Deploying means: `git pull`, rebuild,
restart.

> **Nothing in this file changes the development setup.** `docker-compose.yml`,
> `backend/Dockerfile` and `frontend/Dockerfile` are the live dev stack and are
> untouched by this track. Everything here uses new files: `docker-compose.prod.yml`,
> `backend/Dockerfile.prod`, `.env.production.example`, `.dockerignore`.

---

## 0. What you will end up with

Three containers on one machine, and **one open port**:

| Container              | What it is                          | Reachable from the internet? |
| ---------------------- | ----------------------------------- | ---------------------------- |
| `sudoku-prod-backend`  | Node/Express API **+ the frontend** | **Yes — port 80 only**       |
| `sudoku-prod-postgres` | PostgreSQL 16 (results, accounts)   | No                           |
| `sudoku-prod-redis`    | Redis 7 (live round state)          | No                           |

Postgres and Redis have **no published port on purpose**: on a public-IP machine,
publishing 5432 would put the database on the internet. They are reachable only from
inside the Compose network.

### How the frontend is served

The frontend is **built to static files and served by the same Express process** as the
API — there is no separate frontend container and no second port.

Why (this is the decision, not an accident):

1. `VITE_API_BASE_URL` is baked into the bundle **at build time**. A separately served
   frontend would have to know the server's final public IP *before* it was built, and
   would be wrong the moment the IP changed.
2. With the bundle served from the same origin, the base URL is **empty**, so every
   `fetch` and — importantly — every **Socket.io** connection is relative to the page's
   own origin. The live round timer, the live ranking and the big screen then work on
   any IP with **no configuration at all**.
3. One origin means the browser needs no CORS for its own page, and the security group
   needs **one** rule instead of two.
4. Zero new dependency: `express.static` is built into Express (code-standards.md,
   "prefer built-in or existing solutions").

The mechanism lives in `backend/src/static-frontend.ts` and is switched on by the
`FRONTEND_DIST` environment variable. **In development that variable is unset**, so
`createApp()` never mounts it and the Vite dev server serves the frontend exactly as
before — no existing route changes behaviour.

---

## 1. First-time setup on a fresh ECS instance

### 1.1 Connect to the server

```bash
ssh root@<YOUR_PUBLIC_IP>
```

Opens a shell on the server. Everything below runs **there**, not on your laptop.

### 1.2 Update the system

```bash
apt-get update && apt-get upgrade -y
```

Refreshes the package list and installs the current security updates. Takes a couple of
minutes; a reboot is only needed if the kernel was updated (the output says so).

### 1.3 Install Docker

Use Docker's own repository, not Ubuntu's — the Ubuntu package is often a release or two
behind, and the Compose plugin ships with Docker's.

```bash
apt-get install -y ca-certificates curl
```

Installs the two tools needed to add a package repository over HTTPS.

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
```

Downloads Docker's signing key and stores it, so `apt` can verify the packages really
come from Docker.

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
> /etc/apt/sources.list.d/docker.list
apt-get update
```

Adds the Docker repository to `apt` and refreshes the package list.

```bash
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Installs Docker Engine, Buildx and the Compose plugin (this is what makes
`docker compose` — with a space — work).

```bash
systemctl enable --now docker
```

Makes Docker start on boot and starts it now. Without `--now`, the containers would not
come back after a server restart.

```bash
docker compose version
```

Sanity check: prints something like `Docker Compose version v2.x`. If it says "command
not found", the plugin did not install — re-run the `apt-get install` line above.

### 1.4 Get the code onto the server

> **Manual prerequisite, not automated here.** Cloning a private repository needs either
> a **public repo** or an **SSH deploy key** created and installed by the project owner.
> Credentials are deliberately not set up by any script in this project. Do this once,
> by hand, before the clone.

```bash
cd /opt
git clone <REPO_URL> sudoku-arena
cd sudoku-arena
```

Puts the code in `/opt/sudoku-arena`. Any folder works; `/opt` is the conventional place
for software you installed yourself, and it survives upgrades.

```bash
git checkout louise
```

Switches to the branch the build is on. Skip if you deploy from the default branch.

### 1.5 Create the environment file

```bash
cp .env.production.example .env
nano .env
```

Copies the template to the real `.env` (which is git-ignored and never committed) and
opens it in an editor. `Ctrl+O` saves, `Ctrl+X` exits.

**Three values must change before the first start** — they are marked `CHANGE_ME` in the
template:

1. **`POSTGRES_PASSWORD`** — a real random password. Generate one:
   ```bash
   openssl rand -base64 24
   ```
2. **`DATABASE_URL`** — must contain the **same** password, between the two colons:
   `postgresql://sudoku:<THE_SAME_PASSWORD>@postgres:5432/sudoku?schema=public`.
   A mismatch here is the classic "migrations run but the server cannot connect" failure.
3. **`FRONTEND_ORIGIN`** — `http://<YOUR_PUBLIC_IP>`, the server's real address. Plain
   `http://`, no trailing slash, no port if you keep 80. This one is not cosmetic: it is
   what the **Socket.io handshake** checks, so a wrong value leaves the pages loading but
   the live timer and the live ranking dead.

Everything else in the template is already correct for this deployment. Leave
**`VITE_API_BASE_URL` empty** — see "How the frontend is served" above.

`docker-compose.prod.yml` **refuses to start** while `POSTGRES_PASSWORD` is still the
template placeholder, so forgetting #1 fails loudly instead of deploying a guessable
secret.

### 1.6 Open the port in the Alibaba Cloud security group

This is done in the **Alibaba Cloud console**, not on the server — the security group is
a firewall in front of the instance, and `ufw` inside the machine cannot substitute for
it.

Console → ECS → Instances → your instance → *Security Groups* → *Configure Rules* →
*Inbound* → add a rule:

| Field            | Value          |
| ---------------- | -------------- |
| Action           | Allow          |
| Protocol         | Custom TCP     |
| Port range       | `80/80`        |
| Source           | `0.0.0.0/0`    |
| Description      | `sudoku-http`  |

**That is the only rule this application needs.** Do **not** open 5432 (Postgres), 6379
(Redis), 3000 (the internal Node port) or 22 to `0.0.0.0/0` — restrict 22 to your own IP
if the console lets you.

If the instance also runs `ufw`:

```bash
ufw allow 80/tcp && ufw allow OpenSSH && ufw --force enable
```

Allows HTTP and SSH, then turns the local firewall on. The SSH rule comes first so you
cannot lock yourself out.

### 1.7 Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Builds the image (frontend bundle first, then the backend), creates the three containers,
runs the Prisma migrations, and starts everything in the background. **The first build
takes several minutes** — it installs two sets of npm dependencies and compiles both
TypeScript projects. Later builds are much faster because the dependency layers are
cached.

```bash
docker compose -f docker-compose.prod.yml ps
```

Should show three containers, `postgres` and `redis` marked `healthy`, `backend` marked
`Up`. If `backend` is restarting in a loop, read its logs:

```bash
docker compose -f docker-compose.prod.yml logs backend
```

The most common causes, in order: the `.env` is missing or `DATABASE_URL` does not match
`POSTGRES_PASSWORD`; the port is already taken by something else; the build failed (look
for the error higher up in the output of `up`).

### 1.8 Verify

```bash
curl -i http://localhost/api/health
```

Prints the health endpoint's response. `HTTP/1.1 200` means Postgres and Redis are both
reachable; `503` means the server is up but a dependency is not (the JSON body says
which).

From **your own computer**, not the server:

```
http://<YOUR_PUBLIC_IP>/api/health
```

If this fails while `curl` on the server succeeded, the security group is the problem —
go back to step 1.6.

Then open `http://<YOUR_PUBLIC_IP>/` in a browser: the login page should appear.

### 1.9 Create the first controller account

There is no self-service signup for controllers (ROL-011) — the first account is created
by a one-time bootstrap command, which is idempotent (re-running it changes nothing once
an account exists).

Pick the password yourself so you know it:

```bash
docker exec -e CONTROLLER_USERNAME=controller -e CONTROLLER_PASSWORD='<A_STRONG_PASSWORD>' \
  sudoku-prod-backend npx tsx prisma/seed.ts
```

Creates the controller account inside the container and prints the credentials once.
**Write the password down now** — it is stored only as a hash. Omitting
`CONTROLLER_PASSWORD` makes the script generate one and print it; that works too, but
then you must copy it out of the terminal immediately.

> The other accounts (judges, players, schools) are created through the application
> itself by the controller, or imported — that is normal product behaviour, not a
> deployment step.
>
> `backend/prisma/seed-test-accounts.ts` and `seed-test-competition.ts` exist and can be
> run the same way to put test logins on the server **for a rehearsal**. They create
> accounts with a known weak password. **Do not leave them in place for the real event**
> — delete those accounts afterwards, from the controller screens.

---

## 2. Redeploying after a change

There is no automation; this is the whole procedure.

```bash
cd /opt/sudoku-arena
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

`git pull` fetches the new code; the second command rebuilds only what changed and
recreates only the containers whose image or configuration changed. **Data is not
touched**: Postgres, Redis and the uploaded files live in named volumes, which survive
rebuilds and restarts.

Migrations are applied automatically on start (`prisma migrate deploy` is the container's
command), so a schema change needs no extra step. It is a one-way, forward-only command —
it never drops or reverts anything.

```bash
docker compose -f docker-compose.prod.yml ps
curl -i http://localhost/api/health
```

The same two checks as a first deploy. Take a backup (section 4) **before** a redeploy
that includes a migration.

### Rolling back

There is no built-in rollback. The honest procedure is: `git checkout <the last known
good commit>`, rebuild, and restore the database from the backup if the rolled-back code
had already run a migration. This is a real limitation of a manual deployment and is
flagged as such — a migration that has run cannot be un-run by `migrate deploy`.

---

## 3. Day-to-day operations

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

Follows the backend's logs live (`Ctrl+C` stops following, not the server).

```bash
docker compose -f docker-compose.prod.yml restart backend
```

Restarts just the backend — the databases keep running, and no data is lost.

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

Stops everything, then starts it again. **`down` does not delete the volumes**, so the
data survives.

```bash
docker compose -f docker-compose.prod.yml down -v
```

**Destroys the database.** `-v` deletes the named volumes. Only ever run this when you
genuinely want a blank system.

Containers restart automatically after a crash or a server reboot (`restart:
unless-stopped` + `systemctl enable docker`). `docker ps` shows the current state and
`uptime` shows how long the machine has been up.

### Disk space

```bash
docker system df
docker image prune -f
```

The first prints how much space images, containers and volumes take; the second deletes
dangling images left behind by rebuilds. **Do not** run `docker system prune -a` on the
server without reading its warning — it removes every image not currently in use.

---

## 4. Backing up the database

This is a documented example, not a backup system. There is no restore automation, no
off-site copy and no retention policy — all of that is still open and flagged as such.

### 4.1 One backup, by hand

```bash
mkdir -p /opt/backups
docker exec sudoku-prod-postgres pg_dump -U sudoku -d sudoku \
  > /opt/backups/sudoku-$(date +%F-%H%M).sql
```

Creates the backup folder, then dumps the whole database to a dated SQL file **on the
server's own disk**. `-U sudoku -d sudoku` are the user and database from `.env`. The
filename looks like `sudoku-2026-10-11-930.sql`.

Check it is not empty before trusting it:

```bash
ls -lh /opt/backups
```

A few hundred kilobytes is plausible for this database; **0 bytes means the dump failed**
(and the error went to the terminal, not the file).

### 4.2 Restoring from a backup

```bash
docker compose -f docker-compose.prod.yml stop backend
cat /opt/backups/sudoku-2026-10-11-0930.sql | docker exec -i sudoku-prod-postgres psql -U sudoku -d sudoku
docker compose -f docker-compose.prod.yml start backend
```

Stops the app so nothing writes during the restore, pipes the file into `psql`, then
starts the app again. **This overwrites the current data** — take a fresh backup first if
there is any chance you want to keep what is there now.

### 4.3 Nightly, automatically

A one-line `crontab` entry using the same command. `crontab -e` opens the editor:

```cron
15 3 * * * docker exec sudoku-prod-postgres pg_dump -U sudoku -d sudoku > /opt/backups/sudoku-$(date +\%F).sql 2>> /opt/backups/pg_dump.log
```

Runs at **03:15 every night**, writes `sudoku-<date>.sql`, and appends any error to
`/opt/backups/pg_dump.log`. The `\%` is required inside crontab — an unescaped `%` would
truncate the command.

Two things to know about this line:

- It **overwrites the same day's file** if it runs twice in a day, and it **never deletes
  old ones** — the folder grows. Prune it by hand now and then.
- The backup stays **on the same machine**. If the ECS instance is lost, the backups are
  lost with it. Copying them elsewhere (`scp` to another host, or an OSS bucket) is a
  manual step and should be set up before the real event.

Check the log after the first night:

```bash
cat /opt/backups/pg_dump.log
```

Empty means no errors.

---

## 5. Testing the production stack on your own machine

Worth doing before touching the real server. The prod file sets `name: sudoku-prod` at
its top, which makes it a **separate Compose project** from the dev file — separate
containers, separate volume prefix, separate network. That line is load-bearing: Compose
otherwise derives the project name from the *directory*, both files live in the same
directory and both define services called `postgres`/`redis`/`backend`, so bringing the
prod stack up would treat the running dev containers as orphans and **remove them**.

The two stacks do still want the same **host ports**, so:

1. **Stop the dev stack** if it is running:
   ```bash
   docker compose down
   ```
   It publishes 3000/5432/6379/5173 by default; the prod stack wants 80 and its own
   private Postgres. On a machine where 3000 and 5432 are already taken by unrelated
   containers (as this project's dev machine is), the dev `.env` already moves them to
   3001/5433 — `docker-compose.prod.yml` reads `BACKEND_PORT` from that same `.env`, so
   the container side follows automatically.
2. **Make a local `.env` for the test.** The real one must have `POSTGRES_PASSWORD` set,
   or Compose refuses to start. For a throwaway local test, the dev `.env` is fine as-is
   except that `FRONTEND_ORIGIN` should point at the port you are testing:
   ```bash
   # only for a local test — never on the server
   echo "HTTP_PORT=8080" >> .env
   ```
   Then browse to `http://localhost:8080/` instead of `http://<IP>/`.
3. **Build and start:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
4. **Check it:**
   ```bash
   curl -i http://localhost:8080/api/health
   ```
   and open `http://localhost:8080/` in a browser — log in, open a competition screen,
   confirm the live elements connect.
5. **Put the dev stack back:**
   ```bash
   docker compose -f docker-compose.prod.yml down
   docker compose up -d
   ```

---

## 6. Known limitations of this deployment

Recorded here so nobody mistakes them for oversights:

- **No HTTPS.** Plain HTTP on a bare IP: passwords and session tokens cross the network
  in clear text. Deliberate for now (no domain → no certificate → no ICP备案), tracked as
  **I-40**, to be revisited before the real event.
- **No domain, no ICP备案.** Whether Alibaba Cloud permits plain HTTP on a bare IP
  without备案 is **I-39** and is unverified — it must be checked against the provider
  when the real instance is created.
- **Manual deploys, no rollback safety net.** See section 2.
- **Backups are single-machine and hand-pruned.** See section 4.
- **No CI automated review step** is in place (`context/FILL-BEFORE-CODING.md`, row C2).
- **`devDependencies` are present in the production image.** They are not dead weight:
  the `prisma` CLI is needed by `prisma migrate deploy` (the container's start command)
  and `tsx` by the seed scripts in section 1.9. `npm ci --omit=dev` would break both.
  Trimming them with a proper multi-stage runtime image is a worthwhile **later**
  optimization — smaller image, faster pull, smaller attack surface — and is explicitly
  **not** a blocker for this deployment.
- **One instance, no redundancy.** If the ECS instance dies during the event, the event
  stops. That is a scale/sizing decision (BLD-048 chose a single host), not a bug.
- **The production bundle must be built through `backend/Dockerfile.prod`.** It is what
  sets the `VITE_API_BASE_URL=""` build ARG. `frontend/src/config/env.ts` falls back to
  `http://localhost:3000` when that variable is *entirely absent*, so a hand-run
  `npm run build` in `frontend/` with no `.env` would produce a bundle that silently
  points at localhost instead of failing. Building inside the image cannot hit that path.
  Changing the fallback to `""` would fix the wart but would also change what a developer
  gets when running the Vite dev server *outside* Docker with no `.env` (their API calls
  would go to 5173 and 404), so with two days to the event and a second contributor
  working in the same tree, the fallback is **left as it is and flagged** rather than
  changed unilaterally.

---

## Files that belong to this track

| File                        | Role                                                                     |
| --------------------------- | ------------------------------------------------------------------------ |
| `docker-compose.prod.yml`   | The production stack: Postgres + Redis + one backend serving everything.   |
| `backend/Dockerfile.prod`   | Builds the frontend bundle, then the backend, into one image.              |
| `.dockerignore`             | Keeps secrets, `.git`, `node_modules` and `dist` out of that build context. |
| `.env.production.example`   | The template you copy to `.env` on the server.                             |
| `backend/src/static-frontend.ts` | Serves the built SPA from Express (inert unless `FRONTEND_DIST` is set). |
| `DEPLOY.md`                 | This file.                                                                 |

`backend/src/app.ts` gained a three-line gated block that mounts the static server, and
`backend/src/config/env.ts` gained the `FRONTEND_DIST` variable. Nothing else in the
application changed.
