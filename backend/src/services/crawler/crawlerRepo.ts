import { Pool, ResultSetHeader } from 'mysql2/promise';
import { getCrawlerDb, withCrawlerTx } from '../../database/crawlerDb.js';
import { sha256Hex } from './urlUtils.js';

export type CrawlRunRow = {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  total_blogs_processed: number;
  total_pages_crawled: number;
  total_links_found: number;
  error_message: string | null;
};

export type RunBlogRow = {
  id: number;
  run_id: number;
  blog_id: number | null;
  input_blog_url: string;
  root_domain: string | null;
  status: 'queued' | 'running' | 'skipped' | 'completed' | 'failed';
  skip_reason: string | null;
  started_at: string | null;
  finished_at: string | null;
  pages_crawled: number;
  links_found: number;
  error_message: string | null;
};

export class CrawlerRepo {
  private db: Pool;
  constructor(db?: Pool) {
    this.db = db || getCrawlerDb();
  }

  async getRun(runId: number): Promise<CrawlRunRow | null> {
    const [rows] = await this.db.query<any[]>(`SELECT * FROM crawl_runs WHERE id = ?`, [runId]);
    return rows[0] ? (rows[0] as CrawlRunRow) : null;
  }

  async listRunsLastDays(days: number): Promise<CrawlRunRow[]> {
    const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
    const [rows] = await this.db.query<any[]>(
      `SELECT *
       FROM crawl_runs
       WHERE started_at >= (UTC_TIMESTAMP(3) - INTERVAL ? DAY)
       ORDER BY started_at DESC`,
      [safeDays]
    );
    return rows as CrawlRunRow[];
  }

