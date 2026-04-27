import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import api from '../services/api';
import { Task, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import TaskDetail from '../components/TaskDetail';
import './Kanban.css';

const Kanban = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, assigneesRes] = await Promise.all([
        api.get('/tasks', { params: { sort_by: 'due_date', sort_order: 'asc' } }),
        user?.role === 'admin' ? api.get('/users/assignees') : Promise.resolve({ data: [] }),
      ]);
      setTasks(tasksRes.data);
      if (user?.role === 'admin') {
        setAssignees(assigneesRes.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const task = tasks.find((t) => t.id === draggableId);
    if (!task) return;

    const newStatus = destination.droppableId as any;
    if (task.status === newStatus) return;

    try {
      await api.put(`/tasks/${draggableId}`, { status: newStatus });
      setTasks((prev) =>
        prev.map((t) => (t.id === draggableId ? { ...t, status: newStatus } : t))
      );
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error updating task status');
      fetchData();
    }
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter((task) => task.status === status);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowDetail(true);
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
    setSelectedTask(null);
  };

  const handleRefresh = () => {
    fetchData();
    handleCloseDetail();
  };

  if (loading) {
    return <div className="loading">Loading kanban board...</div>;
  }

  const columns = [
    { id: 'to_do', title: 'To Do', color: '#6b7280' },
    { id: 'in_progress', title: 'In Progress', color: '#f59e0b' },
    { id: 'completed', title: 'Completed', color: '#10b981' },
  ];

  return (
    <div className="kanban-page">
      <div className="kanban-header">
        <h1>Kanban Board</h1>
        <p className="kanban-subtitle">Drag and drop tasks to update status</p>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="kanban-board">
          {columns.map((column) => {
            const columnTasks = getTasksByStatus(column.id);
            const inProgressCount = column.id === 'in_progress' ? columnTasks.length : 0;

            return (
              <div key={column.id} className="kanban-column">
                <div className="column-header" style={{ borderLeftColor: column.color }}>
                  <h2>{column.title}</h2>
                  <span className="task-count">{columnTasks.length}</span>
                  {column.id === 'in_progress' && (
                    <span className="limit-indicator">
                      ({inProgressCount}/3 limit)
                    </span>
                  )}
                </div>
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`column-content ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                    >
                      {columnTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`kanban-card ${snapshot.isDragging ? 'dragging' : ''} ${(task.days_unchanged || 0) >= 14 && task.status !== 'completed' ? 'stale' : ''}`}
                              onClick={() => handleTaskClick(task)}
                            >
                              <div className="card-header">
                                <h3 className="card-title">{task.title}</h3>
                                <span
                                  className="priority-badge"
                                  style={{
                                    backgroundColor:
                                      task.priority === 'urgent'
                                        ? '#fee2e2'
                                        : task.priority === 'high'
                                        ? '#fef3c7'
                                        : task.priority === 'normal'
                                        ? '#dbeafe'
                                        : '#f3f4f6',
                                    color:
                                      task.priority === 'urgent'
                                        ? '#ef4444'
                                        : task.priority === 'high'
                                        ? '#f59e0b'
                                        : task.priority === 'normal'
                                        ? '#2563eb'
                                        : '#6b7280',
                                  }}
                                >
                                  {task.priority[0].toUpperCase()}
                                </span>
                              </div>
                              {task.description && (
                                <p className="card-description">{task.description.substring(0, 100)}...</p>
                              )}
                              <div className="card-meta">
                                <span className="due-date">
                                  📅 {new Date(task.due_date).toLocaleDateString()}
                                </span>
                                {task.assignee_name && (
                                  <span className="assignee">👤 {task.assignee_name}</span>
                                )}
                              </div>
                              {(task.days_unchanged || 0) >= 14 && task.status !== 'completed' && (
                                <div className="stale-indicator">🔴 {task.days_unchanged} days unchanged</div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {showDetail && selectedTask && (
        <TaskDetail
          task={selectedTask}
          assignees={assignees}
          onClose={handleCloseDetail}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
};

export default Kanban;

