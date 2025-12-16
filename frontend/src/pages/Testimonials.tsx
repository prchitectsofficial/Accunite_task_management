import { Link } from 'react-router-dom';
import { testimonials } from '../content/siteData';
import './Marketing.css';

const Testimonials = () => {
  return (
    <section className="wf-page">
      <div className="wf-container">
        <div className="wf-kicker">Testimonials</div>
        <h1 className="wf-h1" style={{ marginTop: '0.6rem' }}>Real words from real teams.</h1>
        <p className="wf-lead">
          A few notes clients shared after the work started paying off — tracking, creative, and calmer scaling.
        </p>

        <div className="wf-divider" />

        <div className="wf-grid-2">
          {testimonials.map((t) => (
            <div key={t.id} className="wf-subtle-card">
              <div className="wf-quote">
                <span className="wf-quote-mark">“</span>
                {t.quote}
                <span className="wf-quote-mark">”</span>
              </div>
              <div className="wf-byline">
                {t.name} • {t.title}, {t.company} {t.location ? `(${t.location})` : ''}
              </div>
              {t.highlight && (
                <div className="wf-blog-meta">
                  <span className="wf-tag">{t.highlight}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="wf-divider" />

        <div className="wf-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div className="wf-kicker">Want results like this?</div>
            <h2 className="wf-h2" style={{ marginTop: '0.35rem' }}>Let’s audit your funnel.</h2>
            <p className="wf-lead" style={{ marginTop: '0.35rem' }}>
              We’ll share what to fix first — and what to stop doing immediately.
            </p>
          </div>
          <Link className="wf-btn wf-btn-primary" to="/contact">Get a free audit</Link>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;

