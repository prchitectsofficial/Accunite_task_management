import robotsParser from 'robots-parser';
import { fetch } from 'undici';

type RobotsCacheEntry = {
  fetchedAt: number;
  parser: ReturnType<typeof robotsParser>;
};

export class RobotsCache {
  private cache = new Map<string, RobotsCacheEntry>();
  constructor(
    private readonly userAgent: string,
    private readonly ttlMs: number,
    private readonly timeoutMs: number
  ) {}

  private async fetchRobotsTxt(origin: string, signal?: AbortSignal): Promise<string | null> {
    const url = `${origin.replace(/\/+$/, '')}/robots.txt`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(new Error('timeout')), this.timeoutMs);
    const signals: AbortSignal[] = [controller.signal];
    if (signal) signals.push(signal);
    const combined =
      (AbortSignal as any).any ? (AbortSignal as any).any(signals) : signal || controller.signal;

    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: combined });
      if (!res.ok) return null;
      const txt = await res.text();
      return txt;
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  async isAllowed(pageUrl: string, signal?: AbortSignal): Promise<boolean> {
    try {
      const u = new URL(pageUrl);
      const origin = u.origin;
      const now = Date.now();
      const cached = this.cache.get(origin);
      if (cached && now - cached.fetchedAt < this.ttlMs) {
        return cached.parser.isAllowed(pageUrl, this.userAgent) ?? true;
      }

      const txt = await this.fetchRobotsTxt(origin, signal);
      const parser = robotsParser(`${origin}/robots.txt`, txt || '');
      this.cache.set(origin, { fetchedAt: now, parser });
      return parser.isAllowed(pageUrl, this.userAgent) ?? true;
    } catch {
      // Fail-open; configurable behavior can be tightened later.
      return true;
    }
  }
}

