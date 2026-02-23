#!/bin/bash
# SiteScout Lead Scanner — GA Focus
# Runs one category at a time to avoid OOM
OUTPUT="/tmp/sitescout-leads.jsonl"
> "$OUTPUT"

TARGETS=(
  # South Atlanta / Henry County
  "Restaurants|McDonough, GA"
  "Hair salons|McDonough, GA"
  "Dentists|McDonough, GA"
  "Chiropractors|McDonough, GA"
  "Gyms|McDonough, GA"
  "Nail salons|Stockbridge, GA"
  "Pet grooming|Stockbridge, GA"
  "Insurance agents|McDonough, GA"
  "Cleaning services|McDonough, GA"
  # Fayette / Coweta
  "Restaurants|Fayetteville, GA"
  "Coffee shops|Peachtree City, GA"
  "Bakeries|Newnan, GA"
  "Florists|Fayetteville, GA"
  "Yoga studios|Peachtree City, GA"
  "Landscaping|Newnan, GA"
  # South Metro
  "HVAC companies|Jonesboro, GA"
  "Plumbers|Conyers, GA"
  "Auto repair|Covington, GA"
  "Real estate agents|Griffin, GA"
  "Veterinarians|Hampton, GA"
  # Serenbe / Palmetto area (near your client)
  "Restaurants|Palmetto, GA"
  "Coffee shops|Chattahoochee Hills, GA"
  "Boutiques|Serenbe, GA"
  # North Metro
  "Restaurants|Marietta, GA"
  "Hair salons|Roswell, GA"
  "Dentists|Alpharetta, GA"
  "HVAC companies|Kennesaw, GA"
  "Photographers|Decatur, GA"
  # Atlanta proper
  "Restaurants|East Atlanta, GA"
  "Barber shops|College Park, GA"
)

echo "🕵️ SiteScout GA Scan — ${#TARGETS[@]} targets"
echo "Output: $OUTPUT"
echo "================================"

for entry in "${TARGETS[@]}"; do
  IFS='|' read -r category location <<< "$entry"
  node /home/ubuntu/.openclaw/workspace/sitescout/scripts/scan-one.js "$category" "$location"
  sleep 2
done

TOTAL=$(wc -l < "$OUTPUT" 2>/dev/null || echo 0)
echo ""
echo "================================"
echo "📊 Scan complete — $TOTAL total leads"
echo ""

if [ "$TOTAL" -gt 0 ]; then
  echo "🔥 Top leads (worst websites = best prospects):"
  cat "$OUTPUT" | python3 -c "
import sys, json
leads = [json.loads(l) for l in sys.stdin if l.strip()]
leads.sort(key=lambda x: x.get('siteScore', 100))
for i, l in enumerate(leads[:25]):
    print(f\"  {i+1}. {l['name']} — {l.get('siteScore',0)}/100 [{l['category']}]\")
    print(f\"     📞 {l.get('phone') or 'no phone'}\")
    print(f\"     ✉️  {l.get('email') or 'no email'}\")
    print(f\"     👤 {l.get('ownerName') or 'unknown owner'}\")
    print(f\"     🌐 {l['website']}\")
    print(f\"     📍 {l['address']}\")
    print(f\"     ⭐ {l.get('rating',0)} ({l.get('reviewCount',0)} reviews)\")
    if l.get('facebook'): print(f\"     📘 {l['facebook']}\")
    if l.get('instagram'): print(f\"     📸 {l['instagram']}\")
    print()
" 2>/dev/null
fi
