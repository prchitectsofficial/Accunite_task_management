#!/usr/bin/env python3
"""
DM Conversation Analyzer - Main Entry Point

A production-ready bot that analyzes X (Twitter) DM conversations
for brand outreach tracking by an influencer marketing team.

Usage:
    python -m dm_analyzer.main --input conversations.json --output results.csv
    python -m dm_analyzer.main --input data/ --output results.csv --resume
"""

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from .analyzer import ConversationAnalyzer
from .config import AnalyzerConfig
from .models.conversation import Conversation, ConversationAnalysis
from .persistence.state_manager import StateManager
from .persistence.csv_writer import CSVWriter
from .utils.helpers import load_conversations_from_file, load_conversations_from_json


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class DMAnalyzerBot:
    """
    Main bot class that orchestrates the DM analysis process.
    
    Features:
    - Processes conversations from JSON input
    - Saves results to CSV with exact required columns
    - Supports resume after interruption via SQLite state
    - Prevents duplicate processing
    - Incremental progress saving
    """
    
    def __init__(
        self,
        config: Optional[AnalyzerConfig] = None,
        state_db: Optional[str] = None,
        output_csv: Optional[str] = None
    ):
        """
        Initialize the DM Analyzer Bot.
        
        Args:
            config: Configuration settings
            state_db: Override path for state database
            output_csv: Override path for output CSV
        """
        self.config = config or AnalyzerConfig()
        
        # Override paths if provided
        if state_db:
            self.config.state_db = state_db
        if output_csv:
            self.config.output_csv = output_csv
        
        # Initialize components
        self.analyzer = ConversationAnalyzer(self.config)
        self.state_manager = StateManager(self.config.state_db)
        self.csv_writer = CSVWriter(
            output_path=self.config.output_csv,
            append_mode=True
        )
        
        # Statistics
        self.stats = {
            "total_conversations": 0,
            "processed": 0,
            "skipped_unchanged": 0,
            "errors": 0,
            "interested_count": 0,
            "not_interested_count": 0
        }
    
    def process_conversations(
        self,
        conversations: list[Conversation],
        force_reprocess: bool = False
    ) -> list[ConversationAnalysis]:
        """
        Process a list of conversations.
        
        Args:
            conversations: List of conversations to process
            force_reprocess: If True, reprocess even if already done
            
        Returns:
            List of analysis results
        """
        results = []
        run_id = self.state_manager.start_run()
        
        logger.info(f"Starting processing run {run_id} with {len(conversations)} conversations")
        self.stats["total_conversations"] = len(conversations)
        
        for idx, conversation in enumerate(conversations):
            try:
                # Check if needs processing
                content_hash = conversation.compute_content_hash()
                
                if not force_reprocess and self.config.resume_enabled:
                    if not self.state_manager.needs_reprocessing(
                        conversation.thread_id, content_hash
                    ):
                        logger.debug(f"Skipping unchanged thread {conversation.thread_id}")
                        self.stats["skipped_unchanged"] += 1
                        
                        # Use stored analysis if available
                        stored = self.state_manager.get_stored_analysis(conversation.thread_id)
                        if stored:
                            # Reconstruct analysis from stored data
                            results.append(self._reconstruct_analysis(stored))
                        continue
                
                # Analyze the conversation
                analysis = self.analyzer.analyze(conversation)
                
                # Save to CSV incrementally
                written = self.csv_writer.update_row(analysis)
                
                # Mark as processed in state DB
                self.state_manager.mark_processed(
                    thread_id=conversation.thread_id,
                    content_hash=content_hash,
                    analysis_data=analysis.to_csv_row()
                )
                
                results.append(analysis)
                self.stats["processed"] += 1
                
                # Track interest stats
                if analysis.interested == "Yes":
                    self.stats["interested_count"] += 1
                else:
                    self.stats["not_interested_count"] += 1
                
                # Log progress periodically
                if (idx + 1) % 10 == 0:
                    logger.info(f"Processed {idx + 1}/{len(conversations)} conversations")
                    
            except Exception as e:
                logger.error(f"Error processing thread {conversation.thread_id}: {e}")
                self.stats["errors"] += 1
                continue
        
        # Complete the run
        self.state_manager.complete_run(run_id, self.stats["processed"])
        logger.info(f"Processing complete. Stats: {self.stats}")
        
        return results
    
    def _reconstruct_analysis(self, stored_data: dict) -> ConversationAnalysis:
        """Reconstruct ConversationAnalysis from stored CSV row data."""
        return ConversationAnalysis(
            account_username=stored_data.get("Account User Name", ""),
            recipient_name=stored_data.get("Recipient Name", ""),
            recipient_username=stored_data.get("Recipient User Name", ""),
            message_count_our_side=int(stored_data.get("Message Count (Our Side)", 0)),
            message_count_recipient_side=int(stored_data.get("Message Count (Recipient Side)", 0)),
            follow_up_count=int(stored_data.get("Follow Up Count", 0)),
            total_messages_sent_by_us=int(stored_data.get("Total Messages Sent By Us", 0)),
            garima_keyword_count=int(stored_data.get("Garima Keyword Count", 0)),
            prchitects_keyword_count=int(stored_data.get("PRchitects Keyword Count", 0)),
            last_message_from=stored_data.get("Last Message From", "OUR_END"),
            interested=stored_data.get("Interested", "No")
        )
    
    def process_from_file(
        self,
        input_path: str | Path,
        force_reprocess: bool = False
    ) -> list[ConversationAnalysis]:
        """
        Process conversations from a JSON file.
        
        Args:
            input_path: Path to input JSON file
            force_reprocess: If True, reprocess all conversations
            
        Returns:
            List of analysis results
        """
        logger.info(f"Loading conversations from {input_path}")
        conversations = load_conversations_from_file(input_path)
        logger.info(f"Loaded {len(conversations)} conversations")
        
        return self.process_conversations(conversations, force_reprocess)
    
    def process_from_json(
        self,
        json_data: list[dict],
        force_reprocess: bool = False
    ) -> list[ConversationAnalysis]:
        """
        Process conversations from JSON data.
        
        Args:
            json_data: List of conversation dictionaries
            force_reprocess: If True, reprocess all conversations
            
        Returns:
            List of analysis results
        """
        logger.info(f"Processing {len(json_data)} conversations from JSON data")
        conversations = load_conversations_from_json(json_data)
        return self.process_conversations(conversations, force_reprocess)
    
    def get_stats(self) -> dict:
        """Get processing statistics."""
        return {
            **self.stats,
            "state_db_stats": self.state_manager.get_stats()
        }
    
    def reset_state(self) -> None:
        """Reset all processing state. Use with caution."""
        logger.warning("Resetting all processing state")
        self.state_manager.clear_all()
        self.stats = {
            "total_conversations": 0,
            "processed": 0,
            "skipped_unchanged": 0,
            "errors": 0,
            "interested_count": 0,
            "not_interested_count": 0
        }


