#!/usr/bin/env node
/**
 * SiteScout Lead Scout Agent
 * 
 * Automated sub-agent that:
 * 1. Searches for businesses across target categories + locations
 * 2. Audits each website (via the SiteScout API)
 * 3. Scores and ranks leads (lowest website scores = best leads)
 * 4. Saves results to a Supabase table (or JSON file)
 * 5. Sends a summary notification
 * 
 * Designed to run as a daily cron via OpenClaw.
 */

const SITESCOUT_API = process.env.SITESCOUT_API || 'https://sitescout-olive.vercel.app';
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || 'wchoi0745@gmail.com';

// Target categories and locations to scan
const SCAN_TARGETS = [
  // High-value service businesses
  { category: 'Restaurants', locations: ['Atlanta, GA', 'Decatur, GA', 'McDonough, GA'] },
  { category: 'Dentists', locations: ['Atlanta, GA', 'Sandy Springs, GA'] },
  { category: 'HVAC companies', locations: ['Atlanta, GA', 'Marietta, GA'] },
  { category: 'Plumbers', locations: ['Atlanta, GA', 'Lawrenceville, GA'] },
  { category: 'Auto repair shops', locations: ['Atlanta, GA', 'Decatur, GA'] },
  { category: 'Landscaping companies', locations: ['Atlanta, GA', 'Roswell, GA'] },
  { category: 'Hair salons', locations: ['Atlanta, GA', 'College Park, GA'] },
  { category: 'Law firms', locations: ['Atlanta, GA', 'Buckhead, GA'] },
  { category: 'Real estate agents', locations: ['Atlanta, GA', 'Alpharetta, GA'] },
  { category: 'Veterinarians', locations: ['Atlanta, GA', 'Marietta, GA'] },
];

// Only keep leads with site score below this threshold
const LEAD_SCORE_THRESHOLD = 50;
// Max businesses to audit per category/location combo (API rate limits)
const MAX_AUDIT_PER_SEARCH = 20;

async function searchBusinesses(category, location) {
  console.log(`  🔍 Searching: ${category} in ${location}`);
  
  const res = await fetch(`${SITESCOUT_API}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, location }),
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error(`    ❌ Search failed: ${err}`);
    return [];
  }
  
  const data = await res.json();
  console.log(`    Found ${data.businesses?.length || 0} businesses`);
  return data.businesses || [];
}

async function auditBusiness(business) {
  if (!business.website) {
    return { ...business, siteScore: 0, auditStatus: 'no_website', categories: {} };
  }
  
  try {
    const res = await fetch(`${SITESCOUT_API}/api/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: business.website, placeId: business.placeId }),
    });
    
    if (!res.ok) {
      return { ...business, siteScore: 0, auditStatus: 'error', categories: {} };
    }
    
    const audit = await res.json();
    return {
      ...business,
      siteScore: audit.siteScore,
      auditStatus: audit.status,
      categories: audit.categories || {},
      auditDetails: audit.details || {},
    };
  } catch (err) {
    return { ...business, siteScore: 0, auditStatus: 'error', error: err.message, categories: {} };
  }
}

async function run() {
  console.log('🕵️ SiteScout Lead Agent — Starting');
  console.log(`  API: ${SITESCOUT_API}`);
  console.log(`  Targets: ${SCAN_TARGETS.length} categories`);
  console.log(`  Lead threshold: score < ${LEAD_SCORE_THRESHOLD}`);
  console.log('='.repeat(50));
  
  const allLeads = [];
  let totalSearched = 0;
  let totalAudited = 0;
  
  for (const target of SCAN_TARGETS) {
    for (const location of target.locations) {
      try {
        const businesses = await searchBusinesses(target.category, location);
        totalSearched += businesses.length;
        
        // Filter to ones with websites, limit for API rate
        const toAudit = businesses
          .filter(b => b.website)
          .slice(0, MAX_AUDIT_PER_SEARCH);
        
        console.log(`    Auditing ${toAudit.length} websites...`);
        
        for (const biz of toAudit) {
          const result = await auditBusiness(biz);
          totalAudited++;
          
          if (result.siteScore < LEAD_SCORE_THRESHOLD) {
            allLeads.push({
              name: result.name,
              address: result.address,
              phone: result.phone,
              website: result.website,
              siteScore: result.siteScore,
              category: target.category,
              location: location,
              rating: result.rating,
              reviewCount: result.reviewCount,
              mapsUrl: result.mapsUrl,
              auditStatus: result.auditStatus,
              categories: result.categories,
              scannedAt: new Date().toISOString(),
            });
          }
          
          // Rate limit: 1.5s between audits
          await new Promise(r => setTimeout(r, 1500));
        }
        
        // Delay between searches
        await new Promise(r => setTimeout(r, 2000));
        
      } catch (err) {
        console.error(`    ❌ Error: ${err.message}`);
      }
    }
  }
  
  // Sort by worst score first (best leads)
  allLeads.sort((a, b) => a.siteScore - b.siteScore);
  
  // Deduplicate by placeId/website
  const seen = new Set();
  const uniqueLeads = allLeads.filter(l => {
    const key = l.website || l.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Save results
  const output = {
    scanDate: new Date().toISOString(),
    stats: {
      totalSearched,
      totalAudited,
      totalLeads: uniqueLeads.length,
      avgScore: uniqueLeads.length > 0 
        ? Math.round(uniqueLeads.reduce((s, l) => s + l.siteScore, 0) / uniqueLeads.length) 
        : 0,
    },
    leads: uniqueLeads,
  };
  
  const fs = require('fs');
  const outputPath = '/tmp/sitescout-leads.json';
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Scan Complete');
  console.log(`  Businesses found: ${totalSearched}`);
  console.log(`  Websites audited: ${totalAudited}`);
  console.log(`  Hot leads (score < ${LEAD_SCORE_THRESHOLD}): ${uniqueLeads.length}`);
  if (uniqueLeads.length > 0) {
    console.log(`  Average score: ${output.stats.avgScore}`);
    console.log('\n🔥 Top 10 Leads (worst websites):');
    uniqueLeads.slice(0, 10).forEach((l, i) => {
      console.log(`  ${i + 1}. ${l.name} — Score: ${l.siteScore} | ${l.phone || 'no phone'}`);
      console.log(`     ${l.website}`);
      console.log(`     ${l.category} in ${l.location}`);
    });
  }
  
  console.log(`\n💾 Full results: ${outputPath}`);
  console.log('🏁 Done');
  
  return output;
}

// Run
run().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
