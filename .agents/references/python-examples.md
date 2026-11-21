# Python Examples

Illustrative examples referenced by the corresponding rule file.

## Type hints

```python
def list_sessions(
    session: Session,
    form_id: int,
    status: SessionStatus | None = None,
) -> list[StudySession]: ...
```

## Guard clauses

```python
def record_step_started(session: Session, study_session: StudySession | None, step: Step) -> StepResult:
    if study_session is None:
        raise SessionNotFoundError
    if study_session.status is not SessionStatus.ACTIVE:
        raise SessionClosedError
    if has_result(session, study_session.id, step.id):
        raise StepAlreadyStartedError
    ...
```

## Docstring sections

```python
# Good - the signature already says everything.
def is_timed(step_type: StepType) -> bool:
    """Return whether a step of this type must never be shown twice."""


# Good - the unit and origin of the box cannot be read from the types, stated as prose.
def is_hit(x: float, y: float, box: TargetBox) -> bool:
    """Return whether a click landed inside the target box.

    All values are fractions of the displayed image, measured from its top-left corner.
    """


# Bad - three sections, zero information.
def is_hit(x: float, y: float, box: TargetBox) -> bool:
    """Check a hit.

    Args:
        x: The x.
        y: The y.
        box: The box.

    Returns:
        Whether it hit.
    """
```

## Paragraphs

```python
# Bad - one block; the reader has to find where loading ends and deciding begins.
def next_step(session: Session, study_session: StudySession) -> Step | None:
    steps = list_steps(session, study_session.form_id)
    results = {r.step_id: r for r in list_results(session, study_session.id)}
    for step in steps:
        result = results.get(step.id)
        if result is None:
            return step
        if result.finished_at is None and is_timed(step.type):
            mark_interrupted(session, study_session, result)
    return None


# Good - load, walk, finish: one blank line between each.
def next_step(session: Session, study_session: StudySession) -> Step | None:
    steps = list_steps(session, study_session.form_id)
    results = {r.step_id: r for r in list_results(session, study_session.id)}

    for step in steps:
        result = results.get(step.id)
        if result is None:
            return step
        if result.finished_at is None and is_timed(step.type):
            mark_interrupted(session, study_session, result)

    return None
```

## Logging

```python
logger.info(
    "responses_exported",
    extra={"form_id": form_id, "row_count": len(rows), "duration_ms": elapsed_ms},
)
```
