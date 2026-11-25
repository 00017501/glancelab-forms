# Deployment

GlanceLab runs on one small server with Docker Compose: Caddy for HTTPS, the app, and SeaweedFS for images. This page walks through an AWS EC2 instance; any Linux server with Docker works the same way from step 3.

- [Deploy on one EC2 instance](#deploy-on-one-ec2-instance)
- [Configuration](#configuration)
- [Day to day](#day-to-day)
- [Backups](#backups)
- [Using AWS S3 for images](#using-aws-s3-for-images)
- [Taking it down](#taking-it-down)

## Deploy on one EC2 instance

You need an AWS account and a domain (or subdomain) whose DNS you can edit.

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

Fill in the required values from the [configuration table](#configuration).

### 5. Start it

```bash
docker compose up -d --build
```

The first start takes a few minutes. Then open `https://your-domain/admin` and log in. Caddy gets the HTTPS certificate by itself; the first page load can take up to a minute while it does.

## Configuration

Everything is set in `.env`. [`.env.example`](../.env.example) documents each value.

### Required

| Variable | Value |
|---|---|
| `ADMIN_USERNAME` | The admin login name |
| `ADMIN_PASSWORD` | At least 8 characters. Use a long, unique password |
| `SECRET_KEY` | Signs the login cookie. Output of `openssl rand -hex 32` |
| `DOMAIN` | Your domain, without `https://` |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Output of `openssl rand -hex 16`, one each. With the bundled SeaweedFS they only protect the internal storage service |

### Optional

| Variable | Default | Meaning |
|---|---|---|
| `S3_BUCKET` | `glancelab` | Bucket name |
| `S3_ENDPOINT_URL` | the bundled SeaweedFS | Set to empty to use AWS S3 |
| `S3_REGION` | `us-east-1` | AWS region of the bucket |
| `MAX_UPLOAD_MB` | `15` | Largest image upload |
| `IMAGE_MAX_EDGE_PX` | `2400` | Images are resized so the longest edge is at most this |
| `ACTIVE_SESSION_MINUTES` | `30` | How long an unfinished session counts toward version balance |
| `ADMIN_SESSION_HOURS` | `12` | How long a login lasts |

## Day to day

```bash
docker compose ps                          # is everything running?
docker compose logs -f app                 # application log (contains no IP addresses)
git pull && docker compose up -d --build   # update to a new version
docker compose down                        # stop (data is kept)
```

Database migrations run by themselves each time the app container starts.

## Backups

The database and images live in Docker volumes. To copy the database out:

```bash
docker compose cp app:/data/glancelab.db ./glancelab-backup.db
```

Downloading the CSV from the admin panel is the simplest backup of responses.

## Using AWS S3 for images

By default images are stored by the SeaweedFS container, on the server's disk. Images are resized on upload, so a study with a few dozen ads uses a few tens of megabytes, and the Images page shows the total.

To keep images off the instance entirely:

1. Create a private S3 bucket.
2. Create an IAM user allowed `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` and `s3:ListBucket` on that bucket.
3. In `.env`: put the bucket name in `S3_BUCKET`, the user's keys in `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`, and uncomment `S3_ENDPOINT_URL=` (left empty) and `S3_REGION=…`.
4. `docker compose up -d`. The SeaweedFS container still starts but is no longer used.

Existing images are not moved; switch before uploading, or re-upload.

## Taking it down

When the study is over, download the CSV, then in the admin panel: **Settings → Delete all data**.

To remove everything from the server as well:

```bash
docker compose down --volumes
```

This deletes the database, the images and the HTTPS certificate. It cannot be undone.
