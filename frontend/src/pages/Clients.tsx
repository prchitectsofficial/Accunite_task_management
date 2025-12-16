import { Link } from 'react-router-dom';
import { clients, testimonials } from '../content/siteData';
import './Marketing.css';

const Clients = () => {
  const getTestimonial = (id: string) => testimonials.find((t) => t.id === id);

  return (
    <section className="wf-page">
      <div className="wf-container">
        <div className="wf-kicker">Clients</div>
        <h1 className="wf-h1" style={{ marginTop: '0.6rem' }}>A few teams we’ve partnered with.</h1>
        <p className="wf-lead">
          We keep engagement small so the work stays sharp. Here are sample client snapshots and what we did.
        </p>

        <div className="wf-divider" />

        <div className="wf-grid-2">
          {clients.map((c) => {
            const t = getTestimonial(c.testimonialId);
            return (
              <div key={c.id} className="wf-subtle-card">
                <div className="wf-blog-meta">
                  <span className="wf-tag">{c.industry}</span>
                  {t?.highlight ? <span className="wf-tag">{t.highlight}</span> : null}
                </div>
                <div style={{ height: 10 }} />
                <div className="wf-card-title">{c.name}</div>
                <div className="wf-card-desc">What we did:</div>
                <ul className="wf-list">
                  {c.whatWeDid.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                {t && (
                  <>
                    <div className="wf-divider" />
                    <div className="wf-quote">
                      <span className="wf-quote-mark">“</span>
                      {t.quote}
                      <span className="wf-quote-mark">”</span>
                    </div>
                    <div className="wf-byline">
                      {t.name} • {t.title}, {t.company}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="wf-divider" />

        <div className="wf-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div className="wf-kicker">Work with us</div>
            <h2 className="wf-h2" style={{ marginTop: '0.35rem' }}>Let’s build your next growth sprint.</h2>
            <p className="wf-lead" style={{ marginTop: '0.35rem' }}>
              Tell us what you sell and what “good” looks like. We’ll come back with a tight plan.
            </p>
          </div>
          <Link className="wf-btn wf-btn-primary" to="/contact">Contact us</Link>
        </div>
      </div>
    </section>
  );
};

export default Clients;

