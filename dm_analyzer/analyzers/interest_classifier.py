"""
Interest classification for DM conversations.

Determines if a recipient (brand) has shown interest in our outreach.

Rules:
- Interested = Yes: Positive intent phrases detected in recipient messages
- Interested = No: Rejection phrases detected OR no clear interest
- CRITICAL: Rejection ALWAYS overrides interest if both appear
"""

import re
from typing import NamedTuple


class ClassificationResult(NamedTuple):
    """Result of interest classification."""
    interested: bool
    has_rejection: bool
    has_positive_intent: bool
    matched_positive_phrases: list[str]
    matched_rejection_phrases: list[str]


class InterestClassifier:
    """
    Classifies recipient interest based on message content.
    
    Classification priority:
    1. Check for rejection phrases (highest priority)
    2. Check for positive intent phrases
    3. If rejection found -> Not Interested (regardless of positive phrases)
    4. If only positive intent found -> Interested
    5. Otherwise -> Not Interested (default for neutral/no response)
    """
    
    # Positive intent phrases indicating interest
    DEFAULT_POSITIVE_PHRASES = [
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
    ]
    
    # Rejection phrases indicating no interest
    DEFAULT_REJECTION_PHRASES = [
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
    ]
    
    def __init__(
        self,
        positive_phrases: list[str] | None = None,
        rejection_phrases: list[str] | None = None,
        case_sensitive: bool = False
    ):
        """
        Initialize the interest classifier.
        
        Args:
            positive_phrases: List of regex patterns for positive intent
            rejection_phrases: List of regex patterns for rejection
            case_sensitive: Whether matching should be case-sensitive
        """
        self.positive_phrases = positive_phrases or self.DEFAULT_POSITIVE_PHRASES
        self.rejection_phrases = rejection_phrases or self.DEFAULT_REJECTION_PHRASES
        self.case_sensitive = case_sensitive
        
        # Pre-compile regex patterns for performance
        flags = 0 if case_sensitive else re.IGNORECASE
        self._positive_patterns = [
            re.compile(p, flags) for p in self.positive_phrases
        ]
        self._rejection_patterns = [
            re.compile(p, flags) for p in self.rejection_phrases
        ]
    
    def classify(self, recipient_messages: list[str]) -> ClassificationResult:
        """
        Classify interest based on recipient messages.
        
        Args:
            recipient_messages: List of message texts from the recipient
            
        Returns:
            ClassificationResult with interest determination and matched phrases
        """
        matched_positive = []
        matched_rejection = []
        
        # Analyze all recipient messages
        for message_text in recipient_messages:
            # Check for positive intent
            for pattern in self._positive_patterns:
                matches = pattern.findall(message_text)
                matched_positive.extend(matches)
            
            # Check for rejection
            for pattern in self._rejection_patterns:
                matches = pattern.findall(message_text)
                matched_rejection.extend(matches)
        
        has_positive = len(matched_positive) > 0
        has_rejection = len(matched_rejection) > 0
        
        # CRITICAL: Rejection ALWAYS overrides interest
        if has_rejection:
            interested = False
        elif has_positive:
            interested = True
        else:
            # No clear signal - default to not interested
            interested = False
        
        return ClassificationResult(
            interested=interested,
            has_rejection=has_rejection,
            has_positive_intent=has_positive,
            matched_positive_phrases=matched_positive,
            matched_rejection_phrases=matched_rejection
        )
    
    def is_interested(self, recipient_messages: list[str]) -> bool:
        """
        Simple boolean check for interest.
        
        Args:
            recipient_messages: List of message texts from the recipient
            
        Returns:
            True if interested, False otherwise
        """
        return self.classify(recipient_messages).interested
    
    def get_interest_string(self, recipient_messages: list[str]) -> str:
        """
        Get interest as Yes/No string for CSV output.
        
        Args:
            recipient_messages: List of message texts from the recipient
            
        Returns:
            "Yes" if interested, "No" otherwise
        """
        return "Yes" if self.is_interested(recipient_messages) else "No"
