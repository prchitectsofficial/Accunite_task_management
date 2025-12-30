import * as cheerio from 'cheerio';
import { normalizeUrl } from './urlUtils.js';
import { parseRel, toCommercialDomain } from './commercialFilter.js';

export type ExtractedLink = {
  linkUrl: string;
  anchorText: string | null;
  relType: string;
  isDofollow: boolean;
  commercialDomain: string | null;
  isInternal: boolean;
};

export function extractLinks(html: string, pageUrl: string, blogRootDomain: string): { internal: string[]; outbound: ExtractedLink[] } {
  const $ = cheerio.load(html);
  const internal: string[] = [];
  const outbound: ExtractedLink[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const abs = normalizeUrl(href, pageUrl);
    if (!abs) return;

    const host = (() => {
      try {
        return new URL(abs).hostname.toLowerCase();
      } catch {
        return null;
      }
    })();
    if (!host) return;

    const isInternal = host === blogRootDomain || host.endsWith(`.${blogRootDomain}`);
    if (isInternal) {
      internal.push(abs);
      return;
    }

    const anchorText = ($(el).text() || '').replace(/\s+/g, ' ').trim() || null;
    const relRaw = $(el).attr('rel');
    const { relType, isDofollow } = parseRel(relRaw);
    const commercialDomain = toCommercialDomain(abs);

    outbound.push({
      linkUrl: abs,
      anchorText,
      relType,
      isDofollow,
      commercialDomain,
      isInternal: false,
    });
  });

  return { internal, outbound };
}

export function extractPublishedAt(html: string): Date | null {
  const $ = cheerio.load(html);
  const candidates: string[] = [];

  const metaProps = [
    'article:published_time',
    'og:published_time',
    'published_time',
  ];
  for (const prop of metaProps) {
    const v = $(`meta[property="${prop}"]`).attr('content') || $(`meta[name="${prop}"]`).attr('content');
    if (v) candidates.push(v);
  }

  const timeDatetime = $('time[datetime]').first().attr('datetime');
  if (timeDatetime) candidates.push(timeDatetime);

  for (const raw of candidates) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

