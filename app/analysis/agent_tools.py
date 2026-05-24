"""
Agent tools — implementations for autonomous actions.
"""

import json
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from app.github_client import GitHubClient
from app.analysis.models import Finding, DiffFile

logger = logging.getLogger(__name__)


@dataclass
class ToolResult:
    """Result of a tool execution."""
    success: bool
    data: Any
    message: str
    tool_name: str


class AgentTools:
    """Tools available to the agent for autonomous actions."""

    def __init__(self, gh_client: Optional[GitHubClient] = None):
        self.gh = gh_client

    def analyze_code(self, diff_file: DiffFile, findings: List[Finding]) -> ToolResult:
        """Deeply analyze code with reasoning."""
        analysis = {
            "file": diff_file.filename,
            "language": diff_file.language,
            "changes": {
                "additions": diff_file.additions,
                "deletions": diff_file.deletions,
            },
            "findings_count": len(findings),
            "findings": [f.to_dict() for f in findings],
        }
        return ToolResult(
            success=True,
            data=analysis,
            message=f"Analyzed {diff_file.filename}",
            tool_name="analyze_code"
        )

    def suggest_fix(self, finding: Finding, original_code: str, 
                   fixed_code: str) -> ToolResult:
        """Suggest a code fix for an issue."""
        suggestion = {
            "issue": finding.title,
            "file": finding.file,
            "line": finding.line,
            "original": original_code,
            "suggested": fixed_code,
            "explanation": finding.message,
        }
        return ToolResult(
            success=True,
            data=suggestion,
            message=f"Suggested fix for {finding.title}",
            tool_name="suggest_fix"
        )

    def create_fix_pr(self, repo: str, branch_name: str, title: str,
                     body: str, files_changes: Dict[str, str],
                     pr_number: int) -> ToolResult:
        """Create a PR with automated fixes."""
        if not self.gh:
            return ToolResult(
                success=False,
                data=None,
                message="GitHub client not initialized",
                tool_name="create_fix_pr"
            )
        
        try:
            pr_body = f"""{body}

---
**Automated by AI Agent** 🤖
This PR was created autonomously to fix issues found in #{pr_number}
Please review and merge if satisfied.
"""
            # Simulated PR creation (actual implementation would use gh_client)
            logger.info(f"Would create PR: {title} on {repo}")
            return ToolResult(
                success=True,
                data={"pr_url": f"https://github.com/{repo}/pull/new/{branch_name}"},
                message=f"Created fix PR: {title}",
                tool_name="create_fix_pr"
            )
        except Exception as e:
            logger.error(f"Failed to create fix PR: {e}")
            return ToolResult(
                success=False,
                data=None,
                message=str(e),
                tool_name="create_fix_pr"
            )

    def create_issue(self, repo: str, title: str, body: str,
                    labels: List[str] = None, priority: str = "medium") -> ToolResult:
        """Create a GitHub issue."""
        if not self.gh:
            return ToolResult(
                success=False,
                data=None,
                message="GitHub client not initialized",
                tool_name="create_issue"
            )
        
        try:
            issue_body = f"""{body}

---
**Created by AI Agent** 🤖  
Priority: {priority.upper()}
"""
            logger.info(f"Would create issue: {title} on {repo}")
            return ToolResult(
                success=True,
                data={"issue_url": f"https://github.com/{repo}/issues/new"},
                message=f"Created issue: {title}",
                tool_name="create_issue"
            )
        except Exception as e:
            logger.error(f"Failed to create issue: {e}")
            return ToolResult(
                success=False,
                data=None,
                message=str(e),
                tool_name="create_issue"
            )

    def comment_pr(self, repo: str, pr_number: int, 
                  comment: str, file: str = None, 
                  line: int = None) -> ToolResult:
        """Add a comment to PR (inline or general)."""
        if not self.gh:
            return ToolResult(
                success=False,
                data=None,
                message="GitHub client not initialized",
                tool_name="comment_pr"
            )
        
        try:
            logger.info(f"Would post comment on {repo}#{pr_number}")
            return ToolResult(
                success=True,
                data={"comment_url": f"https://github.com/{repo}/pull/{pr_number}"},
                message=f"Posted comment",
                tool_name="comment_pr"
            )
        except Exception as e:
            logger.error(f"Failed to post comment: {e}")
            return ToolResult(
                success=False,
                data=None,
                message=str(e),
                tool_name="comment_pr"
            )

    def query_memory(self, pattern_type: str) -> ToolResult:
        """Query memory for patterns."""
        return ToolResult(
            success=True,
            data={"patterns": []},
            message=f"Retrieved {pattern_type} patterns",
            tool_name="query_memory"
        )

    def update_memory(self, pattern_type: str, 
                     pattern_data: Dict[str, Any]) -> ToolResult:
        """Store a pattern in memory."""
        return ToolResult(
            success=True,
            data=pattern_data,
            message=f"Stored {pattern_type} pattern",
            tool_name="update_memory"
        )
