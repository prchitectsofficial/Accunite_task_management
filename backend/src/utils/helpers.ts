import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/database.js';
import { TaskHistory } from '../types/index.js';

export const generateId = (): string => {
  return uuidv4();
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0] + ' ' + d.toTimeString().split(' ')[0];
};

export const logTaskHistory = async (
  taskId: string,
  userId: string | undefined,
  action: string,
  oldValue?: string,
  newValue?: string,
  details?: string
): Promise<void> => {
  try {
    await db.run(
      `INSERT INTO task_history (id, task_id, user_id, action, old_value, new_value, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [generateId(), taskId, userId || null, action, oldValue || null, newValue || null, details || null]
    );
  } catch (error) {
    console.error('Error logging task history:', error);
  }
};

export const calculateDaysUnchanged = (updatedAt: string): number => {
  const updated = new Date(updatedAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - updated.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const shouldHighlightTask = (task: { status: string; updated_at: string }): boolean => {
  if (task.status === 'completed') return false;
  return calculateDaysUnchanged(task.updated_at) >= 14;
};

