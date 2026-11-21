"""Domain errors. Each has a safe message and the HTTP status it maps to."""


class AppError(Exception):
    """Base for errors that are safe to show to the caller."""

    code = "error"
    status = 400
    message = "Something went wrong."

    def __init__(self, message: str | None = None, details: list[str] | None = None) -> None:
        super().__init__(message or self.message)
        if message:
            self.message = message
        self.details = details or []


class NotFoundError(AppError):
    code = "not_found"
    status = 404
    message = "Not found."


class NotAuthenticatedError(AppError):
    code = "not_authenticated"
    status = 401
    message = "Please log in."


class InvalidCredentialsError(AppError):
    code = "invalid_credentials"
    status = 401
    message = "Wrong username or password."


class TooManyAttemptsError(AppError):
    code = "too_many_attempts"
    status = 429
    message = "Too many failed attempts. Wait a few minutes and try again."


class FormLockedError(AppError):
    code = "form_locked"
    status = 409
    message = (
        "Only wording can be changed here. To change the structure, "
        "unpublish the form and clear its responses, or duplicate it."
    )


class FormNotReadyError(AppError):
    code = "form_not_ready"
    status = 422
    message = "This form is not ready to publish yet."


class InvalidFormError(AppError):
    code = "invalid_form"
    status = 422
    message = "This form has a problem."


class StudyClosedError(AppError):
    code = "study_closed"
    status = 410
    message = "This study is closed."


class ConsentRequiredError(AppError):
    code = "consent_required"
    status = 422
    message = "Consent is required to take part."


class SessionClosedError(AppError):
    code = "session_closed"
    status = 409
    message = "This session has already finished."


class StepConflictError(AppError):
    code = "step_conflict"
    status = 409
    message = "This step cannot be answered now."


class InvalidAnswerError(AppError):
    code = "invalid_answer"
    status = 422
    message = "That answer is not valid for this question."


class InvalidImageError(AppError):
    code = "invalid_image"
    status = 422
    message = "That file is not a supported image. Use JPEG, PNG or WebP."


class ImageTooLargeError(AppError):
    code = "image_too_large"
    status = 413
    message = "That image is too large."


class ImageInUseError(AppError):
    code = "image_in_use"
    status = 409
    message = "This image is used by a form and cannot be deleted."


class StorageUnavailableError(AppError):
    code = "storage_unavailable"
    status = 503
    message = "Image storage is not available right now."


class ConfirmationMismatchError(AppError):
    code = "confirmation_mismatch"
    status = 422
    message = "The confirmation text does not match."
