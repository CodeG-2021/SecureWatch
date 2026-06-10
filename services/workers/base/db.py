import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor


def get_connection():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_task(conn, task_id: str) -> dict | None:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT t.*, e.storage_path, e.mime_type, e.file_type, e.original_filename
            FROM   tasks t
            JOIN   evidences e ON e.id = t.evidence_id
            WHERE  t.id = %s
            """,
            (task_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def mark_task_processing(conn, task_id: str, worker_id: str):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE tasks SET status='processing', worker_id=%s, started_at=NOW(), updated_at=NOW() WHERE id=%s",
            (worker_id, task_id),
        )
    conn.commit()


def mark_task_completed(conn, task_id: str):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE tasks SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=%s",
            (task_id,),
        )
        # Propagate completed status to evidence when ALL its tasks are done
        cur.execute(
            """
            UPDATE evidences SET status='completed', updated_at=NOW()
            WHERE  id = (SELECT evidence_id FROM tasks WHERE id=%s)
              AND  NOT EXISTS (
                       SELECT 1 FROM tasks
                       WHERE  evidence_id = (SELECT evidence_id FROM tasks WHERE id=%s)
                         AND  status NOT IN ('completed','failed','dead_letter','cancelled')
                   )
            """,
            (task_id, task_id),
        )
    conn.commit()


def mark_task_failed(conn, task_id: str, error_msg: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE tasks
            SET    status = CASE
                               WHEN retry_count + 1 >= max_retries THEN 'failed'
                               ELSE 'retrying'
                           END,
                   retry_count   = retry_count + 1,
                   error_message = %s,
                   failed_at     = NOW(),
                   updated_at    = NOW()
            WHERE  id = %s
            """,
            (error_msg[:2000], task_id),
        )
    conn.commit()


def create_finding(
    conn,
    *,
    case_id: str,
    evidence_id: str,
    task_id: str,
    finding_type: str,
    title: str,
    description: str,
    severity: str,
    data: dict,
) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO findings
                (case_id, evidence_id, task_id, finding_type, title, description, severity, data)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
            """,
            (
                case_id,
                evidence_id,
                task_id,
                finding_type,
                title,
                description,
                severity,
                json.dumps(data),
            ),
        )
        finding_id = str(cur.fetchone()[0])
        # Recalculate case risk score after every new finding
        cur.execute(
            """
            UPDATE cases SET
                findings_count = sub.total,
                risk_score = CASE
                    WHEN sub.total = 0 THEN 0
                    ELSE ROUND(
                        (sub.critical * 4.0 + sub.high * 3.0 + sub.medium * 2.0 + sub.low * 1.0)
                        / (sub.total * 4.0) * 100, 2)
                END,
                updated_at = NOW()
            FROM (
                SELECT
                    COUNT(*)                                       AS total,
                    COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
                    COUNT(*) FILTER (WHERE severity = 'high')     AS high,
                    COUNT(*) FILTER (WHERE severity = 'medium')   AS medium,
                    COUNT(*) FILTER (WHERE severity = 'low')      AS low
                FROM findings WHERE case_id = %s
            ) sub
            WHERE cases.id = %s
            """,
            (case_id, case_id),
        )
    conn.commit()
    return finding_id


def create_secondary_task(conn, *, case_id: str, evidence_id: str, task_type: str, queue_name: str, priority: str) -> str:
    """Insert a secondary task already marked completed (processed inline by the calling worker)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO tasks (case_id, evidence_id, task_type, queue_name, priority, status, completed_at)
            VALUES (%s,%s,%s,%s,%s,'completed', NOW())
            RETURNING id
            """,
            (case_id, evidence_id, task_type, queue_name, priority),
        )
        task_id = str(cur.fetchone()[0])
    conn.commit()
    return task_id
