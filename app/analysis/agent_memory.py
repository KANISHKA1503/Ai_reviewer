"""
Agent memory system — stores patterns and learning across PRs.
"""

import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import os

logger = logging.getLogger(__name__)


class AgentMemory:
    """Manages agent memory across PRs."""

    def __init__(self, memory_dir: str = "agent_memory"):
        self.memory_dir = memory_dir
        os.makedirs(memory_dir, exist_ok=True)
        
        self.pattern_memory_file = os.path.join(memory_dir, "patterns.json")
        self.learning_memory_file = os.path.join(memory_dir, "learning.json")
        self.team_memory_file = os.path.join(memory_dir, "team.json")
        
        self._load_all_memory()

    def _load_all_memory(self):
        """Load memory from disk."""
        self.patterns = self._load_file(self.pattern_memory_file, {})
        self.learning = self._load_file(self.learning_memory_file, {})
        self.team_info = self._load_file(self.team_memory_file, {})
        logger.info("Agent memory loaded")

    def _load_file(self, filepath: str, default: Any) -> Any:
        """Load JSON file or return default."""
        try:
            if os.path.exists(filepath):
                with open(filepath, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Error loading {filepath}: {e}")
        return default

    def _save_file(self, filepath: str, data: Any):
        """Save data to JSON file."""
        try:
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving {filepath}: {e}")

    def add_pattern(self, pattern_type: str, pattern: str, 
                   frequency: str = "first", recommendation: str = ""):
        """Store a code pattern."""
        key = f"{pattern_type}:{pattern}"
        if key not in self.patterns:
            self.patterns[key] = {
                "type": pattern_type,
                "pattern": pattern,
                "frequency": frequency,
                "recommendation": recommendation,
                "first_seen": datetime.now().isoformat(),
                "count": 0
            }
        
        self.patterns[key]["count"] += 1
        self.patterns[key]["last_seen"] = datetime.now().isoformat()
        self._save_file(self.pattern_memory_file, self.patterns)
        logger.debug(f"Pattern stored: {key}")

    def get_patterns(self, pattern_type: Optional[str] = None) -> List[Dict]:
        """Retrieve patterns, optionally filtered by type."""
        if pattern_type:
            return [p for p in self.patterns.values() 
                   if p["type"] == pattern_type]
        return list(self.patterns.values())

    def add_learning(self, pr_number: int, action_taken: str, 
                    feedback_received: str, success: bool):
        """Store learning from PR feedback."""
        key = f"pr_{pr_number}"
        self.learning[key] = {
            "pr_number": pr_number,
            "action": action_taken,
            "feedback": feedback_received,
            "success": success,
            "learned_at": datetime.now().isoformat(),
        }
        self._save_file(self.learning_memory_file, self.learning)
        logger.info(f"Learning stored for PR #{pr_number}")

    def get_learning_patterns(self) -> List[Dict]:
        """Get what worked and what didn't."""
        return list(self.learning.values())

    def set_team_preference(self, key: str, value: Any):
        """Store team preferences and practices."""
        self.team_info[key] = {
            "value": value,
            "set_at": datetime.now().isoformat(),
        }
        self._save_file(self.team_memory_file, self.team_info)

    def get_team_preferences(self) -> Dict[str, Any]:
        """Get team practices and preferences."""
        return {k: v["value"] for k, v in self.team_info.items()}

    def get_context_for_pr(self, repo: str) -> Dict[str, Any]:
        """Get relevant context for analyzing a PR."""
        return {
            "patterns": self.get_patterns()[:5],  # Top 5
            "learning": self.get_learning_patterns()[:5],
            "team_preferences": self.get_team_preferences(),
        }
