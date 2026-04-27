import express from 'express';
import { db } from '../database/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { generateId, logTaskHistory } from '../utils/helpers.js';
import { resetFollowUpForTask } from '../services/followUpScheduler.js';

const router = express.Router();

// Get comments for a task
router.get('/task/:taskId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    // Check task access
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (!isAdmin && task.assignee_id !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const comments = await db.all(
      `SELECT c.*, u.name as user_name
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.task_id = ?
       ORDER BY c.created_at ASC`,
      [taskId]
    );

    res.json(comments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create comment
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { task_id, content } = req.body;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    if (!task_id || !content) {
      res.status(400).json({ error: 'Task ID and content are required' });
      return;
    }

    // Check task access
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [task_id]);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (!isAdmin && task.assignee_id !== userId) {
      res.status(403).json({ error: 'Only assignee can comment on this task' });
      return;
    }

    const id = generateId();

    await db.run(
      'INSERT INTO comments (id, task_id, user_id, content, created_at) VALUES (?, ?, ?, ?, datetime("now"))',
      [id, task_id, userId, content]
    );

    // Log history
    await logTaskHistory(task_id, userId, 'comment_added', undefined, undefined, `Comment: ${content.substring(0, 50)}...`);

    // Reset follow-up cycle when comment is added
    await resetFollowUpForTask(task_id);

    const comment = await db.get(
      `SELECT c.*, u.name as user_name
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [id]
    );

    res.status(201).json(comment);
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete comment (admin or comment owner)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    const comment = await db.get('SELECT * FROM comments WHERE id = ?', [id]);
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (!isAdmin && comment.user_id !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await db.run('DELETE FROM comments WHERE id = ?', [id]);
    await logTaskHistory(comment.task_id, userId, 'comment_deleted', undefined, undefined, 'Comment deleted');

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

