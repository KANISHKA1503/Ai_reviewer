import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import HudPanel from '../components/HudPanel';
import { HexStat, ScoreRing, AnimatedNumber } from '../components/DataViz';
import { fetchStats, fetchReviews, triggerReview } from '../utils/api';
import { stagger, slideIn, textReveal } from '../utils/animations';

// Kinetic text component — letters animate in individually
function KineticText({ text, className = '', delay = 0 }) {
  return (
    <span className={className} aria-label={text}>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 30, rotateX: -90 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{
            duration: 0.5,
            delay: delay + i * 0.03,
            ease: [0.4, 0, 0.2, 1],
          }}
          className="inline-block"
          style={{ transformOrigin: 'bottom' }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </span>
  );
}

// Magnetic button wrapper
function MagneticButton({ children, className = '', ...props }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleMouse = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - rect.width / 2) * 0.15;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.15;
    setPos({ x, y });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Orbiting ring decoration
function OrbitRing({ size = 200, duration = 20, color = 'var(--color-signal)', delay = 0 }) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ width: size, height: size }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.5, delay }}
    >
      <motion.div
        className="w-full h-full rounded-full"
        style={{
          border: `1px solid ${color}`,
          opacity: 0.15,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      />
      {/* Orbiting dot */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 12px ${color}` }}
        animate={{ rotate: 360 }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      />
    </motion.div>
  );
}

export default function CommandView() {
  const [stats, setStats] = useState(null);
  const [recentReviews, setRecentReviews] = useState([]);
  const [prUrl, setPrUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null);
  const [inputFocused, setInputFocused] = useState(false);
  const heroRef = useRef(null);

  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0.7]);
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.97]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statsData, reviewsData] = await Promise.all([
        fetchStats(),
        fetchReviews(8),
      ]);
      setStats(statsData);
      setRecentReviews(reviewsData);
    } catch (err) {
      // Backend might not be running — show empty state
      console.error('Failed to load data:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prUrl.trim() || submitting) return;
    setSubmitting(true);
    try {
      const result = await triggerReview(prUrl);
      setToast({ type: 'success', message: result.message || 'Review queued successfully' });
      setPrUrl('');
      setTimeout(loadData, 2000);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'complete': return 'var(--color-signal)';
      case 'analyzing': return 'var(--color-info)';
      case 'error': return 'var(--color-danger)';
      default: return 'var(--color-dim)';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-[var(--color-signal)]';
    if (score >= 60) return 'text-[var(--color-info)]';
    if (score >= 40) return 'text-[var(--color-warn)]';
    return 'text-[var(--color-danger)]';
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="min-h-screen pt-16 px-4 lg:px-10 pb-16">
      {/* ── Toast notification ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-20 left-1/2 z-[60] px-6 py-3 rounded-lg text-sm font-medium backdrop-blur-md"
            style={{
              fontFamily: 'var(--font-mono)',
              background: toast.type === 'success' ? 'var(--color-signal)' : 'var(--color-danger)',
              color: 'var(--color-void)',
              boxShadow: `0 8px 32px ${toast.type === 'success' ? 'var(--color-signal-glow)' : 'var(--color-danger-glow)'}`,
            }}
          >
            {toast.type === 'success' ? '✓ ' : '✕ '}{toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════
          HERO: Immersive asymmetric split layout
          ═══════════════════════════════════════ */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="max-w-7xl mx-auto mb-20 pt-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start relative">

          {/* ── Decorative orbit rings behind hero ── */}
          <div className="absolute -top-20 -left-20 hidden lg:block">
            <OrbitRing size={300} duration={30} color="var(--color-signal)" delay={0.5} />
          </div>
          <div className="absolute -top-10 right-40 hidden lg:block">
            <OrbitRing size={160} duration={18} color="var(--color-accent)" delay={0.8} />
          </div>

          {/* ══ Left Column: Editorial Title + Stats ══ */}
          <div className="lg:col-span-7 space-y-10 relative z-10">
            
            {/* ── System status bar ── */}
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-[var(--color-muted)]/20 bg-[var(--color-deep)]/40 backdrop-blur-sm"
            >
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-signal)] animate-pulse" />
                <span className="text-[10px] tracking-[0.15em] text-[var(--color-signal)] font-semibold"
                  style={{ fontFamily: 'var(--font-mono)' }}>
                  SYSTEM ACTIVE
                </span>
              </span>
              <span className="w-px h-3 bg-[var(--color-muted)]/30" />
              <span className="text-[10px] tracking-[0.1em] text-[var(--color-dim)]"
                style={{ fontFamily: 'var(--font-mono)' }}>
                v1.0.0-nexus
              </span>
            </motion.div>

            {/* ── Cinematic Title with Kinetic Typography ── */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-label text-[var(--color-signal)] flex items-center gap-3"
              >
                <span className="w-12 h-px bg-gradient-to-r from-[var(--color-signal)] to-transparent" />
                AUTONOMOUS CODE INTELLIGENCE
              </motion.div>

              <h1 className="text-editorial text-[clamp(2.5rem,6vw,4.5rem)] text-[var(--color-white)] leading-[1.05]">
                <KineticText text="Every commit," delay={0.4} />
                <br />
                <span className="relative inline-block">
                  <KineticText text="reviewed" delay={0.8} className="text-[var(--color-signal)]" />
                  {/* Glow underline */}
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.8, delay: 1.4, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute -bottom-2 left-0 right-0 h-[2px] origin-left"
                    style={{
                      background: 'linear-gradient(90deg, var(--color-signal), transparent)',
                      boxShadow: '0 0 20px var(--color-signal-glow)',
                    }}
                  />
                </span>
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1 }}
                className="text-base lg:text-lg text-[var(--color-dim)] max-w-xl leading-relaxed"
              >
                Deep AI analysis of pull requests in real-time. 
                Security vulnerabilities, code quality issues, and performance 
                bottlenecks — <span className="text-[var(--color-text)]">caught before merge</span>.
              </motion.p>
            </div>

            {/* ── Hexagonal Stats — Non-standard layout with stagger ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="flex flex-wrap gap-6 lg:gap-10"
            >
              <HexStat
                label="REVIEWS"
                value={stats?.total_reviews || 0}
                icon="◆"
                color="var(--color-signal)"
                delay={1.3}
              />
              <HexStat
                label="ISSUES"
                value={stats?.total_findings || 0}
                icon="▲"
                color="var(--color-warn)"
                delay={1.4}
              />
              <HexStat
                label="CLEAN"
                value={stats?.high_quality || 0}
                icon="●"
                color="var(--color-info)"
                delay={1.5}
              />
              <HexStat
                label="AVG SCORE"
                value={stats?.avg_score || 0}
                icon="◈"
                color="var(--color-accent)"
                delay={1.6}
              />
            </motion.div>
          </div>

          {/* ══ Right Column: Review Launcher — Floating panel ══ */}
          <div className="lg:col-span-5 lg:mt-16 relative z-10">
            <HudPanel className="p-0 rounded-2xl overflow-hidden" glow delay={0.6}>
              {/* Panel accent bar */}
              <div className="h-[2px] w-full" style={{
                background: 'linear-gradient(90deg, var(--color-signal), var(--color-accent), var(--color-signal))',
                backgroundSize: '200% 100%',
                animation: 'border-flow 3s linear infinite',
              }} />

              <div className="p-6 space-y-5">
                {/* Panel header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2
                      className="text-base font-bold text-[var(--color-bright)] tracking-tight"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      Review Launcher
                    </h2>
                    <p className="text-label mt-1">INITIATE ANALYSIS SEQUENCE</p>
                  </div>
                  <motion.div 
                    className="w-10 h-10 rounded-xl bg-[var(--color-signal)]/8 border border-[var(--color-signal)]/15 flex items-center justify-center"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                      className="text-[var(--color-signal)] text-lg"
                    >
                      ◈
                    </motion.span>
                  </motion.div>
                </div>

                {/* Animated divider */}
                <div className="relative h-px bg-[var(--color-muted)]/15 overflow-hidden">
                  <motion.div
                    className="absolute top-0 left-0 h-full bg-[var(--color-signal)]"
                    initial={{ width: '0%' }}
                    animate={{ width: '45%' }}
                    transition={{ duration: 1.2, delay: 0.8, ease: [0.4, 0, 0.2, 1] }}
                  />
                  <motion.div
                    className="absolute top-0 h-full w-12 bg-gradient-to-r from-transparent via-[var(--color-signal)]/50 to-transparent"
                    animate={{ x: ['-100%', '400%'] }}
                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                  />
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-label block">TARGET PR URL</label>
                    <div className={`relative rounded-lg transition-all duration-300 ${
                      inputFocused ? 'ring-1 ring-[var(--color-signal)]/30' : ''
                    }`}>
                      <input
                        type="url"
                        value={prUrl}
                        onChange={(e) => setPrUrl(e.target.value)}
                        onFocus={() => setInputFocused(true)}
                        onBlur={() => setInputFocused(false)}
                        placeholder="https://github.com/owner/repo/pull/123"
                        className="input-hud pr-10"
                        required
                      />
                      {prUrl && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-signal)] text-xs"
                        >
                          ✓
                        </motion.span>
                      )}
                    </div>
                  </div>

                  <MagneticButton>
                    <motion.button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary w-full group relative overflow-hidden"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {submitting ? (
                        <div className="flex items-center gap-2">
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                          >
                            ◈
                          </motion.span>
                          <span>ANALYZING...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">▶</span>
                          <span>EXECUTE REVIEW</span>
                        </div>
                      )}
                    </motion.button>
                  </MagneticButton>
                </form>

                {/* System readout */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-muted)]/10">
                  <div className="flex items-center gap-2 text-xs text-[var(--color-dim)]"
                    style={{ fontFamily: 'var(--font-mono)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-signal)] animate-pulse" />
                    Gemini AI active
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]"
                    style={{ fontFamily: 'var(--font-mono)' }}>
                    <span>◆</span>
                    <span>GitHub + GitLab</span>
                  </div>
                </div>
              </div>
            </HudPanel>

            {/* ── Quick stat cards below launcher — Asymmetric sizes ── */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="panel rounded-xl p-4 border border-[var(--color-muted)]/10"
              >
                <div className="text-label mb-1">THREAT LEVEL</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-[var(--color-signal)]"
                    style={{ fontFamily: 'var(--font-display)' }}>
                    LOW
                  </span>
                </div>
                <div className="mt-2 h-1 rounded-full bg-[var(--color-muted)]/20 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[var(--color-signal)]"
                    initial={{ width: 0 }}
                    animate={{ width: '25%' }}
                    transition={{ duration: 1, delay: 1.5 }}
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 }}
                className="panel rounded-xl p-4 border border-[var(--color-muted)]/10"
              >
                <div className="text-label mb-1">UPTIME</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-[var(--color-accent)]"
                    style={{ fontFamily: 'var(--font-display)' }}>
                    99.9
                  </span>
                  <span className="text-xs text-[var(--color-dim)]">%</span>
                </div>
                <div className="mt-2 flex gap-0.5">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: 1.5 + i * 0.05 }}
                      className="flex-1 h-3 rounded-sm bg-[var(--color-signal)]/30"
                      style={{ 
                        background: i > 9 ? 'var(--color-signal)' : 'var(--color-signal)',
                        opacity: 0.2 + (i / 12) * 0.8,
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════
          ACTIVITY STREAM — with section transition
          ═══════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto">
        {/* ── Diagonal section separator ── */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          className="relative h-20 mb-8"
        >
          <div className="absolute inset-0 flex items-center">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--color-muted)]/30 to-transparent" />
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4 px-6 bg-[var(--color-void)]">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              className="text-[var(--color-signal)]/40 text-sm"
            >
              ◈
            </motion.span>
            <span className="text-label text-[var(--color-signal)]">ACTIVITY STREAM</span>
            <motion.span
              animate={{ rotate: -360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              className="text-[var(--color-accent)]/40 text-sm"
            >
              ◈
            </motion.span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6 }}
        >
          <HudPanel className="rounded-2xl overflow-hidden" delay={0}>
            {/* Table header */}
            <div className="px-6 py-4 border-b border-[var(--color-muted)]/15 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[var(--color-signal)]" 
                  style={{ boxShadow: '0 0 8px var(--color-signal-glow)' }} />
                <h3
                  className="text-sm font-bold text-[var(--color-bright)]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Recent Reviews
                </h3>
                <span className="px-2 py-0.5 rounded bg-[var(--color-surface)]/60 text-xs text-[var(--color-dim)]"
                  style={{ fontFamily: 'var(--font-mono)' }}>
                  <AnimatedNumber value={recentReviews.length} />
                </span>
              </div>
              <div className="flex items-center gap-2">
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-[var(--color-info)]"
                />
                <span className="text-label">LIVE FEED</span>
              </div>
            </div>

            {/* Custom row design */}
            <div className="divide-y divide-[var(--color-muted)]/8">
              {recentReviews.length === 0 ? (
                <div className="px-6 py-20 text-center">
                  <motion.div
                    animate={{ y: [0, -10, 0], rotate: [0, 180, 360] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="text-4xl mb-6 inline-block opacity-20"
                  >
                    ◇
                  </motion.div>
                  <p className="text-[var(--color-dim)] text-sm mb-2">No reviews yet</p>
                  <p className="text-[var(--color-muted)] text-xs">
                    Launch your first analysis using the Review Launcher above
                  </p>
                </div>
              ) : (
                recentReviews.map((review, i) => (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.4 }}
                    className="group relative"
                  >
                    {/* Main row */}
                    <div
                      className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-[var(--color-surface)]/30 transition-all duration-300"
                      onClick={() => setSelectedReview(selectedReview?.id === review.id ? null : review)}
                    >
                      {/* Animated severity line */}
                      <motion.div
                        className="w-[3px] h-10 rounded-full flex-shrink-0"
                        style={{ background: getStatusColor(review.status) }}
                        whileHover={{ height: 48, boxShadow: `0 0 12px ${getStatusColor(review.status)}` }}
                      />

                      {/* PR info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-[var(--color-bright)] truncate group-hover:text-[var(--color-white)] transition-colors">
                            {review.pr_title || `PR #${review.pr_number}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[var(--color-dim)]"
                          style={{ fontFamily: 'var(--font-mono)' }}>
                          <span className="truncate max-w-[200px]">{review.repo_full_name}</span>
                          <span className="text-[var(--color-muted)]">•</span>
                          <span>#{review.pr_number}</span>
                          {review.pr_author && (
                            <>
                              <span className="text-[var(--color-muted)]">•</span>
                              <span className="text-[var(--color-accent)]/70">@{review.pr_author}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status badge */}
                      <div className={`signal-badge signal-badge--${
                        review.status === 'complete' ? 'active' :
                        review.status === 'analyzing' ? 'info' :
                        review.status === 'error' ? 'danger' : 'info'
                      }`}>
                        {review.status === 'analyzing' && <span className="signal-badge-dot" />}
                        {review.status?.toUpperCase()}
                      </div>

                      {/* Score */}
                      {review.score != null && (
                        <div className={`text-lg font-bold tabular-nums ${getScoreColor(review.score)}`}
                          style={{ fontFamily: 'var(--font-display)', minWidth: '2.5ch', textAlign: 'right' }}>
                          {review.score}
                        </div>
                      )}

                      {/* Time */}
                      <div className="text-xs text-[var(--color-muted)] hidden sm:block min-w-[5rem] text-right tabular-nums"
                        style={{ fontFamily: 'var(--font-mono)' }}>
                        {timeAgo(review.analyzed_at || review.created_at)}
                      </div>

                      {/* Expand indicator */}
                      <motion.span
                        animate={{ rotate: selectedReview?.id === review.id ? 90 : 0 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                        className="text-[var(--color-dim)] group-hover:text-[var(--color-text)] text-xs transition-colors"
                      >
                        ▸
                      </motion.span>
                    </div>

                    {/* Hover accent line */}
                    <motion.div
                      className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--color-signal)] opacity-0 group-hover:opacity-30 transition-opacity"
                    />
                  </motion.div>
                ))
              )}
            </div>

            {/* Expandable findings detail */}
            <AnimatePresence>
              {selectedReview && selectedReview.findings?.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  className="border-t border-[var(--color-signal)]/15 bg-[var(--color-abyss)]/80 overflow-hidden"
                >
                  <div className="p-6 space-y-3">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-label text-[var(--color-signal)]">◆ FINDINGS</span>
                      <span className="text-xs text-[var(--color-dim)]"
                        style={{ fontFamily: 'var(--font-mono)' }}>
                        {selectedReview.findings.length} issue{selectedReview.findings.length !== 1 ? 's' : ''} detected
                      </span>
                      <div className="flex-1 h-px bg-[var(--color-muted)]/10" />
                    </div>
                    {selectedReview.findings.slice(0, 5).map((finding, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-deep)]/50 border border-[var(--color-muted)]/5 hover:border-[var(--color-muted)]/15 transition-colors"
                      >
                        <div className={`severity-line h-auto self-stretch severity-line--${finding.severity || 'medium'}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-bold text-[var(--color-bright)]">{finding.category || 'Issue'}</span>
                            <span className={`signal-badge signal-badge--${
                              finding.severity === 'critical' || finding.severity === 'high' ? 'danger' :
                              finding.severity === 'medium' ? 'warn' : 'info'
                            }`} style={{ fontSize: '0.6rem', padding: '2px 8px' }}>
                              {finding.severity?.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--color-text)] leading-relaxed">{finding.description}</p>
                          {finding.file && (
                            <span className="text-[0.7rem] text-[var(--color-dim)] mt-1 block"
                              style={{ fontFamily: 'var(--font-mono)' }}>
                              📄 {finding.file}{finding.line ? `:${finding.line}` : ''}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {selectedReview.findings.length > 5 && (
                      <div className="text-center pt-2">
                        <span className="text-xs text-[var(--color-dim)]">
                          +{selectedReview.findings.length - 5} more findings
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </HudPanel>
        </motion.div>
      </section>
    </div>
  );
}
