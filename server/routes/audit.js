const express = require('express');
const router = express.Router();
const auditor = require('../services/auditor');
const cache = require('../services/cache');

/**
 * POST /api/audit
 * Audit a single business website.
 */
router.post('/', async (req, res) => {
  try {
    const { url, placeId } = req.body;

    if (!url) {
      return res.json({
        placeId,
        siteScore: 0,
        status: 'no_website',
        categories: {},
        details: { message: 'No website found' },
      });
    }

    // Check audit cache
    const cached = cache.getAuditCache(url);
    if (cached) {
      return res.json({
        placeId,
        ...cached.auditData,
        siteScore: cached.siteScore,
        source: 'cache',
      });
    }

    // Run audit
    const result = await auditor.auditWebsite(url);

    // Cache the result
    if (result.status === 'audited') {
      cache.setAuditCache(url, result, result.siteScore);
    }

    res.json({ placeId, ...result });
  } catch (err) {
    console.error('Audit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/audit/batch
 * Start auditing multiple URLs. Returns results as they complete via SSE.
 */
router.get('/stream', async (req, res) => {
  const { urls, placeIds } = req.query;

  if (!urls) {
    return res.status(400).json({ error: 'URLs parameter required' });
  }

  const urlList = urls.split(',');
  const idList = placeIds ? placeIds.split(',') : [];

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let completed = 0;

  for (let i = 0; i < urlList.length; i++) {
    const url = urlList[i];
    const placeId = idList[i] || null;

    try {
      // Check cache first
      const cached = cache.getAuditCache(url);
      if (cached) {
        completed++;
        res.write(`data: ${JSON.stringify({
          placeId,
          ...cached.auditData,
          siteScore: cached.siteScore,
          source: 'cache',
          progress: { completed, total: urlList.length },
        })}\n\n`);
        continue;
      }

      const result = await auditor.auditWebsite(url);
      completed++;

      if (result.status === 'audited') {
        cache.setAuditCache(url, result, result.siteScore);
      }

      res.write(`data: ${JSON.stringify({
        placeId,
        ...result,
        progress: { completed, total: urlList.length },
      })}\n\n`);
    } catch (err) {
      completed++;
      res.write(`data: ${JSON.stringify({
        placeId,
        siteScore: 0,
        status: 'error',
        error: err.message,
        progress: { completed, total: urlList.length },
      })}\n\n`);
    }

    // Rate limit: 1 audit per second (non-cached)
    if (i < urlList.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

module.exports = router;
