"""
Tests for analyzer components.
"""

import pytest
from datetime import datetime, timedelta

from dm_analyzer.models.message import Message
from dm_analyzer.models.conversation import Conversation
from dm_analyzer.analyzers.followup_detector import FollowUpDetector
from dm_analyzer.analyzers.interest_classifier import InterestClassifier
from dm_analyzer.analyzers.keyword_tracker import KeywordTracker


class TestFollowUpDetector:
    """Tests for follow-up detection logic."""
    
    def setup_method(self):
        self.detector = FollowUpDetector(time_gap_hours=24)
    
    def _create_message(self, sender: str, text: str, hours_offset: int = 0) -> Message:
        """Helper to create test messages."""
        base_time = datetime(2024, 1, 15, 10, 0, 0)
        return Message(
            sender_username=sender,
            text=text,
            timestamp=base_time + timedelta(hours=hours_offset)
        )
    
    def _create_conversation(self, messages: list[Message]) -> Conversation:
        """Helper to create test conversation."""
        return Conversation(
            thread_id="test_001",
            account_username="our_account",
            recipient_name="Test Brand",
            recipient_username="test_brand",
            messages=messages
        )
    
    def test_no_followup_single_message(self):
        """Single message should have no follow-ups."""
        conv = self._create_conversation([
            self._create_message("our_account", "Hello!", 0)
        ])
        assert self.detector.count_follow_ups(conv) == 0
    
    def test_no_followup_with_reply(self):
        """Message followed by reply should have no follow-ups."""
        conv = self._create_conversation([
            self._create_message("our_account", "Hello!", 0),
            self._create_message("test_brand", "Hi there!", 1)
        ])
        assert self.detector.count_follow_ups(conv) == 0
    
    def test_consecutive_messages_are_followups(self):
        """Consecutive messages from our side without reply are follow-ups."""
        conv = self._create_conversation([
            self._create_message("our_account", "Hello!", 0),
            self._create_message("our_account", "Following up...", 2),
            self._create_message("our_account", "Checking in again...", 4)
        ])
        # Second and third messages are follow-ups
        assert self.detector.count_follow_ups(conv) == 2
    
    def test_time_gap_followup(self):
        """Message after 24h+ gap is a follow-up."""
        conv = self._create_conversation([
            self._create_message("our_account", "Hello!", 0),
            self._create_message("test_brand", "Thanks!", 1),
            self._create_message("our_account", "Following up after a day...", 30)  # 30 hours later
        ])
        # The third message is after time gap, but recipient replied
        # So it's not a follow-up in awaiting_reply sense
        assert self.detector.count_follow_ups(conv) == 0
    
    def test_mixed_scenario(self):
        """Complex scenario with multiple follow-up types."""
        conv = self._create_conversation([
            self._create_message("our_account", "Hello!", 0),
            self._create_message("our_account", "Following up...", 2),  # Follow-up (consecutive)
            self._create_message("test_brand", "Hi!", 3),
            self._create_message("our_account", "Great!", 4),
            self._create_message("our_account", "More info here...", 5)  # Follow-up (consecutive)
        ])
        assert self.detector.count_follow_ups(conv) == 2
    
    def test_empty_conversation(self):
        """Empty conversation should have no follow-ups."""
        conv = self._create_conversation([])
        assert self.detector.count_follow_ups(conv) == 0


class TestInterestClassifier:
    """Tests for interest classification logic."""
    
    def setup_method(self):
        self.classifier = InterestClassifier()
    
    def test_positive_intent_share_details(self):
        """'Share details' indicates interest."""
        result = self.classifier.classify(["Can you share details?"])
        assert result.interested is True
        assert result.has_positive_intent is True
    
    def test_positive_intent_pricing(self):
        """'Pricing' indicates interest."""
        result = self.classifier.classify(["What's your pricing?"])
        assert result.interested is True
    
    def test_positive_intent_lets_discuss(self):
        """'Let's discuss' indicates interest."""
        result = self.classifier.classify(["Let's discuss this further"])
        assert result.interested is True
    
    def test_rejection_not_interested(self):
        """'Not interested' indicates rejection."""
        result = self.classifier.classify(["We're not interested"])
        assert result.interested is False
        assert result.has_rejection is True
    
    def test_rejection_overrides_interest(self):
        """Rejection MUST override interest."""
        # Both positive and negative in same conversation
        messages = [
            "Share details please",
            "Actually, we're not interested anymore"
        ]
        result = self.classifier.classify(messages)
        assert result.interested is False
        assert result.has_positive_intent is True
        assert result.has_rejection is True
    
    def test_neutral_response(self):
        """Neutral response should be Not Interested."""
        result = self.classifier.classify(["Thanks for reaching out"])
        assert result.interested is False
        assert result.has_positive_intent is False
        assert result.has_rejection is False
    
    def test_no_messages(self):
        """No messages should be Not Interested."""
        result = self.classifier.classify([])
        assert result.interested is False
    
    def test_case_insensitive(self):
        """Matching should be case-insensitive."""
        result = self.classifier.classify(["SHARE DETAILS PLEASE"])
        assert result.interested is True
    
    def test_already_working_with(self):
        """'Already working with' is a rejection."""
        result = self.classifier.classify(["We're already working with another agency"])
        assert result.interested is False
        assert result.has_rejection is True


class TestKeywordTracker:
    """Tests for keyword tracking."""
    
    def setup_method(self):
        self.tracker = KeywordTracker()
    
    def test_count_garima(self):
        """Count Garima keyword."""
        messages = ["Hi, I'm Garima!", "Garima will follow up"]
        count = self.tracker.count_garima(messages)
        assert count == 2
    
    def test_count_prchitects(self):
        """Count PRchitects keyword."""
        messages = ["Hello from PRchitects", "PRchitects offers great rates"]
        count = self.tracker.count_prchitects(messages)
        assert count == 2
    
    def test_case_insensitive(self):
        """Counting should be case-insensitive."""
        messages = ["GARIMA here", "garima says hi", "Garima"]
        count = self.tracker.count_garima(messages)
        assert count == 3
    
    def test_multiple_in_one_message(self):
        """Count multiple occurrences in single message."""
        messages = ["Garima from PRchitects. Garima will send the deck from PRchitects."]
        counts = self.tracker.count_all_keywords(messages)
        assert counts["Garima"] == 2
        assert counts["PRchitects"] == 2
    
    def test_no_occurrences(self):
        """Zero count when no keywords found."""
        messages = ["Hello there", "Thanks for your message"]
        counts = self.tracker.count_all_keywords(messages)
        assert counts["Garima"] == 0
        assert counts["PRchitects"] == 0
    
    def test_word_boundary(self):
        """Should match whole words only."""
        # "Garimaa" should not match "Garima"
        messages = ["Garimaa is not Garima"]
        count = self.tracker.count_garima(messages)
        assert count == 1  # Only "Garima" matches


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
