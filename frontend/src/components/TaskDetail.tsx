import { useEffect, useState } from 'react';
import api from '../services/api';
import { Task, User, Comment, TaskHistory } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import './TaskDetail.css';

interface TaskDetailProps {
  task: Task;
  assignees: User[];
  onClose: () => void;
  onRefresh: () => void;
}

const TaskDetail = ({ task: initialTask, assignees, onClose, onRefresh }: TaskDetailProps) => {
  const { user } = useAuth();
  const [task, setTask] = useState<Task>(initialTask);
  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTaskDetails();
  }, [initialTask.id]);

  const fetchTaskDetails = async () => {
    try {
      const [taskRes, commentsRes, historyRes] = await Promise.all([
        api.get(`/tasks/${initialTask.id}`),
        api.get(`/comments/task/${initialTask.id}`),
        api.get(`/history/task/${initialTask.id}`),
      ]);
      setTask(taskRes.data);
      setComments(commentsRes.data);
      setHistory(historyRes.data);
    } catch (error) {
      console.error('Error fetching task details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await api.post('/comments', {
        task_id: task.id,
        content: newComment,
      });
      setNewComment('');
      await fetchTaskDetails();
      onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error adding comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.put(`/tasks/${task.id}`, { status: newStatus });
      await fetchTaskDetails();
      onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error updating status');
    }
  };

  const isAdmin = user?.role === 'admin';
  const isAssignee = task.assignee_id === user?.id;

  return (
    <div className="task-detail-overlay" onClick={onClose}>
      <div className="task-detail-content" onClick={(e) => e.stopPropagation()}>
        <div className="task-detail-header">
          <h2>{task.title}</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="task-detail-body">
          <div className="task-info-section">
            <div className="info-group">
              <label>Status:</label>
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={!isAdmin && !isAssignee}
                className="status-select"
              >
                <option value="to_do">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="info-group">
              <label>Priority:</label>
              <span className="priority-badge">{task.priority.toUpperCase()}</span>
            </div>

            <div className="info-group">
              <label>Due Date:</label>
              <span>{format(new Date(task.due_date), 'MMM dd, yyyy')}</span>
            </div>

            {task.assignee_name && (
              <div className="info-group">
                <label>Assignee:</label>
                <span>{task.assignee_name} ({task.assignee_email})</span>
              </div>
            )}

            {task.description && (
              <div className="info-group">
                <label>Description:</label>
                <p className="description-text">{task.description}</p>
              </div>
            )}
          </div>

          <div className="comments-section">
            <h3>Comments</h3>
            <div className="comments-list">
              {comments.map((comment) => (
                <div key={comment.id} className="comment-item">
                  <div className="comment-header">
                    <span className="comment-author">{comment.user_name}</span>
                    <span className="comment-date">
                      {format(new Date(comment.created_at), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                  <p className="comment-content">{comment.content}</p>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="no-comments">No comments yet</p>
              )}
            </div>

            {(isAdmin || isAssignee) && (
              <form onSubmit={handleAddComment} className="comment-form">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={3}
                  className="comment-input"
                />
                <button type="submit" disabled={submitting || !newComment.trim()} className="submit-comment">
                  {submitting ? 'Posting...' : 'Post Comment'}
                </button>
              </form>
            )}
          </div>

          <div className="history-section">
            <h3>Task History</h3>
            <div className="history-timeline">
              {history.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="history-time">
                    {format(new Date(item.created_at), 'MMM dd, yyyy HH:mm')}
                  </div>
                  <div className="history-content">
                    <strong>{item.user_name || 'System'}</strong> - {item.action.replace('_', ' ')}
                    {item.old_value && item.new_value && (
                      <span className="history-change">
                        : "{item.old_value}" → "{item.new_value}"
                      </span>
                    )}
                    {item.details && <p className="history-details">{item.details}</p>}
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <p className="no-history">No history available</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetail;