def create_sample_input():
    """Create a sample input file for testing."""
    sample_data = [
        {
            "thread_id": "thread_001",
            "account_username": "our_account",
            "recipient_name": "Brand ABC",
            "recipient_username": "brand_abc",
            "messages": [
                {
                    "sender_username": "our_account",
                    "text": "Hi! I'm Garima from PRchitects. Would love to discuss a collaboration.",
                    "timestamp": "2024-01-15T10:00:00"
                },
                {
                    "sender_username": "brand_abc",
                    "text": "Hi Garima! Sounds interesting. Can you share details?",
                    "timestamp": "2024-01-15T14:30:00"
                },
                {
                    "sender_username": "our_account",
                    "text": "Absolutely! I'll send our proposal and pricing right away.",
                    "timestamp": "2024-01-15T15:00:00"
                }
            ]
        },
        {
            "thread_id": "thread_002",
            "account_username": "our_account",
            "recipient_name": "Brand XYZ",
            "recipient_username": "brand_xyz",
            "messages": [
                {
                    "sender_username": "our_account",
                    "text": "Hello from PRchitects! Garima here, reaching out about potential collaboration.",
                    "timestamp": "2024-01-10T09:00:00"
                },
                {
                    "sender_username": "our_account",
                    "text": "Just following up on my previous message.",
                    "timestamp": "2024-01-12T09:00:00"
                },
                {
                    "sender_username": "brand_xyz",
                    "text": "Thanks but we're not interested at this time.",
                    "timestamp": "2024-01-12T16:00:00"
                }
            ]
        },
        {
            "thread_id": "thread_003",
            "account_username": "our_account",
            "recipient_name": "Brand 123",
            "recipient_username": "brand_123",
            "messages": [
                {
                    "sender_username": "our_account",
                    "text": "Hi! Garima from PRchitects here. We'd love to work with you!",
                    "timestamp": "2024-01-08T11:00:00"
                },
                {
                    "sender_username": "our_account",
                    "text": "Following up - let me know if you're interested!",
                    "timestamp": "2024-01-10T11:00:00"
                },
                {
                    "sender_username": "our_account",
                    "text": "Hi again! Just wanted to check in. PRchitects has great rates.",
                    "timestamp": "2024-01-15T11:00:00"
                }
            ]
        }
    ]
    
    with open("sample_conversations.json", 'w') as f:
        json.dump(sample_data, f, indent=2)
    
    logger.info("Created sample_conversations.json")
    return "sample_conversations.json"


