import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">Accunite</h1>
          <p className="tagline">Task Management</p>
        </div>
        <div className="user-info">
          <div className="user-name">{user?.name}</div>
          <div className="user-role">{user?.role === 'admin' ? 'Admin' : 'Assignee'}</div>
        </div>
        <ul className="nav-menu">
          <li>
            <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
              <span className="nav-icon">📊</span>
              Dashboard
            </Link>
          </li>
          <li>
            <Link to="/tasks" className={isActive('/tasks') ? 'active' : ''}>
              <span className="nav-icon">📋</span>
              Tasks
            </Link>
          </li>
          <li>
            <Link to="/kanban" className={isActive('/kanban') ? 'active' : ''}>
              <span className="nav-icon">📌</span>
              Kanban Board
            </Link>
          </li>
          {user?.role === 'admin' && (
            <>
              <li>
                <Link to="/analytics" className={isActive('/analytics') ? 'active' : ''}>
                  <span className="nav-icon">📈</span>
                  Analytics
                </Link>
              </li>
              <li>
                <Link to="/users" className={isActive('/users') ? 'active' : ''}>
                  <span className="nav-icon">👥</span>
                  Users
                </Link>
              </li>
            </>
          )}
        </ul>
        <div className="sidebar-footer">
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;

