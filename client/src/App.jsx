import { useState, useCallback, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import ResultsTable from './components/ResultsTable';
import ProgressBar from './components/ProgressBar';
import Pipeline from './components/Pipeline';
import { useSearch } from './hooks/useSearch';
import { refreshCache, getPipelineStats } from './utils/pipeline';

export default function App() {
  const [view, setView] = useState('search'); // 'search' | 'pipeline'
  const [pipelineKey, setPipelineKey] = useState(0);
  const [totalSaved, setTotalSaved] = useState(0);

  useEffect(() => {
    refreshCache().then(() => {
      getPipelineStats().then(stats => setTotalSaved(stats.total || 0)).catch(() => {});
    }).catch(() => {});
  }, [pipelineKey]);

  const {
    businesses,
    loading,
    auditing,
    progress,
    error,
    searchInfo,
    search,
    cancelAudit,
  } = useSearch();

  const onLeadSaved = useCallback(() => {
    setPipelineKey(k => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">SiteScout</h1>
              <p className="text-xs text-gray-500">Business Website Auditor</p>
            </div>
          </div>

          {/* Nav */}
          <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-800 rounded-lg p-1">
            <button
              onClick={() => setView('search')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'search'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Search
            </button>
            <button
              onClick={() => setView('pipeline')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                view === 'pipeline'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Pipeline
              {totalSaved > 0 && (
                <span className="px-1.5 py-0.5 bg-brand-600 text-white text-xs rounded-full min-w-[1.25rem] text-center">
                  {totalSaved}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {view === 'search' ? (
          <>
            {/* Search */}
            <section>
              <SearchBar onSearch={search} loading={loading} />
            </section>

            {/* Error */}
            {error && (
              <div className="bg-red-900/20 border border-red-800/30 rounded-lg px-4 py-3 text-sm text-red-400">
                <span className="font-medium">Error:</span> {error}
              </div>
            )}

            {/* Progress */}
            <ProgressBar progress={progress} auditing={auditing} onCancel={cancelAudit} />

            {/* Results */}
            <ResultsTable businesses={businesses} onLeadSaved={onLeadSaved} />

            {/* Empty State */}
            {!loading && businesses.length === 0 && !error && (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-800/50 mb-6">
                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-400 mb-2">Find businesses to audit</h2>
                <p className="text-sm text-gray-600 max-w-md mx-auto">
                  Enter a business category and location above to discover businesses with poor or outdated websites — your next web design clients.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-6">
                  {[
                    { cat: 'Restaurants', loc: 'Atlanta, GA' },
                    { cat: 'Dentists', loc: 'Decatur, GA' },
                    { cat: 'HVAC', loc: 'Sandy Springs, GA' },
                  ].map((example) => (
                    <button
                      key={example.cat}
                      onClick={() => search(example.cat, example.loc)}
                      className="px-3 py-1.5 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded-full text-xs text-gray-400 hover:text-gray-300 transition-colors"
                    >
                      {example.cat} in {example.loc}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <Pipeline key={pipelineKey} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/30 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-xs text-gray-600">
          <span>SiteScout v1.1</span>
          <span>Built for web design consultants</span>
        </div>
      </footer>
    </div>
  );
}
