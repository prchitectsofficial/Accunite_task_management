import express from 'express';
import { sendContactFormEmail } from '../services/email.js';

const router = express.Router();

type ContactPayload = {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  budget?: string;
  message: string;
};

const isValidEmail = (email: string): boolean => {
  // Basic sanity check (keeps it simple; server-side only)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const normalize = (value: unknown): string => {
  return String(value ?? '').trim();
};

router.post('/', async (req, res) => {
  try {
    const payload: ContactPayload = {
      name: normalize(req.body?.name),
      email: normalize(req.body?.email),
      company: normalize(req.body?.company),
      phone: normalize(req.body?.phone),
      budget: normalize(req.body?.budget),
      message: normalize(req.body?.message),
    };

    if (!payload.name || payload.name.length < 2) {
      res.status(400).json({ error: 'Name is required.' });
      return;
    }
    if (!payload.email || !isValidEmail(payload.email)) {
      res.status(400).json({ error: 'A valid email is required.' });
      return;
    }
    if (!payload.message || payload.message.length < 10) {
      res.status(400).json({ error: 'Message is too short.' });
      return;
    }

    // Simple length caps to prevent abuse
    if (payload.name.length > 120 || payload.email.length > 200) {
      res.status(400).json({ error: 'Input too long.' });
      return;
    }
    if ((payload.company || '').length > 200 || (payload.phone || '').length > 60 || (payload.budget || '').length > 80) {
      res.status(400).json({ error: 'Input too long.' });
      return;
    }
    if (payload.message.length > 5000) {
      res.status(400).json({ error: 'Message is too long.' });
      return;
    }

    await sendContactFormEmail(payload);

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

