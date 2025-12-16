import { useMemo, useState } from 'react';
import { contactInfo } from '../content/siteData';
import './Marketing.css';

type ContactPayload = {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  budget?: string;
  message: string;
};

const Contact = () => {
  const [form, setForm] = useState<ContactPayload>({
    name: '',
    email: '',
    company: '',
    phone: '',
    budget: '₹50k–₹1L / month',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const budgets = useMemo(
    () => ['Under ₹50k / month', '₹50k–₹1L / month', '₹1L–₹3L / month', '₹3L+ / month', 'Not sure yet'],
    []
  );

  const onChange = (key: keyof ContactPayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Something went wrong. Please try again.');
      }

      setStatus({ type: 'success', message: 'Thanks! We received your message. We’ll get back within 1 business day.' });
      setForm({
        name: '',
        email: '',
        company: '',
        phone: '',
        budget: '₹50k–₹1L / month',
        message: '',
      });
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'Failed to send. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="wf-page">
      <div className="wf-container">
        <div className="wf-kicker">Contact</div>
        <h1 className="wf-h1" style={{ marginTop: '0.6rem' }}>Let’s talk growth.</h1>
        <p className="wf-lead">
          Share your current numbers and goals. We’ll respond with a short audit outline and next steps.
        </p>

        <div className="wf-divider" />

        <div className="wf-split">
          <div className="wf-subtle-card">
            <div className="wf-card-title">Send a message</div>
            <p className="wf-card-desc">
              The more context you share, the faster we can help (channel, product, price range, and what you’ve tried).
            </p>

            <div style={{ height: 12 }} />

            {status && (
              <div className={`wf-alert ${status.type}`}>
                {status.message}
              </div>
            )}

            <div style={{ height: 12 }} />

            <form className="wf-form" onSubmit={submit}>
              <div className="wf-field">
                <label htmlFor="name">Name</label>
                <input id="name" value={form.name} onChange={onChange('name')} required placeholder="Your name" />
              </div>

              <div className="wf-field">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" value={form.email} onChange={onChange('email')} required placeholder="you@company.com" />
              </div>

              <div className="wf-grid-2">
                <div className="wf-field">
                  <label htmlFor="company">Company</label>
                  <input id="company" value={form.company} onChange={onChange('company')} placeholder="Brand / Company name" />
                </div>
                <div className="wf-field">
                  <label htmlFor="phone">Phone (optional)</label>
                  <input id="phone" value={form.phone} onChange={onChange('phone')} placeholder="+91…" />
                </div>
              </div>

              <div className="wf-field">
                <label htmlFor="budget">Monthly marketing budget</label>
                <select id="budget" value={form.budget} onChange={onChange('budget')}>
                  {budgets.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="wf-field">
                <label htmlFor="message">Message</label>
                <textarea
                  id="message"
                  value={form.message}
                  onChange={onChange('message')}
                  required
                  placeholder="What are you selling, what’s working, and what’s stuck?"
                />
              </div>

              <button className="wf-btn wf-btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send message'}
              </button>
            </form>
          </div>

          <aside className="wf-subtle-card">
            <div className="wf-card-title">Contact details</div>
            <div className="wf-divider" />
            <div className="wf-card-desc">
              <strong>{contactInfo.hqCity}</strong>
              <div style={{ height: 8 }} />
              <div>
                {contactInfo.addressLine1}
                <br />
                {contactInfo.addressLine2}
              </div>
              <div style={{ height: 12 }} />
              <div>
                Email:{' '}
                <a href={`mailto:${contactInfo.email}`}>{contactInfo.email}</a>
              </div>
            </div>

            <div className="wf-divider" />

            <div className="wf-card-title">What happens next?</div>
            <ul className="wf-list">
              <li>We reply within 1 business day.</li>
              <li>We ask 4–5 quick questions (to avoid wasting your time).</li>
              <li>We share a short audit + a practical 30‑day plan.</li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default Contact;

