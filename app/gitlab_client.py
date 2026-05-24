"""
GitLab API client — handles all interactions with the GitLab REST API.
"""

import logging
import requests
from typing import Optional

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import Config

logger = logging.getLogger(__name__)


class GitLabClient:
    """Client for the GitLab REST API v4."""

    def __init__(self, token: str = None, base_url: str = "https://gitlab.com"):
        self.api_url = f"{base_url}/api/v4"
        self.token = token or Config.GITLAB_TOKEN
        self.headers = {
            "PRIVATE-TOKEN": self.token,
            "Content-Type": "application/json",
        }

    # ──────────────────────────────────────
    #  Merge Request Data
    # ──────────────────────────────────────

    def get_merge_request(self, project_id: int, mr_iid: int) -> dict:
        """Fetch full MR metadata."""
        url = f"{self.api_url}/projects/{project_id}/merge_requests/{mr_iid}"
        resp = requests.get(url, headers=self.headers, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def get_merge_request_changes(self, project_id: int, mr_iid: int) -> list:
        """Get the diff/changes for a merge request."""
        url = (
            f"{self.api_url}/projects/{project_id}"
            f"/merge_requests/{mr_iid}/changes"
        )
        resp = requests.get(url, headers=self.headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        return data.get("changes", [])

    # ──────────────────────────────────────
    #  Posting Comments
    # ──────────────────────────────────────

    def post_mr_note(self, project_id: int, mr_iid: int, body: str) -> dict:
        """Post a general note (comment) on a merge request."""
        url = (
            f"{self.api_url}/projects/{project_id}"
            f"/merge_requests/{mr_iid}/notes"
        )
        resp = requests.post(
            url, headers=self.headers, json={"body": body}, timeout=30
        )
        resp.raise_for_status()
        return resp.json()

    def post_inline_discussion(self, project_id: int, mr_iid: int,
                               sha: str, new_path: str,
                               new_line: int, body: str,
                               old_path: str = None,
                               old_line: int = None) -> dict:
        """
        Create an inline discussion on a specific line of the MR diff.
        """
        url = (
            f"{self.api_url}/projects/{project_id}"
            f"/merge_requests/{mr_iid}/discussions"
        )
        position = {
            "position_type": "text",
            "base_sha": sha,
            "head_sha": sha,
            "start_sha": sha,
            "new_path": new_path,
            "new_line": new_line,
        }
        if old_path:
            position["old_path"] = old_path
        if old_line:
            position["old_line"] = old_line

        payload = {"body": body, "position": position}
        resp = requests.post(
            url, headers=self.headers, json=payload, timeout=30
        )
        resp.raise_for_status()
        return resp.json()

    # ──────────────────────────────────────
    #  Webhook Verification
    # ──────────────────────────────────────

    @staticmethod
    def verify_webhook_token(received_token: str,
                             secret: str = None) -> bool:
        """Verify a GitLab webhook secret token."""
        secret = secret or Config.WEBHOOK_SECRET
        if not secret:
            return True
        return received_token == secret

    # ──────────────────────────────────────
    #  Webhook Payload Helpers
    # ──────────────────────────────────────

    @staticmethod
    def parse_mr_webhook(payload: dict) -> Optional[dict]:
        """
        Parse a GitLab MR webhook payload.

        Returns a normalized dict with MR info, or None if this
        event should be ignored.
        """
        obj_kind = payload.get("object_kind")
        if obj_kind != "merge_request":
            return None

        attrs = payload.get("object_attributes", {})
        action = attrs.get("action")

        if action not in ("open", "update", "reopen"):
            return None

        project = payload.get("project", {})

        return {
            "action": action,
            "pr_number": attrs.get("iid"),
            "pr_title": attrs.get("title", ""),
            "pr_author": payload.get("user", {}).get("username", ""),
            "pr_url": attrs.get("url", ""),
            "head_sha": attrs.get("last_commit", {}).get("id", ""),
            "repo_full_name": project.get("path_with_namespace", ""),
            "project_id": project.get("id"),
        }
