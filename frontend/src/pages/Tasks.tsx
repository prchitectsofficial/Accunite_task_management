import { useEffect, useState } from 'react';
import api from '../services/api';
import { Task, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import TaskModal from '../components/TaskModal';
import TaskDetail from '../components/TaskDetail';
import TaskCard from '../components/TaskCard';
import './Tasks.css';

const Tasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    assignee_id: 'all',
    sort_by: 'due_date',
    sort_order: 'asc',
  });

  useEffect(() => {
    fetchTasks();
    if (user?.role === 'admin') {
      fetchAssignees();
    }
  }, [filters, user]);

  const fetchTasks = async () => {
    try {
      const params: any = {};
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.priority !== 'all') params.priority = filters.priority;
      if (filters.assignee_id !== 'all' && user?.role === 'admin') {
        params.assignee_id = filters.assignee_id;
      }
      params.sort_by = filters.sort_by;
      params.sort_order = filters.sort_order;

      const response = await api.get('/tasks', { params });
      setTasks(response.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignees = async () => {
    try {
      const response = await api.get('/users/assignees');
      setAssignees(response.data);
    } catch (error) {
      console.error('Error fetching assignees:', error);
    }
  };

  const handleCreateTask = () => {
    setSelectedTask(null);
    setShowModal(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setShowModal(true);
  };

  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setShowDetail(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTask(null);
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
    setSelectedTask(null);
  };

  const handleSaveTask = async () => {
    await fetchTasks();
    handleCloseModal();
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      await api.delete(`/tasks/${taskId}`);
      await fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Error deleting task');
    }
  };

  if (loading) {
    return <div className="loading">Loading tasks...</div>;
  }

  return (
    <div className="tasks-page">
      <div className="tasks-header">
        <h1>Tasks</h1>
        <button onClick={handleCreateTask} className="btn-primary">
          + Create Task
        </button>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <label>Status:</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="all">All</option>
            <option value="to_do">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Priority:</label>
          <select
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          >
            <option value="all">All</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {user?.role === 'admin' && (
          <div className="filter-group">
            <label>Assignee:</label>
            <select
              value={filters.assignee_id}
              onChange={(e) => setFilters({ ...filters, assignee_id: e.target.value })}
            >
              <option value="all">All</option>
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="filter-group">
          <label>Sort by:</label>
          <select
            value={filters.sort_by}
            onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}
          >
            <option value="due_date">Due Date</option>
            <option value="created_at">Created Date</option>
            <option value="updated_at">Updated Date</option>
            <option value="priority">Priority</option>
            <option value="status">Status</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Order:</label>
          <select
            value={filters.sort_order}
            onChange={(e) => setFilters({ ...filters, sort_order: e.target.value })}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      <div className="tasks-grid">
        {tasks.length === 0 ? (
          <div className="empty-state">
            <p>No tasks found. Create your first task!</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={handleEditTask}
              onView={handleViewTask}
              onDelete={handleDeleteTask}
              onRefresh={fetchTasks}
            />
          ))
        )}
      </div>

      {showModal && (
        <TaskModal
          task={selectedTask}
          assignees={assignees}
          onClose={handleCloseModal}
          onSave={handleSaveTask}
        />
      )}

      {showDetail && selectedTask && (
        <TaskDetail
          task={selectedTask}
          assignees={assignees}
          onClose={handleCloseDetail}
          onRefresh={async () => {
            await fetchTasks();
            handleCloseDetail();
          }}
        />
      )}
    </div>
  );
};

export default Tasks;

