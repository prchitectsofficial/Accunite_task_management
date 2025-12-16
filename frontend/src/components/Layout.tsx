import { Outlet, NavLink, Link } from 'react-router-dom';
import './Layout.css';

const Layout = () => {
  return (
    <div className="wf-shell">
      <header className="wf-header">
        <div className="wf-container wf-header-inner">
          <Link to="/" className="wf-brand" aria-label="White Falcon Home">
            <span className="wf-brand-mark" aria-hidden="true">WF</span>
            <span className="wf-brand-text">
              <span className="wf-brand-name">White Falcon</span>
              <span className="wf-brand-tagline">Performance Marketing</span>
            </span>
          </Link>

          <nav className="wf-nav" aria-label="Primary">
            <NavLink to="/" end className={({ isActive }) => `wf-nav-link ${isActive ? 'active' : ''}`}>
              Home
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => `wf-nav-link ${isActive ? 'active' : ''}`}>
              About
            </NavLink>
            <NavLink to="/services" className={({ isActive }) => `wf-nav-link ${isActive ? 'active' : ''}`}>
              Services
            </NavLink>
            <NavLink to="/blog" className={({ isActive }) => `wf-nav-link ${isActive ? 'active' : ''}`}>
              Blog
            </NavLink>
            <NavLink to="/testimonials" className={({ isActive }) => `wf-nav-link ${isActive ? 'active' : ''}`}>
              Testimonials
            </NavLink>
            <NavLink to="/clients" className={({ isActive }) => `wf-nav-link ${isActive ? 'active' : ''}`}>
              Clients
            </NavLink>
            <NavLink to="/contact" className={({ isActive }) => `wf-nav-link ${isActive ? 'active' : ''}`}>
              Contact
            </NavLink>
          </nav>

          <div className="wf-header-cta">
            <Link to="/contact" className="wf-btn wf-btn-primary">Get a free audit</Link>
          </div>
        </div>
      </header>

      <main className="wf-main">
        <Outlet />
      </main>

      <footer className="wf-footer">
        <div className="wf-container wf-footer-grid">
          <div>
            <div className="wf-footer-brand">White Falcon</div>
            <p className="wf-muted wf-footer-copy">
              Performance marketing built for measurable growth — with clean tracking, sharp creative, and weekly insights you can actually use.
            </p>
            <div className="wf-social" aria-label="Social media">
              <a className="wf-social-link" href="https://www.facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook">
                <span aria-hidden="true" className="wf-icon wf-icon-facebook" />
              </a>
              <a className="wf-social-link" href="https://www.instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
                <span aria-hidden="true" className="wf-icon wf-icon-instagram" />
              </a>
              <a className="wf-social-link" href="https://x.com" target="_blank" rel="noreferrer" aria-label="X">
                <span aria-hidden="true" className="wf-icon wf-icon-x" />
              </a>
              <a className="wf-social-link" href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                <span aria-hidden="true" className="wf-icon wf-icon-linkedin" />
              </a>
              <a className="wf-social-link" href="https://www.fiverr.com" target="_blank" rel="noreferrer" aria-label="Fiverr">
                <span aria-hidden="true" className="wf-icon wf-icon-fiverr" />
              </a>
            </div>
          </div>

          <div>
            <div className="wf-footer-title">Quick links</div>
            <div className="wf-footer-links">
              <Link to="/services">Services</Link>
              <Link to="/blog">Blog</Link>
              <Link to="/testimonials">Testimonials</Link>
              <Link to="/clients">Clients</Link>
              <Link to="/contact">Contact</Link>
            </div>
          </div>

          <div>
            <div className="wf-footer-title">HQ (Noida, India)</div>
            <p className="wf-muted wf-footer-copy">
              115, Tower 1, Assotech Business Cresterra<br />
              Sector-135, Noida, IN
            </p>
            <p className="wf-muted wf-footer-copy">
              <a href="mailto:contact@whitefalcon.com">contact@whitefalcon.com</a>
            </p>
          </div>
        </div>

        <div className="wf-footer-bottom">
          <div className="wf-container wf-footer-bottom-inner">
            <span className="wf-muted">© {new Date().getFullYear()} White Falcon. All rights reserved.</span>
            <span className="wf-muted">Light theme • Built for speed</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

