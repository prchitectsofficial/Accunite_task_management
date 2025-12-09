import { db } from '../database/database.js';
import { sendTaskFollowUpEmail } from './email.js';
import { addDays, generateId, logTaskHistory } from '../utils/helpers.js';

// Run follow-up scheduler every hour
const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

export const initializeFollowUpScheduler = (): void => {
  // Run immediately on startup
  processFollowUps();

  // Then run every hour
  setInterval(processFollowUps, CHECK_INTERVAL);
  console.log('Follow-up scheduler initialized');
};

const processFollowUps = async (): Promise<void> => {
  try {
    const now = new Date().toISOString();
    
    // Get all pending follow-ups that are due
    const dueFollowUps = await db.all(
      `SELECT f.*, t.title as task_title, t.is_snoozed, t.status
       FROM follow_ups f
       JOIN tasks t ON f.task_id = t.id
       WHERE f.status = 'pending'
       AND f.next_send <= ?
       AND t.is_snoozed = 0
       AND t.status != 'completed'`,
      [now]
    );

    for (const followUp of dueFollowUps) {
      await processFollowUp(followUp);
    }
  } catch (error) {
    console.error('Error processing follow-ups:', error);
  }
};

const processFollowUp = async (followUp: any): Promise<void> => {
  try {
    // Send email notification
    const emailSent = await sendTaskFollowUpEmail(followUp.task_id);

    if (emailSent) {
      // Update follow-up record
      const nextSend = addDays(new Date(), 4).toISOString();
      await db.run(
        `UPDATE follow_ups
         SET last_sent = datetime('now'),
             next_send = ?,
             status = 'pending'
         WHERE id = ?`,
        [nextSend, followUp.id]
      );

      // Log history
      await logTaskHistory(
        followUp.task_id,
        undefined,
        'follow_up_sent',
        undefined,
        undefined,
        `Follow-up email sent. Next follow-up scheduled for ${nextSend}`
      );
    }
  } catch (error) {
    console.error(`Error processing follow-up ${followUp.id}:`, error);
  }
};

export const createFollowUpForTask = async (taskId: string): Promise<void> => {
  try {
    // Check if follow-up already exists
    const existing = await db.get(
      'SELECT id FROM follow_ups WHERE task_id = ? AND status = "pending"',
      [taskId]
    );

    if (!existing) {
      const nextSend = addDays(new Date(), 4).toISOString();
      await db.run(
        `INSERT INTO follow_ups (id, task_id, due_date, next_send, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', datetime('now'))`,
        [generateId(), taskId, nextSend, nextSend]
      );
    }
  } catch (error) {
    console.error('Error creating follow-up for task:', error);
  }
};

export const resetFollowUpForTask = async (taskId: string): Promise<void> => {
  try {
    // Reset next send to 4 days from now
    const nextSend = addDays(new Date(), 4).toISOString();
    
    await db.run(
      `UPDATE follow_ups
       SET next_send = ?,
           status = 'pending'
       WHERE task_id = ?`,
      [nextSend, taskId]
    );

    // If no follow-up exists, create one
    const existing = await db.get(
      'SELECT id FROM follow_ups WHERE task_id = ?',
      [taskId]
    );

    if (!existing) {
      await createFollowUpForTask(taskId);
    }
  } catch (error) {
    console.error('Error resetting follow-up for task:', error);
  }
};

export const pauseFollowUpsForTask = async (taskId: string, until?: string): Promise<void> => {
  try {
    await db.run(
      `UPDATE follow_ups
       SET status = 'snoozed'
       WHERE task_id = ? AND status = 'pending'`,
      [taskId]
    );
  } catch (error) {
    console.error('Error pausing follow-ups for task:', error);
  }
};

export const resumeFollowUpsForTask = async (taskId: string): Promise<void> => {
  try {
    const nextSend = addDays(new Date(), 4).toISOString();
    
    await db.run(
      `UPDATE follow_ups
       SET status = 'pending',
           next_send = ?
       WHERE task_id = ?`,
      [nextSend, taskId]
    );
  } catch (error) {
    console.error('Error resuming follow-ups for task:', error);
  }
};

