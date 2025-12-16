import { Link } from 'react-router-dom';
import './Marketing.css';

const NotFound = () => {
  return (
    <section className="wf-page">
      <div className="wf-container">
        <div className="wf-kicker">404</div>
        <h1 className="wf-h1" style={{ marginTop: '0.6rem' }}>This page flew away.</h1>
        <p className="wf-lead">
          The link might be broken or the page moved. You can head back home or explore our services.
        </p>
        <div className="wf-actions">
          <Link className="wf-btn wf-btn-primary" to="/">Go home</Link>
          <Link className="wf-btn wf-btn-ghost" to="/services">Services</Link>
          <Link className="wf-btn wf-btn-ghost" to="/contact">Contact</Link>
        </div>
      </div>
    </section>
  );
};

export default NotFound;

