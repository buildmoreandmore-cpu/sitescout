const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// --- Inline route handlers for serverless (avoids SQLite in serverless) ---

const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Places search
app.post('/api/search', async (req, res) => {
  try {
    const { category, location } = req.body;
    if (!category || !location) {
      return res.status(400).json({ error: 'Category and location are required' });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY is not configured' });
    }

    const textQuery = `${category} in ${location}`;
    const fieldMask = [
      'places.id', 'places.displayName', 'places.formattedAddress',
      'places.nationalPhoneNumber', 'places.internationalPhoneNumber',
      'places.websiteUri', 'places.rating', 'places.userRatingCount',
      'places.googleMapsUri', 'places.photos', 'places.businessStatus', 'places.types',
    ].join(',');

    let allBusinesses = [];
    let pageToken = null;

    for (let page = 0; page < 3; page++) {
      const body = { textQuery, languageCode: 'en', ...(pageToken && { pageToken }) };
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        return res.status(500).json({ error: `Places API error: ${error}` });
      }

      const data = await response.json();
      const businesses = (data.places || []).map(place => ({
        placeId: place.id,
        name: place.displayName?.text || 'Unknown',
        address: place.formattedAddress || '',
        phone: place.nationalPhoneNumber || place.internationalPhoneNumber || '',
        website: place.websiteUri || null,
        rating: place.rating || 0,
        reviewCount: place.userRatingCount || 0,
        mapsUrl: place.googleMapsUri || '',
        businessStatus: place.businessStatus || 'UNKNOWN',
        types: place.types || [],
        photoRef: place.photos?.[0]?.name || null,
      }));

      allBusinesses = allBusinesses.concat(businesses);
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
      await new Promise(r => setTimeout(r, 2000));
    }

    // Deduplicate
    const seen = new Set();
    allBusinesses = allBusinesses.filter(b => {
      if (seen.has(b.placeId)) return false;
      seen.add(b.placeId);
      return true;
    });

    res.json({ businesses: allBusinesses, source: 'api' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single audit
app.post('/api/audit', async (req, res) => {
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

    let normalizedUrl = url;
    if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`;

    // PageSpeed audit
    let performanceScore = 50, mobileScore = 50;
    const pageSpeedDetails = {};
    const psApiKey = process.env.GOOGLE_PAGESPEED_API_KEY;

    if (psApiKey) {
      try {
        const params = new URLSearchParams({ url: normalizedUrl, key: psApiKey, strategy: 'mobile' });
        params.append('category', 'performance');
        const psRes = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, { timeout: 60000 });
        if (psRes.ok) {
          const psData = await psRes.json();
          const cats = psData.lighthouseResult?.categories || {};
          const audits = psData.lighthouseResult?.audits || {};
          performanceScore = Math.round((cats.performance?.score || 0) * 100);
          const vp = audits.viewport?.score ?? 0;
          const fs = audits['font-size']?.score ?? 0.5;
          const tt = audits['tap-targets']?.score ?? 0.5;
          mobileScore = Math.max(Math.round(((vp + fs + tt) / 3) * 100), 10);
          pageSpeedDetails.firstContentfulPaint = audits['first-contentful-paint']?.displayValue || 'N/A';
          pageSpeedDetails.largestContentfulPaint = audits['largest-contentful-paint']?.displayValue || 'N/A';
          pageSpeedDetails.speedIndex = audits['speed-index']?.displayValue || 'N/A';
        }
      } catch (e) {
        performanceScore = 20;
        mobileScore = 20;
      }
    }

    // Direct audit
    let html = '', $, fetchSuccess = false;
    const directDetails = {};

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(normalizedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteScout/1.0)', Accept: 'text/html' },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      html = await response.text();
      $ = cheerio.load(html);
      fetchSuccess = true;
      directDetails.finalUrl = response.url;
    } catch (e) {
      directDetails.fetchError = e.message;
    }

    const sslScore = (normalizedUrl.startsWith('https://') || directDetails.finalUrl?.startsWith('https://')) ? 100 : 0;
    directDetails.hasSSL = sslScore === 100;

    let brokenResourcesScore = 100;
    if (fetchSuccess) {
      const imgs = [];
      $('img').each((_, el) => { const s = $(el).attr('src'); if (s) imgs.push(s); });
      const broken = imgs.filter(s => s === '' || s === '#' || s === 'undefined').length;
      if (imgs.length > 0) brokenResourcesScore = Math.round((1 - broken / imgs.length) * 100);
    }

    let keyPagesScore = 0;
    const keyPages = { about: false, contact: false, services: false, hours: false, booking: false };
    if (fetchSuccess) {
      const links = [];
      $('a').each((_, el) => { links.push({ href: ($(el).attr('href') || '').toLowerCase(), text: $(el).text().toLowerCase() }); });
      const htmlLower = html.toLowerCase();
      for (const link of links) {
        const c = link.href + ' ' + link.text;
        if (['about', 'about-us', 'our-story'].some(p => c.includes(p))) keyPages.about = true;
        if (['contact', 'contact-us'].some(p => c.includes(p))) keyPages.contact = true;
        if (['services', 'menu', 'products'].some(p => c.includes(p))) keyPages.services = true;
        if (['hours', 'schedule'].some(p => c.includes(p))) keyPages.hours = true;
        if (['book', 'appointment', 'reserve', 'order'].some(p => c.includes(p))) keyPages.booking = true;
      }
      if (htmlLower.includes('tel:') || htmlLower.includes('email')) keyPages.contact = true;
      keyPagesScore = Math.round((Object.values(keyPages).filter(Boolean).length / 5) * 100);
      directDetails.keyPages = keyPages;
    }

    let modernDesignScore = 0;
    const modernDesign = { hasViewport: false, hasResponsiveImages: false, noFlash: true, modernCSS: false };
    if (fetchSuccess) {
      modernDesign.hasViewport = !!$('meta[name="viewport"]').length;
      modernDesign.hasResponsiveImages = !!$('img[srcset]').length || !!$('picture').length || html.includes('max-width');
      modernDesign.noFlash = !html.includes('shockwave-flash') && !html.includes('.swf');
      modernDesign.modernCSS = html.includes('display:flex') || html.includes('display: flex') || html.includes('@media') || html.includes('bootstrap') || $('link[rel="stylesheet"]').length > 0;
      modernDesignScore = Math.round((Object.values(modernDesign).filter(Boolean).length / 4) * 100);
      directDetails.modernDesign = modernDesign;
    }

    let seoScore = 0;
    const seo = { hasTitle: false, hasMetaDescription: false, hasH1: false, hasAltText: false };
    if (fetchSuccess) {
      const title = $('title').text().trim();
      seo.hasTitle = title.length > 0;
      seo.hasMetaDescription = !!$('meta[name="description"]').attr('content');
      seo.hasH1 = !!$('h1').length;
      const totalImgs = $('img').length;
      const withAlt = $('img[alt]').filter((_, el) => $(el).attr('alt').trim().length > 0).length;
      seo.hasAltText = totalImgs === 0 || (withAlt / totalImgs) > 0.5;
      seoScore = Math.round((Object.values(seo).filter(Boolean).length / 4) * 100);
      directDetails.seo = seo;
      directDetails.pageTitle = title || 'None';
    }

    const categories = {
      performance: { score: performanceScore, weight: 0.25, label: 'Performance' },
      mobile: { score: mobileScore, weight: 0.20, label: 'Mobile Responsiveness' },
      ssl: { score: sslScore, weight: 0.10, label: 'SSL Certificate' },
      brokenResources: { score: brokenResourcesScore, weight: 0.10, label: 'Broken Resources' },
      keyPages: { score: keyPagesScore, weight: 0.15, label: 'Key Pages Present' },
      modernDesign: { score: modernDesignScore, weight: 0.10, label: 'Modern Design' },
      seo: { score: seoScore, weight: 0.10, label: 'SEO Basics' },
    };

    const siteScore = Math.round(Object.values(categories).reduce((sum, c) => sum + c.score * c.weight, 0));

    res.json({
      placeId,
      siteScore,
      status: 'audited',
      categories,
      details: { ...pageSpeedDetails, ...directDetails },
      url: normalizedUrl,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Export for Vercel
module.exports = app;
