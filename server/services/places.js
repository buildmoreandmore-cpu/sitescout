const fetch = require('node-fetch');

const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

/**
 * Search for businesses using Google Places API (New).
 * Supports pagination via pageToken for up to 60 results.
 */
async function searchBusinesses(category, location, pageToken = null) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured');
  }

  const textQuery = `${category} in ${location}`;

  const body = {
    textQuery,
    languageCode: 'en',
    ...(pageToken && { pageToken }),
  };

  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.nationalPhoneNumber',
    'places.internationalPhoneNumber',
    'places.websiteUri',
    'places.rating',
    'places.userRatingCount',
    'places.googleMapsUri',
    'places.photos',
    'places.businessStatus',
    'places.types',
  ].join(',');

  const response = await fetch(PLACES_TEXT_SEARCH_URL, {
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
    throw new Error(`Places API error (${response.status}): ${error}`);
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

  return {
    businesses,
    nextPageToken: data.nextPageToken || null,
  };
}

/**
 * Fetch all pages of results (up to maxPages).
 */
async function searchAllBusinesses(category, location, maxPages = 3) {
  let allBusinesses = [];
  let pageToken = null;

  for (let page = 0; page < maxPages; page++) {
    const result = await searchBusinesses(category, location, pageToken);
    allBusinesses = allBusinesses.concat(result.businesses);

    if (!result.nextPageToken) break;
    pageToken = result.nextPageToken;

    // Google requires a short delay before using nextPageToken
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Deduplicate by placeId
  const seen = new Set();
  allBusinesses = allBusinesses.filter(b => {
    if (seen.has(b.placeId)) return false;
    seen.add(b.placeId);
    return true;
  });

  return allBusinesses;
}

/**
 * Get a photo URL for a place photo reference.
 */
function getPhotoUrl(photoRef, maxWidth = 400) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!photoRef || !apiKey) return null;
  return `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;
}

module.exports = {
  searchBusinesses,
  searchAllBusinesses,
  getPhotoUrl,
};
