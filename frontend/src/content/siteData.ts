export type Service = {
  id: string;
  title: string;
  tagline: string;
  bullets: string[];
};

export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  title: string;
  company: string;
  location?: string;
  highlight?: string;
};

export type Client = {
  id: string;
  name: string;
  industry: string;
  whatWeDid: string[];
  testimonialId: string;
};

export const services: Service[] = [
  {
    id: 'performance-ads',
    title: 'Performance Ads (Meta + Google)',
    tagline: 'Campaigns that track cleanly and scale safely.',
    bullets: [
      'Full-funnel structure: prospecting → remarketing → retention',
      'Creative testing frameworks (angles, hooks, offers)',
      'Budget pacing + weekly experiments tied to outcomes',
    ],
  },
  {
    id: 'seo-content',
    title: 'SEO + Content That Converts',
    tagline: 'Not traffic for traffic’s sake — content with intent.',
    bullets: [
      'Keyword strategy mapped to buyer journey',
      'Landing pages built for clarity, not clutter',
      'Content refresh to lift rankings without rewriting everything',
    ],
  },
  {
    id: 'landing-pages',
    title: 'Landing Pages + CRO',
    tagline: 'Small fixes that create big lifts.',
    bullets: [
      'Offer framing, pricing psychology, and CTA clarity',
      'A/B tests with realistic timelines (no vanity wins)',
      'Heatmap-driven UX improvements',
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics + Tracking',
    tagline: 'Your numbers should agree across tools — we make that happen.',
    bullets: [
      'GA4, Google Tag Manager, conversion API basics',
      'Event naming and hygiene so reports stay readable',
      'Simple dashboards for founders and growth teams',
    ],
  },
  {
    id: 'creative',
    title: 'Creative Strategy + Production',
    tagline: 'Ads that feel native — and still sell.',
    bullets: [
      'UGC-style scripts, statics, carousels, short-form videos',
      'Competitive swipe files + angle research',
      'Creative scorecards so “good” is measurable',
    ],
  },
  {
    id: 'crm-retention',
    title: 'Retention (Email + WhatsApp Flows)',
    tagline: 'More revenue from the customers you already have.',
    bullets: [
      'Welcome flows, win-back, browse/cart recovery',
      'Segmentation that stays simple and effective',
      'Offer calendars and lifecycle messaging',
    ],
  },
];

export const testimonials: Testimonial[] = [
  {
    id: 't1',
    quote:
      "They didn’t just “run ads” — they fixed our tracking first. Once the numbers stopped fighting each other, scaling finally felt boring (in the best way).",
    name: 'Ritika Sharma',
    title: 'Founder',
    company: 'BareLeaf Skincare',
    location: 'Noida',
    highlight: 'ROAS stabilized within 3 weeks',
  },
  {
    id: 't2',
    quote:
      'Our leads were coming in, but quality was all over the place. White Falcon rebuilt the funnel, tightened the message, and the sales calls became way easier.',
    name: 'Arjun Mehta',
    title: 'Head of Growth',
    company: 'FinSprint',
    location: 'Gurugram',
    highlight: 'Higher lead quality, lower CPL',
  },
  {
    id: 't3',
    quote:
      'The creative feedback was honest. Sometimes it stings, but it works. We went from “pretty ads” to “ads that sell.”',
    name: 'Sonal Gupta',
    title: 'Marketing Manager',
    company: 'UrbanNest Interiors',
    location: 'Delhi',
    highlight: 'Consistent bookings via Meta',
  },
  {
    id: 't4',
    quote:
      'Weekly updates were crisp: what we tried, what worked, what we’re killing next week. No fluff, no “trust the process” speeches.',
    name: 'Karan Singh',
    title: 'Co-founder',
    company: 'FitCart',
    location: 'Bengaluru',
    highlight: 'Better conversion rate on landing pages',
  },
  {
    id: 't5',
    quote:
      'They cleaned up our keywords and built landing pages that matched intent. Organic traffic grew, but more importantly—demo requests did too.',
    name: 'Neha Kapoor',
    title: 'Product Marketing',
    company: 'CloudLedger',
    location: 'Pune',
    highlight: 'SEO that actually converts',
  },
];

export const clients: Client[] = [
  {
    id: 'c1',
    name: 'BareLeaf Skincare',
    industry: 'D2C Beauty',
    whatWeDid: ['Meta ads scaling', 'Tracking cleanup (GA4 + GTM)', 'Creative testing'],
    testimonialId: 't1',
  },
  {
    id: 'c2',
    name: 'FinSprint',
    industry: 'FinTech',
    whatWeDid: ['Google Search campaigns', 'Landing page CRO', 'Lead quality filtering'],
    testimonialId: 't2',
  },
  {
    id: 'c3',
    name: 'UrbanNest Interiors',
    industry: 'Home & Lifestyle',
    whatWeDid: ['Meta lead gen', 'Offer positioning', 'Local targeting'],
    testimonialId: 't3',
  },
  {
    id: 'c4',
    name: 'FitCart',
    industry: 'E-commerce',
    whatWeDid: ['Product feed improvements', 'Landing page experiments', 'Retention flows'],
    testimonialId: 't4',
  },
  {
    id: 'c5',
    name: 'CloudLedger',
    industry: 'SaaS',
    whatWeDid: ['SEO strategy', 'Content refresh', 'High-intent landing pages'],
    testimonialId: 't5',
  },
];

export const contactInfo = {
  hqCity: 'Noida, India (HQ)',
  addressLine1: '115, Tower 1, Assotech Business Cresterra',
  addressLine2: 'Sector-135, Noida, IN',
  emails: ['contact@whitefalcon.com', 'akashdeep@prchitects.net'],
};

