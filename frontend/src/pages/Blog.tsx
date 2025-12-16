import { Link } from 'react-router-dom';
import { blogPosts } from '../content/blogPosts';
import './Marketing.css';

const Blog = () => {
  const posts = [...blogPosts].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <section className="wf-page">
      <div className="wf-container">
        <div className="wf-kicker">Blog</div>
        <h1 className="wf-h1" style={{ marginTop: '0.6rem' }}>Notes, playbooks, and honest learnings.</h1>
        <p className="wf-lead">
          We write the things we wish someone told us earlier — short, practical, and based on what we see weekly.
        </p>

        <div className="wf-divider" />

        <div className="wf-grid-2">
          {posts.map((p) => (
            <article key={p.slug} className="wf-subtle-card">
              <div className="wf-blog-meta">
                <span className="wf-tag">{p.category}</span>
                <span className="wf-tag">{p.readTime}</span>
                <span className="wf-tag">{p.date}</span>
              </div>
              <div style={{ height: 10 }} />
              <Link to={`/blog/${p.slug}`} className="wf-blog-title-link">
                <h2 className="wf-card-title" style={{ marginBottom: 6 }}>{p.title}</h2>
              </Link>
              <p className="wf-card-desc">{p.excerpt}</p>
              <div style={{ marginTop: '0.9rem' }}>
                <Link to={`/blog/${p.slug}`} className="wf-btn wf-btn-ghost">Read</Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Blog;

