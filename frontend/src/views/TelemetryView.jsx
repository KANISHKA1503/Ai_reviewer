import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchEvents } from '../utils/api';

// Mini activity sparkline
function Sparkline({ data = [], color = 'var(--color-signal)' }) {
  const points = data.length > 0 ? data : Array.from({ length: 20 }, () => Math.random());
  const max = Math.max(...points, 1);
  const w = 200;
  const h = 40;

  const pathD = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - (v / max) * h * 0.8 - h * 0.1;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="opacity-60">
      <defs>
        <linearGradient id="spark-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${pathD} L ${w} ${h} L 0 ${h} Z`} fill="url(#spark-gradient)" />
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
      />
    </svg>
  );
}

export default function TelemetryView() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const feedRef = useRef(null);

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadEvents = async () => {
    try {
      const data = await fetchEvents();
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type) => {
    if (type?.includes('pull_request')) return '⬡';
    if (type?.includes('merge')) return '⬢';
    if (type?.includes('push')) return '◆';
    return '◇';
  };

  const getEventColor = (type) => {
    if (type?.includes('pull_request')) return 'var(--color-signal)';
    if (type?.includes('merge')) return 'var(--color-accent)';
    if (type?.includes('push')) return 'var(--color-info)';
    return 'var(--color-dim)';
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Compute activity distribution
  const platformCounts = events.reduce((acc, e) => {
    acc[e.platform || 'unknown'] = (acc[e.platform || 'unknown'] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen pt-20 px-4 lg:px-10 pb-16">
      <div className="max-w-6xl mx-auto">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="text-label text-[var(--color-signal)] flex items-center gap-2 mb-2">
            <span className="w-8 h-px bg-[var(--color-signal)]" />
            SYSTEM TELEMETRY
          </div>
          <h2 className="text-editorial text-3xl lg:text-4xl text-[var(--color-white)] mb-3">
            Webhook Console
          </h2>
          <p className="text-sm text-[var(--color-dim)] max-w-xl">
            Real-time monitoring of all incoming webhook events from connected repositories.
          </p>
        </motion.div>

        {/* ── Telemetry Dashboard Row ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
        >
          {/* Total events */}
          <div className="panel rounded-xl p-5 border border-[var(--color-muted)]/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-label">TOTAL EVENTS</span>
              <span className="text-[var(--color-signal)] text-xs">◆</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-bright)]"
              style={{ fontFamily: 'var(--font-display)' }}>
              {events.length}
            </div>
            <div className="mt-3">
              <Sparkline color="var(--color-signal)" />
            </div>
          </div>

          {/* Platform split */}
          <div className="panel rounded-xl p-5 border border-[var(--color-muted)]/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-label">PLATFORMS</span>
              <span className="text-[var(--color-accent)] text-xs">◈</span>
            </div>
            <div className="space-y-2">
              {Object.entries(platformCounts).map(([platform, count]) => (
                <div key={platform} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      platform === 'github' ? 'bg-[var(--color-signal)]' : 'bg-[var(--color-accent)]'
                    }`} />
                    <span className="text-xs text-[var(--color-text)] capitalize"
                      style={{ fontFamily: 'var(--font-mono)' }}>
                      {platform}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[var(--color-bright)]"
                    style={{ fontFamily: 'var(--font-display)' }}>
                    {count}
                  </span>
                </div>
              ))}
              {Object.keys(platformCounts).length === 0 && (
                <span className="text-xs text-[var(--color-muted)]">No data yet</span>
              )}
            </div>
          </div>

          {/* Connection status */}
          <div className="panel rounded-xl p-5 border border-[var(--color-muted)]/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-label">CONNECTION</span>
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-[var(--color-signal)] text-xs"
              >
                ●
              </motion.span>
            </div>
            <div className="text-lg font-bold text-[var(--color-signal)]"
              style={{ fontFamily: 'var(--font-display)' }}>
              LISTENING
            </div>
            <p className="text-xs text-[var(--color-dim)] mt-1"
              style={{ fontFamily: 'var(--font-mono)' }}>
              Polling every 5s
            </p>
            <div className="mt-3 flex gap-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ scaleY: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, delay: i * 0.15, repeat: Infinity }}
                  className="w-2 h-6 rounded-sm bg-[var(--color-signal)]/40"
                  style={{ transformOrigin: 'bottom' }}
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Terminal-style feed ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="panel rounded-2xl overflow-hidden"
        >
          {/* Terminal header bar */}
          <div className="px-5 py-3 border-b border-[var(--color-muted)]/15 flex items-center justify-between bg-[var(--color-deep)]/50">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-danger)]/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-warn)]/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-signal)]/80" />
              </div>
              <span className="text-xs text-[var(--color-dim)]"
                style={{ fontFamily: 'var(--font-mono)' }}>
                telemetry-stream.log
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[var(--color-muted)] tracking-wider"
                style={{ fontFamily: 'var(--font-mono)' }}>
                {events.length} entries
              </span>
              <div className="flex items-center gap-1.5">
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-[var(--color-signal)]"
                />
                <span className="text-[10px] text-[var(--color-dim)] tracking-[0.15em]"
                  style={{ fontFamily: 'var(--font-mono)' }}>
                  LIVE
                </span>
              </div>
            </div>
          </div>

          {/* Event feed */}
          <div
            ref={feedRef}
            className="max-h-[55vh] overflow-y-auto p-2"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
          >
            {events.length === 0 ? (
              <div className="py-20 text-center">
                <motion.div
                  animate={{ opacity: [0.2, 0.6, 0.2], scale: [0.95, 1.05, 0.95] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="text-3xl mb-6 inline-block"
                >
                  ◈
                </motion.div>
                <p className="text-[var(--color-dim)] text-sm mb-1">
                  Waiting for webhook events...
                </p>
                <p className="text-[var(--color-muted)] text-xs">
                  Configure webhooks in the Integration tab to start receiving events
                </p>
              </div>
            ) : (
              <AnimatePresence>
                {events.map((event, i) => (
                  <motion.div
                    key={event.id || i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    className="group flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-surface)]/20 transition-all duration-200 cursor-pointer"
                    onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                  >
                    {/* Line number */}
                    <span className="text-[var(--color-muted)]/40 w-6 text-right flex-shrink-0 select-none text-[0.7rem]">
                      {String(i + 1).padStart(2, '0')}
                    </span>

                    {/* Timestamp */}
                    <span className="text-[var(--color-muted)] whitespace-nowrap flex-shrink-0">
                      <span className="text-[var(--color-muted)]/50">{formatDate(event.created_at)}</span>
                      {' '}
                      {formatTime(event.created_at)}
                    </span>

                    {/* Separator */}
                    <span className="text-[var(--color-muted)]/20 flex-shrink-0">│</span>

                    {/* Event icon */}
                    <span style={{ color: getEventColor(event.event_type) }} className="flex-shrink-0">
                      {getEventIcon(event.event_type)}
                    </span>

                    {/* Platform badge */}
                    <span className={`px-1.5 py-0.5 rounded text-[0.65rem] uppercase tracking-wider flex-shrink-0 ${
                      event.platform === 'github'
                        ? 'bg-[var(--color-surface)]/60 text-[var(--color-text)]'
                        : 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    }`}>
                      {event.platform}
                    </span>

                    {/* Event detail */}
                    <span className="text-[var(--color-text)] flex-1 truncate group-hover:text-[var(--color-bright)] transition-colors">
                      {event.payload_summary || event.event_type}
                    </span>

                    {/* Hover indicator */}
                    <span className="text-[var(--color-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      ›
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}

            {/* Blinking terminal cursor */}
            <div className="flex items-center gap-2 px-3 py-2 text-[var(--color-dim)]">
              <span className="text-[var(--color-signal)]/60">$</span>
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.7, repeat: Infinity }}
                className="w-1.5 h-4 bg-[var(--color-signal)]"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
