import pLimit from 'p-limit';
import { CrawlerRepo } from './crawlerRepo.js';
import { normalizeUrl, getRegistrableDomainFromUrl, isInternalUrl } from './urlUtils.js';
import { PerDomainRateLimiter } from './rateLimiter.js';
import { RobotsCache } from './robots.js';
import { fetchHtml } from './httpClient.js';
import { extractLinks, extractPublishedAt } from './htmlParse.js';
import { detectCasinoHomepage } from './casinoDetector.js';

type CrawlConfig = {
  maxPagesPerBlog: number;
  maxBlogConcurrency: number;
  maxCasinoConcurrency: number;
  perDomainDelayMs: number;
  timeoutMs: number;
  maxHtmlBytes: number;
  respectRobots: boolean;
  memoryDays: number;
  postMaxAgeMonths: number;
  userAgent: string;
};

function getConfig(): CrawlConfig {
  return {
    maxPagesPerBlog: Number(process.env.CRAWLER_MAX_PAGES_PER_BLOG || 1000),
    maxBlogConcurrency: Number(process.env.CRAWLER_MAX_BLOG_CONCURRENCY || 3),
    maxCasinoConcurrency: Number(process.env.CRAWLER_MAX_CASINO_CONCURRENCY || 5),
    perDomainDelayMs: Number(process.env.CRAWLER_DOMAIN_DELAY_MS || 500),
    timeoutMs: Number(process.env.CRAWLER_TIMEOUT_MS || 15000),
    maxHtmlBytes: Number(process.env.CRAWLER_MAX_HTML_BYTES || 2_000_000),
    respectRobots: (process.env.CRAWLER_RESPECT_ROBOTS || 'true').toLowerCase() === 'true',
    memoryDays: Number(process.env.CRAWLER_MEMORY_DAYS || 30),
    postMaxAgeMonths: Number(process.env.CRAWLER_POST_MAX_AGE_MONTHS || 12),
    userAgent: process.env.CRAWLER_USER_AGENT || 'BlogLeadCrawler/1.0 (+https://example.com)',
  };
}

function monthsAgo(d: Date, months: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() - months);
  return x;
}

export class CrawlManager {
  private repo = new CrawlerRepo();
  private controllers = new Map<number, AbortController>();
  private running = new Map<number, Promise<void>>();

  async createAndStartRun(inputUrls: string[]): Promise<number> {
    const runId = await this.repo.createRun();
    await this.repo.insertRunBlogs(runId, inputUrls);
    this.startRun(runId);
    return runId;
  }

  startRun(runId: number): void {
    if (this.running.has(runId)) return;
    const controller = new AbortController();
    this.controllers.set(runId, controller);
    const p = this.runInternal(runId, controller.signal)
      .catch(async (e) => {
        await this.repo.logEvent(runId, 'error', 'Run failed', { error: String(e) });
        await this.repo.refreshRunCounters(runId);
        await this.repo.markRunFinished(runId, 'failed', String(e));
      })
      .finally(() => {
        this.controllers.delete(runId);
        this.running.delete(runId);
      });
    this.running.set(runId, p);
  }

  cancelRun(runId: number): void {
    const c = this.controllers.get(runId);
    if (c) c.abort(new Error('cancelled'));
  }

  async getRunStatus(runId: number): Promise<{
    runId: number;
    status: string;
    totals: { blogsProcessed: number; pagesCrawled: number; linksFound: number };
    blogs: any[];
  }> {
    const run = await this.repo.getRun(runId);
    const blogs = await this.repo.listRunBlogs(runId);
    return {
      runId,
      status: run?.status || 'unknown',
      totals: {
        blogsProcessed: Number(run?.total_blogs_processed || 0),
        pagesCrawled: Number(run?.total_pages_crawled || 0),
        linksFound: Number(run?.total_links_found || 0),
      },
      blogs,
    };
  }

