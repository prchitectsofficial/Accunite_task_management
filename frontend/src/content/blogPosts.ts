export type BlogPost = {
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  readTime: string;
  category: string;
  excerpt: string;
  author: string;
  body: string[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: 'the-week-we-stopped-optimizing-for-roas',
    title: 'The Week We Stopped Optimizing for ROAS (and things got better)',
    date: '2025-11-02',
    readTime: '6 min',
    category: 'Paid Media',
    author: 'White Falcon Team',
    excerpt:
      'ROAS is useful… until it becomes the only thing you stare at. Here’s what changed when we switched to cleaner signals and a simpler operating rhythm.',
    body: [
      'We had a client who would refresh the dashboard like it was a cricket score. Every dip triggered a “pause everything” message. Honestly, we’ve all been there.',
      'The turning point wasn’t a new hack. It was admitting our reporting was noisy: attribution windows were inconsistent, purchase events were duplicated, and the “ROAS” number was doing gymnastics.',
      'So we made a deal: for one week, we would not touch budgets based on ROAS alone. We looked at three things instead: (1) blended CAC, (2) checkout-start rate, and (3) creative fatigue (frequency + CTR trend).',
      'Two surprising outcomes: first, we killed a “high ROAS” ad set that was just harvesting warm traffic. Second, our prospecting looked worse on paper but improved net-new customers.',
      'If you’re stuck in the ROAS refresh loop, try this: pick two leading indicators you trust, and one business metric you can’t argue with (blended CAC works for most). Then give your tests enough time to breathe.',
      'You don’t need less data. You need fewer, cleaner signals and a decision rule you can follow even on a bad day.',
    ],
  },
  {
    slug: 'noida-businesses-local-ads-that-dont-feel-local',
    title: 'Noida businesses: local ads that don’t feel “local” (in a good way)',
    date: '2025-10-14',
    readTime: '5 min',
    category: 'Strategy',
    author: 'Ananya, Account Lead',
    excerpt:
      'If your ad screams “Sector-XX!” it can backfire. Here are softer ways to build trust locally without turning the copy into a flyer.',
    body: [
      'Local targeting is powerful, but local messaging is tricky. The obvious approach—stuffing neighborhoods and pin codes into the headline—often makes the ad feel like a poster pasted on a pole.',
      'What works better is proof that quietly signals proximity: delivery timelines that only make sense locally, customer stories with familiar landmarks, or support hours aligned to the audience’s routine.',
      'One of our best-performing hooks last month wasn’t “Noida’s best…” It was: “Ordered on Tuesday night. Installed by Friday.” That line did more for trust than any location keyword.',
      'Try these three tweaks: (1) use local operations as proof (pickup, same-day dispatch, on-site visit), (2) show maps/screenshots sparingly, and (3) keep the CTA human (“Talk to a specialist” beats “Enquire now”).',
      'People don’t buy because you’re nearby. They buy because you feel reliable. Local is just one ingredient of that feeling.',
    ],
  },
  {
    slug: 'landing-page-fixes-under-30-minutes',
    title: '7 landing page fixes you can do in under 30 minutes',
    date: '2025-09-26',
    readTime: '7 min',
    category: 'CRO',
    author: 'White Falcon Team',
    excerpt:
      'No redesign. No “brand refresh.” Just practical changes we make during audits that usually move conversion rate.',
    body: [
      'If you have time for only one thing, do this: make your primary CTA impossible to miss. Same copy, same color, same placement across the page.',
      'Here are seven quick fixes we repeat (because they keep working):',
      '1) Replace vague headlines (“Grow your business”) with specific outcomes (“Cut CAC by 15–25% in 60 days”).',
      '2) Add one concrete proof block above the fold (number, logo strip, short testimonial).',
      '3) Turn feature lists into “why it matters” bullets. People scan; help them.',
      '4) Move FAQs right before the CTA. Objections love that spot.',
      '5) Reduce form fields to the minimum. If you “need” 10 fields, ask for 3 and collect the rest later.',
      '6) Add a plain-text “what happens next” line. It lowers anxiety.',
      '7) Make the mobile version feel intentional: spacing, button size, and readable line-length.',
      'None of this is glamorous. That’s why it works. Most competitors won’t do the boring fixes consistently.',
    ],
  },
  {
    slug: 'ga4-setup-mistakes-we-see-every-week',
    title: 'GA4 setup mistakes we still see every week (and how to avoid them)',
    date: '2025-08-18',
    readTime: '6 min',
    category: 'Analytics',
    author: 'Rohit, Tracking Specialist',
    excerpt:
      'GA4 isn’t hard — messy setups are. Here are common issues that quietly break reporting and what we do during cleanups.',
    body: [
      'The most common GA4 problem isn’t “missing data.” It’s inconsistent data.',
      'We regularly see purchase events firing twice (thank-you page + server event), UTMs overwritten by redirects, and “lead” tracked as 4 different event names across tools.',
      'Our rule: one event, one meaning. If “generate_lead” is your lead event, stop tracking leads as “form_submit”, “lead”, and “submit_contact” in parallel unless you truly need them.',
      'Also: check your referral exclusions and payment gateways. If your conversions suddenly show as coming from a gateway domain, your acquisition reports will become fiction.',
      'During audits we keep it boring: verify events in GTM preview, compare with platform conversion counts, then fix naming. Only after that do we touch dashboards.',
      'Clean tracking doesn’t feel exciting. But it’s the foundation for every “smart” optimization you want to do next.',
    ],
  },
  {
    slug: 'creative-testing-without-burning-budget',
    title: 'Creative testing without burning your budget',
    date: '2025-07-29',
    readTime: '5 min',
    category: 'Creative',
    author: 'White Falcon Creative Desk',
    excerpt:
      'Testing doesn’t mean running 20 ideas at once. Here’s a calmer system: fewer variables, faster learning, and less budget anxiety.',
    body: [
      'Most teams “test” by launching a pile of creatives and hoping the algorithm sorts it out. Then they kill everything after 48 hours. That’s not testing; that’s panic.',
      'We prefer a simple matrix: one offer × three hooks × two formats. Keep the landing page constant. Keep the audience constant. Change one thing at a time.',
      'A good test is not the one that wins. It’s the one that teaches you something you can reuse.',
      'Example: if UGC hook A beats hook B consistently, you don’t just scale the ad — you rewrite your landing page headline with the same language.',
      'Budget tip: allocate a small fixed “learning” amount weekly. If it’s not fixed, it’ll get eaten by whatever is shouting loudest in the dashboard.',
      'Creative is a system. When it’s a system, it stops being stressful.',
    ],
  },
];

