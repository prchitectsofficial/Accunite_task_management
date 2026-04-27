import express from 'express';
import { db } from '../database/database.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { generateId, addDays, calculateDaysUnchanged, logTaskHistory } from '../utils/helpers.js';
import { createFollowUpForTask, resetFollowUpForTask, pauseFollowUpsForTask, resumeFollowUpsForTask } from '../services/followUpScheduler.js';

const router = express.Router();

// Get all tasks (filtered by role)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { status, priority, assignee_id, sort_by = 'due_date', sort_order = 'asc' } = req.query;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    let query = `
      SELECT t.*,
             u.name as assignee_name,
             u.email as assignee_email,
             creator.name as created_by_name,
             CASE 
               WHEN julianday('now') - julianday(t.updated_at) >= 14 AND t.status != 'completed' THEN 1
               ELSE 0
             END as days_unchanged
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE 1=1
    `;

    const params: any[] = [];

    // Role-based filtering
    if (!isAdmin) {
      query += ' AND t.assignee_id = ?';
      params.push(userId);
    }

    // Status filter
    if (status && status !== 'all') {
      query += ' AND t.status = ?';
      params.push(status);
    }

    // Priority filter
    if (priority && priority !== 'all') {
      query += ' AND t.priority = ?';
      params.push(priority);
    }

    // Assignee filter (admin only)
    if (assignee_id && isAdmin) {
      query += ' AND t.assignee_id = ?';
      params.push(assignee_id);
    }

    // Sorting
    const validSortFields = ['due_date', 'created_at', 'updated_at', 'priority', 'status'];
    const sortField = validSortFields.includes(sort_by as string) ? sort_by : 'due_date';
    const sortDirection = sort_order === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY t.${sortField} ${sortDirection}`;

    const tasks = await db.all(query, params);

    res.json(tasks.map(task => ({
      ...task,
      days_unchanged: calculateDaysUnchanged(task.updated_at),
    })));
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single task
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    const task = await db.get(
      `SELECT t.*,
              u.name as assignee_name,
              u.email as assignee_email,
              creator.name as created_by_name
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       LEFT JOIN users creator ON t.created_by = creator.id
       WHERE t.id = ?`,
      [id]
    );

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Role-based access check
    if (!isAdmin && task.assignee_id !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    task.days_unchanged = calculateDaysUnchanged(task.updated_at);

    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create task
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { title, description, priority = 'normal', assignee_id, due_date } = req.body;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    // Validate assignee (admin can assign to anyone, assignee can only self-assign)
    let finalAssigneeId = assignee_id;
    if (!isAdmin) {
      finalAssigneeId = userId;
    } else if (assignee_id) {
      const assignee = await db.get('SELECT id FROM users WHERE id = ? AND role = ?', [assignee_id, 'assignee']);
      if (!assignee) {
        res.status(400).json({ error: 'Invalid assignee' });
        return;
      }
    }

    const id = generateId();
    const defaultDueDate = due_date || addDays(new Date(), 5).toISOString();

    await db.run(
      `INSERT INTO tasks (id, title, description, status, priority, assignee_id, due_date, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'to_do', ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, title, description || null, priority, finalAssigneeId || null, defaultDueDate, userId]
    );

    // Create follow-up for task
    if (finalAssigneeId) {
      await createFollowUpForTask(id);
    }

    // Log history
    await logTaskHistory(id, userId, 'task_created', undefined, undefined, `Task created with status: to_do, priority: ${priority}`);

    const task = await db.get(
      `SELECT t.*,
              u.name as assignee_name,
              u.email as assignee_email,
              creator.name as created_by_name
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       LEFT JOIN users creator ON t.created_by = creator.id
       WHERE t.id = ?`,
      [id]
    );

    task.days_unchanged = calculateDaysUnchanged(task.updated_at);

    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Role-based access check
    if (!isAdmin && task.assignee_id !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { title, description, status, priority, assignee_id, due_date } = req.body;

    // Validate status change (only assignee can change status)
    if (status && status !== task.status) {
      if (!isAdmin && task.assignee_id !== userId) {
        res.status(403).json({ error: 'Only assignee can change status' });
        return;
      }

      // Check In Progress limit if changing to in_progress
      if (status === 'in_progress') {
        const currentAssignee = assignee_id || task.assignee_id;
        if (currentAssignee) {
          const inProgressCount = await db.get(
            'SELECT COUNT(*) as count FROM tasks WHERE assignee_id = ? AND status = ? AND id != ?',
            [currentAssignee, 'in_progress', id]
          );

          if (inProgressCount.count >= 3) {
            res.status(400).json({ error: 'Assignee already has 3 tasks in progress' });
            return;
          }
        }
      }

      await logTaskHistory(id, userId, 'status_changed', task.status, status);
    }

    // Validate assignee change (admin only or assignee can reassign to themselves)
    if (assignee_id && assignee_id !== task.assignee_id) {
      if (!isAdmin) {
        res.status(403).json({ error: 'Only admin can reassign tasks' });
        return;
      }

      const assignee = await db.get('SELECT id, role FROM users WHERE id = ?', [assignee_id]);
      if (!assignee || assignee.role !== 'assignee') {
        res.status(400).json({ error: 'Invalid assignee' });
        return;
      }

      // Check In Progress limit for new assignee
      const inProgressCount = await db.get(
        'SELECT COUNT(*) as count FROM tasks WHERE assignee_id = ? AND status = ?',
        [assignee_id, 'in_progress']
      );

      if (status === 'in_progress' || task.status === 'in_progress') {
        if (inProgressCount.count >= 3) {
          res.status(400).json({ error: 'Assignee already has 3 tasks in progress' });
          return;
        }
      }

      await logTaskHistory(id, userId, 'assignee_changed', task.assignee_id, assignee_id);

      // Create follow-up if task is being assigned
      if (!task.assignee_id && assignee_id) {
        await createFollowUpForTask(id);
      }
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
      if (title !== task.title) {
        await logTaskHistory(id, userId, 'title_changed', task.title, title);
      }
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority);
      if (priority !== task.priority) {
        await logTaskHistory(id, userId, 'priority_changed', task.priority, priority);
      }
    }
    if (assignee_id !== undefined) {
      updates.push('assignee_id = ?');
      values.push(assignee_id || null);
    }
    if (due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(due_date);
      if (due_date !== task.due_date) {
        await logTaskHistory(id, userId, 'due_date_changed', task.due_date, due_date);
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    await db.run(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Reset follow-up if comment was added (handled separately)
    // If status changed to completed, we can pause follow-ups
    if (status === 'completed') {
      await pauseFollowUpsForTask(id);
    } else if (status === 'in_progress' && task.status === 'to_do') {
      await resetFollowUpForTask(id);
    }

    const updatedTask = await db.get(
      `SELECT t.*,
              u.name as assignee_name,
              u.email as assignee_email,
              creator.name as created_by_name
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       LEFT JOIN users creator ON t.created_by = creator.id
       WHERE t.id = ?`,
      [id]
    );

    updatedTask.days_unchanged = calculateDaysUnchanged(updatedTask.updated_at);

    res.json(updatedTask);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete task (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    await db.run('DELETE FROM tasks WHERE id = ?', [id]);
    await logTaskHistory(id, req.user!.id, 'task_deleted', undefined, undefined, 'Task deleted');

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Snooze task (admin only)
router.post('/:id/snooze', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { until } = req.body;

    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const snoozedUntil = until || addDays(new Date(), 7).toISOString();

    await db.run(
      'UPDATE tasks SET is_snoozed = 1, snoozed_until = ? WHERE id = ?',
      [snoozedUntil, id]
    );

    await pauseFollowUpsForTask(id);
    await logTaskHistory(id, req.user!.id, 'task_snoozed', undefined, snoozedUntil, `Task snoozed until ${snoozedUntil}`);

    const updatedTask = await db.get(
      `SELECT t.*,
              u.name as assignee_name,
              u.email as assignee_email,
              creator.name as created_by_name
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       LEFT JOIN users creator ON t.created_by = creator.id
       WHERE t.id = ?`,
      [id]
    );

    res.json(updatedTask);
  } catch (error) {
    console.error('Snooze task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unsnooze task (admin only)
router.post('/:id/unsnooze', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    await db.run(
      'UPDATE tasks SET is_snoozed = 0, snoozed_until = NULL WHERE id = ?',
      [id]
    );

    await resumeFollowUpsForTask(id);
    await logTaskHistory(id, req.user!.id, 'task_unsnoozed', undefined, undefined, 'Task unsnoozed');

    const updatedTask = await db.get(
      `SELECT t.*,
              u.name as assignee_name,
              u.email as assignee_email,
              creator.name as created_by_name
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       LEFT JOIN users creator ON t.created_by = creator.id
       WHERE t.id = ?`,
      [id]
    );

    res.json(updatedTask);
  } catch (error) {
    console.error('Unsnooze task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

