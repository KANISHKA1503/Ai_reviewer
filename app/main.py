"""
AI Code Review Agent — Main Flask Application

Handles webhook events from GitHub/GitLab, orchestrates AI-powered code
analysis, and serves the monitoring dashboard.
"""

import json
import logging
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor

from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import Config
from app.database import Database
from app.github_client import GitHubClient
from app.gitlab_client import GitLabClient
from app.diff_parser import parse_github_files, compute_diff_position
from app.analysis.analyzer import Analyzer
from app.analysis.models import DiffFile
from app.comment_formatter import (
    format_summary_comment,
    build_review_comments,
)

# ──────────────────────────────────────
#  App Setup
# ──────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, Config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ai-reviewer")

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), "templates"),
    static_folder=os.path.join(os.path.dirname(__file__), "static"),
)
app.config["SECRET_KEY"] = Config.SECRET_KEY
CORS(app)

db = Database(Config.DATABASE_PATH)
executor = ThreadPoolExecutor(max_workers=4)


# ──────────────────────────────────────
#  Dashboard Routes
# ──────────────────────────────────────

@app.route("/")
def dashboard():
    """Serve the web dashboard."""
    return render_template("index.html")


# ──────────────────────────────────────
#  API Routes
# ──────────────────────────────────────

@app.route("/api/reviews", methods=["GET"])
def api_get_reviews():
    """Get list of reviews."""
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)
    reviews = db.get_reviews(limit=limit, offset=offset)

    # Parse findings_json for each review
    for r in reviews:
        try:
            r["findings"] = json.loads(r.get("findings_json", "[]"))
        except (json.JSONDecodeError, TypeError):
            r["findings"] = []

    return jsonify(reviews)


@app.route("/api/reviews/<int:review_id>", methods=["GET"])
def api_get_review(review_id):
    """Get a single review with full details."""
    review = db.get_review(review_id)
    if not review:
        return jsonify({"error": "Review not found"}), 404

    try:
        review["findings"] = json.loads(review.get("findings_json", "[]"))
    except (json.JSONDecodeError, TypeError):
        review["findings"] = []

    return jsonify(review)


@app.route("/api/stats", methods=["GET"])
def api_get_stats():
    """Get aggregate statistics."""
    stats = db.get_stats()
    return jsonify(stats)


@app.route("/api/events", methods=["GET"])
def api_get_events():
    """Get recent webhook events."""
    events = db.get_recent_events(limit=20)
    return jsonify(events)


@app.route("/api/review", methods=["POST"])
def api_trigger_review():
    """
    Manually trigger a review for a GitHub PR.

    Expected JSON body: { "pr_url": "https://github.com/owner/repo/pull/123" }
    """
    data = request.json or {}
    pr_url = data.get("pr_url", "").strip()

    if not pr_url:
        return jsonify({"error": "pr_url is required"}), 400

    # Parse the PR URL
    parsed = _parse_pr_url(pr_url)
    if not parsed:
        return jsonify({"error": "Invalid PR URL format"}), 400

    repo, pr_number = parsed

    # Create review record
    review_id = db.create_review(
        platform="github",
        repo_full_name=repo,
        pr_number=pr_number,
        pr_url=pr_url,
    )

    # Run analysis in background
    executor.submit(_run_github_review, review_id, repo, pr_number)

    return jsonify({
        "status": "queued",
        "review_id": review_id,
        "message": f"Review queued for {repo}#{pr_number}",
    }), 202


# ──────────────────────────────────────
#  Webhook Endpoint
# ──────────────────────────────────────

@app.route("/webhook", methods=["POST"])
def webhook():
    """Handle incoming webhook events from GitHub or GitLab."""
    payload_body = request.get_data()

    # Detect platform
    github_event = request.headers.get("X-GitHub-Event")
    gitlab_event = request.headers.get("X-Gitlab-Event")

    if github_event:
        return _handle_github_webhook(payload_body, github_event)
    elif gitlab_event:
        return _handle_gitlab_webhook(payload_body, gitlab_event)
    else:
        return jsonify({"error": "Unknown webhook source"}), 400


