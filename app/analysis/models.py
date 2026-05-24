"""
Data models for the AI Code Review Agent analysis pipeline.
"""

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import List, Optional
import json


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

    @property
    def priority(self) -> int:
        """Lower number = higher priority."""
        return {
            Severity.CRITICAL: 0,
            Severity.HIGH: 1,
            Severity.MEDIUM: 2,
            Severity.LOW: 3,
            Severity.INFO: 4,
        }[self]


class Category(str, Enum):
    BUG = "bug"
    SECURITY = "security"
    PERFORMANCE = "performance"
    CODE_SMELL = "code_smell"
    STYLE = "style"
    BEST_PRACTICE = "best_practice"


@dataclass
class DiffHunk:
    """Represents a single hunk in a unified diff."""
    old_start: int
    old_count: int
    new_start: int
    new_count: int
    lines: List[str] = field(default_factory=list)
    header: str = ""


@dataclass
class DiffFile:
    """Represents a single file's diff."""
    filename: str
    old_filename: Optional[str] = None
    status: str = "modified"  # added, modified, deleted, renamed
    language: str = "unknown"
    hunks: List[DiffHunk] = field(default_factory=list)
    patch: str = ""
    additions: int = 0
    deletions: int = 0

    @property
    def is_binary(self) -> bool:
        return "Binary files" in self.patch if self.patch else False

    def added_lines_with_numbers(self) -> List[tuple]:
        """Returns list of (line_number, line_content) for added lines."""
        result = []
        for hunk in self.hunks:
            line_num = hunk.new_start
            for line in hunk.lines:
                if line.startswith("+"):
                    result.append((line_num, line[1:]))
                    line_num += 1
                elif line.startswith("-"):
                    continue  # deleted line, don't increment new line number
                else:
                    line_num += 1
        return result


@dataclass
class Finding:
    """A single review finding."""
    file: str
    line: int
    severity: Severity
    category: Category
    title: str
    message: str
    suggestion: Optional[str] = None
    diff_position: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "file": self.file,
            "line": self.line,
            "severity": self.severity.value,
            "category": self.category.value,
            "title": self.title,
            "message": self.message,
            "suggestion": self.suggestion,
            "diff_position": self.diff_position,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Finding":
        return cls(
            file=data.get("file", ""),
            line=data.get("line", 0),
            severity=Severity(data.get("severity", "info")),
            category=Category(data.get("category", "best_practice")),
            title=data.get("title", ""),
            message=data.get("message", ""),
            suggestion=data.get("suggestion"),
            diff_position=data.get("diff_position"),
        )


@dataclass
class ReviewResult:
    """Aggregated result of a full PR review."""
    findings: List[Finding] = field(default_factory=list)
    summary: str = ""
    score: int = 100  # 0-100
    files_analyzed: int = 0
    total_additions: int = 0
    total_deletions: int = 0

    def to_dict(self) -> dict:
        return {
            "findings": [f.to_dict() for f in self.findings],
            "summary": self.summary,
            "score": self.score,
            "files_analyzed": self.files_analyzed,
            "total_additions": self.total_additions,
            "total_deletions": self.total_deletions,
            "stats": self.stats,
        }

    @property
    def stats(self) -> dict:
        """Breakdown counts by severity and category."""
        by_severity = {}
        by_category = {}
        for f in self.findings:
            by_severity[f.severity.value] = by_severity.get(f.severity.value, 0) + 1
            by_category[f.category.value] = by_category.get(f.category.value, 0) + 1
        return {"by_severity": by_severity, "by_category": by_category}

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)

    def sort_findings(self):
        """Sort findings by severity (most critical first)."""
        self.findings.sort(key=lambda f: f.severity.priority)

    def calculate_score(self):
        """Calculate a quality score based on findings."""
        if not self.findings:
            self.score = 100
            return

        penalty = 0
        for f in self.findings:
            penalties = {
                Severity.CRITICAL: 25,
                Severity.HIGH: 15,
                Severity.MEDIUM: 8,
                Severity.LOW: 3,
                Severity.INFO: 1,
            }
            penalty += penalties.get(f.severity, 1)

        self.score = max(0, 100 - penalty)
