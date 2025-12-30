import { fetch } from 'undici';

export type FetchResult = {
  url: string;
  status: number;
  ok: boolean;
  contentType: string | null;
  html: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchHtml(
  url: string,
  opts: {
    timeoutMs: number;
    userAgent: string;
    maxBytes: number;
    signal?: AbortSignal;
    retries: number;
  }
): Promise<FetchResult> {
  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= opts.retries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('timeout')), opts.timeoutMs);

    const signals: AbortSignal[] = [controller.signal];
    if (opts.signal) signals.push(opts.signal);

    // AbortSignal.any is supported in modern Node; provide safe fallback.
    const combined =
      (AbortSignal as any).any ? (AbortSignal as any).any(signals) : opts.signal || controller.signal;

    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'user-agent': opts.userAgent,
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        },
        signal: combined,
      });

      const contentType = res.headers.get('content-type');
      const isHtml = contentType ? contentType.toLowerCase().includes('text/html') : false;

      if (!isHtml) {
        clearTimeout(timeout);
        return { url, status: res.status, ok: res.ok, contentType, html: null };
      }

      // Guard memory: read up to maxBytes.
      const reader = res.body?.getReader();
      if (!reader) {
        clearTimeout(timeout);
        return { url, status: res.status, ok: res.ok, contentType, html: null };
      }

      let received = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        received += value.byteLength;
        if (received > opts.maxBytes) {
          // Stop early; treat as non-html to avoid parsing partial huge pages.
          clearTimeout(timeout);
          return { url, status: res.status, ok: res.ok, contentType, html: null };
        }
        chunks.push(value);
      }

      clearTimeout(timeout);
      const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      const html = buf.toString('utf8');
      return { url, status: res.status, ok: res.ok, contentType, html };
    } catch (e) {
      clearTimeout(timeout);
      lastErr = e;
      // simple backoff
      if (attempt < opts.retries) await sleep(250 * Math.pow(2, attempt));
    }

    attempt += 1;
  }

  throw lastErr instanceof Error ? lastErr : new Error('fetch failed');
}

