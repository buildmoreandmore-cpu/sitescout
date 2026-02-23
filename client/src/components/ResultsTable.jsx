import { useState, useMemo } from 'react';
import ScoreBadge from './ScoreBadge';
import DetailPanel from './DetailPanel';
import Filters from './Filters';
import { exportToCsv } from '../utils/api';

const DEFAULT_FILTERS = {
  scoreRange: 'all',
  minRating: 0,
  noWebsiteOnly: false,
};

export default function ResultsTable({ businesses }) {
  const [sortKey, setSortKey] = useState('siteScore');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    return businesses.filter(b => {
      // Score range filter
      if (filters.scoreRange !== 'all') {
        const score = b.audit?.siteScore;
        if (score === null || score === undefined) return filters.scoreRange === 'all';
        if (filters.scoreRange === 'poor' && (score > 40)) return false;
        if (filters.scoreRange === 'fair' && (score <= 40 || score > 70)) return false;
        if (filters.scoreRange === 'good' && score <= 70) return false;
      }

      // Rating filter
      if (filters.minRating > 0 && (b.rating || 0) < filters.minRating) return false;

      // No website filter
      if (filters.noWebsiteOnly && b.website) return false;

      return true;
    });
  }, [businesses, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal, bVal;

      switch (sortKey) {
        case 'siteScore':
          aVal = a.audit?.siteScore ?? (a.website ? 999 : -1);
          bVal = b.audit?.siteScore ?? (b.website ? 999 : -1);
          break;
        case 'rating':
          aVal = a.rating || 0;
          bVal = b.rating || 0;
          break;
        case 'reviewCount':
          aVal = a.reviewCount || 0;
          bVal = b.reviewCount || 0;
          break;
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortAsc]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'siteScore');
    }
  };

  const handleExport = () => {
    exportToCsv(sorted);
  };

  if (businesses.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Filters
          filters={filters}
          onChange={setFilters}
          totalCount={businesses.length}
          filteredCount={filtered.length}
        />
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <SortHeader label="Business" sortKey="name" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Website</th>
                <SortHeader label="Rating" sortKey="rating" currentKey={sortKey} asc={sortAsc} onSort={handleSort} align="center" />
                <SortHeader label="Reviews" sortKey="reviewCount" currentKey={sortKey} asc={sortAsc} onSort={handleSort} align="center" />
                <SortHeader label="SiteScore" sortKey="siteScore" currentKey={sortKey} asc={sortAsc} onSort={handleSort} align="center" />
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {sorted.map((business) => (
                <TableRow
                  key={business.placeId}
                  business={business}
                  isExpanded={expandedId === business.placeId}
                  onToggle={() => setExpandedId(expandedId === business.placeId ? null : business.placeId)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {sorted.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            No businesses match your filters.
          </div>
        )}
      </div>
    </div>
  );
}

function TableRow({ business, isExpanded, onToggle }) {
  const b = business;

  return (
    <>
      <tr
        onClick={onToggle}
        className="hover:bg-gray-800/50 cursor-pointer transition-colors"
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full flex-shrink-0" style={{
              backgroundColor: !b.website ? '#374151' :
                b.audit?.siteScore == null ? '#4B5563' :
                b.audit.siteScore <= 40 ? '#EF4444' :
                b.audit.siteScore <= 70 ? '#EAB308' : '#10B981'
            }} />
            <div>
              <p className="text-sm font-medium text-gray-100">{b.name}</p>
              <p className="text-xs text-gray-500 truncate max-w-xs">{b.address}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          {b.website ? (
            <a
              href={b.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-sm text-brand-400 hover:text-brand-300 truncate block max-w-[200px]"
            >
              {b.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          ) : (
            <span className="text-sm text-gray-600 italic">None</span>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <span className="text-yellow-400 text-xs">★</span>
            <span className="text-sm text-gray-300">{b.rating || '—'}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-sm text-gray-400">{b.reviewCount || 0}</span>
        </td>
        <td className="px-4 py-3 text-center">
          {b.audit?.siteScore != null ? (
            <span className={`text-sm font-bold ${
              b.audit.siteScore <= 40 ? 'text-red-400' :
              b.audit.siteScore <= 70 ? 'text-yellow-400' : 'text-emerald-400'
            }`}>
              {b.audit.siteScore}
            </span>
          ) : b.website ? (
            <span className="text-gray-500 animate-pulse-score text-sm">...</span>
          ) : (
            <span className="text-gray-600 text-sm">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <ScoreBadge score={b.audit?.siteScore} website={b.website} />
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} className="px-4 py-0">
            <DetailPanel business={b} onClose={onToggle} />
          </td>
        </tr>
      )}
    </>
  );
}

function SortHeader({ label, sortKey, currentKey, asc, onSort, align = 'left' }) {
  const isActive = sortKey === currentKey;
  const alignClass = align === 'center' ? 'text-center' : 'text-left';

  return (
    <th
      className={`px-4 py-3 ${alignClass} text-xs font-medium uppercase tracking-wider cursor-pointer select-none transition-colors ${
        isActive ? 'text-brand-400' : 'text-gray-400 hover:text-gray-300'
      }`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <svg className={`w-3 h-3 transition-transform ${asc ? '' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </span>
    </th>
  );
}
