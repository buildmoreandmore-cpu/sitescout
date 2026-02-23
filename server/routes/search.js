const express = require('express');
const router = express.Router();
const places = require('../services/places');
const cache = require('../services/cache');

/**
 * POST /api/search
 * Search for businesses by category and location.
 */
router.post('/', async (req, res) => {
  try {
    const { category, location } = req.body;

    if (!category || !location) {
      return res.status(400).json({ error: 'Category and location are required' });
    }

    // Check cache first
    const cached = cache.getSearchCache(category, location);
    if (cached) {
      return res.json({ businesses: cached, source: 'cache' });
    }

    // Fetch from Google Places API
    const businesses = await places.searchAllBusinesses(category, location);

    // Cache the results
    cache.setSearchCache(category, location, businesses);

    res.json({ businesses, source: 'api' });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
