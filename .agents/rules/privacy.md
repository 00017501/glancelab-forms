---
paths:
  - "backend/**"
  - "frontend/participant/**"
  - "Caddyfile"
  - "docker-compose.yml"
---

# Privacy Rules

The consent text tells participants exactly what is and is not collected. The code must make those statements true. Each rule below is a promise made in that text.

---

## What may be stored about a participant

Only this, and only after consent:

- a random anonymous ID
- the assigned variant
- answers, reaction times, click positions
- device type, viewport size, user agent, pointer type
- timestamps, the consent time and the consent text version

Adding anything to this list is a change to the consent text and needs the user's approval first.

## What is never stored or logged

- IP addresses, in any form, including hashed or truncated
- names, emails, location
- cookies or identifiers that outlive the study flag in `localStorage`

---

## Rules

### 1. No IP addresses

- No model, log line, error report or export contains an IP address.
- Uvicorn runs without an access log. Caddy's access log is off.
- Caddy's error loggers (`http.log.error`, `http.stdlib`) are excluded in the `Caddyfile`. Without that, a failed request is logged with the visitor's address and the URL, which contains the session token. Never remove the exclusion.
- The only code that may read the client address is the admin login rate limiter, which keeps it in process memory and never writes it anywhere.

### 2. No third parties on participant pages

- Every script, style, font and image is served from this origin.
- Images are streamed through the backend, so a browser never contacts the object store.
- No analytics, error-reporting SDK or embedded content.

### 3. Consent gates everything

- No session row is created before the participant agrees.
- "I don't agree" writes nothing at all.
- Every session stores the consent timestamp and the version of the text that was shown.
- The consent step cannot be deleted or moved from first position. Changing its wording creates a new stored version; old versions are kept so past responses still point at the text those people saw.

### 4. Withdrawal deletes

- "Leave study" deletes the session and its results immediately. It is a hard delete, not a flag.
- Admin deletion (one response, all responses of a form, full wipe) is also a hard delete.

### 5. Anonymous exports

- The CSV contains the anonymous ID and study data only.
- Admin-facing tables show the same fields as the CSV, nothing more.

### 6. A stimulus is shown once

- The server records that a timed step started before the client renders it.
- On reload, a started but unfinished timed step is marked interrupted and skipped. The session is flagged so it can be excluded from analysis.
- This is a study-validity rule as much as a privacy one: a second look at the ad invalidates the memory measures.

### 7. Admin access

- HTTPS only. The admin cookie is `Secure`, `HttpOnly`, `SameSite=Strict`.
- Credentials come from the environment and are never logged or returned.
