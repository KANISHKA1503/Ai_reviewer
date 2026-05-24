import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import HudPanel from '../components/HudPanel';
import { ScoreRing, AnimatedNumber } from '../components/DataViz';
import { fetchReviews, fetchReview } from '../utils/api';

export default function ReviewsView() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedData, setExpandedData] = useState(null);

  useEffect(() => {
    loadReviews();
    const interval = setInterval(loadReviews, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadReviews = async () => {
    try {
      const data = await fetchReviews(100);
      setReviews(data);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedData(null);
      return;
    }
    setExpandedId(id);
    try {
      const data = await fetchReview(id);
      setExpandedData(data);
    } catch (err) {
      console.error('Failed to load review detail:', err);
    }
  };

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (r.repo_full_name || '').toLowerCase().includes(q) ||
          (r.pr_title || '').toLowerCase().includes(q) ||
          (r.pr_author || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reviews, search, filter]);

  const filterCounts = useMemo(() => {
    const counts = { all: reviews.length, complete: 0, analyzing: 0, error: 0 };
    reviews.forEach((r) => {
      if (counts[r.status] !== undefined) counts[r.status]++;
    });
    return counts;
  }, [reviews]);

  const getScoreBg = (score) => {
    if (score >= 80) return 'bg-[var(--color-signal)]/10 text-[var(--color-signal)]';
    if (score >= 60) return 'bg-[var(--color-info)]/10 text-[var(--color-info)]';
    if (score >= 40) return 'bg-[var(--color-warn)]/10 text-[var(--color-warn)]';
    return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const mins = Math.floor((now - d) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="min-h-screen pt-20 px-4 lg:px-10 pb-16">
      <div className="max-w-7xl mx-auto">
        {/* ── Header with asymmetric layout ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <div className="text-label text-[var(--color-signal)] flex items-center gap-2 mb-2">
                <span className="w-8 h-px bg-[var(--color-signal)]" />
                REVIEW DATABASE
              </div>
              <h2 className="text-editorial text-3xl lg:text-4xl text-[var(--color-white)]">
                Analysis Console
              </h2>
            </div>

            {/* Search with HUD styling */}
            <div className="relative w-full lg:w-96">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search repo, author, title..."
                className="input-hud pl-10"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dim)] text-sm">⌕</span>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-dim)] hover:text-[var(--color-text)] text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Filter Ribbon — Non-standard pill design ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 mb-6 overflow-x-auto pb-2"
        >
          {['all', 'complete', 'analyzing', 'error'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-sm text-xs font-semibold tracking-[0.08em] uppercase transition-all duration-300 border whitespace-nowrap ${
                filter === f
                  ? f === 'complete'
                    ? 'bg-[var(--color-signal)]/15 border-[var(--color-signal)]/40 text-[var(--color-signal)]'
                    : f === 'analyzing'
                    ? 'bg-[var(--color-info)]/15 border-[var(--color-info)]/40 text-[var(--color-info)]'
                    : f === 'error'
                    ? 'bg-[var(--color-danger)]/15 border-[var(--color-danger)]/40 text-[var(--color-danger)]'
                    : 'bg-[var(--color-muted)]/15 border-[var(--color-text)]/30 text-[var(--color-bright)]'
                  : 'bg-transparent border-[var(--color-muted)]/20 text-[var(--color-dim)] hover:border-[var(--color-muted)]/40'
              }`}
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {f} <span className="ml-1 opacity-60">({filterCounts[f]})</span>
            </button>
          ))}
        </motion.div>

        {/* ── Review List — Stacked panels, not table rows ── */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 text-center"
              >
                <div className="text-3xl mb-4 opacity-20">◇</div>
                <p className="text-[var(--color-dim)] text-sm">
                  {search || filter !== 'all' ? 'No matching reviews found' : 'No reviews recorded yet'}
                </p>
              </motion.div>
            ) : (
              filtered.map((review, i) => (
                <motion.div
                  key={review.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                >
                  <div
                    className={`panel rounded-lg cursor-pointer transition-all duration-300 ${
                      expandedId === review.id ? 'border-[var(--color-signal)]/30' : ''
                    }`}
                    onClick={() => handleExpand(review.id)}
                  >
                    {/* Main row */}
                    <div className="px-5 py-4 flex items-center gap-4">
                      {/* Status indicator */}
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          background: review.status === 'complete' ? 'var(--color-signal)' :
                            review.status === 'analyzing' ? 'var(--color-info)' :
                            review.status === 'error' ? 'var(--color-danger)' : 'var(--color-dim)',
                          boxShadow: review.status === 'analyzing' ? '0 0 8px var(--color-info)' : 'none',
                        }}
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[var(--color-bright)] truncate">
                          {review.pr_title || `PR #${review.pr_number}`}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--color-dim)]"
                          style={{ fontFamily: 'var(--font-mono)' }}>
                          <span className="truncate">{review.repo_full_name}</span>
                          <span className="opacity-40">#{review.pr_number}</span>
                          {review.pr_author && <span className="opacity-40">@{review.pr_author}</span>}
                        </div>
                      </div>

                      {/* Findings count */}
                      {review.findings_count > 0 && (
                        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-surface)]/60">
                          <span className="text-xs text-[var(--color-dim)]" style={{ fontFamily: 'var(--font-mono)' }}>
                            {review.findings_count}
                          </span>
                          <span className="text-[10px] text-[var(--color-dim)]">issues</span>
                        </div>
                      )}

                      {/* Score pill */}
                      {review.score != null && (
                        <div
                          className={`px-3 py-1 rounded-sm text-sm font-bold ${getScoreBg(review.score)}`}
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {review.score}
                        </div>
                      )}

                      {/* Time */}
                      <span className="text-xs text-[var(--color-dim)] min-w-[3rem] text-right hidden sm:block"
                        style={{ fontFamily: 'var(--font-mono)' }}>
                        {timeAgo(review.analyzed_at || review.created_at)}
                      </span>

                      {/* Expand arrow */}
                      <motion.span
                        animate={{ rotate: expandedId === review.id ? 90 : 0 }}
                        className="text-[var(--color-dim)] text-xs"
                      >
                        ▸
                      </motion.span>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {expandedId === review.id && expandedData && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden border-t border-[var(--color-muted)]/10"
                        >
                          <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Left: Score ring + summary */}
                            <div className="lg:col-span-4 flex flex-col items-center gap-4">
                              <ScoreRing score={expandedData.score || 0} size={100} />
                              <div className="text-center">
                                <div className="text-label mb-1">QUALITY SCORE</div>
                                <div className="text-sm text-[var(--color-text)]">
                                  {expandedData.files_analyzed || 0} files analyzed
                                </div>
                              </div>
                              {expandedData.pr_url && (
                                <a
                                  href={expandedData.pr_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-ghost text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View on GitHub →
                                </a>
                              )}
                            </div>

                            {/* Right: Findings */}
                            <div className="lg:col-span-8">
                              {expandedData.summary && (
                                <div className="mb-4 p-3 rounded-md bg-[var(--color-abyss)] border border-[var(--color-muted)]/10">
                                  <div className="text-label mb-1">SUMMARY</div>
                                  <p className="text-xs text-[var(--color-text)] leading-relaxed">
                                    {expandedData.summary}
                                  </p>
                                </div>
                              )}

                              {expandedData.findings?.length > 0 && (
                                <div className="space-y-2">
                                  <div className="text-label mb-2">
                                    FINDINGS ({expandedData.findings.length})
                                  </div>
                                  {expandedData.findings.map((f, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-[var(--color-deep)]/60">
                                      <div className={`severity-line h-auto self-stretch severity-line--${f.severity || 'medium'}`} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                          <span className="text-xs font-bold text-[var(--color-bright)]">
                                            {f.category || 'Issue'}
                                          </span>
                                          <span className={`signal-badge signal-badge--${
                                            f.severity === 'critical' || f.severity === 'high' ? 'danger' :
                                            f.severity === 'medium' ? 'warn' : 'info'
                                          }`} style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
                                            {f.severity?.toUpperCase()}
                                          </span>
                                        </div>
                                        <p className="text-xs text-[var(--color-text)] leading-relaxed">{f.description}</p>
                                        {f.file && (
                                          <div className="text-[0.7rem] text-[var(--color-dim)] mt-1"
                                            style={{ fontFamily: 'var(--font-mono)' }}>
                                            📄 {f.file}{f.line ? `:${f.line}` : ''}
                                          </div>
                                        )}
                                        {f.suggestion && (
                                          <div className="mt-2 p-2 rounded bg-[var(--color-abyss)] text-[0.7rem] text-[var(--color-signal)]"
                                            style={{ fontFamily: 'var(--font-mono)' }}>
                                            💡 {f.suggestion}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
