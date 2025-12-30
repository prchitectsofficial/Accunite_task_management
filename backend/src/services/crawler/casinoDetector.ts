import * as cheerio from 'cheerio';
import { fetchHtml } from './httpClient.js';

export type CasinoDetection = {
  metaTitle: string | null;
  metaDescription: string | null;
  isCasino: boolean;
  score: number; // 0-100
  matchedKeywords: string[];
  homepageUrl: string;
};

type Keyword = { term: string; weight: number; isPhrase?: boolean };

const KEYWORDS: Keyword[] = [
  { term: 'casino', weight: 18 },
  { term: 'gambling', weight: 18 },
  { term: 'betting', weight: 14 },
  { term: 'sportsbook', weight: 18 },
  { term: 'slots', weight: 10 },
  { term: 'poker', weight: 10 },
  { term: 'roulette', weight: 10 },
  { term: 'jackpot', weight: 10 },
  { term: 'odds', weight: 8 },
  { term: 'wager', weight: 10 },
  { term: 'bonus', weight: 6 },
  { term: 'free spins', weight: 14, isPhrase: true },
  { term: 'bet now', weight: 14, isPhrase: true },
  { term: 'stake', weight: 6 },
];

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function scoreCasinoText(parts: { title?: string | null; description?: string | null; body?: string | null }): {
  score: number;
  matched: string[];
} {
  const title = normalizeText(parts.title || '');
  const description = normalizeText(parts.description || '');
  const body = normalizeText(parts.body || '');

  // weighted fields: title > description > body
  const weightedText = `${title} ${title} ${description} ${body}`;
  let score = 0;
  const matched: string[] = [];

  for (const kw of KEYWORDS) {
    const term = kw.term.toLowerCase();
    const present = kw.isPhrase ? weightedText.includes(term) : new RegExp(`\\b${term}\\b`, 'i').test(weightedText);
    if (present) {
      score += kw.weight;
      matched.push(kw.term);
    }
  }

  // Cap and normalize to 0..100
  score = Math.max(0, Math.min(100, score));
  return { score, matched };
}

function extractVisibleText($: cheerio.CheerioAPI): string {
  $('script,noscript,style,svg,canvas,meta,link').remove();
  const text = $('body').text();
  return text.replace(/\s+/g, ' ').trim().slice(0, 2000);
}

export async function detectCasinoHomepage(
  domain: string,
  opts: { timeoutMs: number; userAgent: string; maxBytes: number; signal?: AbortSignal }
): Promise<CasinoDetection | null> {
  const candidates = [`https://${domain}/`, `http://${domain}/`];

  for (const homepageUrl of candidates) {
    try {
      const res = await fetchHtml(homepageUrl, {
        timeoutMs: opts.timeoutMs,
        userAgent: opts.userAgent,
        maxBytes: opts.maxBytes,
        signal: opts.signal,
        retries: 1,
      });

      if (!res.ok || !res.html) continue;
      const $ = cheerio.load(res.html);

      const metaTitle = ($('title').first().text() || '').trim() || null;
      const metaDescription =
        ($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '')
          .trim() || null;

      const body = extractVisibleText($);
      const { score, matched } = scoreCasinoText({ title: metaTitle, description: metaDescription, body });
      const isCasino = score >= (process.env.CASINO_SCORE_THRESHOLD ? Number(process.env.CASINO_SCORE_THRESHOLD) : 35);

      return {
        metaTitle,
        metaDescription,
        isCasino,
        score,
        matchedKeywords: matched,
        homepageUrl,
      };
    } catch {
      // try next scheme
    }
  }

  return null;
}

