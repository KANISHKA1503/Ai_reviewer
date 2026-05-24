"""
Comment formatter — turns structured findings into beautiful markdown comments
for GitHub/GitLab pull requests.
"""

from typing import List
from app.analysis.models import Finding, ReviewResult, Severity, Category


# Emoji mappings
SEVERITY_BADGE = {
    Severity.CRITICAL: "🔴 **CRITICAL**",
    Severity.HIGH: "🟠 **HIGH**",
    Severity.MEDIUM: "🟡 **MEDIUM**",
    Severity.LOW: "🔵 **LOW**",
    Severity.INFO: "⚪ **INFO**",
}

CATEGORY_ICON = {
    Category.BUG: "🐛",
    Category.SECURITY: "🔒",
    Category.PERFORMANCE: "⚡",
    Category.CODE_SMELL: "🧹",
    Category.STYLE: "🎨",
    Category.BEST_PRACTICE: "📘",
}

SCORE_GRADE = [
    (90, "A+", "🟢"),
    (80, "A", "🟢"),
    (70, "B", "🟡"),
    (60, "C", "🟠"),
    (40, "D", "🟠"),
    (0, "F", "🔴"),
]


def _get_grade(score: int) -> tuple:
    """Get letter grade and emoji for a score."""
    for threshold, grade, emoji in SCORE_GRADE:
        if score >= threshold:
            return grade, emoji
    return "F", "🔴"


def format_summary_comment(result: ReviewResult) -> str:
    """
    Format the full PR review summary as a GitHub/GitLab markdown comment.
    """
    grade, grade_emoji = _get_grade(result.score)

    lines = [
        "## 🤖 AI Code Review Report",
        "",
        "---",
        "",
        f"### {grade_emoji} Quality Score: **{result.score}/100** (Grade: {grade})",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| 📁 Files Analyzed | {result.files_analyzed} |",
        f"| ➕ Additions | {result.total_additions} lines |",
        f"| ➖ Deletions | {result.total_deletions} lines |",
        f"| 🔍 Total Findings | {len(result.findings)} |",
        "",
    ]

    # Severity breakdown
    stats = result.stats
    if stats.get("by_severity"):
        lines.append("### Findings by Severity")
        lines.append("")
        for sev_name, count in sorted(
            stats["by_severity"].items(),
            key=lambda x: Severity(x[0]).priority,
        ):
            badge = SEVERITY_BADGE.get(Severity(sev_name), sev_name)
            lines.append(f"- {badge}: {count}")
        lines.append("")

    # Category breakdown
    if stats.get("by_category"):
        lines.append("### Findings by Category")
        lines.append("")
        for cat_name, count in stats["by_category"].items():
            icon = CATEGORY_ICON.get(Category(cat_name), "📌")
            display_name = cat_name.replace("_", " ").title()
            lines.append(f"- {icon} {display_name}: {count}")
        lines.append("")

    # Summary text
    lines.append("### Summary")
    lines.append("")
    lines.append(result.summary)
    lines.append("")

    # Top findings preview (up to 5)
    if result.findings:
        lines.append("---")
        lines.append("")
        lines.append(
            f"### Top Findings (showing {min(5, len(result.findings))} "
            f"of {len(result.findings)})"
        )
        lines.append("")

        for finding in result.findings[:5]:
            sev = SEVERITY_BADGE.get(finding.severity, "")
            icon = CATEGORY_ICON.get(finding.category, "📌")
            lines.append(
                f"#### {icon} {sev} — {finding.title}"
            )
            lines.append(f"📍 `{finding.file}:{finding.line}`")
            lines.append("")
            lines.append(f"> {finding.message}")
            lines.append("")
            if finding.suggestion:
                lines.append(f"💡 **Suggestion:** {finding.suggestion}")
                lines.append("")

    # Footer
    lines.append("---")
    lines.append(
        "*🤖 Powered by AI Code Review Agent — "
        "automated analysis for bugs, security, performance & code quality*"
    )

    return "\n".join(lines)


def format_inline_comment(finding: Finding) -> str:
    """
    Format a single finding as an inline review comment.
    """
    sev = SEVERITY_BADGE.get(finding.severity, "")
    icon = CATEGORY_ICON.get(finding.category, "📌")
    cat_display = finding.category.value.replace("_", " ").title()

    lines = [
        f"{icon} **{cat_display}** | {sev}",
        "",
        f"**{finding.title}**",
        "",
        finding.message,
    ]

    if finding.suggestion:
        lines.append("")
        lines.append(f"💡 **Suggestion:** {finding.suggestion}")

    return "\n".join(lines)


def build_review_comments(findings: List[Finding]) -> list:
    """
    Build a list of inline comment dicts suitable for the GitHub review API.

    Args:
        findings: List of Finding objects.

    Returns:
        List of dicts with keys: path, line, side, body
    """
    comments = []
    for f in findings:
        comments.append({
            "path": f.file,
            "line": f.line,
            "side": "RIGHT",
            "body": format_inline_comment(f),
        })
    return comments
