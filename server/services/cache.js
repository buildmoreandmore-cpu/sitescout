const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db', 'sitescout.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS search_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key TEXT UNIQUE NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      audit_data TEXT NOT NULL,
      site_score INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_search_key ON search_cache(cache_key);
    CREATE INDEX IF NOT EXISTS idx_audit_url ON audit_cache(url);
  `);
}

function getCacheExpiryDays() {
  return parseInt(process.env.CACHE_EXPIRY_DAYS || '7', 10);
}

function getSearchCache(category, location) {
  const d = getDb();
  const key = `${category.toLowerCase().trim()}|${location.toLowerCase().trim()}`;
  const expiryDays = getCacheExpiryDays();

  const row = d.prepare(`
    SELECT data, created_at FROM search_cache
    WHERE cache_key = ?
    AND created_at > datetime('now', ?)
  `).get(key, `-${expiryDays} days`);

  if (row) {
    return JSON.parse(row.data);
  }
  return null;
}

function setSearchCache(category, location, data) {
  const d = getDb();
  const key = `${category.toLowerCase().trim()}|${location.toLowerCase().trim()}`;

  d.prepare(`
    INSERT OR REPLACE INTO search_cache (cache_key, data, created_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).run(key, JSON.stringify(data));
}

function getAuditCache(url) {
  const d = getDb();
  const expiryDays = getCacheExpiryDays();

  const row = d.prepare(`
    SELECT audit_data, site_score, created_at FROM audit_cache
    WHERE url = ?
    AND created_at > datetime('now', ?)
  `).get(url, `-${expiryDays} days`);

  if (row) {
    return {
      auditData: JSON.parse(row.audit_data),
      siteScore: row.site_score,
    };
  }
  return null;
}

function setAuditCache(url, auditData, siteScore) {
  const d = getDb();

  d.prepare(`
    INSERT OR REPLACE INTO audit_cache (url, audit_data, site_score, created_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `).run(url, JSON.stringify(auditData), siteScore);
}

function clearExpiredCache() {
  const d = getDb();
  const expiryDays = getCacheExpiryDays();

  d.prepare(`DELETE FROM search_cache WHERE created_at < datetime('now', ?)`).run(`-${expiryDays} days`);
  d.prepare(`DELETE FROM audit_cache WHERE created_at < datetime('now', ?)`).run(`-${expiryDays} days`);
}

function getCacheStats() {
  const d = getDb();
  const searches = d.prepare('SELECT COUNT(*) as count FROM search_cache').get();
  const audits = d.prepare('SELECT COUNT(*) as count FROM audit_cache').get();
  return { searches: searches.count, audits: audits.count };
}

module.exports = {
  getSearchCache,
  setSearchCache,
  getAuditCache,
  setAuditCache,
  clearExpiredCache,
  getCacheStats,
};
