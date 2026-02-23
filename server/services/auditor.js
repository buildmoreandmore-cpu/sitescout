const fetch = require('node-fetch');
const cheerio = require('cheerio');

const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/**
 * Run a full website audit on a given URL.
 * Returns individual category scores and a weighted SiteScore (0-100).
 */
async function auditWebsite(url) {
  if (!url) {
    return {
      siteScore: 0,
      status: 'no_website',
      categories: {},
      details: { message: 'No website found' },
    };
  }

  // Normalize URL
  let normalizedUrl = url;
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  try {
    const [pageSpeedResult, directAuditResult] = await Promise.all([
      runPageSpeedAudit(normalizedUrl),
      runDirectAudit(normalizedUrl),
    ]);

    const categories = {
      performance: {
        score: pageSpeedResult.performanceScore,
        weight: 0.25,
        label: 'Performance',
      },
      mobile: {
        score: pageSpeedResult.mobileScore,
        weight: 0.20,
        label: 'Mobile Responsiveness',
      },
      ssl: {
        score: directAuditResult.sslScore,
        weight: 0.10,
        label: 'SSL Certificate',
      },
      brokenResources: {
        score: directAuditResult.brokenResourcesScore,
        weight: 0.10,
        label: 'Broken Resources',
      },
      keyPages: {
        score: directAuditResult.keyPagesScore,
        weight: 0.15,
        label: 'Key Pages Present',
      },
      modernDesign: {
        score: directAuditResult.modernDesignScore,
        weight: 0.10,
        label: 'Modern Design',
      },
      seo: {
        score: directAuditResult.seoScore,
        weight: 0.10,
        label: 'SEO Basics',
      },
    };

    const siteScore = Math.round(
      Object.values(categories).reduce((sum, cat) => sum + cat.score * cat.weight, 0)
    );

    return {
      siteScore,
      status: 'audited',
      categories,
      details: {
        ...pageSpeedResult.details,
        ...directAuditResult.details,
      },
      url: normalizedUrl,
    };
  } catch (err) {
    return {
      siteScore: 0,
      status: 'error',
      categories: {},
      details: { error: err.message },
      url: normalizedUrl,
    };
  }
}

/**
 * Run Google PageSpeed Insights audit for performance and mobile scores.
 */
async function runPageSpeedAudit(url) {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;

  const defaultResult = {
    performanceScore: 50,
    mobileScore: 50,
    details: { pageSpeedError: 'API key not configured, using defaults' },
  };

  if (!apiKey) return defaultResult;

  try {
    // Run mobile strategy audit
    const params = new URLSearchParams({
      url,
      key: apiKey,
      strategy: 'mobile',
      category: 'performance',
      category: 'accessibility',
    });

    const response = await fetch(`${PAGESPEED_API_URL}?${params}`, {
      timeout: 60000,
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        performanceScore: 30,
        mobileScore: 30,
        details: { pageSpeedError: `API returned ${response.status}` },
      };
    }

    const data = await response.json();
    const categories = data.lighthouseResult?.categories || {};

    const performanceScore = Math.round((categories.performance?.score || 0) * 100);

    // Derive mobile score from viewport, font-size, and tap-targets audits
    const audits = data.lighthouseResult?.audits || {};
    const viewportScore = audits.viewport?.score ?? 0;
    const fontSizeScore = audits['font-size']?.score ?? 0.5;
    const tapTargetsScore = audits['tap-targets']?.score ?? 0.5;
    const mobileScore = Math.round(((viewportScore + fontSizeScore + tapTargetsScore) / 3) * 100);

    return {
      performanceScore,
      mobileScore: Math.max(mobileScore, 10),
      details: {
        lighthousePerformance: performanceScore,
        lighthouseMobile: mobileScore,
        firstContentfulPaint: audits['first-contentful-paint']?.displayValue || 'N/A',
        largestContentfulPaint: audits['largest-contentful-paint']?.displayValue || 'N/A',
        speedIndex: audits['speed-index']?.displayValue || 'N/A',
        totalBlockingTime: audits['total-blocking-time']?.displayValue || 'N/A',
        cumulativeLayoutShift: audits['cumulative-layout-shift']?.displayValue || 'N/A',
      },
    };
  } catch (err) {
    return {
      performanceScore: 20,
      mobileScore: 20,
      details: { pageSpeedError: err.message },
    };
  }
}

/**
 * Run direct HTTP audit: SSL, broken resources, key pages, design signals, SEO.
 */
