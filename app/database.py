"""
SQLite database layer for persisting reviews, findings, and webhook events.
"""

import sqlite3
import json
import os
import threading
from datetime import datetime, timezone
from contextlib import contextmanager

_local = threading.local()


class Database:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        """Get a thread-local database connection."""
        if not hasattr(_local, "conn") or _local.conn is None:
            _local.conn = sqlite3.connect(self.db_path)
            _local.conn.row_factory = sqlite3.Row
            _local.conn.execute("PRAGMA journal_mode=WAL")
            _local.conn.execute("PRAGMA foreign_keys=ON")
        return _local.conn

    @contextmanager
    def _cursor(self):
        conn = self._get_conn()
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    def _init_db(self):
        """Create tables if they don't exist."""
        with self._cursor() as cur:
            cur.executescript("""
                CREATE TABLE IF NOT EXISTS reviews (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    platform TEXT NOT NULL DEFAULT 'github',
                    repo_full_name TEXT NOT NULL,
                    pr_number INTEGER NOT NULL,
                    pr_title TEXT DEFAULT '',
                    pr_author TEXT DEFAULT '',
                    pr_url TEXT DEFAULT '',
                    head_sha TEXT DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'pending',
                    score INTEGER DEFAULT NULL,
                    summary TEXT DEFAULT '',
                    files_analyzed INTEGER DEFAULT 0,
                    total_findings INTEGER DEFAULT 0,
                    findings_json TEXT DEFAULT '[]',
                    error_message TEXT DEFAULT NULL,
                    created_at TEXT NOT NULL,
                    completed_at TEXT DEFAULT NULL
                );

                CREATE TABLE IF NOT EXISTS webhook_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    platform TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    payload_summary TEXT DEFAULT '',
                    received_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
                CREATE INDEX IF NOT EXISTS idx_reviews_repo ON reviews(repo_full_name);
                CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at);
            """)

    # ──────────────────────────────────────
    #  Reviews
    # ──────────────────────────────────────

    def create_review(self, platform: str, repo_full_name: str, pr_number: int,
                      pr_title: str = "", pr_author: str = "", pr_url: str = "",
                      head_sha: str = "") -> int:
        """Create a new review record and return its ID."""
        now = datetime.now(timezone.utc).isoformat()
        with self._cursor() as cur:
            cur.execute(
                """INSERT INTO reviews
                   (platform, repo_full_name, pr_number, pr_title, pr_author,
                    pr_url, head_sha, status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
                (platform, repo_full_name, pr_number, pr_title, pr_author,
                 pr_url, head_sha, now),
            )
            return cur.lastrowid

    def update_review_status(self, review_id: int, status: str,
                             error_message: str = None):
        """Update the status of a review."""
        with self._cursor() as cur:
            if error_message:
                cur.execute(
                    "UPDATE reviews SET status=?, error_message=? WHERE id=?",
                    (status, error_message, review_id),
                )
            else:
                cur.execute(
                    "UPDATE reviews SET status=? WHERE id=?",
                    (status, review_id),
                )

    def complete_review(self, review_id: int, score: int, summary: str,
                        files_analyzed: int, total_findings: int,
                        findings_json: str):
        """Mark a review as complete with results."""
        now = datetime.now(timezone.utc).isoformat()
        with self._cursor() as cur:
            cur.execute(
                """UPDATE reviews
                   SET status='complete', score=?, summary=?, files_analyzed=?,
                       total_findings=?, findings_json=?, completed_at=?
                   WHERE id=?""",
                (score, summary, files_analyzed, total_findings,
                 findings_json, now, review_id),
            )

    def get_review(self, review_id: int) -> dict:
        """Get a single review by ID."""
        with self._cursor() as cur:
            cur.execute("SELECT * FROM reviews WHERE id=?", (review_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def get_reviews(self, limit: int = 50, offset: int = 0) -> list:
        """Get recent reviews ordered by creation date."""
        with self._cursor() as cur:
            cur.execute(
                "SELECT * FROM reviews ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
            return [dict(r) for r in cur.fetchall()]

    def get_stats(self) -> dict:
        """Get aggregate statistics."""
        with self._cursor() as cur:
            cur.execute("SELECT COUNT(*) as total FROM reviews")
            total = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) as c FROM reviews WHERE status='complete'")
            completed = cur.fetchone()["c"]

            cur.execute(
                "SELECT COALESCE(SUM(total_findings), 0) as s FROM reviews"
            )
            total_findings = cur.fetchone()["s"]

            cur.execute(
                "SELECT COALESCE(AVG(score), 0) as a FROM reviews WHERE score IS NOT NULL"
            )
            avg_score = round(cur.fetchone()["a"], 1)

            cur.execute(
                """SELECT COUNT(*) as c FROM reviews
                   WHERE status='complete' AND score >= 80"""
            )
            high_quality = cur.fetchone()["c"]

            return {
                "total_reviews": total,
                "completed_reviews": completed,
                "total_findings": total_findings,
                "avg_score": avg_score,
                "high_quality_prs": high_quality,
            }

    # ──────────────────────────────────────
    #  Webhook Events
    # ──────────────────────────────────────

    def log_webhook_event(self, platform: str, event_type: str,
                          payload_summary: str = ""):
        """Log an incoming webhook event."""
        now = datetime.now(timezone.utc).isoformat()
        with self._cursor() as cur:
            cur.execute(
                """INSERT INTO webhook_events
                   (platform, event_type, payload_summary, received_at)
                   VALUES (?, ?, ?, ?)""",
                (platform, event_type, payload_summary, now),
            )

    def get_recent_events(self, limit: int = 20) -> list:
        """Get recent webhook events."""
        with self._cursor() as cur:
            cur.execute(
                "SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT ?",
                (limit,),
            )
            return [dict(r) for r in cur.fetchall()]
