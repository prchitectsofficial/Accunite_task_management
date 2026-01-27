"""Message data model for DM conversations."""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Message:
    """
    Represents a single message in a DM conversation thread.
    
    Attributes:
        sender_username: Username of the message sender
        text: The message content
        timestamp: When the message was sent
    """
    sender_username: str
    text: str
    timestamp: datetime
    
    @classmethod
    def from_dict(cls, data: dict) -> "Message":
        """
        Create a Message from a dictionary.
        
        Args:
            data: Dictionary with keys 'sender_username', 'text', 'timestamp'
            
        Returns:
            Message instance
        """
        timestamp = data.get("timestamp")
        
        # Handle various timestamp formats
        if isinstance(timestamp, str):
            # Try ISO format first
            try:
                timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            except ValueError:
                # Try common formats
                for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y %H:%M:%S"]:
                    try:
                        timestamp = datetime.strptime(timestamp, fmt)
                        break
                    except ValueError:
                        continue
                else:
                    raise ValueError(f"Unable to parse timestamp: {timestamp}")
        elif isinstance(timestamp, (int, float)):
            # Unix timestamp
            timestamp = datetime.fromtimestamp(timestamp)
        elif not isinstance(timestamp, datetime):
            raise ValueError(f"Invalid timestamp type: {type(timestamp)}")
            
        return cls(
            sender_username=str(data.get("sender_username", "")),
            text=str(data.get("text", "")),
            timestamp=timestamp
        )
    
    def to_dict(self) -> dict:
        """Convert Message to dictionary."""
        return {
            "sender_username": self.sender_username,
            "text": self.text,
            "timestamp": self.timestamp.isoformat()
        }
    
    def is_from_our_side(self, our_usernames: set[str]) -> bool:
        """
        Check if this message was sent by our team.
        
        Args:
            our_usernames: Set of usernames belonging to our team
            
        Returns:
            True if sender is from our side
        """
        return self.sender_username.lower() in {u.lower() for u in our_usernames}
