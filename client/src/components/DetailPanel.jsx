import ScoreBadge from './ScoreBadge';

export default function DetailPanel({ business, onClose }) {
  if (!business) return null;

  const audit = business.audit;
  const categories = audit?.categories || {};

  return (
    <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-6 mt-2 mb-4 animate-in">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-100">{business.name}</h3>
          <p className="text-sm text-gray-400 mt-1">{business.address}</p>
          <div className="flex items-center gap-4 mt-2">
            {business.phone && (
              <a href={`tel:${business.phone}`} className="text-sm text-brand-400 hover:text-brand-300">
                {business.phone}
              </a>
            )}
            {business.website && (
              <a
                href={business.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand-400 hover:text-brand-300 truncate max-w-xs"
              >
                {business.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
            {business.mapsUrl && (
              <a
                href={business.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-gray-300"
              >
                View on Maps
              </a>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 p-1 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Overall Score */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-shrink-0">
          <ScoreBadge score={audit?.siteScore} website={business.website} size="lg" />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="text-yellow-400">{'★'.repeat(Math.round(business.rating || 0))}</span>
          <span>{business.rating || 'N/A'}</span>
          <span>({business.reviewCount || 0} reviews)</span>
        </div>
      </div>

      {/* Audit Breakdown */}
      {Object.keys(categories).length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Audit Breakdown</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(categories).map(([key, cat]) => (
              <div key={key} className="bg-gray-900/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">{cat.label}</span>
                  <span className={`text-sm font-bold ${getScoreColor(cat.score)}`}>
                    {cat.score}/100
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${getBarColor(cat.score)}`}
                    style={{ width: `${cat.score}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 mt-1 block">
                  Weight: {Math.round(cat.weight * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Details */}
      {audit?.details && (
        <div className="mt-6 space-y-3">
          <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Details</h4>

          {audit.details.pageTitle && (
            <DetailItem label="Page Title" value={audit.details.pageTitle} />
          )}
          {audit.details.firstContentfulPaint && audit.details.firstContentfulPaint !== 'N/A' && (
            <DetailItem label="First Contentful Paint" value={audit.details.firstContentfulPaint} />
          )}
          {audit.details.largestContentfulPaint && audit.details.largestContentfulPaint !== 'N/A' && (
            <DetailItem label="Largest Contentful Paint" value={audit.details.largestContentfulPaint} />
          )}
          {audit.details.speedIndex && audit.details.speedIndex !== 'N/A' && (
            <DetailItem label="Speed Index" value={audit.details.speedIndex} />
          )}

          {audit.details.hasSSL !== undefined && (
            <DetailItem
              label="SSL Certificate"
              value={audit.details.hasSSL ? 'Yes (HTTPS)' : 'No (HTTP only)'}
              good={audit.details.hasSSL}
            />
          )}

          {audit.details.seo && (
            <div className="bg-gray-900/50 rounded-lg p-3">
              <span className="text-xs text-gray-400 uppercase tracking-wider">SEO Checks</span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Check label="Title Tag" value={audit.details.seo.hasTitle} />
                <Check label="Meta Description" value={audit.details.seo.hasMetaDescription} />
                <Check label="H1 Tag" value={audit.details.seo.hasH1} />
                <Check label="Image Alt Text" value={audit.details.seo.hasAltText} />
              </div>
            </div>
          )}

          {audit.details.keyPages && (
            <div className="bg-gray-900/50 rounded-lg p-3">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Key Pages</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                <Check label="About" value={audit.details.keyPages.about} />
                <Check label="Contact" value={audit.details.keyPages.contact} />
                <Check label="Services/Menu" value={audit.details.keyPages.services} />
                <Check label="Hours" value={audit.details.keyPages.hours} />
                <Check label="Booking/Order" value={audit.details.keyPages.booking} />
              </div>
            </div>
          )}

          {audit.details.modernDesign && (
            <div className="bg-gray-900/50 rounded-lg p-3">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Modern Design</span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Check label="Viewport Meta" value={audit.details.modernDesign.hasViewport} />
                <Check label="Responsive Images" value={audit.details.modernDesign.hasResponsiveImages} />
                <Check label="No Flash" value={audit.details.modernDesign.noFlash} />
                <Check label="Modern CSS" value={audit.details.modernDesign.modernCSS} />
              </div>
            </div>
          )}

          {audit.details.error && (
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-3">
              <span className="text-sm text-red-400">Error: {audit.details.error}</span>
            </div>
          )}
        </div>
      )}

      {audit?.status === 'no_website' && (
        <div className="mt-4 bg-gray-900/50 border border-gray-700 rounded-lg p-4 text-center">
          <p className="text-gray-400">This business has no website — high priority lead for web design services.</p>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value, good }) {
  return (
    <div className="flex items-center justify-between bg-gray-900/50 rounded-lg px-3 py-2">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-medium ${good === true ? 'text-emerald-400' : good === false ? 'text-red-400' : 'text-gray-200'}`}>
        {value}
      </span>
    </div>
  );
}

function Check({ label, value }) {
  return (
    <div className="flex items-center gap-1.5">
      {value ? (
        <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span className="text-xs text-gray-300">{label}</span>
    </div>
  );
}

function getScoreColor(score) {
  if (score <= 40) return 'text-red-400';
  if (score <= 70) return 'text-yellow-400';
  return 'text-emerald-400';
}

function getBarColor(score) {
  if (score <= 40) return 'bg-red-500';
  if (score <= 70) return 'bg-yellow-500';
  return 'bg-emerald-500';
}
