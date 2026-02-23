import { getStatusLabel, getStatusColor, getScoreEmoji } from '../utils/api';

export default function ScoreBadge({ score, website, size = 'sm' }) {
  const label = getStatusLabel(score, website);
  const colorClass = getStatusColor(score, website);
  const emoji = getScoreEmoji(score, website);

  const isPending = website && (score === null || score === undefined);

  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-400">
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Auditing...
      </span>
    );
  }

  const sizeClasses = size === 'lg'
    ? 'px-3 py-1.5 text-sm'
    : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 ${sizeClasses} rounded-full font-medium ${colorClass}`}>
      <span>{emoji}</span>
      {score !== null && score !== undefined && website && (
        <span className="font-bold">{score}</span>
      )}
      <span>{label}</span>
    </span>
  );
}
