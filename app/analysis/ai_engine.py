"""
AI engine — integrates with Google Gemini for intelligent code analysis.
Uses the modern google-genai SDK.
"""

import json
import logging
import time
from typing import List, Optional

from google import genai
from google.genai import types

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), ".."))
from config import Config
from app.analysis.models import Finding, Severity, Category, DiffFile
from app.analysis.prompts import SYSTEM_PROMPT, REVIEW_PROMPT_TEMPLATE, SUMMARY_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)


class AIEngine:
    """Gemini-powered code analysis engine."""

    def __init__(self):
        api_key = Config.GEMINI_API_KEY
        if not api_key:
            logger.warning("GEMINI_API_KEY not set — AI analysis will be unavailable")
            self.client = None
            return

        self.client = genai.Client(api_key=api_key)
        self.model_name = Config.GEMINI_MODEL
        logger.info(f"AI Engine initialized with model: {self.model_name}")

    def analyze_file(self, diff_file: DiffFile, repo_name: str = "",
                     pr_title: str = "") -> List[Finding]:
        """
        Analyze a single file's diff using Gemini.

        Returns a list of findings for the file.
        """
        if self.client is None:
            logger.warning("AI client not available, skipping analysis")
            return []

        if not diff_file.patch or not diff_file.patch.strip():
            return []

        prompt = REVIEW_PROMPT_TEMPLATE.format(
            repo_name=repo_name or "unknown",
            pr_title=pr_title or "Untitled PR",
            filename=diff_file.filename,
            language=diff_file.language,
            patch=diff_file.patch[:8000],  # Truncate very large patches
        )

        try:
            response = self._call_with_retry(prompt)
            findings = self._parse_findings(response, diff_file.filename)
            logger.info(
                f"Analyzed {diff_file.filename}: {len(findings)} finding(s)"
            )
            return findings

        except Exception as e:
            logger.error(f"Error analyzing {diff_file.filename}: {e}")
            raise e

    def generate_summary(self, findings: List[Finding], repo_name: str,
                         pr_title: str, files_analyzed: int,
                         total_additions: int, total_deletions: int) -> str:
        """Generate a human-readable review summary."""
        if self.client is None:
            return self._fallback_summary(findings)

        # Build findings text
        findings_text = ""
        if findings:
            for i, f in enumerate(findings, 1):
                findings_text += (
                    f"{i}. [{f.severity.value.upper()}] [{f.category.value}] "
                    f"{f.file}:{f.line} — {f.title}\n"
                    f"   {f.message}\n\n"
                )
        else:
            findings_text = "No issues found. The code changes look clean."

        prompt = SUMMARY_PROMPT_TEMPLATE.format(
            repo_name=repo_name,
            pr_title=pr_title,
            files_analyzed=files_analyzed,
            total_additions=total_additions,
            total_deletions=total_deletions,
            findings_text=findings_text,
        )

        try:
            response = self._call_with_retry(prompt)
            return response.strip()
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            return self._fallback_summary(findings)

    def _call_with_retry(self, prompt: str, max_retries: int = 3) -> str:
        """Call Gemini API with exponential backoff retry."""
        for attempt in range(max_retries):
            try:
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        temperature=0.1,
                        top_p=0.95,
                        max_output_tokens=4096,
                    ),
                )
                if response and response.text:
                    return response.text
                raise ValueError("Empty response from Gemini")
            except Exception as e:
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) + 1
                    logger.warning(
                        f"Gemini API attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {wait_time}s..."
                    )
                    time.sleep(wait_time)
                else:
                    raise

    def _parse_findings(self, response_text: str,
                        filename: str) -> List[Finding]:
        """Parse the AI response into Finding objects."""
        # Clean the response — strip markdown code fences if present
        text = response_text.strip()
        if text.startswith("```"):
            # Remove opening fence (```json or ```)
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # Try to extract JSON array from the response
            start = text.find("[")
            end = text.rfind("]")
            if start != -1 and end != -1:
                try:
                    data = json.loads(text[start : end + 1])
                except json.JSONDecodeError:
                    logger.warning(f"Could not parse AI response for {filename}")
                    return []
            else:
                logger.warning(f"No JSON array found in AI response for {filename}")
                return []

        if not isinstance(data, list):
            logger.warning(f"AI response is not a list for {filename}")
            return []

        findings = []
        for item in data:
            try:
                finding = Finding(
                    file=filename,
                    line=int(item.get("line", 0)),
                    severity=Severity(item.get("severity", "info")),
                    category=Category(item.get("category", "best_practice")),
                    title=str(item.get("title", ""))[:100],
                    message=str(item.get("message", "")),
                    suggestion=item.get("suggestion"),
                )
                findings.append(finding)
            except (ValueError, KeyError) as e:
                logger.warning(f"Skipping malformed finding: {e}")
                continue

        return findings

    def _fallback_summary(self, findings: List[Finding]) -> str:
        """Generate a simple summary when AI is unavailable."""
        if not findings:
            return "No issues found. The code changes look clean and ready to merge."

        critical = sum(1 for f in findings if f.severity == Severity.CRITICAL)
        high = sum(1 for f in findings if f.severity == Severity.HIGH)
        medium = sum(1 for f in findings if f.severity == Severity.MEDIUM)
        low = sum(1 for f in findings if f.severity == Severity.LOW)

        parts = []
        if critical:
            parts.append(f"{critical} critical")
        if high:
            parts.append(f"{high} high")
        if medium:
            parts.append(f"{medium} medium")
        if low:
            parts.append(f"{low} low")

        severity_text = ", ".join(parts) if parts else "minor"
        return (
            f"Found {len(findings)} issue(s) ({severity_text} severity). "
            f"Please review the findings and address them before merging."
        )
