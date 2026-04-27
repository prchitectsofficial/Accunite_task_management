import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/database.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { generateId } from '../utils/helpers.js';
import { sendWelcomeEmail } from '../services/email.js';

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await db.all(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all assignees (admin only)
router.get('/assignees', authenticate, requireAdmin, async (req, res) => {
  try {
    const assignees = await db.all(
      'SELECT id, name, email, role, created_at FROM users WHERE role = ? ORDER BY name',
      ['assignee']
    );
    res.json(assignees);
  } catch (error) {
    console.error('Get assignees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user (admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, email, password, role = 'assignee' } = req.body;

    if (!name || !email) {
      res.status(400).json({ error: 'Name and email are required' });
      return;
    }

    // Check if email already exists
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      res.status(400).json({ error: 'Email already exists' });
      return;
    }

    const id = generateId();
    const defaultPassword = password || 'password123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await db.run(
      'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [id, name, email, hashedPassword, role]
    );

    const user = await db.get('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [id]);
    
    // Send welcome email if user is an assignee
    if (role === 'assignee') {
      try {
        const appUrl = process.env.APP_URL || req.protocol + '://' + req.get('host');
        await sendWelcomeEmail(name, email, defaultPassword, appUrl);
      } catch (error) {
        // Log error but don't fail user creation if email fails
        console.error('Error sending welcome email:', error);
      }
    }
    
    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user (admin only)
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role } = req.body;

    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existing = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
      if (existing) {
        res.status(400).json({ error: 'Email already exists' });
        return;
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
    }
    if (role) {
      updates.push('role = ?');
      values.push(role);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(id);
    await db.run(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updatedUser = await db.get('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [id]);
    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting admin user
    const user = await db.get('SELECT role FROM users WHERE id = ?', [id]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.role === 'admin') {
      res.status(400).json({ error: 'Cannot delete admin user' });
      return;
    }

    // Check if user has tasks assigned
    const tasks = await db.all('SELECT id FROM tasks WHERE assignee_id = ?', [id]);
    if (tasks.length > 0) {
      res.status(400).json({ error: 'Cannot delete user with assigned tasks' });
      return;
    }

    await db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

