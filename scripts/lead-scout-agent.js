#!/usr/bin/env node
/**
 * SiteScout Lead Agent — Lightweight sequential scanner.
 * Scans ONE category at a time via Vercel API, saves leads, emails report.
 * Designed for 1.9GB RAM server — minimal memory usage.
 */

const SITESCOUT_API = process.env.SITESCOUT_API || 'https://sitescout-olive.vercel.app';
const LEAD_THRESHOLD = 55;
const MAX_PER_SEARCH = 8;

// Rotate through 4 targets per run to keep it light
const ALL_TARGETS = [
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

// Pick 4 targets based on day of year (rotates daily)
function getTodaysTargets() {
  const day = Math.floor(Date.now() / 86400000);
  const start = (day * 4) % ALL_TARGETS.length;
  const targets = [];
  for (let i = 0; i < 4; i++) {
    targets.push(ALL_TARGETS[(start + i) % ALL_TARGETS.length]);
  }
  return targets;
}

async function scanOne(category, location) {
  console.log(`🔍 ${category} in ${location}`);

  let businesses;
  try {
    const res = await fetch(`${SITESCOUT_API}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, location }),
    });
    if (!res.ok) { console.error('  Search failed'); return []; }
    const data = await res.json();
    businesses = data.businesses || [];
  } catch (e) { console.error(`  Search error: ${e.message}`); return []; }

  console.log(`  Found ${businesses.length} businesses`);
  const leads = [];

  // No-website businesses = instant leads
  for (const biz of businesses.filter(b => !b.website).slice(0, 5)) {
    leads.push({
      placeId: biz.placeId, name: biz.name, address: biz.address,
      phone: biz.phone, website: null, siteScore: 0,
      category, location, rating: biz.rating,
      reviewCount: biz.reviewCount, mapsUrl: biz.mapsUrl,
    });
  }

  // Audit websites sequentially
  for (const biz of businesses.filter(b => b.website).slice(0, MAX_PER_SEARCH)) {
    try {
      const r = await fetch(`${SITESCOUT_API}/api/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: biz.website, placeId: biz.placeId }),
      });
      if (!r.ok) continue;
      const audit = await r.json();
      const score = audit.siteScore;

      if (score < LEAD_THRESHOLD) {
        console.log(`  🔥 ${biz.name}: ${score}`);
        leads.push({
          placeId: biz.placeId, name: biz.name, address: biz.address,
          phone: biz.phone, website: biz.website, siteScore: score,
          category, location, rating: biz.rating,
          reviewCount: biz.reviewCount, mapsUrl: biz.mapsUrl,
        });
      } else {
        console.log(`  · ${biz.name}: ${score}`);
      }
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }

  return leads;
}

async function saveLeads(leads) {
  if (leads.length === 0) return 0;
  try {
    const res = await fetch(`${SITESCOUT_API}/api/leads/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads }),
    });
    const data = await res.json();
    return data.inserted || 0;
  } catch (e) {
    console.error(`Save failed: ${e.message}`);
    return 0;
  }
}

async function run() {
  const targets = getTodaysTargets();
  console.log('🕵️ SiteScout Lead Agent (lightweight)');
  console.log(`  Scanning ${targets.length} categories today\n`);

  const allLeads = [];

  for (const t of targets) {
    const leads = await scanOne(t.category, t.location);
    allLeads.push(...leads);
    // GC pause between scans
    await new Promise(r => setTimeout(r, 3000));
  }

  // Deduplicate
  const seen = new Set();
  const unique = allLeads.filter(l => {
    const key = l.placeId || l.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => (a.siteScore || 0) - (b.siteScore || 0));

  const saved = await saveLeads(unique);
  console.log(`\n💾 Saved ${saved} leads to database`);

  // Build report
  const noWebsite = unique.filter(l => !l.website);
  const worstSites = unique.filter(l => l.website).slice(0, 5);
  const biggestOpportunity = unique[0];

  let report = `SiteScout Daily Scan Report\n`;
  report += `Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
  report += `Categories scanned: ${targets.map(t => `${t.category} in ${t.location}`).join(', ')}\n\n`;
  report += `Total leads found: ${unique.length}\n`;
  report += `New leads saved: ${saved}\n\n`;

  if (biggestOpportunity) {
    report += `🏆 BIGGEST OPPORTUNITY\n`;
    report += `${biggestOpportunity.name}\n`;
    report += `Score: ${biggestOpportunity.siteScore}/100${!biggestOpportunity.website ? ' (NO WEBSITE)' : ''}\n`;
    report += `Phone: ${biggestOpportunity.phone || 'N/A'}\n`;
    report += `Address: ${biggestOpportunity.address || 'N/A'}\n`;
    report += `Website: ${biggestOpportunity.website || 'None'}\n`;
    report += `Rating: ${biggestOpportunity.rating || 'N/A'} (${biggestOpportunity.reviewCount || 0} reviews)\n\n`;
  }

  if (noWebsite.length > 0) {
    report += `⚫ NO WEBSITE (${noWebsite.length}):\n`;
    noWebsite.slice(0, 5).forEach(l => {
      report += `  • ${l.name} — ${l.phone || 'no phone'} — ${l.address}\n`;
    });
    report += `\n`;
  }

  if (worstSites.length > 0) {
    report += `🔥 WORST WEBSITES:\n`;
    worstSites.forEach(l => {
      report += `  • ${l.name} — Score: ${l.siteScore} — ${l.phone || 'no phone'} — ${l.website}\n`;
    });
    report += `\n`;
  }

  report += `View full pipeline: https://sitescout-olive.vercel.app (Pipeline tab)\n`;

  console.log('\n📧 Report:\n' + report);

  // Output for cron to pick up
  console.log('\n---REPORT---');
  console.log(report);
  console.log('---END_REPORT---');

  console.log('\n---JSON_SUMMARY---');
  console.log(JSON.stringify({
    totalLeads: unique.length,
    saved,
    biggestOpportunity: biggestOpportunity ? { name: biggestOpportunity.name, score: biggestOpportunity.siteScore, phone: biggestOpportunity.phone } : null,
    report,
  }));
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
