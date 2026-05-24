"""
Analysis orchestrator — coordinates diff parsing, AI analysis, and result aggregation.
"""

import logging
from typing import List

from app.analysis.models import DiffFile, Finding, ReviewResult
from app.analysis.ai_engine import AIEngine

logger = logging.getLogger(__name__)


class Analyzer:
    """Orchestrates the full code review analysis pipeline."""

    def __init__(self):
        self.ai_engine = AIEngine()

    def analyze_pr(self, diff_files: List[DiffFile], repo_name: str = "",
                   pr_title: str = "") -> ReviewResult:
        """
        Run full analysis on a list of diff files from a PR.

        Args:
            diff_files: Parsed diff files from the PR.
            repo_name: Full repository name (e.g., 'owner/repo').
            pr_title: Title of the pull request.

        Returns:
            A ReviewResult with all findings, summary, and score.
        """
        result = ReviewResult(
            files_analyzed=len(diff_files),
            total_additions=sum(f.additions for f in diff_files),
            total_deletions=sum(f.deletions for f in diff_files),
        )

        all_findings: List[Finding] = []

        for diff_file in diff_files:
            logger.info(f"Analyzing: {diff_file.filename} ({diff_file.language})")

            file_findings = self.ai_engine.analyze_file(
                diff_file, repo_name, pr_title
            )
            all_findings.extend(file_findings)

        # Deduplicate findings (same file + line + category)
        result.findings = self._deduplicate(all_findings)

        # Sort by severity
        result.sort_findings()

        # Calculate score
        result.calculate_score()

        # Generate summary
        result.summary = self.ai_engine.generate_summary(
            result.findings,
            repo_name,
            pr_title,
            result.files_analyzed,
            result.total_additions,
            result.total_deletions,
        )

        logger.info(
            f"Analysis complete: {len(result.findings)} findings, "
            f"score={result.score}/100"
        )

        return result

    def _deduplicate(self, findings: List[Finding]) -> List[Finding]:
        """Remove duplicate findings based on file + line + category."""
        seen = set()
        unique = []

        for f in findings:
            key = (f.file, f.line, f.category.value, f.title)
            if key not in seen:
                seen.add(key)
                unique.append(f)

        deduped_count = len(findings) - len(unique)
        if deduped_count > 0:
            logger.info(f"Deduplicated {deduped_count} finding(s)")

        return unique
