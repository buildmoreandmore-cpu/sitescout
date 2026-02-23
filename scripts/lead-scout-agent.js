#!/usr/bin/env node
/**
 * SiteScout Lead Agent — Scans businesses, audits websites, saves leads to Supabase.
 * Runs as cron sub-agent. Uses the deployed Vercel API for search + audit,
 * then saves leads with score < threshold via /api/leads/bulk.
 */

const SITESCOUT_API = process.env.SITESCOUT_API || 'https://sitescout-olive.vercel.app';
const LEAD_THRESHOLD = 55;
const MAX_PER_SEARCH = 10;

// GA metro targets — service businesses most likely to have bad websites
const SCAN_TARGETS = [
  { category: 'Restaurants', location: 'McDonough, GA' },
  { category: 'Hair salons', location: 'McDonough, GA' },
  { category: 'Auto repair shops', location: 'McDonough, GA' },
  { category: 'Dentists', location: 'McDonough, GA' },
  { category: 'HVAC companies', location: 'Decatur, GA' },
  { category: 'Plumbers', location: 'Atlanta, GA' },
  { category: 'Landscaping companies', location: 'Roswell, GA' },
  { category: 'Veterinarians', location: 'Marietta, GA' },
  { category: 'Restaurants', location: 'Fayetteville, GA' },
  { category: 'Coffee shops', location: 'Palmetto, GA' },
  { category: 'Bakeries', location: 'Newnan, GA' },
  { category: 'Yoga studios', location: 'Peachtree City, GA' },
  { category: 'Chiropractors', location: 'Stockbridge, GA' },
  { category: 'Pet groomers', location: 'Conyers, GA' },
  { category: 'Florists', location: 'Covington, GA' },
  { category: 'Electricians', location: 'Jonesboro, GA' },
];

