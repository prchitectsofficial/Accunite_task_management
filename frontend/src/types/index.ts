export type UserRole = 'admin' | 'assignee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at?: string;
}

export type TaskStatusType = 'to_do' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatusType;
  priority: TaskPriority;
  assignee_id?: string;
  assignee_name?: string;
  assignee_email?: string;
  due_date: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  created_by_name?: string;
  is_snoozed: number;
  snoozed_until?: string;
  days_unchanged?: number;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  user_name?: string;
  content: string;
  created_at: string;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  user_id?: string;
  user_name?: string;
  action: string;
  old_value?: string;
  new_value?: string;
  details?: string;
  created_at: string;
}

export interface PerformanceMetrics {
  assignee_id: string;
  assignee_name: string;
  assignee_email: string;
  avg_completion_time: number;
  tasks_completed_7d: number;
  on_time_completion_rate: number;
  total_completed: number;
  total_tasks: number;
}

export interface DashboardStats {
  status_counts: Array<{ status: string; count: number }>;
  pending_follow_ups: number;
  overdue_tasks: number;
  stale_tasks: number;
}

