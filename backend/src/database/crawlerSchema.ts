import { Pool } from 'mysql2/promise';

export async function ensureCrawlerSchema(db: Pool): Promise<void> {
  // NOTE: We intentionally avoid foreign keys with cascading deletes for auditability.
  // Use InnoDB + utf8mb4 everywhere.
  const statements: string[] = [
    `
    CREATE TABLE IF NOT EXISTS crawl_runs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      started_at DATETIME(3) NOT NULL,
      finished_at DATETIME(3) NULL,
      status ENUM('running','completed','failed','cancelled') NOT NULL DEFAULT 'running',
      total_blogs_processed INT UNSIGNED NOT NULL DEFAULT 0,
      total_pages_crawled INT UNSIGNED NOT NULL DEFAULT 0,
      total_links_found INT UNSIGNED NOT NULL DEFAULT 0,
      error_message TEXT NULL,
      PRIMARY KEY (id),
      KEY idx_crawl_runs_started_at (started_at),
      KEY idx_crawl_runs_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
    CREATE TABLE IF NOT EXISTS blogs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      root_domain VARCHAR(255) NOT NULL,
      root_url TEXT NULL,
      first_crawled_at DATETIME(3) NULL,
      last_crawled_at DATETIME(3) NULL,
      total_pages_crawled INT UNSIGNED NOT NULL DEFAULT 0,
      total_unique_commercial_links INT UNSIGNED NOT NULL DEFAULT 0,
      links_to_casino TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uq_blogs_root_domain (root_domain),
      KEY idx_blogs_last_crawled_at (last_crawled_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
    CREATE TABLE IF NOT EXISTS blog_pages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      blog_id BIGINT UNSIGNED NOT NULL,
      page_url TEXT NOT NULL,
      page_url_hash CHAR(64) NOT NULL,
      first_crawled_at DATETIME(3) NULL,
      last_crawled_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_blog_pages_blog_hash (blog_id, page_url_hash),
      KEY idx_blog_pages_blog_id (blog_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
    CREATE TABLE IF NOT EXISTS commercial_sites (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      domain VARCHAR(255) NOT NULL,
      homepage_url TEXT NULL,
      meta_title TEXT NULL,
      meta_description TEXT NULL,
      is_casino TINYINT(1) NOT NULL DEFAULT 0,
      casino_score INT UNSIGNED NOT NULL DEFAULT 0,
      first_seen_at DATETIME(3) NOT NULL,
      last_checked_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_commercial_sites_domain (domain),
      KEY idx_commercial_sites_is_casino (is_casino),
      KEY idx_commercial_sites_first_seen_at (first_seen_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
    CREATE TABLE IF NOT EXISTS commercial_links (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      blog_id BIGINT UNSIGNED NOT NULL,
      commercial_site_id BIGINT UNSIGNED NOT NULL,
      source_page_url TEXT NOT NULL,
      source_page_url_hash CHAR(64) NOT NULL,
      link_url TEXT NOT NULL,
      link_url_hash CHAR(64) NOT NULL,
      anchor_text TEXT NULL,
      is_dofollow TINYINT(1) NOT NULL,
      rel_type VARCHAR(64) NOT NULL,
      first_found_at DATETIME(3) NOT NULL,
      last_found_at DATETIME(3) NOT NULL,
      seen_count INT UNSIGNED NOT NULL DEFAULT 1,
      PRIMARY KEY (id),
      UNIQUE KEY uq_commercial_links_dedupe (blog_id, commercial_site_id, source_page_url_hash, link_url_hash, rel_type),
      KEY idx_commercial_links_blog_id (blog_id),
      KEY idx_commercial_links_site_id (commercial_site_id),
      KEY idx_commercial_links_last_found_at (last_found_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
    CREATE TABLE IF NOT EXISTS crawl_run_blogs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      run_id BIGINT UNSIGNED NOT NULL,
      blog_id BIGINT UNSIGNED NULL,
      input_blog_url TEXT NOT NULL,
      root_domain VARCHAR(255) NULL,
      status ENUM('queued','running','skipped','completed','failed') NOT NULL DEFAULT 'queued',
      skip_reason VARCHAR(128) NULL,
      started_at DATETIME(3) NULL,
      finished_at DATETIME(3) NULL,
      pages_crawled INT UNSIGNED NOT NULL DEFAULT 0,
      links_found INT UNSIGNED NOT NULL DEFAULT 0,
      error_message TEXT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_run_blog (run_id, input_blog_url(255)),
      KEY idx_run_blog_run_id (run_id),
      KEY idx_run_blog_status (status),
      KEY idx_run_blog_root_domain (root_domain)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
    CREATE TABLE IF NOT EXISTS blog_page_crawls (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      run_id BIGINT UNSIGNED NOT NULL,
      blog_id BIGINT UNSIGNED NOT NULL,
      blog_page_id BIGINT UNSIGNED NOT NULL,
      crawled_at DATETIME(3) NOT NULL,
      http_status INT NULL,
      content_type VARCHAR(255) NULL,
      error_message TEXT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_run_page (run_id, blog_page_id),
      KEY idx_bpc_run_id (run_id),
      KEY idx_bpc_blog_id (blog_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
    CREATE TABLE IF NOT EXISTS commercial_link_occurrences (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      run_id BIGINT UNSIGNED NOT NULL,
      blog_id BIGINT UNSIGNED NOT NULL,
      commercial_link_id BIGINT UNSIGNED NOT NULL,
      found_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_run_link (run_id, commercial_link_id),
      KEY idx_clo_run_id (run_id),
      KEY idx_clo_blog_id (blog_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
    CREATE TABLE IF NOT EXISTS crawl_run_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      run_id BIGINT UNSIGNED NOT NULL,
      level ENUM('debug','info','warn','error') NOT NULL DEFAULT 'info',
      message VARCHAR(1024) NOT NULL,
      payload JSON NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_cre_run_id (run_id),
      KEY idx_cre_created_at (created_at),
      KEY idx_cre_level (level)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  ];

  for (const sql of statements) {
    // eslint-disable-next-line no-await-in-loop
    await db.execute(sql);
  }
}

