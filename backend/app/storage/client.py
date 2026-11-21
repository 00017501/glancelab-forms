"""S3-compatible object storage. The same client serves SeaweedFS and AWS S3."""

import logging
from collections.abc import Iterator
from functools import lru_cache
from typing import Annotated, Any, Protocol

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import Depends

from app.errors import NotFoundError, StorageUnavailableError
from app.settings import Settings, get_settings

logger = logging.getLogger(__name__)

# Bytes handed to the browser per chunk when streaming an image.
STREAM_CHUNK_BYTES = 64 * 1024


class ObjectStorage(Protocol):
    """What the app needs from an object store."""

    def put(self, key: str, body: bytes, content_type: str) -> None: ...

    def stream(self, key: str) -> tuple[Iterator[bytes], int]: ...

    def delete(self, key: str) -> None: ...


class S3Storage:
    """Object storage backed by any S3-compatible endpoint."""

    def __init__(self, settings: Settings) -> None:
        self._bucket = settings.s3_bucket
        self._client: Any = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key_id.get_secret_value() if settings.s3_access_key_id else None,
            aws_secret_access_key=(
                settings.s3_secret_access_key.get_secret_value() if settings.s3_secret_access_key else None
            ),
            config=Config(
                connect_timeout=5,
                read_timeout=30,
                retries={"max_attempts": 3},
                s3={"addressing_style": "path"} if settings.s3_endpoint_url else {},
            ),
        )

    def ensure_bucket(self) -> None:
        """Create the bucket when it is missing; a self-hosted store starts empty."""
        try:
            self._client.head_bucket(Bucket=self._bucket)
        except ClientError:
            try:
                self._client.create_bucket(Bucket=self._bucket)
            except (ClientError, BotoCoreError):
                logger.warning("storage_bucket_unavailable", extra={"bucket": self._bucket})
        except BotoCoreError:
            logger.warning("storage_unreachable", extra={"bucket": self._bucket})

    def put(self, key: str, body: bytes, content_type: str) -> None:
        """Store an object, creating the bucket first if the store was not ready at startup."""
        try:
            try:
                self._client.put_object(Bucket=self._bucket, Key=key, Body=body, ContentType=content_type)
            except ClientError as error:
                if error.response.get("Error", {}).get("Code") != "NoSuchBucket":
                    raise
                self._client.create_bucket(Bucket=self._bucket)
                self._client.put_object(Bucket=self._bucket, Key=key, Body=body, ContentType=content_type)
        except (ClientError, BotoCoreError) as error:
            raise StorageUnavailableError from error

    def stream(self, key: str) -> tuple[Iterator[bytes], int]:
        """Return a chunk iterator over an object and its size in bytes."""
        try:
            response = self._client.get_object(Bucket=self._bucket, Key=key)
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") in {"NoSuchKey", "404"}:
                raise NotFoundError from error
            raise StorageUnavailableError from error
        except BotoCoreError as error:
            raise StorageUnavailableError from error
        return response["Body"].iter_chunks(STREAM_CHUNK_BYTES), int(response["ContentLength"])

    def delete(self, key: str) -> None:
        """Delete an object; a missing object is not an error."""
        try:
            self._client.delete_object(Bucket=self._bucket, Key=key)
        except (ClientError, BotoCoreError) as error:
            raise StorageUnavailableError from error


@lru_cache
def get_s3_storage() -> S3Storage:
    """Return the process-wide storage client."""
    return S3Storage(get_settings())


def get_storage() -> ObjectStorage:
    """Dependency that tests override with an in-memory store."""
    return get_s3_storage()


Storage = Annotated[ObjectStorage, Depends(get_storage)]
