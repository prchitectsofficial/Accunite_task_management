import express from 'express';
import { db } from '../database/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get task history
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

    const history = await db.all(
      `SELECT h.*, u.name as user_name
       FROM task_history h
       LEFT JOIN users u ON h.user_id = u.id
       WHERE h.task_id = ?
       ORDER BY h.created_at ASC`,
      [taskId]
    );

    res.json(history);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

