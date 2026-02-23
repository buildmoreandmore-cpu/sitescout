export default function Filters({ filters, onChange, totalCount, filteredCount }) {
  const update = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 uppercase tracking-wider whitespace-nowrap">Score</label>
        <select
          value={filters.scoreRange}
          onChange={(e) => update('scoreRange', e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="all">All Scores</option>
          <option value="poor">Poor (0-40)</option>
          <option value="fair">Fair (41-70)</option>
          <option value="good">Good (71-100)</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 uppercase tracking-wider whitespace-nowrap">Min Rating</label>
        <select
          value={filters.minRating}
          onChange={(e) => update('minRating', Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value={0}>Any</option>
          <option value={3}>3+ Stars</option>
          <option value={3.5}>3.5+ Stars</option>
          <option value={4}>4+ Stars</option>
          <option value={4.5}>4.5+ Stars</option>
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.noWebsiteOnly}
          onChange={(e) => update('noWebsiteOnly', e.target.checked)}
          className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-brand-500 focus:ring-brand-500 focus:ring-offset-gray-950"
        />
        <span className="text-sm text-gray-300">No website only</span>
      </label>

      {filteredCount !== totalCount && (
        <span className="text-xs text-gray-500 ml-auto">
          Showing {filteredCount} of {totalCount}
        </span>
      )}
    </div>
  );
}
