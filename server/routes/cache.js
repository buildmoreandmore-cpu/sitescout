const express = require('express');
const router = express.Router();
const cache = require('../services/cache');

/**
 * GET /api/cache/stats
 */
router.get('/stats', (req, res) => {
  try {
    const stats = cache.getCacheStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/cache/clear
 */
router.post('/clear', (req, res) => {
  try {
    cache.clearExpiredCache();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
