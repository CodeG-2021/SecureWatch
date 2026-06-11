import io
import os

from minio import Minio


def get_client() -> Minio:
    return Minio(
        endpoint=os.environ["MINIO_ENDPOINT"],
        access_key=os.environ["MINIO_ACCESS_KEY"],
        secret_key=os.environ["MINIO_SECRET_KEY"],
        secure=os.environ.get("MINIO_USE_SSL", "false").lower() == "true",
    )


def download_bytes(client: Minio, bucket: str, path: str) -> bytes:
    resp = client.get_object(bucket, path)
    try:
        return resp.read()
    finally:
        resp.close()
        resp.release_conn()


def upload_bytes(client: Minio, bucket: str, path: str, data: bytes, content_type: str = "text/plain"):
    client.put_object(
        bucket_name=bucket,
        object_name=path,
        data=io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
