# Architecture Examples

Illustrative examples referenced by the corresponding rule file.

## Layer diagram

```
┌──────────────────────────────────────────┐
│  routers/        HTTP in, schema out     │
├──────────────────────────────────────────┤
│  services/       rules and queries       │
├──────────────────────────────────────────┤
│  models/  storage/   tables, object store│
└──────────────────────────────────────────┘
        dependencies point downward only
```

## Source tree

```
backend/app/
├── main.py
├── settings.py
├── db.py
├── errors.py
├── security.py
├── utils.py
├── models/        form.py  image.py  session.py
├── schemas/       forms.py  steps.py  results.py  participant.py
├── routers/
│   ├── admin/     auth.py  forms.py  images.py  responses.py
│   ├── participant.py
│   └── images.py
├── services/      forms.py  edit_guard.py  assignment.py  sessions.py  export.py  images.py
└── storage/       client.py
```

## Pure rule, tested without a database

```python
def choose_variant(counts: dict[int, int], rng: random.Random) -> int:
    """Return a variant with the lowest count, breaking ties at random."""
    lowest = min(counts.values())
    return rng.choice([variant_id for variant_id, count in counts.items() if count == lowest])
```

```python
def test_choose_variant_prefers_the_emptiest() -> None:
    assert choose_variant({1: 4, 2: 3, 3: 4}, random.Random(0)) == 2
```

## Service function

```python
def publish_form(session: Session, form_id: int) -> Form:
    """Publish a form once its consent details and variant images are complete."""
    form = session.get(Form, form_id)
    if form is None:
        raise FormNotFoundError

    problems = find_publish_problems(form)
    if problems:
        raise FormNotReadyError(problems)

    form.status = FormStatus.PUBLISHED
    session.add(form)
    return form
```

## Step config

```python
class StimulusConfig(BaseModel):
    type: Literal[StepType.STIMULUS] = StepType.STIMULUS
    duration_ms: int = Field(ge=100, le=60_000)
    images: dict[int, int]  # variant id -> image id


class TimedSearchConfig(BaseModel):
    type: Literal[StepType.TIMED_SEARCH] = StepType.TIMED_SEARCH
    instruction: str = Field(min_length=1, max_length=500)
    timeout_ms: int = Field(default=10_000, ge=1_000, le=120_000)
    images: dict[int, int]
    targets: dict[int, TargetBox]  # variant id -> normalised box


type StepConfig = Annotated[
    ConsentConfig | TextConfig | StimulusConfig | DistractorConfig | QuestionConfig | ClickImageConfig | TimedSearchConfig,
    Field(discriminator="type"),
]
```