  async createRun(): Promise<number> {
    const [res] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO crawl_runs (started_at, status) VALUES (UTC_TIMESTAMP(3), 'running')`
    );
    return Number(res.insertId);
  }

  async markRunFinished(runId: number, status: CrawlRunRow['status'], errorMessage?: string | null): Promise<void> {
    await this.db.execute(
      `UPDATE crawl_runs
       SET finished_at = UTC_TIMESTAMP(3),
           status = ?,
           error_message = ?
       WHERE id = ?`,
      [status, errorMessage || null, runId]
    );
  }

  async refreshRunCounters(runId: number): Promise<void> {
    // Pages crawled in this run
    const [[p]] = await this.db.query<any[]>(
      `SELECT COUNT(*) AS c FROM blog_page_crawls WHERE run_id = ?`,
      [runId]
    );
    const [[l]] = await this.db.query<any[]>(
      `SELECT COUNT(*) AS c FROM commercial_link_occurrences WHERE run_id = ?`,
      [runId]
    );
    const [[b]] = await this.db.query<any[]>(
      `SELECT COUNT(*) AS c FROM crawl_run_blogs WHERE run_id = ? AND status IN ('completed','failed','skipped')`,
      [runId]
    );

    await this.db.execute(
      `UPDATE crawl_runs
       SET total_pages_crawled = ?,
           total_links_found = ?,
           total_blogs_processed = ?
       WHERE id = ?`,
      [Number(p.c || 0), Number(l.c || 0), Number(b.c || 0), runId]
    );
  }

  async insertRunBlogs(runId: number, inputUrls: string[]): Promise<void> {
    if (inputUrls.length === 0) return;
    const values = inputUrls.map(() => `(?, ?)`).join(',');
    const params: any[] = [];
    for (const u of inputUrls) {
      params.push(runId, u);
    }
    await this.db.execute(
      `INSERT IGNORE INTO crawl_run_blogs (run_id, input_blog_url) VALUES ${values}`,
      params
    );
  }

  async listRunBlogs(runId: number): Promise<RunBlogRow[]> {
    const [rows] = await this.db.query<any[]>(
      `SELECT * FROM crawl_run_blogs WHERE run_id = ? ORDER BY id ASC`,
      [runId]
    );
    return rows as RunBlogRow[];
  }

  async updateRunBlog(
    runBlogId: number,
    patch: Partial<Pick<RunBlogRow, 'blog_id' | 'root_domain' | 'status' | 'skip_reason' | 'pages_crawled' | 'links_found' | 'error_message'>> & {
      started_at?: 'now';
      finished_at?: 'now';
    }
  ): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];

    const set = (k: string, v: any) => {
      sets.push(`${k} = ?`);
      params.push(v);
    };

    if (patch.blog_id !== undefined) set('blog_id', patch.blog_id);
    if (patch.root_domain !== undefined) set('root_domain', patch.root_domain);
    if (patch.status !== undefined) set('status', patch.status);
    if (patch.skip_reason !== undefined) set('skip_reason', patch.skip_reason);
    if (patch.pages_crawled !== undefined) set('pages_crawled', patch.pages_crawled);
    if (patch.links_found !== undefined) set('links_found', patch.links_found);
    if (patch.error_message !== undefined) set('error_message', patch.error_message);
    if (patch.started_at === 'now') sets.push(`started_at = UTC_TIMESTAMP(3)`);
    if (patch.finished_at === 'now') sets.push(`finished_at = UTC_TIMESTAMP(3)`);

    if (sets.length === 0) return;
    params.push(runBlogId);
    await this.db.execute(`UPDATE crawl_run_blogs SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  async upsertBlog(rootDomain: string, rootUrl: string | null): Promise<number> {
    return withCrawlerTx(async (conn) => {
      await conn.execute(
        `INSERT INTO blogs (root_domain, root_url, first_crawled_at, last_crawled_at)
         VALUES (?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
         ON DUPLICATE KEY UPDATE
           root_url = COALESCE(VALUES(root_url), root_url),
           first_crawled_at = COALESCE(first_crawled_at, VALUES(first_crawled_at)),
           last_crawled_at = VALUES(last_crawled_at)`,
        [rootDomain, rootUrl]
      );
      const [[row]] = await conn.query<any[]>(`SELECT id FROM blogs WHERE root_domain = ?`, [rootDomain]);
      return Number(row.id);
    });
  }

  async getBlogByRootDomain(rootDomain: string): Promise<{ id: number; last_crawled_at: string | null } | null> {
    const [rows] = await this.db.query<any[]>(
      `SELECT id, last_crawled_at FROM blogs WHERE root_domain = ?`,
      [rootDomain]
    );
    return rows[0] ? { id: Number(rows[0].id), last_crawled_at: rows[0].last_crawled_at } : null;
  }

  async touchBlogCrawled(blogId: number): Promise<void> {
    await this.db.execute(
      `UPDATE blogs SET last_crawled_at = UTC_TIMESTAMP(3) WHERE id = ?`,
      [blogId]
    );
  }

  async upsertBlogPage(blogId: number, pageUrl: string): Promise<{ id: number; existed: boolean }> {
    const h = sha256Hex(pageUrl);
    const [res] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO blog_pages (blog_id, page_url, page_url_hash, first_crawled_at, last_crawled_at)
       VALUES (?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE
         last_crawled_at = VALUES(last_crawled_at)`,
      [blogId, pageUrl, h]
    );
    const existed = res.affectedRows === 2; // MySQL reports 2 when updated
    const [[row]] = await this.db.query<any[]>(
      `SELECT id FROM blog_pages WHERE blog_id = ? AND page_url_hash = ?`,
      [blogId, h]
    );
    return { id: Number(row.id), existed };
  }

  async recordPageCrawl(runId: number, blogId: number, blogPageId: number, httpStatus: number | null, contentType: string | null, errorMessage: string | null): Promise<void> {
    await this.db.execute(
      `INSERT INTO blog_page_crawls (run_id, blog_id, blog_page_id, crawled_at, http_status, content_type, error_message)
       VALUES (?, ?, ?, UTC_TIMESTAMP(3), ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         crawled_at = VALUES(crawled_at),
         http_status = VALUES(http_status),
         content_type = VALUES(content_type),
         error_message = VALUES(error_message)`,
      [runId, blogId, blogPageId, httpStatus, contentType, errorMessage]
    );
  }

  async upsertCommercialSite(domain: string, patch?: { metaTitle?: string | null; metaDescription?: string | null; isCasino?: boolean; casinoScore?: number; homepageUrl?: string | null }): Promise<number> {
    return withCrawlerTx(async (conn) => {
      await conn.execute(
        `INSERT INTO commercial_sites (domain, homepage_url, meta_title, meta_description, is_casino, casino_score, first_seen_at, last_checked_at)
         VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
         ON DUPLICATE KEY UPDATE
           homepage_url = COALESCE(VALUES(homepage_url), homepage_url),
           meta_title = COALESCE(VALUES(meta_title), meta_title),
           meta_description = COALESCE(VALUES(meta_description), meta_description),
           is_casino = GREATEST(is_casino, VALUES(is_casino)),
           casino_score = GREATEST(casino_score, VALUES(casino_score)),
           last_checked_at = COALESCE(VALUES(last_checked_at), last_checked_at)`,
        [
          domain,
          patch?.homepageUrl ?? null,
          patch?.metaTitle ?? null,
          patch?.metaDescription ?? null,
          patch?.isCasino ? 1 : 0,
          patch?.casinoScore ?? 0,
        ]
      );
      const [[row]] = await conn.query<any[]>(`SELECT id FROM commercial_sites WHERE domain = ?`, [domain]);
      return Number(row.id);
    });
  }

  async getCommercialSite(domain: string): Promise<{ id: number; last_checked_at: string | null } | null> {
    const [rows] = await this.db.query<any[]>(
      `SELECT id, last_checked_at FROM commercial_sites WHERE domain = ?`,
      [domain]
    );
    return rows[0] ? { id: Number(rows[0].id), last_checked_at: rows[0].last_checked_at } : null;
  }

  async upsertCommercialLink(args: {
    blogId: number;
    commercialSiteId: number;
    sourcePageUrl: string;
    linkUrl: string;
    anchorText: string | null;
    isDofollow: boolean;
    relType: string;
  }): Promise<number> {
    const spHash = sha256Hex(args.sourcePageUrl);
    const linkHash = sha256Hex(args.linkUrl);
    return withCrawlerTx(async (conn) => {
      await conn.execute(
        `INSERT INTO commercial_links (
          blog_id, commercial_site_id,
          source_page_url, source_page_url_hash,
          link_url, link_url_hash,
          anchor_text, is_dofollow, rel_type,
          first_found_at, last_found_at, seen_count
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), 1)
        ON DUPLICATE KEY UPDATE
          last_found_at = VALUES(last_found_at),
          seen_count = seen_count + 1,
          anchor_text = COALESCE(VALUES(anchor_text), anchor_text),
          is_dofollow = VALUES(is_dofollow)`,
        [
          args.blogId,
          args.commercialSiteId,
          args.sourcePageUrl,
          spHash,
          args.linkUrl,
          linkHash,
          args.anchorText,
          args.isDofollow ? 1 : 0,
          args.relType,
        ]
      );
      const [[row]] = await conn.query<any[]>(
        `SELECT id FROM commercial_links
         WHERE blog_id = ? AND commercial_site_id = ?
           AND source_page_url_hash = ? AND link_url_hash = ? AND rel_type = ?`,
        [args.blogId, args.commercialSiteId, spHash, linkHash, args.relType]
      );
      return Number(row.id);
    });
  }

  async recordCommercialLinkOccurrence(runId: number, blogId: number, commercialLinkId: number): Promise<void> {
    await this.db.execute(
      `INSERT INTO commercial_link_occurrences (run_id, blog_id, commercial_link_id, found_at)
       VALUES (?, ?, ?, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE found_at = VALUES(found_at)`,
      [runId, blogId, commercialLinkId]
    );
  }

  async recomputeBlogRollups(blogId: number): Promise<void> {
    const [[pages]] = await this.db.query<any[]>(
      `SELECT COUNT(*) AS c FROM blog_pages WHERE blog_id = ?`,
      [blogId]
    );
    const [[uniqueCommercial]] = await this.db.query<any[]>(
      `SELECT COUNT(DISTINCT commercial_site_id) AS c FROM commercial_links WHERE blog_id = ?`,
      [blogId]
    );
    const [[hasCasino]] = await this.db.query<any[]>(
      `SELECT EXISTS(
         SELECT 1
         FROM commercial_links cl
         JOIN commercial_sites cs ON cs.id = cl.commercial_site_id
         WHERE cl.blog_id = ? AND cs.is_casino = 1
       ) AS c`,
      [blogId]
    );
    await this.db.execute(
      `UPDATE blogs
       SET total_pages_crawled = ?,
           total_unique_commercial_links = ?,
           links_to_casino = ?
       WHERE id = ?`,
      [Number(pages.c || 0), Number(uniqueCommercial.c || 0), Number(hasCasino.c || 0), blogId]
    );
  }

  async logEvent(runId: number, level: 'debug' | 'info' | 'warn' | 'error', message: string, payload?: any): Promise<void> {
    await this.db.execute(
      `INSERT INTO crawl_run_events (run_id, level, message, payload, created_at)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
      [runId, level, message, payload ? JSON.stringify(payload) : null]
    );
  }
}

