import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { DashboardStats } from '../types';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/analytics/dashboard');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const statusCounts = stats?.status_counts || [];
  const toDoCount = statusCounts.find(s => s.status === 'to_do')?.count || 0;
  const inProgressCount = statusCounts.find(s => s.status === 'in_progress')?.count || 0;
  const completedCount = statusCounts.find(s => s.status === 'completed')?.count || 0;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p className="welcome">Welcome back, {user?.name}!</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon to-do">📋</div>
          <div className="stat-content">
            <h3>To Do</h3>
            <p className="stat-value">{toDoCount}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon in-progress">⚡</div>
          <div className="stat-content">
            <h3>In Progress</h3>
            <p className="stat-value">{inProgressCount}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon completed">✅</div>
          <div className="stat-content">
            <h3>Completed</h3>
            <p className="stat-value">{completedCount}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon overdue">⚠️</div>
          <div className="stat-content">
            <h3>Overdue</h3>
            <p className="stat-value">{stats?.overdue_tasks || 0}</p>
          </div>
        </div>
      </div>

      <div className="alerts-section">
        <h2>Alerts & Notifications</h2>
        <div className="alerts-grid">
          {stats && stats.pending_follow_ups > 0 && (
            <div className="alert-card warning">
              <span className="alert-icon">📧</span>
              <div>
                <h4>Pending Follow-ups</h4>
                <p>{stats.pending_follow_ups} task(s) require follow-up</p>
              </div>
            </div>
          )}
          {stats && stats.stale_tasks > 0 && (
            <div className="alert-card error">
              <span className="alert-icon">🔴</span>
              <div>
                <h4>Stale Tasks</h4>
                <p>{stats.stale_tasks} task(s) unchanged for 14+ days</p>
              </div>
            </div>
          )}
          {stats && stats.overdue_tasks > 0 && (
            <div className="alert-card error">
              <span className="alert-icon">⏰</span>
              <div>
                <h4>Overdue Tasks</h4>
                <p>{stats.overdue_tasks} task(s) past due date</p>
              </div>
            </div>
          )}
          {(!stats || (stats.pending_follow_ups === 0 && stats.stale_tasks === 0 && stats.overdue_tasks === 0)) && (
            <div className="alert-card success">
              <span className="alert-icon">✨</span>
              <div>
                <h4>All Clear!</h4>
                <p>No alerts at this time</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <Link to="/tasks" className="action-card">
            <span className="action-icon">📋</span>
            <h3>View All Tasks</h3>
            <p>Manage your tasks</p>
          </Link>
          <Link to="/kanban" className="action-card">
            <span className="action-icon">📌</span>
            <h3>Kanban Board</h3>
            <p>Visual task management</p>
          </Link>
          {user?.role === 'admin' && (
            <>
              <Link to="/analytics" className="action-card">
                <span className="action-icon">📈</span>
                <h3>Performance Analytics</h3>
                <p>View team metrics</p>
              </Link>
              <Link to="/users" className="action-card">
                <span className="action-icon">👥</span>
                <h3>Manage Users</h3>
                <p>Add or edit assignees</p>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

