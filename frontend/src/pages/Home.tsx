import { Link } from 'react-router-dom';
import { services, testimonials } from '../content/siteData';
import { blogPosts } from '../content/blogPosts';
import './Marketing.css';

const Home = () => {
  const featuredServices = services.slice(0, 3);
  const featuredTestimonials = testimonials.slice(0, 2);
  const featuredBlogs = [...blogPosts].slice(0, 3);

  return (
    <>
      <section className="wf-hero">
        <div className="wf-container">
          <div className="wf-grid" style={{ alignItems: 'center' }}>
            <div style={{ gridColumn: 'span 7' }}>
              <span className="wf-pill">White Falcon • Performance Marketing</span>
              <h1 className="wf-h1" style={{ marginTop: '0.9rem' }}>
                Growth that’s measurable, calm, and repeatable.
              </h1>
              <p className="wf-lead">
                We help brands scale with performance ads, clean tracking, and creative that feels native —
                without turning your budget into a guessing game.
              </p>
              <div className="wf-actions">
                <Link className="wf-btn wf-btn-primary" to="/contact">
                  Book a free audit
                </Link>
                <Link className="wf-btn wf-btn-ghost" to="/services">
                  Explore services
                </Link>
              </div>
              <div className="wf-badges" aria-label="Highlights">
                <span className="wf-badge">Weekly testing plan</span>
                <span className="wf-badge">Clean tracking first</span>
                <span className="wf-badge">Founder-friendly reporting</span>
              </div>
            </div>

            <div style={{ gridColumn: 'span 5' }}>
              <div className="wf-card">
                <div className="wf-kicker">What you get</div>
                <div style={{ height: 10 }} />
                <div className="wf-grid-2">
                  <div className="wf-subtle-card">
                    <div className="wf-card-title">Clear tracking</div>
                    <div className="wf-card-desc">Events, UTMs, and dashboards that don’t lie.</div>
                  </div>
                  <div className="wf-subtle-card">
                    <div className="wf-card-title">Better creative</div>
                    <div className="wf-card-desc">Hooks, angles, and formats that scale.</div>
                  </div>
                  <div className="wf-subtle-card">
                    <div className="wf-card-title">Cleaner funnels</div>
                    <div className="wf-card-desc">Landing pages and CRO that reduce drop-offs.</div>
                  </div>
                  <div className="wf-subtle-card">
                    <div className="wf-card-title">Tight ops</div>
                    <div className="wf-card-desc">Weekly cadence. Fewer surprises.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="wf-section">
        <div className="wf-container">
          <div className="wf-kicker">Services</div>
          <h2 className="wf-h2" style={{ marginTop: '0.5rem' }}>What we do best</h2>
          <p className="wf-lead" style={{ marginTop: '0.6rem' }}>
            Choose a single service or a full growth stack — we’ll keep it focused, not bloated.
          </p>

          <div className="wf-grid-3" style={{ marginTop: '1.1rem' }}>
            {featuredServices.map((s) => (
              <div key={s.id} className="wf-subtle-card">
                <div className="wf-card-title">{s.title}</div>
                <div className="wf-card-desc">{s.tagline}</div>
                <ul className="wf-list">
                  {s.bullets.slice(0, 3).map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <Link className="wf-btn wf-btn-ghost" to="/services">
              See all services
            </Link>
          </div>
        </div>
      </section>

      <section className="wf-section">
        <div className="wf-container">
          <div className="wf-kicker">Testimonials</div>
          <h2 className="wf-h2" style={{ marginTop: '0.5rem' }}>Clients say it better</h2>
          <div className="wf-grid-2" style={{ marginTop: '1.1rem' }}>
            {featuredTestimonials.map((t) => (
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
          <div style={{ marginTop: '1.25rem' }}>
            <Link className="wf-btn wf-btn-ghost" to="/testimonials">
              Read more testimonials
            </Link>
          </div>
        </div>
      </section>

      <section className="wf-section">
        <div className="wf-container">
          <div className="wf-kicker">Blog</div>
          <h2 className="wf-h2" style={{ marginTop: '0.5rem' }}>Practical notes from the field</h2>
          <div className="wf-grid-3" style={{ marginTop: '1.1rem' }}>
            {featuredBlogs.map((p) => (
              <div key={p.slug} className="wf-subtle-card">
                <div className="wf-blog-meta">
                  <span className="wf-tag">{p.category}</span>
                  <span className="wf-tag">{p.readTime}</span>
                  <span className="wf-tag">{p.date}</span>
                </div>
                <div style={{ height: 10 }} />
                <Link to={`/blog/${p.slug}`} className="wf-blog-title-link">
                  <div className="wf-card-title">{p.title}</div>
                </Link>
                <div className="wf-card-desc">{p.excerpt}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.25rem' }}>
            <Link className="wf-btn wf-btn-ghost" to="/blog">
              View all posts
            </Link>
          </div>
        </div>
      </section>

      <section className="wf-section">
        <div className="wf-container">
          <div className="wf-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div className="wf-kicker">Ready?</div>
              <h2 className="wf-h2" style={{ marginTop: '0.35rem' }}>Let’s find the quickest growth wins.</h2>
              <p className="wf-lead" style={{ marginTop: '0.35rem' }}>
                Share your goals. We’ll reply with a short audit plan and the first set of experiments.
              </p>
            </div>
            <Link className="wf-btn wf-btn-primary" to="/contact">
              Contact White Falcon
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default Home;

