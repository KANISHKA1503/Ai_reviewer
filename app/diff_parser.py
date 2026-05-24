"""
Unified diff parser — converts raw patches into structured DiffFile/DiffHunk objects.
"""

import re
import os
from typing import List, Optional

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import Config
from app.analysis.models import DiffFile, DiffHunk


# Regex for unified diff hunk headers: @@ -old_start,old_count +new_start,new_count @@
HUNK_HEADER_RE = re.compile(
    r"^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)?$"
)


def detect_language(filename: str) -> str:
    """Detect programming language from file extension."""
    ext = os.path.splitext(filename)[1].lower()
    return Config.EXTENSION_TO_LANGUAGE.get(ext, "unknown")


def should_skip_file(filename: str) -> bool:
    """Check if a file should be skipped from analysis."""
    # Skip by pattern
    for pattern in Config.SKIP_PATTERNS:
        if pattern in filename:
            return True

    # Skip unsupported extensions
    ext = os.path.splitext(filename)[1].lower()
    if ext and ext not in Config.SUPPORTED_EXTENSIONS:
        return True

    return False


def parse_patch(patch: str, filename: str) -> DiffFile:
    """
    Parse a single file's patch (unified diff) into a DiffFile object.

    Args:
        patch: The raw unified diff string for a single file.
        filename: The filename this patch applies to.

    Returns:
        A DiffFile with parsed hunks.
    """
    diff_file = DiffFile(
        filename=filename,
        language=detect_language(filename),
        patch=patch,
    )

    if not patch:
        return diff_file

    lines = patch.split("\n")
    current_hunk: Optional[DiffHunk] = None

    for line in lines:
        hunk_match = HUNK_HEADER_RE.match(line)
        if hunk_match:
            # Save any existing hunk
            if current_hunk is not None:
                diff_file.hunks.append(current_hunk)

            old_start = int(hunk_match.group(1))
            old_count = int(hunk_match.group(2)) if hunk_match.group(2) else 1
            new_start = int(hunk_match.group(3))
            new_count = int(hunk_match.group(4)) if hunk_match.group(4) else 1
            header = hunk_match.group(5) or ""

            current_hunk = DiffHunk(
                old_start=old_start,
                old_count=old_count,
                new_start=new_start,
                new_count=new_count,
                header=header.strip(),
            )
        elif current_hunk is not None:
            current_hunk.lines.append(line)
            if line.startswith("+"):
                diff_file.additions += 1
            elif line.startswith("-"):
                diff_file.deletions += 1

    # Don't forget the last hunk
    if current_hunk is not None:
        diff_file.hunks.append(current_hunk)

    return diff_file


def parse_github_files(files_data: list) -> List[DiffFile]:
    """
    Parse the GitHub API response for PR files into DiffFile objects.

    Args:
        files_data: List of file objects from GitHub's
                    GET /repos/{owner}/{repo}/pulls/{pr}/files

    Returns:
        List of DiffFile objects, filtered to only analyzable files.
    """
    diff_files = []

    for file_info in files_data:
        filename = file_info.get("filename", "")

        if should_skip_file(filename):
            continue

        patch = file_info.get("patch", "")
        if not patch:
            continue

        diff_file = parse_patch(patch, filename)
        diff_file.status = file_info.get("status", "modified")
        diff_file.old_filename = file_info.get("previous_filename")
        diff_file.additions = file_info.get("additions", diff_file.additions)
        diff_file.deletions = file_info.get("deletions", diff_file.deletions)

        diff_files.append(diff_file)

    return diff_files[:Config.MAX_FILES_PER_PR]


def compute_diff_position(diff_file: DiffFile, target_line: int) -> Optional[int]:
    """
    Compute the diff position for a target line number in the new file.

    GitHub's review comment API requires a 'position' which is the line index
    within the diff (patch), not the file line number. This function maps
    a file line number to the corresponding diff position.

    Args:
        diff_file: The parsed DiffFile.
        target_line: The line number in the new version of the file.

    Returns:
        The diff position (1-indexed), or None if the line isn't in the diff.
    """
    position = 0

    for hunk in diff_file.hunks:
        position += 1  # Hunk header counts as a position
        current_new_line = hunk.new_start

        for line in hunk.lines:
            position += 1

            if line.startswith("-"):
                # Deleted line — doesn't correspond to a new file line
                continue
            elif line.startswith("+"):
                if current_new_line == target_line:
                    return position
                current_new_line += 1
            else:
                # Context line
                if current_new_line == target_line:
                    return position
                current_new_line += 1

    return None
