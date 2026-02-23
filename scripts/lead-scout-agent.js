#!/usr/bin/env node
/**
 * SiteScout Lead Agent — Lightweight version
 * Scans one category/location at a time to avoid OOM on 1.9GB server.
 */

const SITESCOUT_API = process.env.SITESCOUT_API || 'https://sitescout-olive.vercel.app';

// Focused targets — ATL metro service businesses most likely to have bad websites
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
];

const LEAD_THRESHOLD = 55;
const MAX_PER_SEARCH = 10; // Keep it light

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
  const leads = [];
  
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
      const icon = score < 30 ? '🔥' : score < 50 ? '⚠️' : '·';
      console.log(`  ${icon} ${biz.name}: ${score}/100`);
      
      if (score < LEAD_THRESHOLD) {
        leads.push({
          name: biz.name,
          address: biz.address,
          phone: biz.phone,
          website: biz.website,
          siteScore: score,
          category,
          location,
          rating: biz.rating,
          reviewCount: biz.reviewCount,
          mapsUrl: biz.mapsUrl,
          categories: audit.categories || {},
          scannedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error(`  ✗ ${biz.name}: ${e.message}`);
    }
    
    // Rate limit
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
    
    // GC-friendly pause between searches
    await new Promise(r => setTimeout(r, 3000));
  }
  
  // Deduplicate
  const seen = new Set();
  const unique = allLeads.filter(l => {
    const key = l.website || l.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.siteScore - b.siteScore);
  
  // Save
  const fs = require('fs');
  const output = {
    scanDate: new Date().toISOString(),
    totalLeads: unique.length,
    avgScore: unique.length ? Math.round(unique.reduce((s, l) => s + l.siteScore, 0) / unique.length) : 0,
    leads: unique,
  };
  
  fs.writeFileSync('/tmp/sitescout-leads.json', JSON.stringify(output, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Done — ${unique.length} leads found`);
  
  if (unique.length > 0) {
    console.log(`\n🔥 Top 15 (worst websites = best leads):`);
    unique.slice(0, 15).forEach((l, i) => {
      console.log(`\n  ${i + 1}. ${l.name} — Score: ${l.siteScore}/100`);
      console.log(`     📞 ${l.phone || 'no phone'}`);
      console.log(`     🌐 ${l.website}`);
      console.log(`     📍 ${l.address}`);
      console.log(`     ⭐ ${l.rating} (${l.reviewCount} reviews)`);
    });
  }
  
  // Output JSON summary for cron consumption
  console.log('\n---JSON_SUMMARY---');
  console.log(JSON.stringify({ totalLeads: unique.length, avgScore: output.avgScore, top5: unique.slice(0, 5).map(l => ({ name: l.name, score: l.siteScore, phone: l.phone, website: l.website })) }));
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
