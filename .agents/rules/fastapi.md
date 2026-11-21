---
paths:
  - "backend/app/routers/**"
  - "backend/app/schemas/**"
  - "backend/app/main.py"
  - "backend/app/db.py"
  - "backend/app/security.py"
---

# FastAPI Conventions

Examples: [fastapi examples](../references/fastapi-examples.md).

General Python rules: [`python.md`](python.md). Layering: [`architecture.md`](architecture.md).

There are two API surfaces and they must stay separate:

| Prefix | Who | Guard |
|---|---|---|
| `/api/admin/*` | The one admin | Session-cookie dependency on the router |
| `/api/p/*` | Anonymous participants | The session token issued at consent, where a session exists |

---

## Routes

[Example](../references/fastapi-examples.md#thin-route).

Routes are thin: validate input through Pydantic, call one service function, return. Three to ten lines.

- One router per area (`forms`, `images`, `responses`, `participant`). Mounted in `main.py`.
- Handlers are `def`, not `async def` (see [`architecture.md`](architecture.md#sync-not-async)).
- The return type annotation is the response model. Omit `response_model` unless overriding (`response_model=None` for file and streaming responses).
- Explicit `status_code` on writes: 201 for creation, 204 for empty.
- `tags` per router.
- No business logic in handlers.
- Handler parameters use `Annotated` aliases (`session: DbSession`), never `= Depends(f)` defaults.

---

## Pydantic Schemas

[Example](../references/fastapi-examples.md#schemas).

- Separate `Create`, `Update`, `Response`.
- No `dict[str, Any]` in request or response bodies. Step configs and step results are discriminated unions.
- A participant-facing response never includes another variant's images, target boxes, or which variants exist.

---

## Dependencies

[Example](../references/fastapi-examples.md#dependencies).

- `DbSession` yields a session, commits on clean exit, rolls back on exception.
- `require_admin` is attached once, on the admin `APIRouter`, never per handler and never as an inline check.
- Storage client and settings come through dependencies so tests can override them. Clear overrides after each test; see [the fixture](../references/fastapi-examples.md#override-fixture).

---

## Admin session

- Username and password are compared in constant time against settings.
- The cookie is signed, `Secure`, `HttpOnly`, `SameSite=Strict`, with an expiry.
- Login is rate limited. The counter lives in memory only: it is never written to the database or a log.
- State-changing admin routes accept JSON or multipart only, so a cross-site form post cannot reach them.

---

## Exception Handling

[Example](../references/fastapi-examples.md#errors).

- Services raise exceptions from `app/errors.py`. Each carries a short `code` and an HTTP status.
- One handler in `main.py` renders every error as `{"code": ..., "message": ...}`.
- Handlers do not raise `HTTPException` and do not catch domain exceptions inline.
- Never put user-supplied data in an error message.

---

## Middleware and logging

- No access log. Uvicorn runs with `--no-access-log`.
- Nothing reads `request.client`, `X-Forwarded-For` or `Forwarded` except the in-memory login limiter.
- No middleware that records requests.

---

## Background work

There is none. Image processing happens inside the upload request. If something long-running is ever needed, record an ADR first.

---

## Common Anti-Patterns

|Smell|Fix|
|---|---|
|Business logic in a handler|Move it to a service|
|Service raises `HTTPException`|Raise a domain exception|
|Service commits the session|Drop it; the dependency owns the commit|
|Admin check written inside a handler|`require_admin` on the router|
|One model for input and output|Split into `Create` / `Update` / `Response`|
|`async def` handler calling the database or boto3|Make it `def`|
|Participant response that includes all variants|Return only the assigned variant's data|