async function runDirectAudit(url) {
  const details = {};
  let html = '';
  let $;
  let fetchSuccess = false;

  // Fetch the page
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SiteScout/1.0; +https://sitescout.dev)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    html = await response.text();
    $ = cheerio.load(html);
    fetchSuccess = true;
    details.httpStatus = response.status;
    details.finalUrl = response.url;
  } catch (err) {
    details.fetchError = err.message;
    return {
      sslScore: url.startsWith('https') ? 50 : 0,
      brokenResourcesScore: 50,
      keyPagesScore: 30,
      modernDesignScore: 30,
      seoScore: 30,
      details,
    };
  }

  // SSL Check
  const sslScore = url.startsWith('https://') || details.finalUrl?.startsWith('https://') ? 100 : 0;
  details.hasSSL = sslScore === 100;

  // Broken Resources Check
  let brokenResourcesScore = 100;
  if (fetchSuccess) {
    const imgSrcs = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src) imgSrcs.push(src);
    });

    const brokenCount = imgSrcs.filter(src =>
      src === '' || src === '#' || src === 'undefined'
    ).length;

    details.totalImages = imgSrcs.length;
    details.brokenImages = brokenCount;

    if (imgSrcs.length > 0) {
      const brokenRatio = brokenCount / imgSrcs.length;
      brokenResourcesScore = Math.round((1 - brokenRatio) * 100);
    }
  }

  // Key Pages Check
  let keyPagesScore = 0;
  if (fetchSuccess) {
    const htmlLower = html.toLowerCase();
    const links = [];
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().toLowerCase();
      links.push({ href: href.toLowerCase(), text });
    });

    const keyPages = {
      about: false,
      contact: false,
      services: false,
      hours: false,
      booking: false,
    };

    const aboutPatterns = ['about', 'about-us', 'our-story', 'who-we-are'];
    const contactPatterns = ['contact', 'contact-us', 'get-in-touch', 'reach-us'];
    const servicesPatterns = ['services', 'menu', 'products', 'offerings', 'what-we-do', 'our-services'];
    const hoursPatterns = ['hours', 'schedule', 'business-hours', 'open'];
    const bookingPatterns = ['book', 'booking', 'appointment', 'reserve', 'order', 'schedule'];

    for (const link of links) {
      const combined = link.href + ' ' + link.text;
      if (aboutPatterns.some(p => combined.includes(p))) keyPages.about = true;
      if (contactPatterns.some(p => combined.includes(p))) keyPages.contact = true;
      if (servicesPatterns.some(p => combined.includes(p))) keyPages.services = true;
      if (hoursPatterns.some(p => combined.includes(p))) keyPages.hours = true;
      if (bookingPatterns.some(p => combined.includes(p))) keyPages.booking = true;
    }

    // Also check page content for embedded info
    if (htmlLower.includes('phone') || htmlLower.includes('tel:') || htmlLower.includes('email')) {
      keyPages.contact = true;
    }

    const foundCount = Object.values(keyPages).filter(Boolean).length;
    keyPagesScore = Math.round((foundCount / 5) * 100);
    details.keyPages = keyPages;
  }

  // Modern Design Signals
  let modernDesignScore = 0;
  if (fetchSuccess) {
    const signals = {
      hasViewport: false,
      hasResponsiveImages: false,
      noFlash: true,
      modernCSS: false,
    };

    signals.hasViewport = !!$('meta[name="viewport"]').length;
    signals.hasResponsiveImages = !!$('img[srcset]').length || !!$('picture').length ||
      html.includes('max-width') || html.includes('object-fit');
    signals.noFlash = !html.includes('<embed') && !html.includes('shockwave-flash') &&
      !html.includes('.swf');
    signals.modernCSS = html.includes('flexbox') || html.includes('display:flex') ||
      html.includes('display: flex') || html.includes('grid') ||
      html.includes('@media') || html.includes('tailwind') ||
      html.includes('bootstrap') || $('link[rel="stylesheet"]').length > 0;

    const signalCount = Object.values(signals).filter(Boolean).length;
    modernDesignScore = Math.round((signalCount / 4) * 100);
    details.modernDesign = signals;
  }

  // SEO Basics
  let seoScore = 0;
  if (fetchSuccess) {
    const seoChecks = {
      hasTitle: false,
      hasMetaDescription: false,
      hasH1: false,
      hasAltText: false,
    };

    const title = $('title').text().trim();
    seoChecks.hasTitle = title.length > 0;

    seoChecks.hasMetaDescription = !!$('meta[name="description"]').attr('content');
    seoChecks.hasH1 = !!$('h1').length;

    const totalImages = $('img').length;
    const imagesWithAlt = $('img[alt]').filter((_, el) => $(el).attr('alt').trim().length > 0).length;
    seoChecks.hasAltText = totalImages === 0 || (imagesWithAlt / totalImages) > 0.5;

    const seoCount = Object.values(seoChecks).filter(Boolean).length;
    seoScore = Math.round((seoCount / 4) * 100);
    details.seo = seoChecks;
    details.pageTitle = title || 'None';
  }

  return {
    sslScore,
    brokenResourcesScore,
    keyPagesScore,
    modernDesignScore,
    seoScore,
    details,
  };
}

module.exports = {
  auditWebsite,
};
