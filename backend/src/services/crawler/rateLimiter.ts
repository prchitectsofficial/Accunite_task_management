type DomainState = {
  nextAllowedAt: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class PerDomainRateLimiter {
  private readonly states = new Map<string, DomainState>();
  constructor(private readonly minDelayMs: number) {}

  async wait(domain: string, signal?: AbortSignal): Promise<void> {
    const now = Date.now();
    const st = this.states.get(domain) || { nextAllowedAt: now };
    const waitMs = Math.max(0, st.nextAllowedAt - now);
    st.nextAllowedAt = Math.max(st.nextAllowedAt, now) + this.minDelayMs;
    this.states.set(domain, st);

    if (waitMs <= 0) return;

    if (!signal) {
      await sleep(waitMs);
      return;
    }

    await Promise.race([
      sleep(waitMs),
      new Promise<void>((_, reject) => {
        if (signal.aborted) reject(signal.reason ?? new Error('aborted'));
        signal.addEventListener('abort', () => reject(signal.reason ?? new Error('aborted')), { once: true });
      }),
    ]);
  }
}

