import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { isCrawlerDbConfigured } from '../database/crawlerDb.js';
import multer from 'multer';
import { parse as parseCsv } from 'csv-parse/sync';
import { crawlManager } from '../services/crawler/managerSingleton.js';
import { CrawlerRepo } from '../services/crawler/crawlerRepo.js';
import { generateRunCsv } from '../services/crawler/exporter.js';
import { getCrawlerDb } from '../database/crawlerDb.js';

const router = express.Router();

router.get('/health', authenticate, requireAdmin, async (req, res) => {
  const enabled = (process.env.CRAWLER_ENABLED || 'true').toLowerCase() === 'true';
  res.json({
    enabled,
    db_configured: isCrawlerDbConfigured(),
  });
});

// Other crawler endpoints are implemented in services; if DB isn't configured, fail safely.
router.use((req, res, next) => {
  const enabled = (process.env.CRAWLER_ENABLED || 'true').toLowerCase() === 'true';
  if (!enabled) {
    res.status(503).json({ error: 'Crawler is disabled (CRAWLER_ENABLED=false)' });
    return;
  }
  if (!isCrawlerDbConfigured()) {
    res.status(503).json({
      error: 'Crawler DB is not configured. Set CRAWLER_DB_HOST, CRAWLER_DB_USER, CRAWLER_DB_NAME (and password if needed).',
    });
    return;
  }
  next();
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function parseInputUrlsFromText(text: string): string[] {
  return text
    .split(/[\n,;\t ]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

router.post('/runs', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    let urls: string[] = [];

    if (req.file) {
      const csvText = req.file.buffer.toString('utf8');
      const records = parseCsv(csvText, { columns: true, skip_empty_lines: true, trim: true });
      urls = records
        .map((r: any) => r.blog_url || r.url || r.blog || r.BlogURL || r.Blog || '')
        .map((x: any) => String(x).trim())
        .filter(Boolean);
    } else if (Array.isArray(req.body?.urls)) {
      urls = req.body.urls.map((u: any) => String(u).trim()).filter(Boolean);
    } else if (typeof req.body?.input_text === 'string') {
      urls = parseInputUrlsFromText(req.body.input_text);
    }

    // Deduplicate while keeping order
    const seen = new Set<string>();
    urls = urls.filter((u) => {
      const key = u.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (urls.length === 0) {
      res.status(400).json({ error: 'No blog URLs provided. Use CSV upload (blog_url column) or input_text/urls.' });
      return;
    }

    const runId = await crawlManager.createAndStartRun(urls);
    res.json({ run_id: runId });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/runs/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const runId = Number(req.params.id);
    if (!Number.isFinite(runId)) {
      res.status(400).json({ error: 'Invalid run id' });
      return;
    }
    const status = await crawlManager.getRunStatus(runId);
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/runs', authenticate, requireAdmin, async (req, res) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 30;
    const repo = new CrawlerRepo();
    const runs = await repo.listRunsLastDays(days);
    res.json({ runs });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/runs/:id/cancel', authenticate, requireAdmin, async (req, res) => {
  const runId = Number(req.params.id);
  if (!Number.isFinite(runId)) {
    res.status(400).json({ error: 'Invalid run id' });
    return;
  }
  crawlManager.cancelRun(runId);
  res.json({ ok: true });
});

router.post('/runs/:id/resume', authenticate, requireAdmin, async (req, res) => {
  const runId = Number(req.params.id);
  if (!Number.isFinite(runId)) {
    res.status(400).json({ error: 'Invalid run id' });
    return;
  }
  crawlManager.startRun(runId);
  res.json({ ok: true });
});

router.get('/runs/:id/results/blogs', authenticate, requireAdmin, async (req, res) => {
  try {
    const runId = Number(req.params.id);
    const db = getCrawlerDb();
    const [rows] = await db.query<any[]>(
      `
      SELECT
        b.id AS blog_id,
        b.root_domain AS blog_root_domain,
        COUNT(DISTINCT cs.domain) AS unique_commercial_domains_linked,
        ROUND(100 * SUM(CASE WHEN cl.is_dofollow = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS dofollow_outbound_pct,
        CASE WHEN SUM(CASE WHEN cs.is_casino = 1 THEN 1 ELSE 0 END) > 0 THEN 1 ELSE 0 END AS links_to_casino,
        COUNT(DISTINCT CASE WHEN cs.is_casino = 1 THEN cs.domain ELSE NULL END) AS unique_casino_commercial_domains_count,
        COUNT(DISTINCT cs.domain) AS unique_commercial_links_count
      FROM commercial_link_occurrences clo
      JOIN commercial_links cl ON cl.id = clo.commercial_link_id
      JOIN commercial_sites cs ON cs.id = cl.commercial_site_id
      JOIN blogs b ON b.id = cl.blog_id
      WHERE clo.run_id = ?
      GROUP BY b.id, b.root_domain
      ORDER BY b.root_domain ASC
      `,
      [runId]
    );
    res.json({ blogs: rows });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/runs/:id/results/commercial-sites', authenticate, requireAdmin, async (req, res) => {
  try {
    const runId = Number(req.params.id);
    const casino = req.query.casino ? String(req.query.casino) : 'all'; // all|yes|no
    const db = getCrawlerDb();
    const whereCasino =
      casino === 'yes' ? 'AND cs.is_casino = 1' : casino === 'no' ? 'AND cs.is_casino = 0' : '';

    const [rows] = await db.query<any[]>(
      `
      SELECT
        cs.id AS commercial_site_id,
        cs.domain AS commercial_domain,
        COUNT(DISTINCT cl.blog_id) AS blogs_linking_count,
        ROUND(100 * SUM(CASE WHEN cl.is_dofollow = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS dofollow_pct,
        ROUND(100 * SUM(CASE WHEN cl.is_dofollow = 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS nofollow_pct,
        cs.meta_title AS meta_title,
        cs.meta_description AS meta_description,
        cs.is_casino AS is_casino_related,
        cs.casino_score AS casino_confidence_score
      FROM commercial_link_occurrences clo
      JOIN commercial_links cl ON cl.id = clo.commercial_link_id
      JOIN commercial_sites cs ON cs.id = cl.commercial_site_id
      WHERE clo.run_id = ?
      ${whereCasino}
      GROUP BY cs.id, cs.domain, cs.meta_title, cs.meta_description, cs.is_casino, cs.casino_score
      ORDER BY blogs_linking_count DESC, cs.domain ASC
      `,
      [runId]
    );
    res.json({ commercial_sites: rows });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/runs/:id/results/blogs/:blogId/page-links', authenticate, requireAdmin, async (req, res) => {
  try {
    const runId = Number(req.params.id);
    const blogId = Number(req.params.blogId);
    const limit = req.query.limit ? Math.min(500, Math.max(1, Number(req.query.limit))) : 200;
    const offset = req.query.offset ? Math.max(0, Number(req.query.offset)) : 0;
    const db = getCrawlerDb();
    const [rows] = await db.query<any[]>(
      `
      SELECT
        b.root_domain AS blog_root_domain,
        cl.source_page_url AS page_url,
        cl.link_url AS commercial_link_url,
        cs.domain AS commercial_domain,
        cl.anchor_text AS anchor_text,
        cl.is_dofollow AS is_dofollow,
        cl.rel_type AS rel_attribute,
        cs.is_casino AS is_casino_related,
        cs.casino_score AS casino_confidence_score
      FROM commercial_link_occurrences clo
      JOIN commercial_links cl ON cl.id = clo.commercial_link_id
      JOIN commercial_sites cs ON cs.id = cl.commercial_site_id
      JOIN blogs b ON b.id = cl.blog_id
      WHERE clo.run_id = ? AND cl.blog_id = ?
      ORDER BY cl.source_page_url ASC
      LIMIT ? OFFSET ?
      `,
      [runId, blogId, limit, offset]
    );
    res.json({ rows, limit, offset });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/runs/:id/exports/:kind', authenticate, requireAdmin, async (req, res) => {
  try {
    const runId = Number(req.params.id);
    const kind = String(req.params.kind);
    if (!Number.isFinite(runId)) {
      res.status(400).json({ error: 'Invalid run id' });
      return;
    }
    if (!['page-level', 'commercial-intel', 'blog-summary'].includes(kind)) {
      res.status(400).json({ error: 'Invalid export kind' });
      return;
    }

    const out = await generateRunCsv(runId, kind as any);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.send(out.csv);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;

