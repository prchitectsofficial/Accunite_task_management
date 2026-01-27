"""
Keyword tracking for DM conversations.

Counts occurrences of specified keywords (case-insensitive).
"""

import re
from typing import NamedTuple


class KeywordCount(NamedTuple):
    """Result of keyword counting."""
    keyword: str
    count: int
    occurrences: list[dict]  # Details about where each occurrence was found


class KeywordTracker:
    """
    Tracks keyword occurrences across messages.
    
    Features:
    - Case-insensitive matching by default
    - Counts ALL occurrences including repeats
    - Supports word boundary matching to avoid partial matches
    """
    
    # Default keywords to track
    DEFAULT_KEYWORDS = ["Garima", "PRchitects"]
    
    def __init__(
        self,
        keywords: list[str] | None = None,
        case_sensitive: bool = False,
        word_boundary: bool = True
    ):
        """
        Initialize the keyword tracker.
        
        Args:
            keywords: List of keywords to track
            case_sensitive: Whether matching should be case-sensitive
            word_boundary: Whether to use word boundaries in matching
        """
        self.keywords = keywords or self.DEFAULT_KEYWORDS
        self.case_sensitive = case_sensitive
        self.word_boundary = word_boundary
        
        # Pre-compile regex patterns
        flags = 0 if case_sensitive else re.IGNORECASE
        self._patterns = {}
        for keyword in self.keywords:
            # Escape special regex characters in keyword
            escaped = re.escape(keyword)
            if word_boundary:
                # Use word boundaries to avoid partial matches
                # \b matches word boundaries
                pattern = rf"\b{escaped}\b"
            else:
                pattern = escaped
            self._patterns[keyword] = re.compile(pattern, flags)
    
    def count_in_text(self, text: str, keyword: str) -> int:
        """
        Count occurrences of a keyword in a single text.
        
        Args:
            text: The text to search
            keyword: The keyword to count
            
        Returns:
            Number of occurrences
        """
        if keyword not in self._patterns:
            # Create pattern on the fly if keyword wasn't pre-configured
            flags = 0 if self.case_sensitive else re.IGNORECASE
            escaped = re.escape(keyword)
            pattern = rf"\b{escaped}\b" if self.word_boundary else escaped
            pattern_compiled = re.compile(pattern, flags)
        else:
            pattern_compiled = self._patterns[keyword]
        
        return len(pattern_compiled.findall(text))
    
    def count_in_messages(self, messages: list[str], keyword: str) -> KeywordCount:
        """
        Count occurrences of a keyword across multiple messages.
        
        Args:
            messages: List of message texts
            keyword: The keyword to count
            
        Returns:
            KeywordCount with total count and occurrence details
        """
        total_count = 0
        occurrences = []
        
        for idx, text in enumerate(messages):
            count = self.count_in_text(text, keyword)
            if count > 0:
                total_count += count
                occurrences.append({
                    "message_index": idx,
                    "count": count,
                    "text_preview": text[:100] + "..." if len(text) > 100 else text
                })
        
        return KeywordCount(
            keyword=keyword,
            count=total_count,
            occurrences=occurrences
        )
    
    def count_all_keywords(self, messages: list[str]) -> dict[str, int]:
        """
        Count all configured keywords across messages.
        
        Args:
            messages: List of message texts
            
        Returns:
            Dictionary mapping keyword to count
        """
        return {
            keyword: self.count_in_messages(messages, keyword).count
            for keyword in self.keywords
        }
    
    def count_garima(self, messages: list[str]) -> int:
        """
        Count occurrences of "Garima" keyword.
        
        Args:
            messages: List of message texts
            
        Returns:
            Count of Garima occurrences
        """
        return self.count_in_messages(messages, "Garima").count
    
    def count_prchitects(self, messages: list[str]) -> int:
        """
        Count occurrences of "PRchitects" keyword.
        
        Args:
            messages: List of message texts
            
        Returns:
            Count of PRchitects occurrences
        """
        return self.count_in_messages(messages, "PRchitects").count