def _handle_github_webhook(payload_body: bytes, event_type: str):
    """Process a GitHub webhook event."""
    # Verify signature
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not GitHubClient.verify_webhook_signature(payload_body, signature):
        logger.warning("Invalid GitHub webhook signature")
        return jsonify({"error": "Invalid signature"}), 401

    data = request.json

    # Log the event
    db.log_webhook_event(
        platform="github",
        event_type=event_type,
        payload_summary=f"{event_type}: {data.get('action', 'N/A')}",
    )

    # We only care about PR events
    if event_type != "pull_request":
        logger.info(f"Ignoring GitHub event: {event_type}")
        return jsonify({"status": "ignored", "reason": "not a PR event"}), 200

    # Parse PR info
    pr_info = GitHubClient.parse_pr_webhook(data)
    if not pr_info:
        logger.info(f"Ignoring PR action: {data.get('action')}")
        return jsonify({"status": "ignored", "reason": "action not relevant"}), 200

    logger.info(
        f"Processing PR #{pr_info['pr_number']} "
        f"({pr_info['action']}) on {pr_info['repo_full_name']}"
    )

    # Create review record
    review_id = db.create_review(
        platform="github",
        repo_full_name=pr_info["repo_full_name"],
        pr_number=pr_info["pr_number"],
        pr_title=pr_info["pr_title"],
        pr_author=pr_info["pr_author"],
        pr_url=pr_info["pr_url"],
        head_sha=pr_info["head_sha"],
    )

    # Run analysis in background
    executor.submit(
        _run_github_review,
        review_id,
        pr_info["repo_full_name"],
        pr_info["pr_number"],
    )

    return jsonify({
        "status": "queued",
        "review_id": review_id,
    }), 202


def _handle_gitlab_webhook(payload_body: bytes, event_type: str):
    """Process a GitLab webhook event."""
    # Verify token
    gl_token = request.headers.get("X-Gitlab-Token", "")
    if not GitLabClient.verify_webhook_token(gl_token):
        logger.warning("Invalid GitLab webhook token")
        return jsonify({"error": "Invalid token"}), 401

    data = request.json

    db.log_webhook_event(
        platform="gitlab",
        event_type=event_type,
        payload_summary=f"{event_type}",
    )

    # Parse MR info
    mr_info = GitLabClient.parse_mr_webhook(data)
    if not mr_info:
        return jsonify({"status": "ignored"}), 200

    logger.info(
        f"Processing MR !{mr_info['pr_number']} on {mr_info['repo_full_name']}"
    )

    review_id = db.create_review(
        platform="gitlab",
        repo_full_name=mr_info["repo_full_name"],
        pr_number=mr_info["pr_number"],
        pr_title=mr_info["pr_title"],
        pr_author=mr_info["pr_author"],
        pr_url=mr_info["pr_url"],
        head_sha=mr_info["head_sha"],
    )

    executor.submit(
        _run_gitlab_review,
        review_id,
        mr_info["project_id"],
        mr_info["pr_number"],
        mr_info["repo_full_name"],
    )

    return jsonify({"status": "queued", "review_id": review_id}), 202


# ──────────────────────────────────────
#  Review Pipeline Workers
# ──────────────────────────────────────

def _run_github_review(review_id: int, repo: str, pr_number: int):
    """Full GitHub PR review pipeline — runs in a background thread."""
    try:
        db.update_review_status(review_id, "analyzing")
        logger.info(f"[Review #{review_id}] Starting analysis of {repo}#{pr_number}")

        gh = GitHubClient()

        # Fetch PR metadata (for title, author, etc. if not already set)
        try:
            pr_data = gh.get_pull_request(repo, pr_number)
            pr_title = pr_data.get("title", "")
            head_sha = pr_data.get("head", {}).get("sha", "")
        except Exception as e:
            logger.warning(f"Could not fetch PR metadata: {e}")
            pr_title = ""
            head_sha = ""

        # Fetch changed files
        files_data = gh.get_pull_request_files(repo, pr_number)
        if not files_data:
            db.complete_review(review_id, 100, "No files to review.", 0, 0, "[]")
            return

        # Parse diffs
        diff_files = parse_github_files(files_data)
        if not diff_files:
            db.complete_review(
                review_id, 100, "No reviewable files found.", 0, 0, "[]"
            )
            return

        # Run AI analysis
        analyzer = Analyzer()
        result = analyzer.analyze_pr(diff_files, repo, pr_title)

        # Post review to GitHub
        try:
            summary_body = format_summary_comment(result)
            inline_comments = build_review_comments(result.findings)

            # Determine review event type
            has_critical = any(
                f.severity.value in ("critical", "high")
                for f in result.findings
            )
            event = "REQUEST_CHANGES" if has_critical else "COMMENT"

            if inline_comments:
                try:
                    gh.create_review(
                        repo, pr_number, summary_body, head_sha, event, inline_comments
                    )
                except Exception as e:
                    # If self-review changes request is blocked, fallback to COMMENT
                    if "own pull request" in str(e) or "422" in str(e):
                        logger.warning("Self-review detected. Falling back to COMMENT review event.")
                        gh.create_review(
                            repo, pr_number, summary_body, head_sha, "COMMENT", inline_comments
                        )
                    else:
                        raise e
            else:
                gh.post_comment(repo, pr_number, summary_body)

            logger.info(
                f"[Review #{review_id}] Posted review with "
                f"{len(inline_comments)} inline comment(s)"
            )
        except Exception as e:
            logger.error(f"[Review #{review_id}] Failed to post review: {e}")

        # Save results to database
        findings_json = json.dumps([f.to_dict() for f in result.findings])
        db.complete_review(
            review_id,
            result.score,
            result.summary,
            result.files_analyzed,
            len(result.findings),
            findings_json,
        )

        logger.info(
            f"[Review #{review_id}] Complete — "
            f"score={result.score}, findings={len(result.findings)}"
        )

    except Exception as e:
        logger.exception(f"[Review #{review_id}] Pipeline error: {e}")
        db.update_review_status(review_id, "error", str(e))


