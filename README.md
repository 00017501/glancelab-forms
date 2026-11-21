# GlanceLab

A small web app for running ad-variant studies. You build a study in a Google-Forms-like editor, each participant sees one version of your ad for a fixed time, and you download an anonymous CSV of what they noticed, remembered, and how fast they found the price.

- **Admin panel** at `/admin`: one admin, set in `.env`.
- **Participants** open a public link (`/s/…`) on a phone or laptop. No login.

## What it does

| Step type | What the participant does | What is recorded |
|---|---|---|
| Consent | Reads the study information, ticks "I am 18 or older and I agree" | Consent time and text version |
| Text screen | Reads, presses a button | Nothing |
| Ad exposure | Sees their assigned ad version for N seconds; no pause, no going back | Actual time on screen (ms) |
| Distractor | Does simple sums for N seconds | Sums attempted and correct |
| Question | Multiple choice, dropdown, short answer, paragraph or 1–7 style scale | The answer |
| Click on image | Clicks a spot on a picture | Click position (0–1), mouse or touch |
| Timed search | Finds something ("Click the price as fast as you can") | Reaction time (ms), click position, hit or miss |

Participants are assigned to ad versions at random and the versions are kept even. Refreshing the page never shows the ad a second time; that response is marked `interrupted`.

## Privacy

These are built in:

- No IP address is stored or logged, by the app, uvicorn or Caddy.
- Participant pages load nothing from other websites.
- Nothing is saved before consent. "Leave study" deletes that person's data immediately.
- Responses carry only a random ID. The CSV contains nothing identifying.
- The admin can delete one response, all responses of a study, or everything.

To check the first promise on your own server at any time:

```bash
docker compose logs | grep -E '([0-9]{1,3}\.){3}[0-9]{1,3}' | grep -v -e '0.0.0.0' -e '127.0.0.1' -e ' 172\.' -e ' 10\.'
```

It should print nothing that looks like a visitor's address.

## Deploy on one AWS EC2 instance

You need: an AWS account and a domain (or subdomain) whose DNS you can edit.

### 1. Create the server

1. Launch an EC2 instance: **Ubuntu 24.04**, `t3.small` or larger, 20 GB disk.
2. Security group: allow inbound **22** (SSH, your IP only), **80** and **443** (anywhere). Nothing else.
3. Allocate an **Elastic IP** and attach it to the instance, so the address survives restarts.

### 2. Point your domain at it

Create a DNS **A record** for your domain (for example `study.example.com`) with the Elastic IP as its value. Wait until `ping study.example.com` shows that IP.

### 3. Install Docker

SSH in, then:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit
```

SSH in again so the group change applies.

### 4. Get the code and configure it

```bash
git clone <your repository URL> glancelab
cd glancelab
cp .env.example .env
nano .env
```

Fill in `.env`:

| Variable | Value |
|---|---|
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | The admin login. Use a long password. |
| `SECRET_KEY` | Output of `openssl rand -hex 32` |
| `DOMAIN` | Your domain, without `https://` |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Output of `openssl rand -hex 16`, one each |

### 5. Start it

```bash
docker compose up -d --build
```

The first start takes a few minutes. Then open `https://your-domain/admin` and log in. Caddy gets the HTTPS certificate by itself; the first page load can take up to a minute while it does.

### Day-to-day

```bash
docker compose ps                 # is everything running?
docker compose logs -f app        # application log (contains no IP addresses)
git pull && docker compose up -d --build   # update to a new version
docker compose down               # stop (data is kept)
```

### Back up the data

The database and images live in Docker volumes. To copy the database out:

```bash
docker compose cp app:/data/glancelab.db ./glancelab-backup.db
```

Downloading the CSV from the admin panel is the simplest backup of responses.

### When the coursework is graded

In the admin panel: **Settings → Delete all data**. To remove everything from the server as well:

```bash
docker compose down --volumes
```

## Using AWS S3 for images

By default images are stored by the SeaweedFS container, on the EC2 disk. Images are resized on upload, so a study with a few dozen ads uses a few tens of megabytes, and the Images page shows the total.

To keep images off the instance entirely:

1. Create a private S3 bucket.
2. Create an IAM user allowed `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` and `s3:ListBucket` on that bucket.
3. In `.env`: put the bucket name in `S3_BUCKET`, the user's keys in `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`, and uncomment `S3_ENDPOINT_URL=` (left empty) and `S3_REGION=…`.
4. `docker compose up -d`. The SeaweedFS container still starts but is no longer used.

Existing images are not moved; switch before uploading, or re-upload.

## Local development

Requirements: Docker, [uv](https://docs.astral.sh/uv/), Node 22 or newer.

```bash
# 1. Image store
docker compose -f docker-compose.dev.yml up -d

# 2. Backend (in backend/)
export ADMIN_USERNAME=researcher ADMIN_PASSWORD=local-dev-password
export SECRET_KEY=$(openssl rand -hex 32) COOKIE_SECURE=false
export S3_ENDPOINT_URL=http://127.0.0.1:8333 S3_ACCESS_KEY_ID=dev-access-key S3_SECRET_ACCESS_KEY=dev-secret-key
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --no-access-log

# 3. Admin (in frontend/admin/) on http://localhost:5173/admin/
npm install && npm run dev

# 4. Participant app (in frontend/participant/)
npm install && npm run build      # then open study links through the backend, http://localhost:8000/s/…
```

To have the backend serve both built frontends, as in production, build them and set `STATIC_DIR` to a folder containing `admin/` and `participant/` (the two `dist` folders).

### Checks

```bash
# backend/
uv run pytest && uv run ruff check . && uv run ruff format --check . && uv run pyright

# frontend/admin and frontend/participant
npm run typecheck && npm run lint && npm run build
npm test            # participant only
```

## The CSV

One row per participant. Fixed columns come first (`participant_id`, `variant`, `status`, `interrupted`, device and timing columns), then columns per step named by position: `s03_stimulus_shown_ms`, `s05_answer`, `s09_search_rt_ms`, and so on. The numbers match the step numbers in the editor. **Column guide** on the Responses tab downloads a second CSV that explains every column and lists each question's wording.

Rows with `interrupted = 1` reloaded the page during a timed step; consider leaving them out. Rows with `status = partial` did not reach the end.

## Project layout

See [AGENTS.md](AGENTS.md).
