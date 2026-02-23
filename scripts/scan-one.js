#!/usr/bin/env node
/**
 * Scan ONE category+location, extract contact info, append to JSONL
 * Usage: node scan-one.js "Restaurants" "McDonough, GA"
 */
const API = 'https://sitescout-olive.vercel.app';
const THRESHOLD = 55;
const MAX = 10;
const fs = require('fs');
const OUTPUT = '/tmp/sitescout-leads.jsonl';

const [,, category, location] = process.argv;
if (!category || !location) { console.error('Usage: node scan-one.js <category> <location>'); process.exit(1); }

async function extractContactInfo(url) {
  /** Scrape website for email, owner name, social links */
  const info = { email: null, ownerName: null, facebook: null, instagram: null };
  
  try {
    // Fetch homepage
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteScout/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    let html = await res.text();
    
    // Extract emails
    const emails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const goodEmails = emails.filter(e => 
      !e.includes('example.com') && !e.includes('sentry') && 
      !e.includes('webpack') && !e.includes('.png') && 
      !e.includes('.jpg') && !e.includes('wixpress') &&
      !e.includes('schema.org') && !e.includes('protection')
    );
    info.email = goodEmails[0] || null;
    
    // Extract mailto: as fallback
    if (!info.email) {
      const mailto = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (mailto) info.email = mailto[1];
    }
    
    // Extract owner/founder name patterns
    const ownerPatterns = [
      /(?:owner|founder|proprietor|ceo|president|operated by|owned by)[:\s]*([A-Z][a-z]+ [A-Z][a-z]+)/i,
      /(?:Dr\.|Dr)\s+([A-Z][a-z]+ [A-Z][a-z]+)/,
      /(?:meet|about)\s+(?:the\s+)?(?:owner|founder)?[:\s]*([A-Z][a-z]+ [A-Z][a-z]+)/i,
    ];
    for (const pat of ownerPatterns) {
      const m = html.match(pat);
      if (m) { info.ownerName = m[1].trim(); break; }
    }
    
    // Extract social links
    const fbMatch = html.match(/(?:href=["'])(https?:\/\/(?:www\.)?facebook\.com\/[^"'\s>]+)/i);
    if (fbMatch) info.facebook = fbMatch[1];
    
    const igMatch = html.match(/(?:href=["'])(https?:\/\/(?:www\.)?instagram\.com\/[^"'\s>]+)/i);
    if (igMatch) info.instagram = igMatch[1];
    
    // Try /about or /contact page for more info
    if (!info.email || !info.ownerName) {
      for (const path of ['/about', '/contact', '/about-us', '/contact-us']) {
        try {
          const baseUrl = new URL(url);
          const pageRes = await fetch(`${baseUrl.origin}${path}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteScout/1.0)' },
            redirect: 'follow',
            signal: AbortSignal.timeout(8000),
          });
          if (!pageRes.ok) continue;
          const pageHtml = await pageRes.text();
          
          if (!info.email) {
            const pageEmails = pageHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            const goodPageEmails = pageEmails.filter(e => !e.includes('example') && !e.includes('sentry') && !e.includes('wix'));
            if (goodPageEmails[0]) info.email = goodPageEmails[0];
            
            const mailtoPage = pageHtml.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (mailtoPage && !info.email) info.email = mailtoPage[1];
          }
          
          if (!info.ownerName) {
            for (const pat of ownerPatterns) {
              const m = pageHtml.match(pat);
              if (m) { info.ownerName = m[1].trim(); break; }
            }
          }
          
          if (info.email && info.ownerName) break;
        } catch (e) {}
      }
    }
  } catch (e) {}
  
  return info;
}

async function run() {
  console.log(`🔍 ${category} in ${location}`);
  
  const res = await fetch(`${API}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, location }),
  });
  if (!res.ok) { console.error('  Search failed'); process.exit(1); }
  const { businesses } = await res.json();
  
  const withSites = businesses.filter(b => b.website).slice(0, MAX);
  console.log(`  ${businesses.length} found, auditing ${withSites.length}...`);
  
  let leadCount = 0;
  
  for (const biz of withSites) {
    try {
      const r = await fetch(`${API}/api/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: biz.website, placeId: biz.placeId }),
      });
      if (!r.ok) continue;
      const audit = await r.json();
      const score = audit.siteScore;
      const icon = score < 30 ? '🔥' : score < THRESHOLD ? '⚠️' : '·';
      
      if (score < THRESHOLD) {
        // Extract contact info from their website
        const contact = await extractContactInfo(biz.website);
        
        console.log(`  ${icon} ${biz.name}: ${score} | 📞 ${biz.phone || '-'} | ✉️ ${contact.email || '-'} | 👤 ${contact.ownerName || '-'}`);
        
        const lead = {
          name: biz.name, address: biz.address, 
          phone: biz.phone, email: contact.email, ownerName: contact.ownerName,
          facebook: contact.facebook, instagram: contact.instagram,
          website: biz.website, siteScore: score, category, location,
          rating: biz.rating, reviewCount: biz.reviewCount,
          mapsUrl: biz.mapsUrl, scannedAt: new Date().toISOString(),
        };
        fs.appendFileSync(OUTPUT, JSON.stringify(lead) + '\n');
        leadCount++;
      } else {
        console.log(`  ${icon} ${biz.name}: ${score}`);
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log(`  ✅ ${leadCount} leads`);
}

run().catch(e => { console.error(e); process.exit(1); });
