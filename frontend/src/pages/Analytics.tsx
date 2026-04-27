import { useEffect, useState } from 'react';
import api from '../services/api';
import { PerformanceMetrics } from '../types';
import './Analytics.css';

const Analytics = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await api.get('/analytics/performance');
      setMetrics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading analytics...</div>;
  }

  const getRankColor = (index: number) => {
    if (index === 0) return '#10b981'; // Gold
    if (index === 1) return '#3b82f6'; // Silver
    if (index === 2) return '#f59e0b'; // Bronze
    return '#6b7280';
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <h1>Performance Analytics</h1>
        <p className="analytics-subtitle">Team performance metrics and leaderboard</p>
      </div>

      <div className="leaderboard-section">
        <h2>Performance Leaderboard</h2>
        <div className="leaderboard">
          {metrics.length === 0 ? (
            <div className="empty-state">
              <p>No performance data available yet</p>
            </div>
          ) : (
            metrics.map((metric, index) => (
              <div
                key={metric.assignee_id}
                className={`leaderboard-card ${index < 3 ? 'top-three' : ''}`}
                style={index < 3 ? { borderLeftColor: getRankColor(index) } : {}}
              >
                <div className="rank-badge" style={{ color: getRankColor(index) }}>
                  {getRankIcon(index)}
                </div>
                <div className="card-content">
                  <div className="card-header">
                    <h3>{metric.assignee_name}</h3>
                    <span className="email">{metric.assignee_email}</span>
                  </div>
                  <div className="metrics-grid">
                    <div className="metric-item">
                      <span className="metric-label">On-Time Rate</span>
                      <span className="metric-value highlight">
                        {metric.on_time_completion_rate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Avg. Completion Time</span>
                      <span className="metric-value">
                        {metric.avg_completion_time.toFixed(1)} days
                      </span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Completed (7 days)</span>
                      <span className="metric-value">{metric.tasks_completed_7d}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Total Completed</span>
                      <span className="metric-value">{metric.total_completed}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Total Tasks</span>
                      <span className="metric-value">{metric.total_tasks}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Completion Rate</span>
                      <span className="metric-value">
                        {metric.total_tasks > 0
                          ? ((metric.total_completed / metric.total_tasks) * 100).toFixed(1)
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="metrics-summary">
        <h2>Summary Statistics</h2>
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-icon">👥</div>
            <div className="summary-content">
              <h3>Total Assignees</h3>
              <p className="summary-value">{metrics.length}</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">✅</div>
            <div className="summary-content">
              <h3>Total Completed Tasks</h3>
              <p className="summary-value">
                {metrics.reduce((sum, m) => sum + m.total_completed, 0)}
              </p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">📊</div>
            <div className="summary-content">
              <h3>Average On-Time Rate</h3>
              <p className="summary-value">
                {metrics.length > 0
                  ? (
                      metrics.reduce((sum, m) => sum + m.on_time_completion_rate, 0) /
                      metrics.length
                    ).toFixed(1)
                  : 0}
                %
              </p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">⏱️</div>
            <div className="summary-content">
              <h3>Avg. Completion Time</h3>
              <p className="summary-value">
                {metrics.length > 0
                  ? (
                      metrics.reduce((sum, m) => sum + m.avg_completion_time, 0) /
                      metrics.length
                    ).toFixed(1)
                  : 0}{' '}
                days
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;

