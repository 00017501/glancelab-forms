---
name: git-commit-message
description: Generate a Conventional Commits-style commit message based on the current git working tree changes, without ever creating an actual commit. Use this skill whenever the user asks to "write a commit message", "generate a commit message", "suggest a commit message", "what should I commit this as", or any similar phrasing referring to drafting commit text for changes they've made. Also use it when the user references staged or unstaged changes and wants help describing them. The skill only produces text in the chat - it never runs `git commit`, `git add`, `git push`, or any other state-changing git command.
---

# Git Commit Message Generator

Generate a Conventional Commits-style commit message describing the user's current git changes. Output the message in the chat only - never create the commit.

## Hard rules

- **Never run state-changing git commands.** Forbidden: `git commit`, `git add`, `git restore`, `git reset`, `git push`, `git stash`, `git checkout` (for switching), `git rm`, `git mv`. Only read-only inspection is allowed.
- **Never write the message to a file** (no `.git/COMMIT_EDITMSG`, no `commit.txt`, etc.) unless the user explicitly asks.
- **Output the message in chat as a fenced code block** so the user can copy it.
- If there are no changes detected at all, say so and stop. Don't fabricate a message.

## Workflow

### 1. Inspect the working tree

Run these read-only commands, in order, to understand what changed:

```bash
git status --short
git diff --cached --stat   # staged file list with line counts
git diff --stat            # unstaged file list with line counts
```

Decide which diff to summarize:
- If there are **staged** changes → use staged (`git diff --cached`).
- Else if there are **unstaged** changes → use unstaged (`git diff`).
- Else if there are **untracked** files → list them and base the message on their paths/contents.
- Else → tell the user "No changes detected" and stop.

State which set you used in one short line before the message (e.g. "Based on staged changes:").

### 2. Read the actual diff

Get the full diff for the chosen set:

```bash
git diff --cached         # if staged
# or
git diff                  # if unstaged
```

For untracked files, read each one directly. If the diff is very large (>2000 lines), fall back to `--stat` plus reading the most-changed files directly - don't try to parse a giant diff blindly.

### 3. Pick the type

Use one of these Conventional Commits types. Pick the single best fit for the dominant change:

| Type | Use for |
|------|---------|
| `feat` | New functionality, new endpoint, new feature flag, new user-facing capability |
| `fix` | Bug fix, error correction, broken behavior repaired |
| `refactor` | Code restructure without changing behavior (rename, extract, reorganize) |
| `perf` | Performance improvement |
| `docs` | Documentation only - README, comments, docstrings, markdown files |
| `test` | Adding or modifying tests, no production code change |
| `style` | Formatting, whitespace, lint fixes (no logic change) |
| `build` | Build system, dependencies, package manifests (pyproject.toml, package.json, Dockerfile) |
| `ci` | CI config - .github/workflows, .gitlab-ci.yml, Jenkinsfile |
| `chore` | Maintenance that doesn't fit elsewhere - .gitignore, tooling config, version bumps |
| `revert` | Reverting a previous commit |

If a change is genuinely mixed (e.g. a feature plus tests for it), use the type of the primary change - usually `feat` - and mention the rest in the bullet points. Don't invent compound types like `feat+test`.

### 4. Pick the scope

The scope is a short noun in lowercase identifying the affected module. Infer it from the changed file paths:

- This repo's usual scopes: `api` (backend routers, services, models), `admin` (`frontend/admin/`), `participant` (`frontend/participant/`), `storage`, `deploy` (compose, Caddy, Dockerfile), `harness` (`.agents/`, `.claude/`, `AGENTS.md`).
- Changes inside one backend area like `backend/app/services/export.py` may use the more specific segment (`export`, `assignment`, `consent`) when it reads better.
- Config files at the repo root → use a meaningful name like `deps`, `docker`, `config`.
- Truly cross-cutting changes (e.g. a rename touching many unrelated modules) → omit the scope entirely. Write `refactor:` rather than guessing.

Keep it short - one word, occasionally two joined with a hyphen. Don't use file extensions or full paths.

### 5. Write the subject line

Format: `type(scope): short imperative summary`

