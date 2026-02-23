# SiteScout

A local business website audit and lead prospecting tool. SiteScout helps web design consultants find businesses with poor or outdated websites so they can offer redesign services.

## What It Does

1. **Business Discovery** — Search for any business category (restaurants, dentists, HVAC, etc.) in any location using Google Places API
2. **Automated Website Audits** — Each business website is scored 0-100 based on performance, mobile responsiveness, SSL, SEO, and more
3. **Lead Prioritization** — Sort and filter results to find the worst websites first — your best leads
4. **Export for Outreach** — Download results as CSV with phone numbers and addresses for cold outreach

## SiteScore Breakdown

| Category | Weight | What It Checks |
|----------|--------|----------------|
| Performance | 25% | PageSpeed Insights / Lighthouse score |
| Mobile Responsiveness | 20% | Viewport, font sizes, tap targets |
| SSL Certificate | 10% | HTTPS enabled |
| Broken Resources | 10% | Missing images, 404 assets |
| Key Pages | 15% | About, Contact, Services, Hours, Booking pages |
| Modern Design | 10% | Viewport meta, responsive images, no Flash, modern CSS |
| SEO Basics | 10% | Title tag, meta description, H1, image alt text |

## Getting API Keys

### Google Places API (New)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services > Library**
4. Search for and enable **Places API (New)**
5. Go to **APIs & Services > Credentials**
6. Click **Create Credentials > API Key**
7. Copy the key — this is your `GOOGLE_PLACES_API_KEY`

### Google PageSpeed Insights API
1. In the same Google Cloud project, go to **APIs & Services > Library**
2. Search for and enable **PageSpeed Insights API**
3. You can use the same API key, or create a separate one
4. This is your `GOOGLE_PAGESPEED_API_KEY`

> **Note:** The Places API has usage costs. Check [Google's pricing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing) for current rates. PageSpeed Insights API is free.

## Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd sitescout

# Install all dependencies
npm run install:all

# Configure environment variables
cp .env.example .env
# Edit .env and add your Google API keys

# Start development servers
npm run dev
```

This starts:
- **Frontend** at http://localhost:5173
- **Backend** at http://localhost:3001

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** SQLite (via better-sqlite3) for caching audit results
- **APIs:** Google Places API (New), Google PageSpeed Insights API

## Project Structure

```
sitescout/
├── client/                # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── hooks/         # Custom React hooks
│   │   └── utils/         # API helpers, CSV export
│   └── package.json
├── server/                # Express backend
│   ├── routes/            # API route handlers
│   ├── services/          # Business logic
│   │   ├── places.js      # Google Places integration
│   │   ├── auditor.js     # Website audit engine
│   │   └── cache.js       # SQLite caching layer
│   └── package.json
├── .env.example
└── README.md
```

## Screenshots

<!-- Add screenshots here -->

## Deployment

The app is configured for Vercel deployment with the Express backend as a serverless function.

```bash
vercel
```