async function extractContactInfo(url) {
  const info = { email: null, ownerName: null, facebook: null, instagram: null };
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteScout/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    let html = await res.text();

    // Emails
    const emails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const clean = emails.filter(e =>
      !e.includes('example') && !e.includes('sentry') && !e.includes('webpack') &&
      !e.includes('.png') && !e.includes('.jpg') && !e.includes('wixpress') &&
      !e.includes('schema.org') && !e.includes('protection')
    );
    info.email = clean[0] || null;
    if (!info.email) {
      const mailto = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (mailto) info.email = mailto[1];
    }

    // Owner name
    const ownerPatterns = [
      /(?:owner|founder|proprietor|ceo|president|operated by|owned by)[:\s]*([A-Z][a-z]+ [A-Z][a-z]+)/i,
      /(?:Dr\.|Dr)\s+([A-Z][a-z]+ [A-Z][a-z]+)/,
      /(?:meet|about)\s+(?:the\s+)?(?:owner|founder)?[:\s]*([A-Z][a-z]+ [A-Z][a-z]+)/i,
    ];
    for (const pat of ownerPatterns) {
      const m = html.match(pat);
      if (m) { info.ownerName = m[1].trim(); break; }
    }

    // Socials
    const fb = html.match(/(?:href=["'])(https?:\/\/(?:www\.)?facebook\.com\/[^"'\s>]+)/i);
    if (fb) info.facebook = fb[1];
    const ig = html.match(/(?:href=["'])(https?:\/\/(?:www\.)?instagram\.com\/[^"'\s>]+)/i);
    if (ig) info.instagram = ig[1];

    // Try /about and /contact for more
    if (!info.email || !info.ownerName) {
      for (const path of ['/about', '/contact', '/about-us', '/contact-us']) {
        try {
          const base = new URL(url);
          const pr = await fetch(`${base.origin}${path}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteScout/1.0)' },
            redirect: 'follow',
            signal: AbortSignal.timeout(8000),
          });
          if (!pr.ok) continue;
          const ph = await pr.text();
          if (!info.email) {
            const pe = ph.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            const ce = pe.filter(e => !e.includes('example') && !e.includes('sentry') && !e.includes('wix'));
            if (ce[0]) info.email = ce[0];
          }
          if (!info.ownerName) {
            for (const pat of ownerPatterns) {
              const m = ph.match(pat);
              if (m) { info.ownerName = m[1].trim(); break; }
            }
          }
          if (info.email && info.ownerName) break;
        } catch {}
      }
    }
  } catch {}
  return info;
}

async function searchAndAudit(category, location) {
  console.log(`\n🔍 ${category} in ${location}`);

  const res = await fetch(`${SITESCOUT_API}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, location }),
  });

  if (!res.ok) { console.error('  Search failed'); return []; }
  const { businesses } = await res.json();
  console.log(`  Found ${businesses.length} businesses`);

  const withSites = businesses.filter(b => b.website).slice(0, MAX_PER_SEARCH);
  const noSites = businesses.filter(b => !b.website);
  const leads = [];

  // Businesses with no website = instant leads
  for (const biz of noSites) {
    console.log(`  ⚫ ${biz.name}: No website`);
    leads.push({
      placeId: biz.placeId,
      name: biz.name,
      address: biz.address,
      phone: biz.phone,
      website: null,
      siteScore: 0,
      category,
      location,
      rating: biz.rating,
      reviewCount: biz.reviewCount,
      mapsUrl: biz.mapsUrl,
    });
  }

  // Audit businesses with websites
  for (const biz of withSites) {
    try {
      const auditRes = await fetch(`${SITESCOUT_API}/api/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: biz.website, placeId: biz.placeId }),
      });
      if (!auditRes.ok) continue;
      const audit = await auditRes.json();
      const score = audit.siteScore;
      const icon = score < 30 ? '🔥' : score < LEAD_THRESHOLD ? '⚠️' : '·';
      console.log(`  ${icon} ${biz.name}: ${score}`);

      if (score < LEAD_THRESHOLD) {
        const contact = await extractContactInfo(biz.website);
        leads.push({
          placeId: biz.placeId,
          name: biz.name,
          address: biz.address,
          phone: biz.phone,
          email: contact.email,
          ownerName: contact.ownerName,
          facebook: contact.facebook,
          instagram: contact.instagram,
          website: biz.website,
          siteScore: score,
          category,
          location,
          rating: biz.rating,
          reviewCount: biz.reviewCount,
          mapsUrl: biz.mapsUrl,
        });
      }
    } catch (e) {
      console.error(`  ✗ ${biz.name}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  return leads;
}

async function run() {
  console.log('🕵️ SiteScout Lead Agent');
  console.log(`  Threshold: score < ${LEAD_THRESHOLD}`);
  console.log(`  Targets: ${SCAN_TARGETS.length}`);

  const allLeads = [];

  for (const t of SCAN_TARGETS) {
    const leads = await searchAndAudit(t.category, t.location);
    allLeads.push(...leads);
    await new Promise(r => setTimeout(r, 3000));
  }

  // Deduplicate
  const seen = new Set();
  const unique = allLeads.filter(l => {
    const key = l.placeId || l.website || l.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => (a.siteScore || 0) - (b.siteScore || 0));

  console.log(`\n📊 ${unique.length} total leads found`);

  // Save to Supabase via API
  if (unique.length > 0) {
    try {
      const res = await fetch(`${SITESCOUT_API}/api/leads/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: unique }),
      });
      const data = await res.json();
      console.log(`💾 Saved ${data.inserted || 0} leads to database`);
    } catch (e) {
      console.error(`Failed to save: ${e.message}`);
    }

    console.log(`\n🔥 Top 10 (worst websites = best leads):`);
    unique.slice(0, 10).forEach((l, i) => {
      console.log(`  ${i + 1}. ${l.name} — Score: ${l.siteScore}/100`);
      console.log(`     📞 ${l.phone || '-'} | ✉️ ${l.email || '-'} | 👤 ${l.ownerName || '-'}`);
      console.log(`     🌐 ${l.website || 'No website'}`);
    });
  }

  // Summary for cron
  console.log('\n---JSON_SUMMARY---');
  console.log(JSON.stringify({
    totalLeads: unique.length,
    newNoWebsite: unique.filter(l => !l.website).length,
    avgScore: unique.length ? Math.round(unique.reduce((s, l) => s + (l.siteScore || 0), 0) / unique.length) : 0,
    top5: unique.slice(0, 5).map(l => ({ name: l.name, score: l.siteScore, phone: l.phone, email: l.email, ownerName: l.ownerName })),
  }));
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
