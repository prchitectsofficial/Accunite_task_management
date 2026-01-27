"""
Follow-up detection logic for DM conversations.

A follow-up is detected when:
1. Multiple consecutive messages are sent by our side without a reply from recipient
2. Our message is sent after a significant time gap (default: >24h) following 
   our previous message, without any recipient reply in between
"""

from datetime import timedelta
from typing import Optional

from ..models.message import Message
from ..models.conversation import Conversation


class FollowUpDetector:
    """
    Detects follow-up messages in DM conversations.
    
    Follow-up definition:
    - A follow-up occurs when we send additional messages after our initial 
      outreach without receiving a response
    - This includes:
      a) Consecutive messages from our side (2nd, 3rd, etc. messages count as follow-ups)
      b) Messages sent after a time gap (>24h by default) when awaiting response
    """
    
    # Default time gap threshold for considering a message as a follow-up
    DEFAULT_TIME_GAP_HOURS = 24
    
    def __init__(self, time_gap_hours: float = DEFAULT_TIME_GAP_HOURS):
        """
        Initialize the follow-up detector.
        
        Args:
            time_gap_hours: Hours of gap to consider a message as a time-based follow-up
        """
        self.time_gap = timedelta(hours=time_gap_hours)
    
    def count_follow_ups(self, conversation: Conversation) -> int:
        """
        Count the number of follow-up messages in a conversation.
        
        Follow-up counting logic:
        1. Track the state of who sent the last message
        2. When we send a message:
           - If recipient hasn't replied since our last message: it's a follow-up
           - If we're awaiting a reply AND there's a time gap > threshold: it's a follow-up
        3. First message is never a follow-up (it's initial outreach)
        4. If recipient replied, the next message from us is NOT a follow-up (fresh conversation)
        
        Args:
            conversation: The conversation to analyze
            
        Returns:
            Number of follow-up messages detected
        """
        if not conversation.messages:
            return 0
        
        our_usernames = conversation.get_our_usernames()
        follow_up_count = 0
        
        # State tracking
        last_our_message_time: Optional[datetime] = None
        awaiting_recipient_reply = False
        
        for message in conversation.messages:
            is_our_message = message.is_from_our_side(our_usernames)
            
            if is_our_message:
                # Check if this is a follow-up
                if awaiting_recipient_reply:
                    # We're already waiting for a reply - this is definitely a follow-up
                    # This covers:
                    # a) Consecutive messages without reply
                    # b) Messages sent after time gap while still awaiting reply
                    follow_up_count += 1
                # Note: If recipient replied (awaiting_recipient_reply = False),
                # then this is a fresh message, not a follow-up, regardless of time gap.
                # Time gap only matters when we're awaiting a reply.
                
                # Update state: we sent a message, now awaiting reply
                last_our_message_time = message.timestamp
                awaiting_recipient_reply = True
                
            else:
                # Recipient message - reset the awaiting state
                # They responded, so next message from us isn't automatically a follow-up
                awaiting_recipient_reply = False
        
        return follow_up_count
    
    def get_follow_up_details(self, conversation: Conversation) -> list[dict]:
        """
        Get detailed information about each follow-up message.
        
        Useful for debugging and detailed analysis.
        
        Args:
            conversation: The conversation to analyze
            
        Returns:
            List of dictionaries with follow-up details
        """
        if not conversation.messages:
            return []
        
        our_usernames = conversation.get_our_usernames()
        follow_ups = []
        
        last_our_message_time: Optional[datetime] = None
        last_our_message_idx: Optional[int] = None
        awaiting_recipient_reply = False
        
        for idx, message in enumerate(conversation.messages):
            is_our_message = message.is_from_our_side(our_usernames)
            
            if is_our_message:
                reason = None
                
                if awaiting_recipient_reply:
                    reason = "consecutive_without_reply"
                elif last_our_message_time is not None:
                    time_since_last = message.timestamp - last_our_message_time
                    if time_since_last >= self.time_gap:
                        reason = f"time_gap_{time_since_last.total_seconds() / 3600:.1f}h"
                
                if reason:
                    follow_ups.append({
                        "message_index": idx,
                        "timestamp": message.timestamp.isoformat(),
                        "text_preview": message.text[:100] + "..." if len(message.text) > 100 else message.text,
                        "reason": reason,
                        "previous_our_message_index": last_our_message_idx
                    })
                
                last_our_message_time = message.timestamp
                last_our_message_idx = idx
                awaiting_recipient_reply = True
                
            else:
                awaiting_recipient_reply = False
        
        return follow_ups
