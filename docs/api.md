# API reference

The backend has two separate API surfaces.

| Prefix | Used by | Access |
|---|---|---|
| `/api/admin/*` | The admin panel | Login cookie |
| `/api/p/*` | The participant app | Anonymous. A session is addressed by the token issued at consent |

All request and response bodies are JSON, except image upload (multipart) and the CSV downloads. The interactive OpenAPI pages are turned off.

## Errors

Every error has the same shape:

```json
{ "code": "form_locked", "message": "…", "details": [] }
```

| Code | Status | When |
|---|---|---|
| `not_found` | 404 | The form, session, image or link does not exist |
| `not_authenticated` | 401 | An admin request without a valid login |
| `invalid_credentials` | 401 | Wrong username or password |
| `too_many_attempts` | 429 | Too many failed logins |
| `form_locked` | 409 | A structural edit to a published form |
| `form_not_ready` | 422 | Publishing a form with missing parts; `details` lists them |
| `invalid_form` | 422 | The form content is not valid |
| `study_closed` | 410 | Starting a session on a closed study |
| `consent_required` | 422 | The consent text changed since the participant read it |
| `session_closed` | 409 | A step request for a completed session |
| `step_conflict` | 409 | A request for a step that is not the current one |
| `invalid_answer` | 422 | An answer that does not fit the question |
| `invalid_image` | 422 | An upload that is not a usable image |
| `image_too_large` | 413 | An upload over the size limit |
| `image_in_use` | 409 | Deleting an image a study uses |
| `storage_unavailable` | 503 | The image store cannot be reached |
| `confirmation_mismatch` | 422 | A wipe without the right confirmation |

Bodies that fail schema validation return FastAPI's standard 422 response.

## Admin API

### Login

| Method | Path | Does |
|---|---|---|
| `POST` | `/api/admin/login` | Body `{username, password}`. Sets the session cookie |
| `POST` | `/api/admin/logout` | Clears the cookie |
| `GET` | `/api/admin/me` | Returns the logged-in username |

### Forms

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/admin/forms` | List forms with their response counts |
| `POST` | `/api/admin/forms` | Create a draft. Body `{title}` |
| `GET` | `/api/admin/forms/{id}` | One form for the editor, including `publish_problems` and `structure_locked` |
| `PUT` | `/api/admin/forms/{id}` | Save the whole form: `{title, block_repeats, variants, steps}` |
| `DELETE` | `/api/admin/forms/{id}` | Delete the form and its responses |
| `POST` | `/api/admin/forms/{id}/duplicate` | Copy into a new draft |
| `POST` | `/api/admin/forms/{id}/publish` | Open to participants |
| `POST` | `/api/admin/forms/{id}/close` | Stop accepting participants |
| `GET` | `/api/admin/forms/{id}/preview?variant={key}` | The form as one version sees it. Stores nothing |

A step in the saved form is `{key, required, config}`. `config` is one of the step configs in [`backend/app/schemas/steps.py`](../backend/app/schemas/steps.py), selected by its `type` field.

### Images

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/admin/images` | The library, with total size and where each image is used |
| `POST` | `/api/admin/images` | Upload one or more files (multipart field `files`). Returns `{uploaded, failed}` |
| `DELETE` | `/api/admin/images/{id}` | Delete an unused image |

### Responses

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/admin/forms/{id}/responses` | Rows and per-version counts |
| `GET` | `/api/admin/forms/{id}/responses.csv` | The responses file |
| `GET` | `/api/admin/forms/{id}/codebook.csv` | The column guide |
| `DELETE` | `/api/admin/forms/{id}/responses` | Delete every response of the form |
| `DELETE` | `/api/admin/forms/{id}/responses/{participant_id}` | Delete one response |
| `POST` | `/api/admin/wipe` | Delete all responses. Body `{confirmation, include_forms_and_images}` |

The CSV files are described in [Results and CSV](data-export.md).

## Participant API

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/p/studies/{slug}` | Title, whether the study is open, and the consent text. Stores nothing |
| `POST` | `/api/p/studies/{slug}/sessions` | Create a session after consent and assign a version |
| `GET` | `/api/p/sessions/{token}` | Continue after a page load |
| `POST` | `/api/p/sessions/{token}/steps/{step_key}/start` | Record that a timed step is about to be shown |
| `POST` | `/api/p/sessions/{token}/steps/{step_key}/finish` | Store a step's result |
| `DELETE` | `/api/p/sessions/{token}` | Withdraw: delete the session and its results |

### Starting a session

```json
{
  "agreed": true,
  "consent_version": 1,
  "device_type": "phone",
  "viewport_width": 390,
  "viewport_height": 760
}
```

`agreed` must be `true`, and `consent_version` must be the version the participant was shown. The response is the session state.

### Session state

Returned by starting, continuing and finishing a step.

```json
{
  "participant_id": "…",
  "token": "…",
  "steps": [ … ],
  "next_index": 2,
  "interrupted": false
}
```

`steps` holds the steps after consent, with this participant's images only. `next_index` is the step to show next, or `null` when the session is complete.

### Finishing a step

The body is `{"result": …}`, where the result matches the step type:

| Step type | Result |
|---|---|
| `text` | `{"type": "text"}` |
| `stimulus` | `{"type": "stimulus", "shown_ms": 5003}` |
| `distractor` | `{"type": "distractor", "attempted": 9, "correct": 8}` |
| `question` | `{"type": "question", "value": "yes", "other": null}` |
| `click_image` | `{"type": "click_image", "x": 0.71, "y": 0.18, "pointer": "touch"}` |
| `timed_search` | `{"type": "timed_search", "rt_ms": 1840, "x": 0.72, "y": 0.2, "pointer": "touch"}` |

Click positions are fractions of the displayed image, from 0 to 1. A timed search with no `rt_ms` is a timeout. The server works out whether the click was a hit.

Timed steps (`stimulus`, `distractor`, `timed_search`) must be started before they can be finished. See [the shown-once rule](architecture.md#the-shown-once-rule).

## Other paths

| Path | Does |
|---|---|
| `GET /img/{key}` | Stream an image from storage |
| `GET /admin`, `/admin/*` | The admin app |
| `GET /s/{slug}` | The participant app |
