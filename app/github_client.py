"""
GitHub API client — handles all interactions with the GitHub REST API.
"""

import hmac
import hashlib
import logging
import requests
from typing import Optional

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import Config

logger = logging.getLogger(__name__)


class GitHubClient:
    """Client for the GitHub REST API v3."""

    def __init__(self, token: str = None):
        self.api_url = "https://api.github.com"
        self.token = token or Config.GITHUB_TOKEN
        self.headers = {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json",
        }

    # ──────────────────────────────────────
    #  Pull Request Data
    # ──────────────────────────────────────

    def get_pull_request(self, repo: str, pr_number: int) -> dict:
        """Fetch full PR metadata."""
        url = f"{self.api_url}/repos/{repo}/pulls/{pr_number}"
        resp = requests.get(url, headers=self.headers, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def get_pull_request_files(self, repo: str, pr_number: int) -> list:
        """
        Get all files changed in a pull request, handling pagination.
        """
        files = []
        page = 1
        while True:
            url = f"{self.api_url}/repos/{repo}/pulls/{pr_number}/files"
            resp = requests.get(
                url,
                headers=self.headers,
                params={"per_page": 100, "page": page},
                timeout=30,
            )
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            files.extend(batch)
            page += 1
            if len(batch) < 100:
                break
        return files

    # ──────────────────────────────────────
    #  Posting Reviews & Comments
    # ──────────────────────────────────────

    def create_review(self, repo: str, pr_number: int, body: str,
                      commit_id: str = None,
                      event: str = "COMMENT",
                      comments: list = None) -> dict:
        """
        Create a pull request review.

        Args:
            repo: Full repo name (owner/repo)
            pr_number: PR number
            body: Review summary body
            commit_id: Optional commit ID of the PR head
            event: APPROVE, REQUEST_CHANGES, or COMMENT
            comments: List of inline comment dicts with keys:
                      path, position/line, body
        """
        url = f"{self.api_url}/repos/{repo}/pulls/{pr_number}/reviews"
        payload = {"body": body, "event": event}
        if commit_id:
            payload["commit_id"] = commit_id
        if comments:
            payload["comments"] = comments

        try:
            resp = requests.post(
                url, headers=self.headers, json=payload, timeout=30
            )
            resp.raise_for_status()
            logger.info(f"Created review on {repo}#{pr_number} ({event})")
            return resp.json()
        except requests.exceptions.HTTPError as e:
            logger.error(f"GitHub API Error Response: {e.response.text}")
            raise e

    def post_comment(self, repo: str, pr_number: int, body: str) -> dict:
        """Post a general comment (issue comment) on a PR."""
        url = f"{self.api_url}/repos/{repo}/issues/{pr_number}/comments"
        resp = requests.post(
            url, headers=self.headers, json={"body": body}, timeout=30
        )
        resp.raise_for_status()
        return resp.json()

    def post_inline_comment(self, repo: str, pr_number: int,
                            commit_id: str, path: str, position: int,
                            body: str) -> dict:
        """Post an inline review comment at a specific diff position."""
        url = f"{self.api_url}/repos/{repo}/pulls/{pr_number}/comments"
        payload = {
            "body": body,
            "commit_id": commit_id,
            "path": path,
            "position": position,
        }
        resp = requests.post(
            url, headers=self.headers, json=payload, timeout=30
        )
        resp.raise_for_status()
        return resp.json()

    # ──────────────────────────────────────
    #  Webhook Verification
    # ──────────────────────────────────────

    @staticmethod
    def verify_webhook_signature(payload_body: bytes,
                                 signature: str,
                                 secret: str = None) -> bool:
        """
        Verify a GitHub webhook signature (HMAC-SHA256).

        Args:
            payload_body: Raw request body bytes
            signature: The X-Hub-Signature-256 header value
            secret: Webhook secret (falls back to Config.WEBHOOK_SECRET)
        """
        secret = secret or Config.WEBHOOK_SECRET
        if not secret:
            logger.warning("No webhook secret configured — skipping verification")
            return True

        if not signature:
            return False

        expected = "sha256=" + hmac.new(
            secret.encode("utf-8"),
            payload_body,
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(expected, signature)

    # ──────────────────────────────────────
    #  Webhook Payload Helpers
    # ──────────────────────────────────────

    @staticmethod
    def parse_pr_webhook(payload: dict) -> Optional[dict]:
        """
        Parse a GitHub PR webhook payload.

        Returns a normalized dict with PR info, or None if this
        event should be ignored.
        """
        action = payload.get("action")
        if action not in ("opened", "synchronize", "reopened"):
            return None

        pr = payload.get("pull_request", {})
        repo = payload.get("repository", {})

        return {
            "action": action,
            "pr_number": pr.get("number"),
            "pr_title": pr.get("title", ""),
            "pr_author": pr.get("user", {}).get("login", ""),
            "pr_url": pr.get("html_url", ""),
            "head_sha": pr.get("head", {}).get("sha", ""),
            "repo_full_name": repo.get("full_name", ""),
        }
