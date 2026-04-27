import { useEffect, useState } from 'react';
import api from '../services/api';
import { User } from '../types';
import UserModal from '../components/UserModal';
import './Users.css';

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/assignees');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setShowModal(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedUser(null);
  };

  const handleSaveUser = async () => {
    await fetchUsers();
    handleCloseModal();
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${userName}?`)) return;

    try {
      await api.delete(`/users/${userId}`);
      await fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error deleting user');
    }
  };

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="users-page">
      <div className="users-header">
        <h1>Manage Assignees</h1>
        <button onClick={handleCreateUser} className="btn-primary">
          + Create Assignee
        </button>
      </div>

      <div className="users-grid">
        {users.length === 0 ? (
          <div className="empty-state">
            <p>No assignees found. Create your first assignee!</p>
          </div>
        ) : (
          users.map((user) => (
            <div key={user.id} className="user-card">
              <div className="user-card-header">
                <div className="user-avatar">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                  <h3>{user.name}</h3>
                  <p className="user-email">{user.email}</p>
                  <span className="user-role">{user.role}</span>
                </div>
              </div>
              <div className="user-card-actions">
                <button
                  onClick={() => handleEditUser(user)}
                  className="btn-secondary"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteUser(user.id, user.name)}
                  className="btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <UserModal
          user={selectedUser}
          onClose={handleCloseModal}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
};

export default Users;

