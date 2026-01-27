"""
Utility helper functions for DM analyzer.
"""

import json
from pathlib import Path
from typing import Iterator

from ..models.conversation import Conversation


def load_conversations_from_json(json_data: list[dict]) -> list[Conversation]:
    """
    Load conversations from JSON data.
    
    Args:
        json_data: List of conversation dictionaries
        
    Returns:
        List of Conversation objects
    """
    conversations = []
    for item in json_data:
        try:
            conv = Conversation.from_dict(item)
            conversations.append(conv)
        except Exception as e:
            # Log error but continue processing
            print(f"Warning: Failed to parse conversation {item.get('thread_id', 'unknown')}: {e}")
    return conversations


def load_conversations_from_file(file_path: str | Path) -> list[Conversation]:
    """
    Load conversations from a JSON file.
    
    Args:
        file_path: Path to JSON file containing conversation data
        
    Returns:
        List of Conversation objects
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Conversation file not found: {file_path}")
    
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Handle both list format and dict with 'conversations' key
    if isinstance(data, dict):
        data = data.get("conversations", data.get("threads", []))
    
    return load_conversations_from_json(data)


def iter_conversations_from_file(
    file_path: str | Path,
    batch_size: int = 100
) -> Iterator[list[Conversation]]:
    """
    Iterator that yields batches of conversations from a JSON file.
    
    Useful for processing large files with memory efficiency.
    
    Args:
        file_path: Path to JSON file
        batch_size: Number of conversations per batch
        
    Yields:
        Batches of Conversation objects
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Conversation file not found: {file_path}")
    
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if isinstance(data, dict):
        data = data.get("conversations", data.get("threads", []))
    
    batch = []
    for item in data:
        try:
            conv = Conversation.from_dict(item)
            batch.append(conv)
            
            if len(batch) >= batch_size:
                yield batch
                batch = []
        except Exception as e:
            print(f"Warning: Failed to parse conversation {item.get('thread_id', 'unknown')}: {e}")
    
    if batch:  # Yield remaining
        yield batch


def format_timestamp(dt) -> str:
    """Format datetime for display."""
    return dt.strftime("%Y-%m-%d %H:%M:%S") if dt else "N/A"


def sanitize_for_csv(value: str) -> str:
    """
    Sanitize a string value for CSV output.
    
    Removes/escapes characters that could cause CSV parsing issues.
    """
    if not isinstance(value, str):
        return str(value)
    
    # Replace newlines with spaces
    value = value.replace('\n', ' ').replace('\r', ' ')
    
    # Remove or escape quotes
    value = value.replace('"', '""')
    
    return value