def _run_gitlab_review(review_id: int, project_id: int, mr_iid: int,
                       repo_name: str):
    """Full GitLab MR review pipeline — runs in a background thread."""
    try:
        db.update_review_status(review_id, "analyzing")
        logger.info(f"[Review #{review_id}] Starting GitLab MR analysis")

        gl = GitLabClient()

        # Fetch MR changes
        changes = gl.get_merge_request_changes(project_id, mr_iid)
        if not changes:
            db.complete_review(review_id, 100, "No files to review.", 0, 0, "[]")
            return

        # Convert GitLab changes to DiffFile objects
        diff_files = []
        for change in changes:
            filename = change.get("new_path", "")
            patch = change.get("diff", "")
            if patch and filename:
                from app.diff_parser import parse_patch, should_skip_file
                if not should_skip_file(filename):
                    df = parse_patch(patch, filename)
                    diff_files.append(df)

        if not diff_files:
            db.complete_review(
                review_id, 100, "No reviewable files found.", 0, 0, "[]"
            )
            return

        # Run AI analysis
        analyzer = Analyzer()
        mr_data = gl.get_merge_request(project_id, mr_iid)
        mr_title = mr_data.get("title", "")
        result = analyzer.analyze_pr(diff_files, repo_name, mr_title)

        # Post summary comment
        try:
            summary_body = format_summary_comment(result)
            gl.post_mr_note(project_id, mr_iid, summary_body)
            logger.info(f"[Review #{review_id}] Posted MR summary")
        except Exception as e:
            logger.error(f"[Review #{review_id}] Failed to post MR note: {e}")

        # Save results
        findings_json = json.dumps([f.to_dict() for f in result.findings])
        db.complete_review(
            review_id,
            result.score,
            result.summary,
            result.files_analyzed,
            len(result.findings),
            findings_json,
        )

    except Exception as e:
        logger.exception(f"[Review #{review_id}] GitLab pipeline error: {e}")
        db.update_review_status(review_id, "error", str(e))


# ──────────────────────────────────────
#  Helpers
# ──────────────────────────────────────

def _parse_pr_url(url: str):
    """
    Parse a GitHub PR URL into (repo, pr_number).

    Supports: https://github.com/owner/repo/pull/123
    """
    import re
    match = re.match(
        r"https?://github\.com/([^/]+/[^/]+)/pull/(\d+)", url
    )
    if match:
        return match.group(1), int(match.group(2))
    return None


# ──────────────────────────────────────
#  Entry Point
# ──────────────────────────────────────

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("  🤖 AI Code Review Agent")
    logger.info("=" * 60)
    logger.info(f"  Dashboard:  http://localhost:{Config.PORT}")
    logger.info(f"  Webhook:    http://localhost:{Config.PORT}/webhook")
    logger.info(f"  GitHub:     {'✅ configured' if Config.GITHUB_TOKEN else '❌ not set'}")
    logger.info(f"  GitLab:     {'✅ configured' if Config.GITLAB_TOKEN else '❌ not set'}")
    logger.info(f"  Gemini AI:  {'✅ configured' if Config.GEMINI_API_KEY else '❌ not set'}")
    logger.info("=" * 60)

    app.run(
        host="0.0.0.0",
        port=Config.PORT,
        debug=Config.DEBUG,
    )
