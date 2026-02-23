export default function ProgressBar({ progress, auditing, onCancel }) {
  if (!auditing && progress.completed === 0) return null;

  const pct = progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  const isDone = progress.completed === progress.total && progress.total > 0;

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {auditing && (
            <svg className="animate-spin h-4 w-4 text-brand-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {isDone && (
            <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span className="text-sm text-gray-300">
            {isDone
              ? `Audit complete — ${progress.total} businesses scanned`
              : `Auditing ${progress.completed}/${progress.total} businesses...`}
          </span>
        </div>
        {auditing && (
          <button
            onClick={onCancel}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${isDone ? 'bg-emerald-500' : 'bg-brand-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
