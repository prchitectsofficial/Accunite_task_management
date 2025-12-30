import { getRegistrableDomainFromUrl, getHostnameFromUrl } from './urlUtils.js';

const SOCIAL_DOMAINS = new Set([
  'facebook.com',
  'fb.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  't.co',
  'linkedin.com',
  'youtube.com',
  'youtu.be',
  'pinterest.com',
  'tiktok.com',
  'reddit.com',
]);

// Common "non-commercial" / infra / platforms we generally do not want as "money sites".
const COMMON_PLATFORM_DOMAINS = new Set([
  'wordpress.org',
  'wordpress.com',
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'wikipedia.org',
  'medium.com',
  'blogger.com',
  'substack.com',
  'tumblr.com',
  'amzn.to',
  'amazon.com',
  'google.com',
  'goo.gl',
  'mailto',
]);

export function isExcludedCommercialDomain(hostnameOrDomain: string): boolean {
  const h = hostnameOrDomain.toLowerCase();
  if (SOCIAL_DOMAINS.has(h) || COMMON_PLATFORM_DOMAINS.has(h)) return true;
  // also exclude subdomains of socials/platforms
  for (const d of SOCIAL_DOMAINS) if (h === d || h.endsWith(`.${d}`)) return true;
  for (const d of COMMON_PLATFORM_DOMAINS) if (h === d || h.endsWith(`.${d}`)) return true;
  return false;
}

export function toCommercialDomain(linkUrl: string): string | null {
  const host = getHostnameFromUrl(linkUrl);
  if (!host) return null;
  if (isExcludedCommercialDomain(host)) return null;

  // Use registrable domain for dedupe.
  const rd = getRegistrableDomainFromUrl(linkUrl);
  if (!rd) return null;
  if (isExcludedCommercialDomain(rd)) return null;
  return rd;
}

export function parseRel(relRaw: string | undefined | null): { relType: string; isDofollow: boolean } {
  const rel = (relRaw || '').toLowerCase().trim();
  const parts = new Set(rel.split(/\s+/).filter(Boolean));
  const hasNofollow = parts.has('nofollow');
  const hasSponsored = parts.has('sponsored');
  const hasUgc = parts.has('ugc');

  let relType = 'dofollow';
  if (hasNofollow && (hasSponsored || hasUgc)) relType = 'nofollow';
  else if (hasNofollow) relType = 'nofollow';
  else if (hasSponsored) relType = 'sponsored';
  else if (hasUgc) relType = 'ugc';

  const isDofollow = !(hasNofollow || hasSponsored || hasUgc);
  return { relType, isDofollow };
}

