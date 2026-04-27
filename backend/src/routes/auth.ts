import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/database.js';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth.js';
import { generateId } from '../utils/helpers.js';

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await db.get('SELECT id, name, email, role FROM users WHERE id = ?', [req.user!.id]);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


// SSO Login via apps.accunite.com portal token
router.post('/sso', async (req, res) => {
  try {
    const token = req.cookies?.auth_token || req.body?.token;
    if (!token) {
      res.status(401).json({ error: 'No SSO token provided' });
      return;
    }

    // Verify with portal auth service
    const verifyRes = await new Promise<{ok:boolean,data:any}>((resolve) => {
      import('http').then(({ default: http }) => {
        const opts = {
          hostname: 'localhost', port: 3010,
          path: '/api/auth/verify', method: 'GET',
          headers: { 'Cookie': `auth_token=${token}` }
        };
        const req2 = http.request(opts, (r:any) => {
          let body = '';
          r.on('data', (d:any) => body += d);
          r.on('end', () => resolve({ok: r.statusCode===200, data: body}));
        });
        req2.on('error', () => resolve({ok:false, data:'{}'}));
        req2.end();
      }).catch(() => resolve({ok:false, data:'{}'}));
    });

    if (!verifyRes.ok) {
      res.status(401).json({ error: 'Invalid portal session' });
      return;
    }

    const data = JSON.parse(verifyRes.data) as { user: { email: string; name: string } };
    const email = data.user.email;
    const name = data.user.name;

    const ADMIN_EMAILS = ['contact@prchitects.com', 'manish@prchitects.com'];
    const role = ADMIN_EMAILS.includes(email) ? 'admin' : 'assignee';

    // Get or create user in task management DB
    let user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      const id = generateId();
      const hashedPassword = await bcrypt.hash(generateId(), 10); // random password
      await db.run(
        'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
        [id, name, email, hashedPassword, role]
      );
      user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    } else if (user.role !== role) {
      // Update role if it changed
      await db.run('UPDATE users SET role = ? WHERE email = ?', [role, email]);
      user.role = role;
    }

    const taskToken = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      token: taskToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error: any) {
    console.error('SSO login error full:', error?.message, error?.stack);
    res.status(500).json({ error: 'SSO login failed', detail: error?.message });
  }
});
