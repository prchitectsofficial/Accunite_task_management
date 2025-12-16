import { Link } from 'react-router-dom';
import './Marketing.css';

const About = () => {
  return (
    <section className="wf-page">
      <div className="wf-container">
        <div className="wf-kicker">About</div>
        <h1 className="wf-h1" style={{ marginTop: '0.6rem' }}>We’re White Falcon.</h1>
        <p className="wf-lead">
          A small team that treats performance marketing like a craft: clean tracking, clear messaging,
          and disciplined testing. We’re based out of Noida (HQ) and work with brands across India.
        </p>

        <div className="wf-divider" />

        <div className="wf-split">
          <div className="wf-subtle-card">
            <div className="wf-card-title">How we work</div>
            <div className="wf-card-desc">
              Most growth problems aren’t “we need more ads.” They’re usually one of these:
              the offer is unclear, tracking is messy, the landing page doesn’t match intent,
              or the creative is tired. We fix the foundations first, then scale.
            </div>
            <ul className="wf-list">
              <li>Week 1: audit + tracking sanity check</li>
              <li>Week 2: funnel cleanup + first experiments</li>
              <li>Week 3+: scale winners, retire losers, repeat</li>
            </ul>
          </div>

          <div className="wf-subtle-card">
            <div className="wf-card-title">What we won’t do</div>
            <div className="wf-card-desc">
              No vanity reports. No “set and forget.” No mysterious dashboards with 40 metrics nobody reads.
              If we can’t explain a decision in plain English, we don’t ship it.
            </div>
            <div className="wf-divider" />
            <div className="wf-card-title">If you like clarity, we’ll get along.</div>
            <div className="wf-actions">
              <Link className="wf-btn wf-btn-primary" to="/contact">Talk to us</Link>
              <Link className="wf-btn wf-btn-ghost" to="/services">See services</Link>
            </div>
          </div>
        </div>

        <div className="wf-divider" />

        <div className="wf-grid-3">
          <div className="wf-subtle-card">
            <div className="wf-card-title">Tracking first</div>
            <div className="wf-card-desc">We don’t scale until conversions are trustworthy.</div>
          </div>
          <div className="wf-subtle-card">
            <div className="wf-card-title">Creative with intent</div>
            <div className="wf-card-desc">We write to one person, not “everyone.”</div>
          </div>
          <div className="wf-subtle-card">
            <div className="wf-card-title">Weekly cadence</div>
            <div className="wf-card-desc">Clear updates: what we tested, what changed, what’s next.</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;

