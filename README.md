# Accunite Task Management System

A comprehensive task management system with performance analytics, role-based access, automated follow-ups, and admin controls.

## Features

- **Role-Based Access Control**: Admin and Assignee roles with different permissions
- **User Management**: Create, edit, and delete assignees (admin only)
- **Task Management**: Full CRUD operations with automatic defaults (5-day due date, normal priority)
- **Task Status**: To Do, In Progress, Completed with visual indicators
- **Smart Assignment**: Validation preventing more than 3 'In Progress' tasks per assignee
- **Task Comments**: Commenting system with timestamps for updates
- **Automated Follow-ups**: 4-day follow-up cycle with email notifications
- **Welcome Emails**: New assignees receive welcome emails with login credentials
- **Task Snoozing**: Admin-only snooze feature that pauses all follow-ups
- **Task History**: Comprehensive timeline showing all events
- **Performance Dashboard**: Analytics comparing assignees (completion time, tasks completed, on-time rate)
- **Visual Indicators**: Red highlighting for tasks unchanged for 14+ days
- **Filtering & Sorting**: Filter by status, priority, assignee, and due date
- **Kanban Board**: Drag-and-drop board with real-time validation
- **Accunite Branding**: Professional interface with performance leaderboard

## Setup

1. Install dependencies:

```bash
npm run install:all
```

2. Set up backend environment:

```bash
cd backend
# On Windows (Command Prompt):
copy .env.example .env

# On Windows (PowerShell):
Copy-Item .env.example .env

# On Mac/Linux:
cp .env.example .env

# Edit .env with your configuration (optional - email settings)
```

3. Initialize database (runs automatically on first start)

4. Run development servers:

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## Default Login

- Admin: admin@accunite.com / admin123
- Create assignees through the admin panel

## Technology Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express, TypeScript
- Database: SQLite
- Email: Nodemailer
