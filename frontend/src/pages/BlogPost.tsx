import { Link, useParams } from 'react-router-dom';
import { blogPosts } from '../content/blogPosts';
import './Marketing.css';

const BlogPost = () => {
  const { slug } = useParams();
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <section className="wf-page">
        <div className="wf-container">
          <div className="wf-kicker">Blog</div>
          <h1 className="wf-h1" style={{ marginTop: '0.6rem' }}>Post not found</h1>
          <p className="wf-lead">Maybe the link is old. You can browse all posts here.</p>
          <div className="wf-actions">
            <Link className="wf-btn wf-btn-primary" to="/blog">Back to blog</Link>
            <Link className="wf-btn wf-btn-ghost" to="/">Home</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="wf-page">
      <div className="wf-container">
        <div className="wf-blog-meta">
          <span className="wf-tag">{post.category}</span>
          <span className="wf-tag">{post.readTime}</span>
          <span className="wf-tag">{post.date}</span>
          <span className="wf-tag">{post.author}</span>
        </div>

        <h1 className="wf-h1" style={{ marginTop: '0.85rem' }}>{post.title}</h1>
        <p className="wf-lead">{post.excerpt}</p>

        <div className="wf-divider" />

        <article className="wf-subtle-card">
          <div style={{ display: 'grid', gap: '0.9rem' }}>
            {post.body.map((para, idx) => (
              <p key={idx} className="wf-card-desc" style={{ fontSize: '1.05rem', lineHeight: 1.8 }}>
                {para}
              </p>
            ))}
          </div>
        </article>

        <div className="wf-actions" style={{ marginTop: '1.25rem' }}>
          <Link className="wf-btn wf-btn-ghost" to="/blog">← Back to blog</Link>
          <Link className="wf-btn wf-btn-primary" to="/contact">Get a free audit</Link>
        </div>
      </div>
    </section>
  );
};

export default BlogPost;

