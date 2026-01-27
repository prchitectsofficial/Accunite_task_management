"""
Core analyzer that orchestrates conversation analysis.

This module ties together all the analysis components and provides
the main interface for analyzing conversations.
"""

from datetime import datetime
from typing import Optional

from .models.conversation import Conversation, ConversationAnalysis
from .models.message import Message
from .analyzers.followup_detector import FollowUpDetector
from .analyzers.interest_classifier import InterestClassifier
from .analyzers.keyword_tracker import KeywordTracker
from .config import AnalyzerConfig, DEFAULT_CONFIG


class ConversationAnalyzer:
    """
    Main analyzer class that processes DM conversations.
    
    Combines all analysis components:
    - Follow-up detection
    - Interest classification
    - Keyword tracking
    - Message counting
    """
    
    def __init__(self, config: Optional[AnalyzerConfig] = None):
        """
        Initialize the conversation analyzer.
        
        Args:
            config: Configuration settings. Uses defaults if not provided.
        """
        self.config = config or DEFAULT_CONFIG
        
        # Initialize analysis components
        self.followup_detector = FollowUpDetector(
            time_gap_hours=self.config.time_gap_hours
        )
        self.interest_classifier = InterestClassifier(
            positive_phrases=self.config.positive_phrases,
            rejection_phrases=self.config.rejection_phrases
        )
        self.keyword_tracker = KeywordTracker(
            keywords=self.config.keywords
        )
    
    def analyze(self, conversation: Conversation) -> ConversationAnalysis:
        """
        Analyze a single conversation and produce analysis results.
        
        Args:
            conversation: The conversation to analyze
            
        Returns:
            ConversationAnalysis with all computed metrics
        """
        our_usernames = conversation.get_our_usernames()
        
        # Separate messages by sender
        our_messages = []
        recipient_messages = []
        
        for msg in conversation.messages:
            if msg.is_from_our_side(our_usernames):
                our_messages.append(msg)
            else:
                recipient_messages.append(msg)
        
        # Get message texts for analysis
        all_message_texts = [msg.text for msg in conversation.messages]
        our_message_texts = [msg.text for msg in our_messages]
        recipient_message_texts = [msg.text for msg in recipient_messages]
        
        # Count messages
        message_count_our_side = len(our_messages)
        message_count_recipient = len(recipient_messages)
        total_messages_by_us = message_count_our_side
        
        # Detect follow-ups
        follow_up_count = self.followup_detector.count_follow_ups(conversation)
        
        # Track keywords (across ALL messages)
        garima_count = self.keyword_tracker.count_garima(all_message_texts)
        prchitects_count = self.keyword_tracker.count_prchitects(all_message_texts)
        
        # Classify interest (based on RECIPIENT messages only)
        interested = self.interest_classifier.get_interest_string(recipient_message_texts)
        
        # Determine last message sender
        last_message_from = self._determine_last_message_from(
            conversation, our_usernames
        )
        
        # Compute content hash for change detection
        content_hash = conversation.compute_content_hash()
        
        return ConversationAnalysis(
            account_username=conversation.account_username,
            recipient_name=conversation.recipient_name,
            recipient_username=conversation.recipient_username,
            message_count_our_side=message_count_our_side,
            message_count_recipient_side=message_count_recipient,
            follow_up_count=follow_up_count,
            total_messages_sent_by_us=total_messages_by_us,
            garima_keyword_count=garima_count,
            prchitects_keyword_count=prchitects_count,
            last_message_from=last_message_from,
            interested=interested,
            thread_id=conversation.thread_id,
            content_hash=content_hash,
            analyzed_at=datetime.now()
        )
    
    def _determine_last_message_from(
        self,
        conversation: Conversation,
        our_usernames: set[str]
    ) -> str:
        """
        Determine who sent the last message.
        
        Args:
            conversation: The conversation
            our_usernames: Set of our team's usernames
            
        Returns:
            "OUR_END" or "RECIPIENT_END"
        """
        if not conversation.messages:
            return "OUR_END"  # Default if no messages
        
        last_message = conversation.messages[-1]
        if last_message.is_from_our_side(our_usernames):
            return "OUR_END"
        else:
            return "RECIPIENT_END"
    
    def analyze_batch(
        self,
        conversations: list[Conversation]
    ) -> list[ConversationAnalysis]:
        """
        Analyze multiple conversations.
        
        Args:
            conversations: List of conversations to analyze
            
        Returns:
            List of analysis results
        """
        return [self.analyze(conv) for conv in conversations]
