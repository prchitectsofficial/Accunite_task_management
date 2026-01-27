"""
Configuration settings for DM Analyzer.

All configurable parameters are centralized here for easy modification.
"""

from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class AnalyzerConfig:
    """
    Configuration for the DM Analyzer.
    
    Attributes:
        input_file: Path to input JSON file with conversations
        output_csv: Path for output CSV file
        state_db: Path for SQLite state database
        time_gap_hours: Hours gap to consider as follow-up
        keywords: Keywords to track (case-insensitive)
        positive_phrases: Phrases indicating positive interest
        rejection_phrases: Phrases indicating rejection
        batch_size: Number of conversations to process at once
        resume_enabled: Whether to enable resume functionality
    """
    # Input/Output paths
    input_file: Optional[str] = None
    output_csv: str = "dm_analysis_results.csv"
    state_db: str = "dm_analyzer_state.db"
    
    # Follow-up detection settings
    time_gap_hours: float = 24.0
    
    # Keywords to track
    keywords: list[str] = field(default_factory=lambda: ["Garima", "PRchitects"])
    
    # Interest classification - positive phrases
    positive_phrases: list[str] = field(default_factory=lambda: [
        r"share\s+details",
        r"send\s+(?:me\s+)?(?:the\s+)?(?:a\s+)?proposal",
        r"send\s+(?:me\s+)?details",
        r"pricing",
        r"email\s+us",
        r"email\s+me",
        r"let'?s\s+discuss",
        r"let'?s\s+talk",
        r"let'?s\s+connect",
        r"interested\s+in\s+(?:knowing|learning|hearing)",
        r"tell\s+(?:me|us)\s+more",
        r"would\s+(?:like|love)\s+to\s+(?:know|learn|hear|discuss)",
        r"sounds?\s+(?:good|great|interesting)",
        r"can\s+(?:you|we)\s+(?:discuss|talk|chat)",
        r"what(?:'s|\s+is|\s+are)\s+(?:your|the)\s+(?:rates?|pricing|cost|charges?)",
        r"send\s+(?:your|the)\s+(?:rates?|pricing|media\s+kit|deck)",
        r"share\s+(?:your|the)\s+(?:rates?|pricing|media\s+kit|deck)",
        r"let'?s\s+(?:set\s+up|schedule)\s+a\s+call",
        r"happy\s+to\s+(?:discuss|chat|talk)",
        r"please\s+(?:share|send)",
        r"dm\s+(?:me|us)\s+(?:the\s+)?details",
    ])
    
    # Interest classification - rejection phrases
    rejection_phrases: list[str] = field(default_factory=lambda: [
        r"not\s+interested",
        r"no\s+thanks?",
        r"no,?\s+thank\s+you",
        r"don'?t\s+contact",
        r"do\s+not\s+contact",
        r"please\s+(?:do\s+not|don'?t)\s+(?:contact|message|dm)",
        r"already\s+working\s+with",
        r"we(?:'re|\s+are)\s+(?:not\s+)?(?:currently\s+)?(?:working\s+with|partnered)",
        r"not\s+(?:looking|accepting|taking)",
        r"don'?t\s+(?:need|want|require)",
        r"pass(?:ing)?\s+(?:on\s+this|for\s+now)",
        r"we(?:'ll|\s+will)\s+pass",
        r"not\s+a\s+(?:good\s+)?fit",
        r"doesn'?t\s+(?:fit|align|match)",
        r"no\s+budget",
        r"budget\s+(?:is\s+)?(?:tight|limited|exhausted)",
        r"not\s+(?:at\s+)?this\s+time",
        r"maybe\s+(?:later|next\s+(?:time|year|quarter))",
        r"stop\s+(?:messaging|contacting|dming)",
        r"remove\s+(?:me|us)\s+from",
        r"unsubscribe",
        r"not\s+for\s+us",
    ])
    
    # Processing settings
    batch_size: int = 100
    resume_enabled: bool = True
    
    @classmethod
    def from_dict(cls, data: dict) -> "AnalyzerConfig":
        """Create config from dictionary."""
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
    
    def to_dict(self) -> dict:
        """Convert config to dictionary."""
        return {
            "input_file": self.input_file,
            "output_csv": self.output_csv,
            "state_db": self.state_db,
            "time_gap_hours": self.time_gap_hours,
            "keywords": self.keywords,
            "batch_size": self.batch_size,
            "resume_enabled": self.resume_enabled,
        }


# Default configuration instance
DEFAULT_CONFIG = AnalyzerConfig()
