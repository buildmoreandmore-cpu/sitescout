#!/usr/bin/env node
/**
 * Scan ONE category+location, save leads to Supabase via API.
 * Usage: node scan-one.js "Restaurants" "McDonough, GA"
 */
const API = 'https://sitescout-olive.vercel.app';
const THRESHOLD = 55;
const MAX = 5;

const [,, category, location] = process.argv;
if (!category || !location) { console.error('Usage: node scan-one.js <category> <location>'); process.exit(1); }

async function run() {
  console.log(`🔍 ${category} in ${location}`);

  const res = await fetch(`${API}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, location }),
  });
  if (!res.ok) { console.error('Search failed'); process.exit(1); }
  const { businesses } = await res.json();

  console.log(`  ${businesses.length} found, auditing up to ${MAX}...`);
  const leads = [];

  // No website = instant lead
  for (const biz of businesses.filter(b => !b.website).slice(0, 5)) {
    console.log(`  ⚫ ${biz.name}: No website | 📞 ${biz.phone || '-'}`);
    leads.push({
      placeId: biz.placeId, name: biz.name, address: biz.address,
      phone: biz.phone, website: null, siteScore: 0,
      category, location, rating: biz.rating,
      reviewCount: biz.reviewCount, mapsUrl: biz.mapsUrl,
    });
  }

  // Audit sites
  for (const biz of businesses.filter(b => b.website).slice(0, MAX)) {
    try {
      const r = await fetch(`${API}/api/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: biz.website, placeId: biz.placeId }),
      });
      if (!r.ok) continue;
      const audit = await r.json();
      const score = audit.siteScore;

      if (score < THRESHOLD) {
        console.log(`  🔥 ${biz.name}: ${score} | 📞 ${biz.phone || '-'}`);
        leads.push({
          placeId: biz.placeId, name: biz.name, address: biz.address,
          phone: biz.phone, website: biz.website, siteScore: score,
          category, location, rating: biz.rating,
          reviewCount: biz.reviewCount, mapsUrl: biz.mapsUrl,
        });
      } else {
        console.log(`  · ${biz.name}: ${score}`);
      }
    } catch (e) {
      console.error(`  ✗ ${biz.name}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  // Save to Supabase
  if (leads.length > 0) {
    try {
      const saveRes = await fetch(`${API}/api/leads/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      });
      const data = await saveRes.json();
      console.log(`\n💾 Saved ${data.inserted || 0} leads to pipeline`);
    } catch (e) {
      console.error(`Save failed: ${e.message}`);
    }
  } else {
    console.log('\n  No leads below threshold');
  }

  console.log(`✅ Done — ${leads.length} leads from ${category} in ${location}`);
}

run().catch(e => { console.error(e); process.exit(1); });