  private async runInternal(runId: number, signal: AbortSignal): Promise<void> {
    const cfg = getConfig();
    const limiter = new PerDomainRateLimiter(cfg.perDomainDelayMs);
    const robots = new RobotsCache(cfg.userAgent, 6 * 60 * 60 * 1000, Math.min(5000, cfg.timeoutMs));

    await this.repo.logEvent(runId, 'info', 'Run started', { cfg });

    const runBlogsAll = await this.repo.listRunBlogs(runId);
    const runBlogs = runBlogsAll.filter((rb: any) => ['queued', 'running', 'failed'].includes(String(rb.status)));
    const blogLimit = pLimit(cfg.maxBlogConcurrency);
    const casinoLimit = pLimit(cfg.maxCasinoConcurrency);

    // per-run caches
    const commercialSiteIdCache = new Map<string, number>();
    const casinoCheckedInRun = new Set<string>();
    const casinoPromises: Promise<void>[] = [];

    const maybeDetectCasino = async (domain: string): Promise<void> => {
      if (casinoCheckedInRun.has(domain)) return;
      casinoCheckedInRun.add(domain);

      await casinoLimit(async () => {
        if (signal.aborted) return;
        const existing = await this.repo.getCommercialSite(domain);
        const shouldRecheck =
          !existing?.last_checked_at ||
          new Date(existing.last_checked_at).getTime() < Date.now() - cfg.memoryDays * 24 * 60 * 60 * 1000;
        if (!shouldRecheck) return;

        const det = await detectCasinoHomepage(domain, {
          timeoutMs: cfg.timeoutMs,
          userAgent: cfg.userAgent,
          maxBytes: cfg.maxHtmlBytes,
          signal,
        });
        if (!det) return;
        await this.repo.upsertCommercialSite(domain, {
          metaTitle: det.metaTitle,
          metaDescription: det.metaDescription,
          isCasino: det.isCasino,
          casinoScore: det.score,
          homepageUrl: det.homepageUrl,
        });
      });
    };

    const getOrCreateCommercialSiteId = async (domain: string): Promise<number> => {
      const cached = commercialSiteIdCache.get(domain);
      if (cached) return cached;
      const existing = await this.repo.getCommercialSite(domain);
      const id = existing ? existing.id : await this.repo.upsertCommercialSite(domain);
      commercialSiteIdCache.set(domain, id);
      return id;
    };

    const processBlog = async (rb: any): Promise<void> => {
      if (signal.aborted) return;

      const raw = String(rb.input_blog_url || '').trim();
      const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const startUrl = normalizeUrl(withScheme);
      if (!startUrl) {
        await this.repo.updateRunBlog(rb.id, { status: 'skipped', skip_reason: 'invalid_url', finished_at: 'now' });
        return;
      }
      const rootDomain = getRegistrableDomainFromUrl(startUrl);
      if (!rootDomain) {
        await this.repo.updateRunBlog(rb.id, { status: 'skipped', skip_reason: 'invalid_domain', finished_at: 'now' });
        return;
      }

      await this.repo.updateRunBlog(rb.id, { status: 'running', root_domain: rootDomain, started_at: 'now' });

      const blogExisting = await this.repo.getBlogByRootDomain(rootDomain);
      if (blogExisting?.last_crawled_at) {
        const last = new Date(blogExisting.last_crawled_at).getTime();
        const recent = last > Date.now() - cfg.memoryDays * 24 * 60 * 60 * 1000;
        if (recent) {
          await this.repo.updateRunBlog(rb.id, {
            blog_id: blogExisting.id,
            status: 'skipped',
            skip_reason: `already_crawled_within_${cfg.memoryDays}d`,
            finished_at: 'now',
          });
          return;
        }
      }

      const blogId = await this.repo.upsertBlog(rootDomain, startUrl);
      await this.repo.updateRunBlog(rb.id, { blog_id: blogId });

      const queue: string[] = [startUrl];
      const seen = new Set<string>();
      let pagesCrawled = 0;
      let linksFound = 0;
      let successfulHtmlPages = 0;
      const cutoff = monthsAgo(new Date(), cfg.postMaxAgeMonths).getTime();

      while (queue.length > 0 && pagesCrawled < cfg.maxPagesPerBlog) {
        if (signal.aborted) throw signal.reason ?? new Error('cancelled');
        const pageUrl = queue.shift()!;
        if (!isInternalUrl(pageUrl, rootDomain)) continue;
        if (seen.has(pageUrl)) continue;
        seen.add(pageUrl);

        const page = await this.repo.upsertBlogPage(blogId, pageUrl);
        if (page.existed) {
          // Memory rule: skip previously processed pages
          continue;
        }

        // robots + rate limit
        const hostname = new URL(pageUrl).hostname.toLowerCase();
        await limiter.wait(hostname, signal);
        if (cfg.respectRobots) {
          const allowed = await robots.isAllowed(pageUrl, signal);
          if (!allowed) {
            await this.repo.recordPageCrawl(runId, blogId, page.id, null, null, 'blocked_by_robots');
            continue;
          }
        }

        try {
          const res = await fetchHtml(pageUrl, {
            timeoutMs: cfg.timeoutMs,
            userAgent: cfg.userAgent,
            maxBytes: cfg.maxHtmlBytes,
            signal,
            retries: 2,
          });

          await this.repo.recordPageCrawl(runId, blogId, page.id, res.status, res.contentType, null);
          pagesCrawled += 1;

          if (!res.ok || !res.html) continue;
          successfulHtmlPages += 1;

          // 12-month heuristic: if published_at exists and is older, don't extract/enqueue.
          const publishedAt = extractPublishedAt(res.html);
          if (publishedAt && publishedAt.getTime() < cutoff) {
            continue;
          }

          const { internal, outbound } = extractLinks(res.html, pageUrl, rootDomain);
          for (const iUrl of internal) {
            if (queue.length + seen.size >= cfg.maxPagesPerBlog) break;
            if (!seen.has(iUrl)) queue.push(iUrl);
          }

          for (const out of outbound) {
            if (!out.commercialDomain) continue;
            const siteId = await getOrCreateCommercialSiteId(out.commercialDomain);
            const linkId = await this.repo.upsertCommercialLink({
              blogId,
              commercialSiteId: siteId,
              sourcePageUrl: pageUrl,
              linkUrl: out.linkUrl,
              anchorText: out.anchorText,
              isDofollow: out.isDofollow,
              relType: out.relType,
            });
            await this.repo.recordCommercialLinkOccurrence(runId, blogId, linkId);
            linksFound += 1;
            casinoPromises.push(maybeDetectCasino(out.commercialDomain));
          }
        } catch (e) {
          await this.repo.recordPageCrawl(runId, blogId, page.id, null, null, String(e));
        }

        if (pagesCrawled % 25 === 0) {
          await this.repo.updateRunBlog(rb.id, { pages_crawled: pagesCrawled, links_found: linksFound });
          await this.repo.refreshRunCounters(runId);
        }
      }

      await this.repo.touchBlogCrawled(blogId);
      await this.repo.recomputeBlogRollups(blogId);
      if (successfulHtmlPages === 0) {
        await this.repo.updateRunBlog(rb.id, {
          status: 'failed',
          pages_crawled: pagesCrawled,
          links_found: linksFound,
          error_message: 'blog_unreachable_or_non_html',
          finished_at: 'now',
        });
        return;
      }

      await this.repo.updateRunBlog(rb.id, {
        status: 'completed',
        pages_crawled: pagesCrawled,
        links_found: linksFound,
        finished_at: 'now',
      });
    };

    await Promise.all(
      runBlogs.map((rb) =>
        blogLimit(async () => {
          try {
            await processBlog(rb);
          } catch (e) {
            if (String(e).includes('cancelled') || (signal.aborted && String(signal.reason || '').includes('cancelled'))) {
              await this.repo.updateRunBlog(rb.id, { status: 'failed', error_message: 'cancelled', finished_at: 'now' });
              return;
            }
            await this.repo.updateRunBlog(rb.id, { status: 'failed', error_message: String(e), finished_at: 'now' });
          }
        })
      )
    );

    // Wait for all casino checks triggered during this run.
    await Promise.allSettled(casinoPromises);

    await this.repo.refreshRunCounters(runId);
    if (signal.aborted) {
      await this.repo.markRunFinished(runId, 'cancelled', 'cancelled');
      return;
    }
    await this.repo.markRunFinished(runId, 'completed', null);
    await this.repo.logEvent(runId, 'info', 'Run completed');
  }
}

