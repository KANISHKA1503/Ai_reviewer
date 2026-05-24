"""
Core agent loop — implements ReAct reasoning for autonomous code review.
"""

import json
import logging
from typing import List, Dict, Any, Optional

from google import genai
from google.genai import types

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), ".."))

from config import Config
from app.analysis.models import DiffFile, Finding, ReviewResult
from app.analysis.ai_engine import AIEngine
from app.analysis.agent_tools import AgentTools, ToolResult
from app.analysis.agent_memory import AgentMemory
from app.analysis.agent_prompts import (
    AGENT_SYSTEM_PROMPT,
    AGENTIC_REVIEW_PROMPT,
    DECISION_PROMPT,
)

logger = logging.getLogger(__name__)


class CodeReviewAgent:
    """Autonomous AI Code Review Agent using ReAct pattern."""

    def __init__(self, gh_client=None):
        self.ai_engine = AIEngine()
        self.gh_client = gh_client
        self.tools = AgentTools(gh_client)
        self.memory = AgentMemory()
        self.max_iterations = 3
        self.iteration_count = 0

    def analyze_pr_autonomously(
        self,
        diff_files: List[DiffFile],
        repo_name: str,
        pr_number: int,
        pr_title: str,
        pr_author: str
    ) -> ReviewResult:
        """
        Autonomously analyze a PR with ReAct reasoning loop.

        Process:
        1. OBSERVE: Parse code changes
        2. THINK: Analyze with AI
        3. REASON: Decide what actions to take
        4. ACT: Execute tools
        5. LEARN: Update memory
        """
        logger.info(f"🤖 Starting autonomous agent analysis for PR #{pr_number}")
        self.iteration_count = 0

        # Step 1: Initial analysis
        findings = self._analyze_all_files(diff_files, repo_name, pr_title)
        
        # Step 2: Get memory context
        memory_context = self.memory.get_context_for_pr(repo_name)
        
        # Step 3: ReAct reasoning loop
        actions_log = []
        while self.iteration_count < self.max_iterations:
            self.iteration_count += 1
            logger.info(f"Agent iteration {self.iteration_count}/{self.max_iterations}")
            
            # THINK & REASON
            reasoning = self._reason_about_actions(
                findings, memory_context, repo_name, pr_title
            )
            
            if not reasoning.get("should_continue", False):
                logger.info("Agent decided to stop reasoning")
                break
                
            # ACT
            action_results = self._execute_actions(
                reasoning.get("actions", []),
                repo_name, pr_number, pr_author, findings
            )
            actions_log.extend(action_results)
            
            # LEARN
            self._learn_from_findings(findings, repo_name)

        # Create final review result
        result = ReviewResult(
            files_analyzed=len(diff_files),
            total_additions=sum(f.additions for f in diff_files),
            total_deletions=sum(f.deletions for f in diff_files),
            findings=findings,
        )
        result.sort_findings()
        result.calculate_score()

        # Generate summary
        result.summary = self._generate_smart_summary(
            findings, repo_name, pr_title, actions_log
        )

        logger.info(f"✅ Autonomous analysis complete: {len(findings)} findings, "
                   f"{len(actions_log)} actions taken")
        return result

    def _analyze_all_files(
        self, diff_files: List[DiffFile], 
        repo_name: str, pr_title: str
    ) -> List[Finding]:
        """Analyze all files in the PR."""
        all_findings = []
        for diff_file in diff_files:
            logger.debug(f"Analyzing: {diff_file.filename}")
            file_findings = self.ai_engine.analyze_file(
                diff_file, repo_name, pr_title
            )
            all_findings.extend(file_findings)
        return all_findings

    def _reason_about_actions(
        self, findings: List[Finding],
        memory_context: Dict,
        repo_name: str,
        pr_title: str
    ) -> Dict[str, Any]:
        """Reasoning phase - decide what actions to take."""
        if not self.ai_engine.client:
            return {"should_continue": False}

        # Group findings by severity
        critical = [f for f in findings if f.severity.value == "critical"]
        major = [f for f in findings if f.severity.value == "major"]

        patterns_json = json.dumps([p['pattern'] for p in memory_context.get('patterns', [])])
        
        reasoning_prompt = f"""Current analysis state:
- Critical issues: {len(critical)}
- Major issues: {len(major)}
- Total findings: {len(findings)}
- Iteration: {self.iteration_count}/{self.max_iterations}

Recent patterns from memory: {patterns_json}

Decide:
1. Should we create fix PRs?
2. Should we create issues?
3. What patterns to remember?
4. Continue reasoning?

Respond in JSON with format:
{{"should_continue": true/false, "actions": [{{"type": "create_issue", "for_finding": "..."}}]}}"""

        try:
            response = self.ai_engine._call_with_retry(reasoning_prompt)
            result = json.loads(response)
            return result
        except Exception as e:
            logger.warning(f"Reasoning failed: {e}, stopping iteration")
            return {"should_continue": False}

    def _execute_actions(
        self, actions: List[Dict],
        repo_name: str,
        pr_number: int,
        pr_author: str,
        findings: List[Finding]
    ) -> List[ToolResult]:
        """Execute phase - perform the decided actions."""
        results = []
        for action in actions:
            action_type = action.get("type")
            logger.info(f"Executing action: {action_type}")
            
            if action_type == "create_issue":
                finding_desc = action.get("for_finding", "Code improvement")
                result = self.tools.create_issue(
                    repo=repo_name,
                    title=f"Code improvement: {finding_desc[:60]}",
                    body="Review suggested improvement",
                    labels=["ai-generated", "code-review"]
                )
                results.append(result)
                
            elif action_type == "store_pattern":
                pattern = action.get("pattern", "")
                if pattern:
                    self.memory.add_pattern(
                        pattern_type="code_issue",
                        pattern=pattern
                    )

        return results

    def _learn_from_findings(self, findings: List[Finding], repo_name: str):
        """Learning phase - extract and store patterns."""
        patterns_found = {}
        
        for finding in findings:
            category = finding.category.value
            if category not in patterns_found:
                patterns_found[category] = 0
            patterns_found[category] += 1
            
            # Store pattern
            self.memory.add_pattern(
                pattern_type=category,
                pattern=finding.title,
                recommendation=finding.message
            )

        if patterns_found:
            logger.info(f"Learned patterns: {patterns_found}")

    def _generate_smart_summary(
        self, findings: List[Finding],
        repo_name: str, pr_title: str,
        actions_log: List[ToolResult]
    ) -> str:
        """Generate summary including autonomous actions taken."""
        summary_parts = []

        # What we found
        if findings:
            critical = len([f for f in findings if f.severity.value == "critical"])
            major = len([f for f in findings if f.severity.value == "major"])
            summary_parts.append(
                f"**AI Analysis:** Found {critical} critical and {major} major issues."
            )

        # What we did
        successful_actions = [a for a in actions_log if a.success]
        if successful_actions:
            summary_parts.append("**Autonomous Actions Taken:**")
            for action in successful_actions:
                summary_parts.append(f"- {action.message}")

        # Recommendations
        summary_parts.append("**Recommendations:**")
        summary_parts.append("1. Review the suggested fixes in the created issues")
        summary_parts.append("2. Discuss any concerns with the team")
        summary_parts.append("3. Merge when ready")

        return "\n\n".join(summary_parts) if summary_parts else "Code review complete"
