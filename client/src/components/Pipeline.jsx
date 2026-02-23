import { useState, useEffect, useCallback } from 'react';
import { STAGES, getLeads, updateLeadStage, updateLeadNotes, removeLead } from '../utils/pipeline';
import { getStatusColor } from '../utils/api';

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');

  const refresh = useCallback(() => {
    setLeads(getLeads());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleStageChange = (placeId, newStage) => {
    updateLeadStage(placeId, newStage);
    refresh();
  };

  const handleSaveNotes = (placeId) => {
    updateLeadNotes(placeId, notesDraft);
    setEditingNotes(null);
    refresh();
  };

  const handleRemove = (placeId) => {
    removeLead(placeId);
    setExpandedId(null);
    refresh();
  };

  const startEditNotes = (lead) => {
    setEditingNotes(lead.placeId);
    setNotesDraft(lead.notes || '');
  };

  // Stats
  const stats = STAGES.map(s => ({
    ...s,
    count: leads.filter(l => l.stage === s.id).length,
  }));

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-100">{s.count}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Stage columns */}
      {leads.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-800/50 mb-6">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-400 mb-2">No saved leads yet</h2>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Search for businesses, then click the bookmark icon to save leads to your pipeline.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {STAGES.map(stage => {
            const stageLeads = leads.filter(l => l.stage === stage.id);
            if (stageLeads.length === 0) return null;

            return (
              <div key={stage.id}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">{stage.label}</h3>
                  <span className="px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-400">{stageLeads.length}</span>
                </div>

                <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="divide-y divide-gray-800/50">
                    {stageLeads.map(lead => (
                      <div key={lead.placeId}>
                        <div
                          onClick={() => setExpandedId(expandedId === lead.placeId ? null : lead.placeId)}
                          className="flex items-center gap-4 px-4 py-3 hover:bg-gray-800/50 cursor-pointer transition-colors"
                        >
                          {/* Score indicator */}
                          <div className="w-1 h-8 rounded-full flex-shrink-0" style={{
                            backgroundColor: lead.siteScore == null ? '#4B5563' :
                              lead.siteScore <= 40 ? '#EF4444' :
                              lead.siteScore <= 70 ? '#EAB308' : '#10B981'
                          }} />

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-100">{lead.name}</p>
                            <p className="text-xs text-gray-500 truncate">{lead.address}</p>
                          </div>

                          {/* Score */}
                          <div className="flex-shrink-0">
                            {lead.siteScore != null ? (
                              <span className={`text-sm font-bold ${
                                lead.siteScore <= 40 ? 'text-red-400' :
                                lead.siteScore <= 70 ? 'text-yellow-400' : 'text-emerald-400'
                              }`}>{lead.siteScore}</span>
                            ) : lead.website ? (
                              <span className="text-sm text-gray-500">—</span>
                            ) : (
                              <span className="text-xs text-gray-600 italic">No site</span>
                            )}
                          </div>

                          {/* Phone */}
                          <div className="hidden sm:block flex-shrink-0">
                            {lead.phone ? (
                              <span className="text-xs text-gray-400">{lead.phone}</span>
                            ) : (
                              <span className="text-xs text-gray-600">—</span>
                            )}
                          </div>

                          {/* Notes indicator */}
                          {lead.notes && (
                            <div className="flex-shrink-0">
                              <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                            </div>
                          )}

                          {/* Chevron */}
                          <svg className={`w-4 h-4 text-gray-500 transition-transform ${expandedId === lead.placeId ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        {/* Expanded detail */}
                        {expandedId === lead.placeId && (
                          <div className="px-4 pb-4 pt-1 border-t border-gray-800/30 space-y-4">
                            {/* Contact info */}
                            <div className="flex flex-wrap gap-3 text-sm">
                              {lead.phone && (
                                <a href={`tel:${lead.phone}`} className="text-brand-400 hover:text-brand-300">{lead.phone}</a>
                              )}
                              {lead.website && (
                                <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300 truncate max-w-xs">
                                  {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                </a>
                              )}
                              {lead.mapsUrl && (
                                <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-300">Maps</a>
                              )}
                            </div>

                            {/* Rating */}
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <span className="text-yellow-400">★</span>
                              <span>{lead.rating || 'N/A'}</span>
                              <span>({lead.reviewCount || 0} reviews)</span>
                              <span className="text-gray-600 mx-1">·</span>
                              <span className="text-gray-500">Saved {new Date(lead.savedAt).toLocaleDateString()}</span>
                            </div>

                            {/* Stage selector */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 uppercase tracking-wider">Stage:</span>
                              <div className="flex gap-1.5">
                                {STAGES.map(s => (
                                  <button
                                    key={s.id}
                                    onClick={(e) => { e.stopPropagation(); handleStageChange(lead.placeId, s.id); }}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                      lead.stage === s.id
                                        ? 'bg-brand-600 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                                    }`}
                                  >
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Notes */}
                            <div>
                              {editingNotes === lead.placeId ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={notesDraft}
                                    onChange={(e) => setNotesDraft(e.target.value)}
                                    placeholder="Add notes about this lead..."
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                                    rows={3}
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleSaveNotes(lead.placeId)}
                                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingNotes(null)}
                                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-medium rounded-lg transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onClick={(e) => { e.stopPropagation(); startEditNotes(lead); }}
                                  className="px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-400 cursor-text hover:border-gray-600 transition-colors min-h-[2.5rem]"
                                >
                                  {lead.notes || <span className="italic text-gray-600">Click to add notes...</span>}
                                </div>
                              )}
                            </div>

                            {/* Remove */}
                            <div className="flex justify-end">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemove(lead.placeId); }}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                              >
                                Remove from pipeline
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
