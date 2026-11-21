"""Admin login: credential check, signed session cookie, and an in-memory login limiter."""

import secrets
import threading
import time
from collections import deque
from typing import Annotated

from fastapi import Cookie, Depends
from itsdangerous import BadSignature, TimestampSigner

from app.errors import InvalidCredentialsError, NotAuthenticatedError, TooManyAttemptsError
from app.settings import Settings, get_settings

COOKIE_NAME = "glancelab_admin"
# Signed into the cookie; the signature and timestamp carry the trust, not this value.
COOKIE_PAYLOAD = "admin"

AppSettings = Annotated[Settings, Depends(get_settings)]


def make_signer(settings: Settings) -> TimestampSigner:
    """Return the signer for the admin cookie."""
    return TimestampSigner(settings.secret_key.get_secret_value(), salt="admin-session")


def issue_cookie_value(settings: Settings) -> str:
    """Return a freshly signed cookie value."""
    return make_signer(settings).sign(COOKIE_PAYLOAD).decode()


def credentials_match(settings: Settings, username: str, password: str) -> bool:
    """Compare both values in constant time, always checking both."""
    name_ok = secrets.compare_digest(username.encode(), settings.admin_username.encode())
    password_ok = secrets.compare_digest(password.encode(), settings.admin_password.get_secret_value().encode())
    return name_ok and password_ok


class LoginLimiter:
    """Counts failed logins per client in process memory only. Nothing here is stored or logged."""

    def __init__(self) -> None:
        self._failures: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def check(self, client: str, limit: int, window_seconds: int) -> None:
        """Raise when this client has failed too often inside the window."""
        cutoff = time.monotonic() - window_seconds
        with self._lock:
            attempts = self._failures.get(client)
            if attempts is None:
                return
            while attempts and attempts[0] < cutoff:
                attempts.popleft()
            if not attempts:
                del self._failures[client]
            elif len(attempts) >= limit:
                raise TooManyAttemptsError

    def record_failure(self, client: str) -> None:
        """Remember one failed attempt."""
        with self._lock:
            self._failures.setdefault(client, deque()).append(time.monotonic())

    def reset(self, client: str) -> None:
        """Forget a client after a successful login."""
        with self._lock:
            self._failures.pop(client, None)


login_limiter = LoginLimiter()


def log_in(settings: Settings, client: str, username: str, password: str) -> str:
    """Check credentials under the rate limit and return the cookie value to set."""
    login_limiter.check(client, settings.login_max_failures, settings.login_window_seconds)
    if not credentials_match(settings, username, password):
        login_limiter.record_failure(client)
        raise InvalidCredentialsError
    login_limiter.reset(client)
    return issue_cookie_value(settings)


def require_admin(settings: AppSettings, glancelab_admin: Annotated[str | None, Cookie()] = None) -> None:
    """Dependency for every admin route: a valid, unexpired signed cookie."""
    if glancelab_admin is None:
        raise NotAuthenticatedError
    try:
        make_signer(settings).unsign(glancelab_admin, max_age=settings.admin_session_hours * 3600)
    except BadSignature as error:
        raise NotAuthenticatedError from error
