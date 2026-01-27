"""
SQLite-based state manager for resume capability.

Tracks:
- Processed thread IDs
- Content hashes to detect changes
- Processing timestamps

This enables the bot to resume cleanly after interruption and 
avoid duplicate processing.
"""

import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, NamedTuple
from contextlib import contextmanager


class ProcessedThread(NamedTuple):
    """Record of a processed thread."""
    thread_id: str
    content_hash: str
    processed_at: str
    analysis_json: str


class StateManager:
    """
    Manages processing state using SQLite.
    
    Features:
    - Tracks processed thread IDs and their content hashes
    - Detects if a thread has been modified since last processing
    - Supports incremental progress saving
    - Provides clean resume after interruption
    """
    
    DEFAULT_DB_PATH = "dm_analyzer_state.db"
    
    def __init__(self, db_path: str | Path | None = None):
        """
        Initialize the state manager.
        
        Args:
            db_path: Path to SQLite database file. Creates if not exists.
        """
        self.db_path = Path(db_path) if db_path else Path(self.DEFAULT_DB_PATH)
        self._init_database()
    
    def _init_database(self) -> None:
        """Initialize database schema."""
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS processed_threads (
                    thread_id TEXT PRIMARY KEY,
                    content_hash TEXT NOT NULL,
                    processed_at TEXT NOT NULL,
                    analysis_json TEXT
                )
            """)
            
            # Index for faster lookups
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_content_hash 
                ON processed_threads(content_hash)
            """)
            
            # Table for tracking run metadata
            conn.execute("""
                CREATE TABLE IF NOT EXISTS run_history (
                    run_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    started_at TEXT NOT NULL,
                    completed_at TEXT,
                    threads_processed INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'running'
                )
            """)
            
            conn.commit()
    
    @contextmanager
    def _get_connection(self):
        """Get a database connection with proper cleanup."""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def is_processed(self, thread_id: str) -> bool:
        """
        Check if a thread has been processed.
        
        Args:
            thread_id: The thread ID to check
            
        Returns:
            True if thread was previously processed
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT 1 FROM processed_threads WHERE thread_id = ?",
                (thread_id,)
            )
            return cursor.fetchone() is not None
    
    def get_content_hash(self, thread_id: str) -> Optional[str]:
        """
        Get the stored content hash for a thread.
        
        Args:
            thread_id: The thread ID to look up
            
        Returns:
            Content hash if found, None otherwise
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT content_hash FROM processed_threads WHERE thread_id = ?",
                (thread_id,)
            )
            row = cursor.fetchone()
            return row["content_hash"] if row else None
    
    def needs_reprocessing(self, thread_id: str, current_hash: str) -> bool:
        """
        Check if a thread needs reprocessing (content changed).
        
        Args:
            thread_id: The thread ID to check
            current_hash: Current content hash of the thread
            
        Returns:
            True if thread was never processed or content changed
        """
        stored_hash = self.get_content_hash(thread_id)
        if stored_hash is None:
            return True  # Never processed
        return stored_hash != current_hash  # Content changed
    
    def mark_processed(
        self,
        thread_id: str,
        content_hash: str,
        analysis_data: Optional[dict] = None
    ) -> None:
        """
        Mark a thread as processed.
        
        Args:
            thread_id: The thread ID
            content_hash: Hash of the thread content
            analysis_data: Optional analysis results to store
        """
        analysis_json = json.dumps(analysis_data) if analysis_data else None
        processed_at = datetime.now().isoformat()
        
        with self._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO processed_threads 
                (thread_id, content_hash, processed_at, analysis_json)
                VALUES (?, ?, ?, ?)
            """, (thread_id, content_hash, processed_at, analysis_json))
            conn.commit()
    
    def get_processed_thread(self, thread_id: str) -> Optional[ProcessedThread]:
        """
        Get full record of a processed thread.
        
        Args:
            thread_id: The thread ID to look up
            
        Returns:
            ProcessedThread record if found, None otherwise
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM processed_threads WHERE thread_id = ?",
                (thread_id,)
            )
            row = cursor.fetchone()
            if row:
                return ProcessedThread(
                    thread_id=row["thread_id"],
                    content_hash=row["content_hash"],
                    processed_at=row["processed_at"],
                    analysis_json=row["analysis_json"]
                )
            return None
    
    def get_all_processed_ids(self) -> set[str]:
        """
        Get set of all processed thread IDs.
        
        Returns:
            Set of thread IDs that have been processed
        """
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT thread_id FROM processed_threads")
            return {row["thread_id"] for row in cursor.fetchall()}
    
    def get_stored_analysis(self, thread_id: str) -> Optional[dict]:
        """
        Get stored analysis data for a thread.
        
        Args:
            thread_id: The thread ID
            
        Returns:
            Analysis data dictionary if available
        """
        record = self.get_processed_thread(thread_id)
        if record and record.analysis_json:
            return json.loads(record.analysis_json)
        return None
    
    def start_run(self) -> int:
        """
        Record the start of a processing run.
        
        Returns:
            Run ID for this processing run
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "INSERT INTO run_history (started_at) VALUES (?)",
                (datetime.now().isoformat(),)
            )
            conn.commit()
            return cursor.lastrowid
    
    def complete_run(self, run_id: int, threads_processed: int) -> None:
        """
        Record completion of a processing run.
        
        Args:
            run_id: The run ID from start_run()
            threads_processed: Number of threads processed
        """
        with self._get_connection() as conn:
            conn.execute("""
                UPDATE run_history 
                SET completed_at = ?, threads_processed = ?, status = 'completed'
                WHERE run_id = ?
            """, (datetime.now().isoformat(), threads_processed, run_id))
            conn.commit()
    
    def clear_all(self) -> None:
        """Clear all processing state. Use with caution."""
        with self._get_connection() as conn:
            conn.execute("DELETE FROM processed_threads")
            conn.commit()
    
    def get_stats(self) -> dict:
        """
        Get statistics about processed threads.
        
        Returns:
            Dictionary with processing statistics
        """
        with self._get_connection() as conn:
            total = conn.execute(
                "SELECT COUNT(*) as count FROM processed_threads"
            ).fetchone()["count"]
            
            latest = conn.execute("""
                SELECT MAX(processed_at) as latest 
                FROM processed_threads
            """).fetchone()["latest"]
            
            runs = conn.execute(
                "SELECT COUNT(*) as count FROM run_history"
            ).fetchone()["count"]
            
            return {
                "total_processed": total,
                "latest_processing": latest,
                "total_runs": runs
            }
