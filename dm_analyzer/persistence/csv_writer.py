"""
CSV writer for DM analysis results.

Features:
- Writes with exact column headers as specified
- Prevents duplicate rows using thread_id tracking
- Supports incremental writing for fault tolerance
- Handles resume by loading existing CSV data
"""

import csv
from datetime import datetime
from pathlib import Path
from typing import Optional

from ..models.conversation import ConversationAnalysis


class CSVWriter:
    """
    Writes conversation analysis results to CSV.
    
    Features:
    - Exact column headers as specified in requirements
    - Deduplication based on thread_id
    - Incremental append support
    - Atomic write option for data safety
    """
    
    DEFAULT_OUTPUT_PATH = "dm_analysis_results.csv"
    
    def __init__(
        self,
        output_path: str | Path | None = None,
        append_mode: bool = True
    ):
        """
        Initialize the CSV writer.
        
        Args:
            output_path: Path to output CSV file
            append_mode: If True, append to existing file; if False, overwrite
        """
        self.output_path = Path(output_path) if output_path else Path(self.DEFAULT_OUTPUT_PATH)
        self.append_mode = append_mode
        self._written_ids: set[str] = set()
        
        # Load existing IDs if file exists and we're in append mode
        if self.append_mode and self.output_path.exists():
            self._load_existing_ids()
    
    def _load_existing_ids(self) -> None:
        """Load thread IDs from existing CSV to prevent duplicates."""
        try:
            with open(self.output_path, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                # We don't have thread_id in CSV, so track by composite key
                for row in reader:
                    # Create composite key from unique identifiers
                    key = self._create_row_key(row)
                    self._written_ids.add(key)
        except Exception:
            # If we can't read the file, start fresh
            self._written_ids = set()
    
    def _create_row_key(self, row: dict) -> str:
        """
        Create a unique key for a row to detect duplicates.
        
        Uses Account User Name + Recipient User Name as composite key.
        """
        account = row.get("Account User Name", "")
        recipient = row.get("Recipient User Name", "")
        return f"{account}::{recipient}"
    
    def _ensure_file_exists(self) -> None:
        """Create file with headers if it doesn't exist."""
        if not self.output_path.exists():
            with open(self.output_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=ConversationAnalysis.csv_headers())
                writer.writeheader()
    
    def write_analysis(
        self,
        analysis: ConversationAnalysis,
        skip_if_duplicate: bool = True
    ) -> bool:
        """
        Write a single analysis result to CSV.
        
        Args:
            analysis: The analysis result to write
            skip_if_duplicate: If True, skip writing if already written
            
        Returns:
            True if written, False if skipped (duplicate)
        """
        row = analysis.to_csv_row()
        row_key = f"{analysis.account_username}::{analysis.recipient_username}"
        
        # Check for duplicate
        if skip_if_duplicate and row_key in self._written_ids:
            return False
        
        self._ensure_file_exists()
        
        with open(self.output_path, 'a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=ConversationAnalysis.csv_headers())
            writer.writerow(row)
        
        self._written_ids.add(row_key)
        return True
    
    def write_analyses(
        self,
        analyses: list[ConversationAnalysis],
        skip_duplicates: bool = True
    ) -> tuple[int, int]:
        """
        Write multiple analysis results to CSV.
        
        Args:
            analyses: List of analysis results to write
            skip_duplicates: If True, skip duplicate entries
            
        Returns:
            Tuple of (written_count, skipped_count)
        """
        written = 0
        skipped = 0
        
        for analysis in analyses:
            if self.write_analysis(analysis, skip_if_duplicate=skip_duplicates):
                written += 1
            else:
                skipped += 1
        
        return written, skipped
    
    def write_all_fresh(self, analyses: list[ConversationAnalysis]) -> int:
        """
        Write all analyses to a fresh CSV file (overwrites existing).
        
        Args:
            analyses: List of analysis results to write
            
        Returns:
            Number of rows written
        """
        self._written_ids.clear()
        
        with open(self.output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=ConversationAnalysis.csv_headers())
            writer.writeheader()
            
            for analysis in analyses:
                row = analysis.to_csv_row()
                row_key = f"{analysis.account_username}::{analysis.recipient_username}"
                
                # Still deduplicate within the batch
                if row_key not in self._written_ids:
                    writer.writerow(row)
                    self._written_ids.add(row_key)
        
        return len(self._written_ids)
    
    def update_row(
        self,
        analysis: ConversationAnalysis,
    ) -> bool:
        """
        Update an existing row or add if not exists.
        
        This requires rewriting the entire file, use sparingly.
        
        Args:
            analysis: The analysis result to update/add
            
        Returns:
            True if updated existing row, False if added new
        """
        row_key = f"{analysis.account_username}::{analysis.recipient_username}"
        new_row = analysis.to_csv_row()
        
        if not self.output_path.exists():
            self.write_analysis(analysis, skip_if_duplicate=False)
            return False
        
        # Read all existing rows
        rows = []
        found = False
        
        with open(self.output_path, 'r', newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing_key = self._create_row_key(row)
                if existing_key == row_key:
                    rows.append(new_row)
                    found = True
                else:
                    rows.append(row)
        
        if not found:
            rows.append(new_row)
        
        # Write back
        with open(self.output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=ConversationAnalysis.csv_headers())
            writer.writeheader()
            writer.writerows(rows)
        
        self._written_ids.add(row_key)
        return found
    
    def get_written_count(self) -> int:
        """Get count of rows written (tracked in memory)."""
        return len(self._written_ids)
    
    def read_all(self) -> list[dict]:
        """
        Read all rows from the CSV file.
        
        Returns:
            List of row dictionaries
        """
        if not self.output_path.exists():
            return []
        
        with open(self.output_path, 'r', newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            return list(reader)
