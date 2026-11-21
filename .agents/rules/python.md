---
paths:
  - "**/*.py"
---

# Python Conventions

[Examples](../references/python-examples.md).

Python 3.12. Ruff and Pyright must pass.

---

## Naming

|Element|Convention|
|---|---|
|Variables, functions|`snake_case`|
|Classes, Pydantic models|`PascalCase`|
|Constants|`SCREAMING_SNAKE_CASE`|
|Private|Leading underscore|
|Booleans|`is_`, `has_`, `should_` prefix|
|Test files|`test_*.py`|
|Test functions|`test_` + scenario|

### Rules

- Describe purpose, not type. `forms = ...` not `form_list = ...`.
- Spell names out. Allowed abbreviations: `id`, `db`, `url`, `api`, `config`, `ctx`, `msg`, `req`/`res`, `err`, `rt` (reaction time).
- Functions: action + subject (`assign_variant`, `export_responses`). Not `handle`, `do`, `process`.
- Collections are plural. Avoid `data`, `info`, `result`, `item`, `obj` as names.

---

## Type Hints

[Example](../references/python-examples.md#type-hints).

Mandatory on all function signatures (params + return).

- Modern syntax: `list[X]`, `dict[K, V]`, `X | None`. Never `Optional`, `List`, `Dict`, `Union`.
- `Any` only at a genuinely dynamic edge, with a comment.
- Type aliases use `type FormId = int`.

---

## Pydantic

Pydantic v2. Anything crossing a layer boundary is a typed model, never a raw dict.

- v2 API only: `model_config = ConfigDict(...)`, `@field_validator`, `.model_dump()`, `.model_validate()`.
- `Field(...)` for constraints (`min_length`, `max_length`, `ge`, `le`).
- Separate `Create` / `Update` / `Response` models. Never one model for input and output.
- Validators check shape only. Business rules belong in a service.
- Fixed value sets are `StrEnum`, never raw strings.
- `SecretStr` for credentials in settings.

---

## Functions and modules

[Example](../references/python-examples.md#guard-clauses).

- Function length target ≤30 lines, hard limit 50.
- Parameter count target ≤3, hard limit 5. Past 5, fold into a model or dataclass.
- Guard clauses over nesting.
- Module hard limit 250 lines. Split by moving functions to a sibling module.

---

## Error Handling

- Never bare `except` or `except Exception` without re-raise. Catch specific exceptions.
- Preserve the chain: `raise ... from err`.
- Never silently swallow. If you catch without re-raising, log with context.
- Raise the exceptions in `app/errors.py`, not generic `ValueError` / `RuntimeError`.

|Situation|Strategy|
|---|---|
|Invalid input|Pydantic validation (422)|
|Rule violation in a service|Raise a domain exception; the central handler translates|
|Storage unavailable|Raise; the handler returns 503|
|Unexpected error|Propagate to the central handler|

---

## Logging

[Example](../references/python-examples.md#logging).

Standard-library `logging`. The message is an event name; context goes in `extra=`.

- Event name as the message (`"form_published"`), not a sentence. No f-string messages.
- No `print()`.
- **Never log an IP address, a user agent, an answer, a click position or a request body.** Log IDs, counts, durations and sizes. See [`privacy.md`](privacy.md).
- Never log credentials or the session cookie.
- Log at boundaries (publish, export, deletion, storage errors), not inside loops.

---

## Comments & Documentation

**Be brief; prose ages.**

- Explain why, not what.
- A one-line docstring is the default. Add up to two more lines only when the signature cannot carry the meaning (a unit, a constraint, a non-obvious raise).
- [Docstring sections](../references/python-examples.md#docstring-sections): add `Args:` / `Returns:` only for information the signature does not show.
- Inline comment blocks: four lines maximum.
- A function body longer than about 8 lines is split into [paragraphs](../references/python-examples.md#paragraphs) with single blank lines: guard or load, work, write, return.
- TODOs carry an issue reference: `# TODO(#12): ...`. No `FIXME`, `XXX`, `HACK`.
- Say what the code does and why. Never where it came from, what it used to be, or which other project it resembles.

---

## Imports

Order (Ruff enforces): stdlib → third-party → local.

- Explicit imports. Never `import *`.
- Check `app/utils.py` before writing a helper.

---

## Configuration & Secrets

- All config through the `BaseSettings` class in `app/settings.py`. No `os.environ[...]` elsewhere.
- Validated at startup: a missing required value fails immediately.
- No hardcoded URLs, timeouts, limits or ports. They belong in settings.
- `.env` is gitignored. Every variable is documented in `.env.example`.