def main():
    """Main entry point for CLI usage."""
    parser = argparse.ArgumentParser(
        description="Analyze X (Twitter) DM conversations for brand outreach tracking"
    )
    parser.add_argument(
        "--input", "-i",
        type=str,
        help="Path to input JSON file with conversations"
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        default="dm_analysis_results.csv",
        help="Path for output CSV file (default: dm_analysis_results.csv)"
    )
    parser.add_argument(
        "--state-db",
        type=str,
        default="dm_analyzer_state.db",
        help="Path for SQLite state database (default: dm_analyzer_state.db)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force reprocess all conversations (ignore resume state)"
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset all processing state before running"
    )
    parser.add_argument(
        "--sample",
        action="store_true",
        help="Create and process a sample input file for testing"
    )
    parser.add_argument(
        "--time-gap",
        type=float,
        default=24.0,
        help="Hours gap to consider a message as follow-up (default: 24)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging"
    )
    
    args = parser.parse_args()
    
    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Create config
    config = AnalyzerConfig(
        output_csv=args.output,
        state_db=args.state_db,
        time_gap_hours=args.time_gap,
        resume_enabled=not args.force
    )
    
    # Initialize bot
    bot = DMAnalyzerBot(config=config)
    
    # Handle reset
    if args.reset:
        bot.reset_state()
        logger.info("State reset complete")
    
    # Handle sample mode
    if args.sample:
        input_file = create_sample_input()
        results = bot.process_from_file(input_file, force_reprocess=args.force)
        print(f"\nProcessed {len(results)} conversations")
        print(f"Results saved to: {args.output}")
        print(f"\nStats: {bot.get_stats()}")
        return 0
    
    # Normal processing
    if not args.input:
        parser.error("--input is required (or use --sample for testing)")
    
    input_path = Path(args.input)
    if not input_path.exists():
        logger.error(f"Input file not found: {args.input}")
        return 1
    
    try:
        results = bot.process_from_file(input_path, force_reprocess=args.force)
        
        print(f"\n{'='*50}")
        print("DM Analysis Complete")
        print(f"{'='*50}")
        print(f"Total conversations: {bot.stats['total_conversations']}")
        print(f"Processed: {bot.stats['processed']}")
        print(f"Skipped (unchanged): {bot.stats['skipped_unchanged']}")
        print(f"Errors: {bot.stats['errors']}")
        print(f"Interested: {bot.stats['interested_count']}")
        print(f"Not Interested: {bot.stats['not_interested_count']}")
        print(f"\nResults saved to: {args.output}")
        print(f"State saved to: {args.state_db}")
        
        return 0
        
    except Exception as e:
        logger.error(f"Processing failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
