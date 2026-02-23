const API_BASE = '/api';

export async function searchBusinesses(category, location) {
  const res = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, location }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Search failed' }));
    throw new Error(err.error || 'Search failed');
  }

  return res.json();
}

export async function auditSingle(url, placeId) {
  const res = await fetch(`${API_BASE}/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, placeId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Audit failed' }));
    throw new Error(err.error || 'Audit failed');
  }

  return res.json();
}

/**
 * Stream audit results via SSE.
 * onResult is called for each completed audit.
 * onProgress is called with { completed, total }.
 * Returns an AbortController to cancel.
 */
export function streamAudits(businesses, onResult, onProgress, onDone) {
  const controller = new AbortController();

  // Audit businesses one at a time to respect rate limits
  const businessesWithSites = businesses.filter(b => b.website);
  const businessesWithoutSites = businesses.filter(b => !b.website);

  // Immediately report no-website businesses
  for (const b of businessesWithoutSites) {
    onResult({
      placeId: b.placeId,
      siteScore: 0,
      status: 'no_website',
      categories: {},
      details: { message: 'No website found' },
    });
  }

  let completed = businessesWithoutSites.length;
  const total = businesses.length;

  if (completed > 0) {
    onProgress({ completed, total });
  }

  // Sequentially audit businesses with websites
  (async () => {
    for (const b of businessesWithSites) {
      if (controller.signal.aborted) break;

      try {
        const result = await auditSingle(b.website, b.placeId);
        completed++;
        onResult(result);
        onProgress({ completed, total });
      } catch (err) {
        completed++;
        onResult({
          placeId: b.placeId,
          siteScore: 0,
          status: 'error',
          categories: {},
          details: { error: err.message },
        });
        onProgress({ completed, total });
      }
    }

    if (onDone) onDone();
  })();

  return controller;
}

export function exportToCsv(businesses) {
  const headers = [
    'Business Name',
    'Address',
    'Phone',
    'Website',
    'Google Rating',
    'Review Count',
    'SiteScore',
    'Status',
    'Google Maps URL',
  ];

  const rows = businesses.map(b => [
    `"${(b.name || '').replace(/"/g, '""')}"`,
    `"${(b.address || '').replace(/"/g, '""')}"`,
    `"${(b.phone || '').replace(/"/g, '""')}"`,
    `"${(b.website || 'N/A').replace(/"/g, '""')}"`,
    b.rating || 0,
    b.reviewCount || 0,
    b.audit?.siteScore ?? 'N/A',
    getStatusLabel(b.audit?.siteScore, b.website),
    `"${(b.mapsUrl || '').replace(/"/g, '""')}"`,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sitescout-export-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function getStatusLabel(score, website) {
  if (!website) return 'No Website';
  if (score === null || score === undefined) return 'Pending';
  if (score <= 40) return 'Poor';
  if (score <= 70) return 'Fair';
  return 'Good';
}

export function getStatusColor(score, website) {
  if (!website) return 'bg-gray-800 text-gray-300';
  if (score === null || score === undefined) return 'bg-gray-700 text-gray-400';
  if (score <= 40) return 'bg-red-900/60 text-red-300';
  if (score <= 70) return 'bg-yellow-900/60 text-yellow-300';
  return 'bg-emerald-900/60 text-emerald-300';
}

export function getScoreEmoji(score, website) {
  if (!website) return '\u26AB';
  if (score === null || score === undefined) return '\u23F3';
  if (score <= 40) return '\uD83D\uDD34';
  if (score <= 70) return '\uD83D\uDFE1';
  return '\uD83D\uDFE2';
}
