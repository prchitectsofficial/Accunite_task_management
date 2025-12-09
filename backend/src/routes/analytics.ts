import express from 'express';
import { db } from '../database/database.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get performance analytics (admin only)
router.get('/performance', authenticate, requireAdmin, async (req, res) => {
  try {
    // Get all assignees
    const assignees = await db.all(
      'SELECT id, name, email FROM users WHERE role = ?',
      ['assignee']
    );

    const metrics = await Promise.all(
      assignees.map(async (assignee) => {
        // Total completed tasks
        const totalCompleted = await db.get(
          'SELECT COUNT(*) as count FROM tasks WHERE assignee_id = ? AND status = ?',
          [assignee.id, 'completed']
        );

        // Tasks completed in last 7 days
        const completed7d = await db.get(
          `SELECT COUNT(*) as count 
           FROM tasks 
           WHERE assignee_id = ? 
           AND status = ? 
           AND updated_at >= datetime('now', '-7 days')`,
          [assignee.id, 'completed']
        );

        // Total tasks assigned
        const totalTasks = await db.get(
          'SELECT COUNT(*) as count FROM tasks WHERE assignee_id = ?',
          [assignee.id]
        );

        // Average completion time (in days)
        const avgCompletion = await db.get(
          `SELECT AVG(julianday(updated_at) - julianday(created_at)) as avg_days
           FROM tasks
           WHERE assignee_id = ?
           AND status = ?
           AND updated_at IS NOT NULL`,
          [assignee.id, 'completed']
        );

        // On-time completion rate
        const onTimeData = await db.get(
          `SELECT 
             COUNT(*) as total,
             SUM(CASE WHEN datetime(updated_at) <= datetime(due_date) THEN 1 ELSE 0 END) as on_time
           FROM tasks
           WHERE assignee_id = ?
           AND status = ?`,
          [assignee.id, 'completed']
        );

        const onTimeRate = onTimeData.total > 0
          ? (onTimeData.on_time / onTimeData.total) * 100
          : 0;

        return {
          assignee_id: assignee.id,
          assignee_name: assignee.name,
          assignee_email: assignee.email,
          avg_completion_time: avgCompletion.avg_days ? parseFloat(avgCompletion.avg_days.toFixed(2)) : 0,
          tasks_completed_7d: completed7d.count,
          on_time_completion_rate: parseFloat(onTimeRate.toFixed(2)),
          total_completed: totalCompleted.count,
          total_tasks: totalTasks.count,
        };
      })
    );

    // Sort by performance (on-time completion rate descending)
    metrics.sort((a, b) => b.on_time_completion_rate - a.on_time_completion_rate);

    res.json(metrics);
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard statistics
router.get('/dashboard', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    let taskQuery = 'SELECT status, COUNT(*) as count FROM tasks';
    const params: any[] = [];

    if (!isAdmin) {
      taskQuery += ' WHERE assignee_id = ?';
      params.push(userId);
    }

    taskQuery += ' GROUP BY status';

    const statusCounts = await db.all(taskQuery, params);

    // Get pending follow-ups
    let followUpQuery = `
      SELECT COUNT(*) as count
      FROM follow_ups f
      JOIN tasks t ON f.task_id = t.id
      WHERE f.status = 'pending'
      AND f.next_send <= datetime('now')
      AND t.is_snoozed = 0
      AND t.status != 'completed'
    `;

    if (!isAdmin) {
      followUpQuery += ' AND t.assignee_id = ?';
      params.push(userId);
    }

    const pendingFollowUps = await db.get(followUpQuery, params);

    // Get overdue tasks
    let overdueQuery = `
      SELECT COUNT(*) as count
      FROM tasks
      WHERE due_date < datetime('now')
      AND status != 'completed'
    `;

    if (!isAdmin) {
      overdueQuery += ' AND assignee_id = ?';
    }

    const overdueCount = await db.get(overdueQuery, isAdmin ? [] : [userId]);

    // Get tasks unchanged for 14+ days
    let staleQuery = `
      SELECT COUNT(*) as count
      FROM tasks
      WHERE julianday('now') - julianday(updated_at) >= 14
      AND status != 'completed'
    `;

    if (!isAdmin) {
      staleQuery += ' AND assignee_id = ?';
    }

    const staleCount = await db.get(staleQuery, isAdmin ? [] : [userId]);

    res.json({
      status_counts: statusCounts,
      pending_follow_ups: pendingFollowUps.count,
      overdue_tasks: overdueCount.count,
      stale_tasks: staleCount.count,
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

