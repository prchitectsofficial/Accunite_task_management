"""
Integration tests for the complete DM analyzer flow.
"""

import pytest
import tempfile
import json
import os
from pathlib import Path

from dm_analyzer.main import DMAnalyzerBot
from dm_analyzer.config import AnalyzerConfig
from dm_analyzer.models.conversation import Conversation
from dm_analyzer.analyzer import ConversationAnalyzer


class TestIntegration:
    """Integration tests for the complete analysis flow."""
    
    @pytest.fixture
    def sample_conversations(self):
        """Sample conversation data for testing."""
        return [
            {
                "thread_id": "test_001",
                "account_username": "our_account",
                "recipient_name": "Interested Brand",
                "recipient_username": "interested_brand",
                "messages": [
                    {
                        "sender_username": "our_account",
                        "text": "Hi! I'm Garima from PRchitects. Would love to collaborate!",
                        "timestamp": "2024-01-15T10:00:00"
                    },
                    {
                        "sender_username": "interested_brand",
                        "text": "Hi Garima! Sounds great. Can you share details and pricing?",
                        "timestamp": "2024-01-15T14:00:00"
                    }
                ]
            },
            {
                "thread_id": "test_002",
                "account_username": "our_account",
                "recipient_name": "Rejecting Brand",
                "recipient_username": "rejecting_brand",
                "messages": [
                    {
                        "sender_username": "our_account",
                        "text": "Hello from PRchitects! Garima here.",
                        "timestamp": "2024-01-10T09:00:00"
                    },
                    {
                        "sender_username": "our_account",
                        "text": "Following up on my previous message.",
                        "timestamp": "2024-01-12T09:00:00"
                    },
                    {
                        "sender_username": "rejecting_brand",
                        "text": "Sorry, we're not interested at this time.",
                        "timestamp": "2024-01-12T14:00:00"
                    }
                ]
            },
            {
                "thread_id": "test_003",
                "account_username": "our_account",
                "recipient_name": "Silent Brand",
                "recipient_username": "silent_brand",
                "messages": [
                    {
                        "sender_username": "our_account",
                        "text": "Hi! Garima from PRchitects reaching out.",
                        "timestamp": "2024-01-08T11:00:00"
                    },
                    {
                        "sender_username": "our_account",
                        "text": "Following up - Garima here again from PRchitects!",
                        "timestamp": "2024-01-10T11:00:00"
                    },
                    {
                        "sender_username": "our_account",
                        "text": "One more follow-up from PRchitects team.",
                        "timestamp": "2024-01-15T11:00:00"
                    }
                ]
            }
        ]
    
    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for test files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir
    
    def test_full_analysis_flow(self, sample_conversations, temp_dir):
        """Test complete analysis flow from input to output."""
        # Setup paths
        input_file = Path(temp_dir) / "conversations.json"
        output_csv = Path(temp_dir) / "results.csv"
        state_db = Path(temp_dir) / "state.db"
        
        # Write input file
        with open(input_file, 'w') as f:
            json.dump(sample_conversations, f)
        
        # Configure and run bot
        config = AnalyzerConfig(
            input_file=str(input_file),
            output_csv=str(output_csv),
            state_db=str(state_db),
            resume_enabled=True
        )
        
        bot = DMAnalyzerBot(config=config)
        results = bot.process_from_file(input_file)
        
        # Verify results
        assert len(results) == 3
        assert bot.stats["processed"] == 3
        assert bot.stats["errors"] == 0
        
        # Check CSV was created
        assert output_csv.exists()
        
        # Check state DB was created
        assert state_db.exists()
    
    def test_interested_classification(self, sample_conversations):
        """Test that interested classification works correctly."""
        analyzer = ConversationAnalyzer()
        
        # Test interested brand
        conv = Conversation.from_dict(sample_conversations[0])
        result = analyzer.analyze(conv)
        assert result.interested == "Yes"
        
        # Test rejecting brand
        conv = Conversation.from_dict(sample_conversations[1])
        result = analyzer.analyze(conv)
        assert result.interested == "No"
        
        # Test silent brand (no response = No)
        conv = Conversation.from_dict(sample_conversations[2])
        result = analyzer.analyze(conv)
        assert result.interested == "No"
    
    def test_followup_counting(self, sample_conversations):
        """Test follow-up counting accuracy."""
        analyzer = ConversationAnalyzer()
        
        # test_001: No follow-ups (reply received after first message)
        conv = Conversation.from_dict(sample_conversations[0])
        result = analyzer.analyze(conv)
        assert result.follow_up_count == 0
        
        # test_002: 1 follow-up (consecutive message without reply)
        conv = Conversation.from_dict(sample_conversations[1])
        result = analyzer.analyze(conv)
        assert result.follow_up_count == 1
        
        # test_003: 2 follow-ups (2 consecutive messages without any reply)
        conv = Conversation.from_dict(sample_conversations[2])
        result = analyzer.analyze(conv)
        assert result.follow_up_count == 2
    
    def test_keyword_counting(self, sample_conversations):
        """Test keyword counting accuracy."""
        analyzer = ConversationAnalyzer()
        
        # test_001: 1 Garima, 1 PRchitects
        conv = Conversation.from_dict(sample_conversations[0])
        result = analyzer.analyze(conv)
        assert result.garima_keyword_count == 2  # In our message + recipient's reply
        assert result.prchitects_keyword_count == 1
        
        # test_003: 2 Garima, 3 PRchitects
        conv = Conversation.from_dict(sample_conversations[2])
        result = analyzer.analyze(conv)
        assert result.garima_keyword_count == 2
        assert result.prchitects_keyword_count == 3
    
    def test_message_counting(self, sample_conversations):
        """Test message counting accuracy."""
        analyzer = ConversationAnalyzer()
        
        # test_001: 1 our, 1 recipient
        conv = Conversation.from_dict(sample_conversations[0])
        result = analyzer.analyze(conv)
        assert result.message_count_our_side == 1
        assert result.message_count_recipient_side == 1
        assert result.total_messages_sent_by_us == 1
        
        # test_003: 3 our, 0 recipient
        conv = Conversation.from_dict(sample_conversations[2])
        result = analyzer.analyze(conv)
        assert result.message_count_our_side == 3
        assert result.message_count_recipient_side == 0
        assert result.total_messages_sent_by_us == 3
    
    def test_last_message_from(self, sample_conversations):
        """Test last message detection."""
        analyzer = ConversationAnalyzer()
        
        # test_001: Last from recipient
        conv = Conversation.from_dict(sample_conversations[0])
        result = analyzer.analyze(conv)
        assert result.last_message_from == "RECIPIENT_END"
        
        # test_003: Last from our side
        conv = Conversation.from_dict(sample_conversations[2])
        result = analyzer.analyze(conv)
        assert result.last_message_from == "OUR_END"
    
    def test_resume_capability(self, sample_conversations, temp_dir):
        """Test that resume works correctly."""
        input_file = Path(temp_dir) / "conversations.json"
        output_csv = Path(temp_dir) / "results.csv"
        state_db = Path(temp_dir) / "state.db"
        
        with open(input_file, 'w') as f:
            json.dump(sample_conversations, f)
        
        config = AnalyzerConfig(
            output_csv=str(output_csv),
            state_db=str(state_db),
            resume_enabled=True
        )
        
        # First run
        bot1 = DMAnalyzerBot(config=config)
        results1 = bot1.process_from_file(input_file)
        assert bot1.stats["processed"] == 3
        
        # Second run - should skip all (unchanged)
        bot2 = DMAnalyzerBot(config=config)
        results2 = bot2.process_from_file(input_file)
        assert bot2.stats["processed"] == 0
        assert bot2.stats["skipped_unchanged"] == 3
    
    def test_rejection_overrides_interest(self):
        """Test that rejection always overrides positive intent."""
        analyzer = ConversationAnalyzer()
        
        # Conversation with both interest and rejection
        conv_data = {
            "thread_id": "test_override",
            "account_username": "our_account",
            "recipient_name": "Mixed Brand",
            "recipient_username": "mixed_brand",
            "messages": [
                {
                    "sender_username": "our_account",
                    "text": "Hi from PRchitects!",
                    "timestamp": "2024-01-15T10:00:00"
                },
                {
                    "sender_username": "mixed_brand",
                    "text": "Share details please",
                    "timestamp": "2024-01-15T11:00:00"
                },
                {
                    "sender_username": "our_account",
                    "text": "Here are the details...",
                    "timestamp": "2024-01-15T12:00:00"
                },
                {
                    "sender_username": "mixed_brand",
                    "text": "Thanks but we're not interested after reviewing",
                    "timestamp": "2024-01-15T14:00:00"
                }
            ]
        }
        
        conv = Conversation.from_dict(conv_data)
        result = analyzer.analyze(conv)
        
        # Even though "share details" was said, rejection must win
        assert result.interested == "No"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
