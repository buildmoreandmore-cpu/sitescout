import { useState, useEffect, useCallback } from 'react';
import { STAGES, getLeads, updateLeadStage, updateLeadNotes, removeLead } from '../utils/pipeline';

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await getLeads();
    setLeads(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleStageChange = async (placeId, newStage) => {
    await updateLeadStage(placeId, newStage);
    refresh();
  };

  const handleSaveNotes = async (placeId) => {
    await updateLeadNotes(placeId, notesDraft);
    setEditingNotes(null);
    refresh();
  };

  const handleRemove = async (placeId) => {
    await removeLead(placeId);
    setExpandedId(null);
    refresh();
  };

  const startEditNotes = (lead) => {
    setEditingNotes(lead.place_id);
    setNotesDraft(lead.notes || '');
  };

  const stats = STAGES.map(s => ({
    ...s,
    count: leads.filter(l => l.stage === s.id).length,
  }));

  if (loading) {
    return (
      <div className="text-center py-20">
        <svg className="animate-spin h-8 w-8 text-brand-400 mx-auto mb-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-gray-400">Loading pipeline...</p>
      </div>
    );
  }

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

      {leads.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-800/50 mb-6">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-400 mb-2">No saved leads yet</h2>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Search for businesses, then click the bookmark icon to save leads to your pipeline. The sub-agent also adds leads automatically.
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
                      <div key={lead.place_id}>
                        <div
                          onClick={() => setExpandedId(expandedId === lead.place_id ? null : lead.place_id)}
                          className="flex items-center gap-4 px-4 py-3 hover:bg-gray-800/50 cursor-pointer transition-colors"
                        >
                          <div className="w-1 h-8 rounded-full flex-shrink-0" style={{
                            backgroundColor: lead.site_score == null ? '#4B5563' :
                              lead.site_score <= 40 ? '#EF4444' :
                              lead.site_score <= 70 ? '#EAB308' : '#10B981'
                          }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-100">{lead.name}</p>
                            <p className="text-xs text-gray-500 truncate">{lead.address}</p>
                          </div>
                          <div className="flex-shrink-0">
                            {lead.site_score != null ? (
                              <span className={`text-sm font-bold ${
                                lead.site_score <= 40 ? 'text-red-400' :
                                lead.site_score <= 70 ? 'text-yellow-400' : 'text-emerald-400'
                              }`}>{lead.site_score}</span>
                            ) : (
                              <span className="text-xs text-gray-600 italic">No site</span>
                            )}
                          </div>
                          <div className="hidden sm:block flex-shrink-0">
                            <span className="text-xs text-gray-400">{lead.phone || '—'}</span>
                          </div>
                          {lead.email && (
                            <div className="hidden md:block flex-shrink-0">
                              <span className="text-xs text-brand-400">{lead.email}</span>
                            </div>
                          )}
                          {lead.owner_name && (
                            <div className="hidden lg:block flex-shrink-0">
                              <span className="text-xs text-gray-300">{lead.owner_name}</span>
                            </div>
                          )}
                          {lead.notes && (
                            <div className="flex-shrink-0">
                              <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                            </div>
                          )}
                          <svg className={`w-4 h-4 text-gray-500 transition-transform ${expandedId === lead.place_id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        {expandedId === lead.place_id && (
                          <div className="px-4 pb-4 pt-1 border-t border-gray-800/30 space-y-4">
                            <div className="flex flex-wrap gap-3 text-sm">
                              {lead.phone && <a href={`tel:${lead.phone}`} className="text-brand-400 hover:text-brand-300">{lead.phone}</a>}
                              {lead.email && <a href={`mailto:${lead.email}`} className="text-brand-400 hover:text-brand-300">{lead.email}</a>}
                              {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300 truncate max-w-xs">{lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>}
                              {lead.maps_url && <a href={lead.maps_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-300">Maps</a>}
                              {lead.facebook && <a href={lead.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-300">Facebook</a>}
                              {lead.instagram && <a href={lead.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-300">Instagram</a>}
                            </div>

                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              {lead.owner_name && <span>👤 {lead.owner_name}</span>}
                              <span className="text-yellow-400">★</span>
                              <span>{lead.rating || 'N/A'} ({lead.review_count || 0} reviews)</span>
                              {lead.category && <span className="text-gray-500">· {lead.category}</span>}
                              <span className="text-gray-600">· Saved {new Date(lead.scanned_at).toLocaleDateString()}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 uppercase tracking-wider">Stage:</span>
                              <div className="flex gap-1.5">
                                {STAGES.map(s => (
                                  <button
                                    key={s.id}
                                    onClick={(e) => { e.stopPropagation(); handleStageChange(lead.place_id, s.id); }}
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

                            <div>
                              {editingNotes === lead.place_id ? (
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
                                    <button onClick={() => handleSaveNotes(lead.place_id)} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors">Save</button>
                                    <button onClick={() => setEditingNotes(null)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-medium rounded-lg transition-colors">Cancel</button>
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

                            <div className="flex justify-end">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemove(lead.place_id); }}
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
