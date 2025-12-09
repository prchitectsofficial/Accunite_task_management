import { useState } from 'react';
import api from '../services/api';
import { Task } from '../types';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import './TaskCard.css';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onView?: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onRefresh: () => void;
}

const TaskCard = ({ task, onEdit, onView, onDelete, onRefresh }: TaskCardProps) => {
  const { user } = useAuth();
  const [updating, setUpdating] = useState(false);
  const isAdmin = user?.role === 'admin';
  const isAssignee = task.assignee_id === user?.id;
  const isStale = (task.days_unchanged || 0) >= 14 && task.status !== 'completed';
  const isOverdue = new Date(task.due_date) < new Date() && task.status !== 'completed';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'to_do': return '#6b7280';
      case 'in_progress': return '#f59e0b';
      case 'completed': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return '#6b7280';
      case 'normal': return '#3b82f6';
      case 'high': return '#f59e0b';
      case 'urgent': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const handleStatusChange = async (newStatus: string) => {
    if (updating) return;
    setUpdating(true);

    try {
      await api.put(`/tasks/${task.id}`, { status: newStatus });
      onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error updating task status');
    } finally {
      setUpdating(false);
    }
  };

  const handleSnooze = async () => {
    if (!isAdmin) return;

    try {
      await api.post(`/tasks/${task.id}/snooze`);
      onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error snoozing task');
    }
  };

  const handleUnsnooze = async () => {
    if (!isAdmin) return;

    try {
      await api.post(`/tasks/${task.id}/unsnooze`);
      onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error unsnoozing task');
    }
  };

  return (
    <div
      className={`task-card ${isStale ? 'stale' : ''} ${isOverdue ? 'overdue' : ''}`}
      style={isStale ? { borderLeft: '4px solid var(--error)' } : {}}
    >
      <div className="task-header">
        <h3 className="task-title" onClick={() => onView && onView(task)} style={{ cursor: onView ? 'pointer' : 'default' }}>
          {task.title}
        </h3>
        <div className="task-actions">
          {(isAdmin || isAssignee) && (
            <button
              onClick={() => onEdit(task)}
              className="icon-btn"
              title="Edit task"
            >
              ✏️
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => onDelete(task.id)}
              className="icon-btn"
              title="Delete task"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {task.description && (
        <p className="task-description">{task.description}</p>
      )}

      <div className="task-meta">
        <div className="task-meta-item">
          <span className="label">Status:</span>
          <select
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={updating || (!isAdmin && !isAssignee)}
            className="status-select"
            style={{ color: getStatusColor(task.status) }}
          >
            <option value="to_do">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="task-meta-item">
          <span className="label">Priority:</span>
          <span
            className="priority-badge"
            style={{ backgroundColor: getPriorityColor(task.priority) + '20', color: getPriorityColor(task.priority) }}
          >
            {task.priority.toUpperCase()}
          </span>
        </div>

        <div className="task-meta-item">
          <span className="label">Due:</span>
          <span className={isOverdue ? 'overdue-date' : ''}>
            {format(new Date(task.due_date), 'MMM dd, yyyy')}
          </span>
        </div>

        {task.assignee_name && (
          <div className="task-meta-item">
            <span className="label">Assignee:</span>
            <span>{task.assignee_name}</span>
          </div>
        )}

        {isStale && (
          <div className="task-alert">
            🔴 Unchanged for {task.days_unchanged} days
          </div>
        )}

        {task.is_snoozed === 1 && (
          <div className="task-alert snoozed">
            😴 Snoozed until {task.snoozed_until ? format(new Date(task.snoozed_until), 'MMM dd, yyyy') : 'further notice'}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="task-admin-actions">
          {task.is_snoozed === 1 ? (
            <button onClick={handleUnsnooze} className="btn-small">
              Unsnooze
            </button>
          ) : (
            <button onClick={handleSnooze} className="btn-small">
              Snooze
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskCard;

