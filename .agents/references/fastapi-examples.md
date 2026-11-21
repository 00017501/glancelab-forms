# FastAPI Examples

Illustrative examples referenced by the corresponding rule file.

## Thin route

```python
router = APIRouter(prefix="/api/admin/forms", tags=["forms"], dependencies=[Depends(require_admin)])


@router.post("/{form_id}/publish")
def publish_form(form_id: int, session: DbSession) -> FormResponse:
    """Publish a form."""
    form = forms.publish_form(session, form_id)
    return FormResponse.model_validate(form)
```

## Schemas

```python
class FormCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class FormUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    block_repeats: bool | None = None


class FormResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    status: FormStatus
```

## Dependencies

```python
def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


DbSession = Annotated[Session, Depends(get_session)]
Storage = Annotated[ObjectStorage, Depends(get_storage)]
```

## Override fixture

```python
@pytest.fixture
def client(db_session: Session, fake_storage: FakeStorage) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: db_session
    app.dependency_overrides[get_storage] = lambda: fake_storage
    yield TestClient(app)
    app.dependency_overrides.clear()
```

## Errors

```python
class AppError(Exception):
    """Base for errors that have a safe message and an HTTP status."""

    code = "error"
    status = 400
    message = "Something went wrong."


class FormLockedError(AppError):
    code = "form_locked"
    status = 409
    message = "This form is published. Only wording can be changed."
```

```python
@app.exception_handler(AppError)
def render_app_error(_: Request, error: AppError) -> JSONResponse:
    return JSONResponse(status_code=error.status, content={"code": error.code, "message": error.message})
```
