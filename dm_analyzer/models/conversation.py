"""Conversation data model and analysis result."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import hashlib
import json

from .message import Message


@dataclass
class Conversation:
    """
    Represents a complete DM conversation thread.
    
    Attributes:
        thread_id: Unique identifier for the thread
        account_username: Our side's username
        recipient_name: Display name of the recipient (brand)
        recipient_username: Username of the recipient
        messages: List of messages in chronological order
    """
    thread_id: str
    account_username: str
    recipient_name: str
    recipient_username: str
    messages: list[Message] = field(default_factory=list)
    
    @classmethod
    def from_dict(cls, data: dict) -> "Conversation":
        """
        Create a Conversation from a dictionary.
        
        Args:
            data: Dictionary with conversation data
            
        Returns:
            Conversation instance
        """
        messages_data = data.get("messages", [])
        messages = [
            Message.from_dict(m) if isinstance(m, dict) else m 
            for m in messages_data
        ]
        # Ensure messages are sorted by timestamp
        messages.sort(key=lambda m: m.timestamp)
        
        return cls(
            thread_id=str(data.get("thread_id", "")),
            account_username=str(data.get("account_username", "")),
            recipient_name=str(data.get("recipient_name", "")),
            recipient_username=str(data.get("recipient_username", "")),
            messages=messages
        )
    
    def to_dict(self) -> dict:
        """Convert Conversation to dictionary."""
        return {
            "thread_id": self.thread_id,
            "account_username": self.account_username,
            "recipient_name": self.recipient_name,
            "recipient_username": self.recipient_username,
            "messages": [m.to_dict() for m in self.messages]
        }
    
    def compute_content_hash(self) -> str:
        """
        Compute a hash of the conversation content.
        Used for detecting changes when resuming.
        
        Returns:
            SHA256 hash of the conversation content
        """
        content = json.dumps({
            "thread_id": self.thread_id,
            "messages": [
                {
                    "sender": m.sender_username,
                    "text": m.text,
                    "ts": m.timestamp.isoformat()
                }
                for m in self.messages
            ]
        }, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()
    
    def get_our_usernames(self) -> set[str]:
        """
        Get the set of usernames that belong to our side.
        
        Returns:
            Set containing our account username(s)
        """
        return {self.account_username.lower()}


@dataclass
class ConversationAnalysis:
    """
    Results of analyzing a conversation thread.
    
    All fields correspond to required CSV output columns.
    """
    account_username: str
    recipient_name: str
    recipient_username: str
    message_count_our_side: int
    message_count_recipient_side: int
    follow_up_count: int
    total_messages_sent_by_us: int
    garima_keyword_count: int
    prchitects_keyword_count: int
    last_message_from: str  # "OUR_END" or "RECIPIENT_END"
    interested: str  # "Yes" or "No"
    
    # Additional metadata for tracking
    thread_id: str = ""
    content_hash: str = ""
    analyzed_at: Optional[datetime] = None
    
    def to_csv_row(self) -> dict:
        """
        Convert analysis to a dictionary matching CSV column headers.
        
        Returns:
            Dictionary with exact CSV column names as keys
        """
        return {
            "Account User Name": self.account_username,
            "Recipient Name": self.recipient_name,
            "Recipient User Name": self.recipient_username,
            "Message Count (Our Side)": self.message_count_our_side,
            "Message Count (Recipient Side)": self.message_count_recipient_side,
            "Follow Up Count": self.follow_up_count,
            "Total Messages Sent By Us": self.total_messages_sent_by_us,
            "Garima Keyword Count": self.garima_keyword_count,
            "PRchitects Keyword Count": self.prchitects_keyword_count,
            "Last Message From": self.last_message_from,
            "Interested": self.interested
        }
    
    @staticmethod
    def csv_headers() -> list[str]:
        """Get the exact CSV column headers in order."""
        return [
            "Account User Name",
            "Recipient Name",
            "Recipient User Name",
            "Message Count (Our Side)",
            "Message Count (Recipient Side)",
            "Follow Up Count",
            "Total Messages Sent By Us",
            "Garima Keyword Count",
            "PRchitects Keyword Count",
            "Last Message From",
            "Interested"
        ]
