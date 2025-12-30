import { stringify } from 'csv-stringify/sync';
import { getCrawlerDb } from '../../database/crawlerDb.js';

export type ExportKind = 'page-level' | 'commercial-intel' | 'blog-summary';

export async function generateRunCsv(runId: number, kind: ExportKind): Promise<{ filename: string; csv: string }> {
  const db = getCrawlerDb();

  if (kind === 'page-level') {
    const [rows] = await db.query<any[]>(
      `
      SELECT
        b.root_domain AS blog_root_domain,
        cl.source_page_url AS page_url,
        cl.link_url AS commercial_link_url,
        cl.anchor_text AS anchor_text,
        CASE WHEN cl.is_dofollow = 1 THEN 'dofollow' ELSE 'nofollow' END AS dofollow_nofollow,
        cl.rel_type AS rel_attribute
      FROM commercial_link_occurrences clo
      JOIN commercial_links cl ON cl.id = clo.commercial_link_id
      JOIN blogs b ON b.id = cl.blog_id
      WHERE clo.run_id = ?
      ORDER BY b.root_domain, cl.source_page_url
      `,
      [runId]
    );

    const csv = stringify(rows, { header: true });
    return { filename: `run_${runId}_page_level_detail.csv`, csv };
  }

  if (kind === 'commercial-intel') {
    const [rows] = await db.query<any[]>(
      `
      SELECT
        cs.domain AS commercial_domain,
        COUNT(DISTINCT cl.blog_id) AS blogs_linking_count,
        ROUND(100 * SUM(CASE WHEN cl.is_dofollow = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS dofollow_pct,
        ROUND(100 * SUM(CASE WHEN cl.is_dofollow = 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS nofollow_pct,
        cs.meta_title AS meta_title,
        cs.meta_description AS meta_description,
        CASE WHEN cs.is_casino = 1 THEN 'Yes' ELSE 'No' END AS casino_related,
        cs.casino_score AS casino_confidence_score
      FROM commercial_link_occurrences clo
      JOIN commercial_links cl ON cl.id = clo.commercial_link_id
      JOIN commercial_sites cs ON cs.id = cl.commercial_site_id
      WHERE clo.run_id = ?
      GROUP BY cs.id, cs.domain, cs.meta_title, cs.meta_description, cs.is_casino, cs.casino_score
      ORDER BY blogs_linking_count DESC, cs.domain ASC
      `,
      [runId]
    );

    const csv = stringify(rows, { header: true });
    return { filename: `run_${runId}_commercial_link_intelligence.csv`, csv };
  }

  // blog-summary
  const [rows] = await db.query<any[]>(
    `
    SELECT
      b.root_domain AS blog_root_domain,
      COUNT(DISTINCT cs.domain) AS unique_commercial_domains_linked,
      ROUND(100 * SUM(CASE WHEN cl.is_dofollow = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS dofollow_outbound_pct,
      CASE WHEN SUM(CASE WHEN cs.is_casino = 1 THEN 1 ELSE 0 END) > 0 THEN 'Yes' ELSE 'No' END AS links_to_casino_sites,
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

  const csv = stringify(rows, { header: true });
  return { filename: `run_${runId}_blog_summary.csv`, csv };
}

