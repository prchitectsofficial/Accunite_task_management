import { Link } from 'react-router-dom';
import { services } from '../content/siteData';
import './Marketing.css';

const Services = () => {
  return (
    <section className="wf-page">
      <div className="wf-container">
        <div className="wf-kicker">Services</div>
        <h1 className="wf-h1" style={{ marginTop: '0.6rem' }}>A focused growth stack.</h1>
        <p className="wf-lead">
          5–6 core services, done well. We’ll recommend what matters for your stage — and skip what doesn’t.
        </p>

        <div className="wf-divider" />

        <div className="wf-grid-2">
          {services.map((s) => (
            <div key={s.id} className="wf-subtle-card">
              <div className="wf-card-title">{s.title}</div>
              <div className="wf-card-desc">{s.tagline}</div>
              <ul className="wf-list">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="wf-divider" />

        <div className="wf-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div className="wf-kicker">Next step</div>
            <h2 className="wf-h2" style={{ marginTop: '0.35rem' }}>Not sure what you need?</h2>
            <p className="wf-lead" style={{ marginTop: '0.35rem' }}>
              Tell us your goal (sales, leads, or retention). We’ll reply with a short plan and the first experiments.
            </p>
          </div>
          <Link className="wf-btn wf-btn-primary" to="/contact">Request a plan</Link>
        </div>
      </div>
    </section>
  );
};

export default Services;

