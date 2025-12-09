import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { db } from '../database/database.js';

// Load environment variables at the top of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });

const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587');
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Accunite Task Management <noreply@accunite.com>';

// Debug: Log email config (without showing password)
if (EMAIL_USER || EMAIL_PASS) {
  console.log(`[Email Config] Host: ${EMAIL_HOST}, Port: ${EMAIL_PORT}, User: ${EMAIL_USER}, From: ${EMAIL_FROM}`);
} else {
  console.log(`[Email Config] No email credentials found. EMAIL_USER: ${EMAIL_USER ? 'set' : 'NOT SET'}, EMAIL_PASS: ${EMAIL_PASS ? 'set' : 'NOT SET'}`);
}

let transporter: nodemailer.Transporter | null = null;

export const initEmailService = (): void => {
  if (EMAIL_USER && EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465, // true for 465, false for other ports
      requireTLS: EMAIL_PORT === 587 || EMAIL_PORT === 2525 || EMAIL_PORT === 2587, // Enable STARTTLS for EmailIT
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
      }
    });
    console.log(`Email service initialized with ${EMAIL_HOST}:${EMAIL_PORT}`);
  } else {
    console.warn('Email service not configured - notifications will be logged only');
  }
};

export const sendTaskFollowUpEmail = async (taskId: string): Promise<boolean> => {
  try {
    const task = await db.get(
      `SELECT t.*, u.name as assignee_name, u.email as assignee_email
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.id = ?`,
      [taskId]
    );

    if (!task || !task.assignee_email) {
      console.log(`No assignee email found for task ${taskId}`);
      return false;
    }

    if (task.is_snoozed) {
      console.log(`Task ${taskId} is snoozed, skipping email`);
      return false;
    }

    const subject = `Task Follow-up: ${task.title}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Accunite Task Management</h2>
        <p>Hi ${task.assignee_name},</p>
        <p>This is a follow-up regarding your task:</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${task.title}</h3>
          ${task.description ? `<p>${task.description}</p>` : ''}
          <p><strong>Status:</strong> ${task.status.replace('_', ' ').toUpperCase()}</p>
          <p><strong>Priority:</strong> ${task.priority.toUpperCase()}</p>
          <p><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</p>
        </div>
        <p>Please provide an update by adding a comment to the task.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
          This is an automated follow-up email. Adding a comment to the task will reset the follow-up cycle.
        </p>
      </div>
    `;

    if (transporter) {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: task.assignee_email,
        subject,
        html,
      });
      console.log(`Follow-up email sent for task ${taskId} to ${task.assignee_email}`);
      return true;
    } else {
      console.log(`[EMAIL MOCK] Follow-up email would be sent for task ${taskId} to ${task.assignee_email}`);
      console.log(`[EMAIL MOCK] Subject: ${subject}`);
      return true; // Return true even in mock mode
    }
  } catch (error) {
    console.error('Error sending follow-up email:', error);
    return false;
  }
};

export const sendWelcomeEmail = async (
  userName: string,
  userEmail: string,
  password: string,
  appUrl?: string
): Promise<boolean> => {
  try {
    const appBaseUrl = appUrl || process.env.APP_URL || 'https://your-app-url.ondigitalocean.app';
    
    const subject = 'Welcome to Accunite Task Management';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Accunite</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Task Management System</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">Hi ${userName},</p>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            You have been added as an <strong>Assignee</strong> to the Accunite Task Management panel. 
            You can now access the system to view and manage your assigned tasks.
          </p>
          
          <div style="background: #f9fafb; border-left: 4px solid #2563eb; padding: 20px; margin: 25px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #1f2937; font-size: 18px;">Your Login Credentials:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: 600; width: 100px;">Email:</td>
                <td style="padding: 8px 0; color: #1f2937; font-family: monospace;">${userEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Password:</td>
                <td style="padding: 8px 0; color: #1f2937; font-family: monospace; font-weight: 600;">${password}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appBaseUrl}" 
               style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; 
                      text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;
                      box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);">
              Access Task Management Panel
            </a>
          </div>
          
          <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h4 style="margin-top: 0; color: #1e40af; font-size: 16px;">✨ What you can do:</h4>
            <ul style="color: #374151; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
              <li>View all tasks assigned to you</li>
              <li>Update task status (To Do, In Progress, Completed)</li>
              <li>Add comments and updates to tasks</li>
              <li>Track task due dates and priorities</li>
              <li>Use the Kanban board for visual task management</li>
            </ul>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin-top: 30px;">
            <strong>Security Note:</strong> For your security, please change your password after your first login. 
            If you have any questions or need assistance, please contact your administrator.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
            This is an automated email from Accunite Task Management System.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `;

    if (transporter) {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: userEmail,
        subject,
        html,
      });
      console.log(`Welcome email sent to ${userEmail} for user ${userName}`);
      return true;
    } else {
      console.log(`[EMAIL MOCK] Welcome email would be sent to ${userEmail}`);
      console.log(`[EMAIL MOCK] Subject: ${subject}`);
      console.log(`[EMAIL MOCK] User: ${userName}, Password: ${password}`);
      return true; // Return true even in mock mode
    }
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};

