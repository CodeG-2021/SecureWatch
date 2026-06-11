"""
BaseWorker — shared RabbitMQ consumer for all analysis workers.

Subclasses implement:
    process(task: dict, file_bytes: bytes) -> None
and call self.save_finding(...) to persist results.
"""

import json
import logging
import os
import socket
import sys
import time
import uuid

import pika

from . import db, minio_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    stream=sys.stdout,
)


class BaseWorker:
    def __init__(self, queue_name: str, task_type: str):
        self.queue_name = queue_name
        self.task_type  = task_type
        self.worker_id  = f"{task_type}-{socket.gethostname()}-{uuid.uuid4().hex[:6]}"
        self.logger     = logging.getLogger(self.worker_id)
        self.bucket     = os.environ.get("MINIO_BUCKET_EVIDENCE", "securewatch-evidence")

        self.db_conn    = db.get_connection()
        self.minio      = minio_client.get_client()
        self._channel   = None
        self._conn      = None

    # ── RabbitMQ connection ───────────────────────────────────────────────────

    def _connect_rabbitmq(self):
        url  = os.environ["RABBITMQ_URL"]
        params = pika.URLParameters(url)
        params.heartbeat = 600
        params.blocked_connection_timeout = 300

        for attempt in range(1, 11):
            try:
                self._conn    = pika.BlockingConnection(params)
                self._channel = self._conn.channel()
                self._channel.basic_qos(prefetch_count=1)
                self.logger.info("RabbitMQ connected")
                return
            except Exception as exc:
                self.logger.warning(f"RabbitMQ not ready (attempt {attempt}): {exc}")
                time.sleep(attempt * 2)
        raise RuntimeError("Could not connect to RabbitMQ after 10 attempts")

    # ── Public API ────────────────────────────────────────────────────────────

    def run(self):
        self.logger.info(f"Starting worker on queue '{self.queue_name}'")
        self._connect_rabbitmq()
        self._channel.basic_consume(
            queue=self.queue_name,
            on_message_callback=self._on_message,
        )
        try:
            self._channel.start_consuming()
        except KeyboardInterrupt:
            self._channel.stop_consuming()
        finally:
            if self._conn and not self._conn.is_closed:
                self._conn.close()

    def save_finding(self, task: dict, *, finding_type: str, title: str,
                     description: str = "", severity: str = "low", data: dict = None):
        db.create_finding(
            self.db_conn,
            case_id=task["case_id"],
            evidence_id=str(task["evidence_id"]),
            task_id=str(task["id"]),
            finding_type=finding_type,
            title=title,
            description=description,
            severity=severity,
            data=data or {},
        )

    def download_file(self, storage_path: str) -> bytes:
        return minio_client.download_bytes(self.minio, self.bucket, storage_path)

    def upload_artifact(self, evidence_id: str, filename: str, data: bytes, content_type: str = "text/plain") -> str:
        path = f"artifacts/{evidence_id}/{filename}"
        minio_client.upload_bytes(self.minio, self.bucket, path, data, content_type)
        return path

    # ── Message handler ───────────────────────────────────────────────────────

    def _on_message(self, ch, method, properties, body):
        try:
            msg = json.loads(body)
        except Exception:
            self.logger.error(f"Invalid message body: {body!r}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            return

        task_id = msg.get("task_id") or msg.get("id")
        self.logger.info(f"Received task {task_id}")

        task = db.get_task(self.db_conn, task_id)
        if not task:
            self.logger.error(f"Task {task_id} not found in DB")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            return

        db.mark_task_processing(self.db_conn, task_id, self.worker_id)

        try:
            file_bytes = self.download_file(task["storage_path"])
            self.process(task, file_bytes)
            db.mark_task_completed(self.db_conn, task_id)
            ch.basic_ack(delivery_tag=method.delivery_tag)
            self.logger.info(f"Task {task_id} completed")
        except Exception as exc:
            self.logger.exception(f"Task {task_id} failed: {exc}")
            db.mark_task_failed(self.db_conn, task_id, str(exc))
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    # ── To be implemented by subclass ─────────────────────────────────────────

    def process(self, task: dict, file_bytes: bytes):
        raise NotImplementedError
