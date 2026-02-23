const STORAGE_KEY = 'sitescout_pipeline';

export const STAGES = [
  { id: 'saved', label: 'Saved', color: 'brand' },
  { id: 'reaching_out', label: 'Reaching Out', color: 'yellow' },
  { id: 'responded', label: 'Responded', color: 'blue' },
  { id: 'closed', label: 'Closed', color: 'emerald' },
];

export function getLeads() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLeads(leads) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

export function saveLead(business) {
  const leads = getLeads();
  if (leads.find(l => l.placeId === business.placeId)) return false; // already saved

  leads.push({
    placeId: business.placeId,
    name: business.name,
    address: business.address,
    phone: business.phone || '',
    website: business.website || '',
    rating: business.rating || 0,
    reviewCount: business.reviewCount || 0,
    mapsUrl: business.mapsUrl || '',
    siteScore: business.audit?.siteScore ?? null,
    auditStatus: business.audit?.status || 'pending',
    categories: business.audit?.categories || {},
    stage: 'saved',
    notes: '',
    savedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  saveLeads(leads);
  return true;
}

export function removeLead(placeId) {
  const leads = getLeads().filter(l => l.placeId !== placeId);
  saveLeads(leads);
}

export function updateLeadStage(placeId, stage) {
  const leads = getLeads().map(l =>
    l.placeId === placeId ? { ...l, stage, updatedAt: new Date().toISOString() } : l
  );
  saveLeads(leads);
}

export function updateLeadNotes(placeId, notes) {
  const leads = getLeads().map(l =>
    l.placeId === placeId ? { ...l, notes, updatedAt: new Date().toISOString() } : l
  );
  saveLeads(leads);
}

export function isLeadSaved(placeId) {
  return getLeads().some(l => l.placeId === placeId);
}

export function getLeadsByStage(stage) {
  return getLeads().filter(l => l.stage === stage);
}

export function getPipelineStats() {
  const leads = getLeads();
  return STAGES.map(s => ({
    ...s,
    count: leads.filter(l => l.stage === s.id).length,
  }));
}