Rules for the subject:
- Lowercase after the colon.
- Imperative mood: "add user login", not "added user login" or "adds user login".
- No trailing period.
- Aim for ≤ 72 characters total. If you can't fit it, shorten the summary, not the scope.
- Describe **what changed**, not the file that changed. "add JWT token validation" is good; "edit auth.py" is not.
- **Never use backticks (`)** in the subject or body. Use single quotes (`'`) for code-like tokens, or drop the quoting entirely when the meaning is clear. Backticks render literally in `git log` and break Markdown rendering on some hosts.

### 6. Write the body bullets

After a blank line, write 1–4 bullet points starting with `* `. **Default to fewer, shorter bullets.** A commit message is a headline, not a changelog - the diff already contains the details.

Each bullet:
- Starts with an imperative verb: "add", "remove", "rename", "extract", "wire up", "handle", "fix", "introduce".
- Describes a distinct meaningful change visible in the diff. Don't restate the subject. Don't list every line edited.
- Stays compact - aim for ≤ 70 characters per bullet. One line, no wrapping.
- Names the *concept* that changed, not the implementation path. "introduce CELEvaluator and bounded LRU compile cache" beats "introduce CELEvaluator with evaluate()/evaluate_bool()/validate() and bounded LRU compile cache in src/core/cel/evaluator.py".
- Only names a specific identifier when it carries information the type+scope+summary doesn't already convey. If the scope is `auth` and the subject says "add JWT login", `verify_jwt()` is redundant. If the change introduces a new public class that callers will reach for by name, naming it once is fair.

**Bullet count guidance:**
- 1 bullet: trivial change where the subject already says everything. Often omit the body entirely.
- 2 bullets: typical small feature, bug fix, or refactor. **This is the most common case.**
- 3 bullets: feature with a clearly separate sub-concern (e.g. feature + tests, feature + migration).
- 4 bullets: ceiling. If you need more, the commit is probably doing too much - suggest splitting.

**Anti-patterns to avoid:**
- Listing each new file as its own bullet. The reader can see file paths in the diff.
- Restating method signatures or naming every function in a new class.
- Padding with vague filler ("various improvements", "general cleanup", "miscellaneous fixes").
- Mentioning trivial scaffolding (init files, exports, type hints) - those are implied by the feature bullet.
- Repeating the subject line in different words.
- Wrapping identifiers in backticks. Use single quotes around symbols when needed (e.g. `'paginate_cursor'`, `'__cursor_sort__'`), or leave them bare.

If a bullet doesn't add information the next reader would actually want, drop it.

### 7. Output

Output in this exact shape, inside a fenced code block:

````
```
type(scope): short imperative summary

* first specific change
* second specific change
* third specific change
```
````

Then stop. Do not offer to commit. Do not suggest running `git commit`. If the user wants follow-ups (alternative messages, breaking-change footer, issue refs), wait for them to ask.

## Examples

**Example 1 - new feature**

Diff context: added `app/auth/jwt.py` with token issuance and verification, modified `app/auth/routes.py` to expose `/auth/login` and `/auth/refresh`.

```
feat(auth): add JWT-based login and refresh

* introduce JWT issuance and verification
* expose POST /auth/login and POST /auth/refresh
```

**Example 2 - bug fix**

Diff context: one-line change in `app/services/billing/invoice.py` correcting a tax calculation that double-counted VAT.

```
fix(billing): correct double-counted VAT in invoice totals

* divide tax_total by 1 instead of summing line VAT twice in build_invoice()
```

**Example 3 - refactor across one module**

Diff context: split `workflows/runner.py` into `runner.py`, `scheduler.py`, `executor.py`; no behavior change.

```
refactor(workflows): split runner into scheduler and executor

* extract scheduling logic into workflows/scheduler.py
* move step execution into workflows/executor.py
* keep runner.py as a thin orchestrator delegating to both
```

**Example 4 - docs only**

Diff context: README updates explaining setup.

```
docs(readme): document local setup and env vars

* add Quickstart section with uv sync and pre-commit install
* list required env vars with example values
```

**Example 5 - cross-cutting, no clear scope**

Diff context: renamed `User.email_addr` to `User.email` across 14 files in unrelated modules.

```
refactor: rename User.email_addr to User.email

* update model field and migration in app/models/user.py
* replace all references across auth, billing, and notifications
* adjust tests and fixtures using the old attribute name
```

## When something's off

- **Diff is huge and noisy** (e.g. autogenerated lockfile changes mixed with real code): mention both in the body, but type the commit by the real code change. For pure lockfile/dep bumps, use `build` or `chore`.
- **Changes look like two unrelated commits**: say so. Suggest the user split them, and offer one message for each.
- **No changes**: respond "No changes detected in the working tree." and stop. Don't invent anything.
- **Only untracked files**: base the message on file paths and contents you can read. Note in the preamble that the changes are untracked.
