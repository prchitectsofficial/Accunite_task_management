import crypto from 'crypto';
import { parse as parseDomain } from 'tldts';

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const u = base ? new URL(raw, base) : new URL(raw);
    // only http(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

    // normalize host casing + remove default ports
    u.hostname = u.hostname.toLowerCase();
    if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
      u.port = '';
    }

    // strip hash
    u.hash = '';

    // strip common tracking params
    const tracking = new Set([
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'gclid',
      'fbclid',
      'igshid',
      'mc_cid',
      'mc_eid',
    ]);
    for (const k of Array.from(u.searchParams.keys())) {
      if (tracking.has(k.toLowerCase())) u.searchParams.delete(k);
    }

    // stable ordering of query params
    if (u.searchParams.size > 1) {
      const entries = Array.from(u.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
      u.search = '';
      for (const [k, v] of entries) u.searchParams.append(k, v);
    }

    // normalize trailing slash (keep root "/")
    if (u.pathname.length > 1) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }

    return u.toString();
  } catch {
    return null;
  }
}

export function getRegistrableDomainFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parsed = parseDomain(u.hostname);
    if (!parsed.domain) return u.hostname.toLowerCase();
    // domain is registrable domain without subdomain
    return parsed.domain.toLowerCase();
  } catch {
    return null;
  }
}

export function getHostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isInternalUrl(targetUrl: string, blogRootDomain: string): boolean {
  const host = getHostnameFromUrl(targetUrl);
  if (!host) return false;
  if (host === blogRootDomain) return true;
  return host.endsWith(`.${blogRootDomain}`);
}

