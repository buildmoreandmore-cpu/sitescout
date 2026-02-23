const API_BASE = '/api';

export const STAGES = [
  { id: 'saved', label: 'Saved', color: 'brand' },
  { id: 'reaching_out', label: 'Reaching Out', color: 'yellow' },
  { id: 'responded', label: 'Responded', color: 'blue' },
  { id: 'closed', label: 'Closed', color: 'emerald' },
];

// Cache for quick isLeadSaved checks (refreshed on fetch)
let _cachedPlaceIds = new Set();

export async function getLeads(stage) {
  const params = stage ? `?stage=${stage}` : '';
  const res = await fetch(`${API_BASE}/leads${params}`);
  const data = await res.json();
  const leads = data.leads || [];
  _cachedPlaceIds = new Set(leads.map(l => l.place_id));
  return leads;
}

export async function saveLead(business) {
  if (_cachedPlaceIds.has(business.placeId)) return false;

  const res = await fetch(`${API_BASE}/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      placeId: business.placeId,
      name: business.name,
      address: business.address,
      phone: business.phone || '',
      website: business.website || '',
      siteScore: business.audit?.siteScore ?? null,
      rating: business.rating || 0,
      reviewCount: business.reviewCount || 0,
      mapsUrl: business.mapsUrl || '',
      category: business.searchCategory || '',
      location: business.searchLocation || '',
    }),
  });

  if (res.ok) {
    _cachedPlaceIds.add(business.placeId);
    return true;
  }
  return false;
}

export async function removeLead(placeId) {
  await fetch(`${API_BASE}/leads/${encodeURIComponent(placeId)}`, { method: 'DELETE' });
  _cachedPlaceIds.delete(placeId);
}

export async function updateLeadStage(placeId, stage) {
  await fetch(`${API_BASE}/leads/${encodeURIComponent(placeId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  });
}

export async function updateLeadNotes(placeId, notes) {
  await fetch(`${API_BASE}/leads/${encodeURIComponent(placeId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
}

export function isLeadSaved(placeId) {
  return _cachedPlaceIds.has(placeId);
}

export async function refreshCache() {
  await getLeads();
}

export async function getPipelineStats() {
  const res = await fetch(`${API_BASE}/leads/stats`);
  return res.json();
}
