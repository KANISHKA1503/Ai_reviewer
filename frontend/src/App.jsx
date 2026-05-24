import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import GridBackground from './components/GridBackground';
import CommandBar from './components/CommandBar';
import CommandView from './views/CommandView';
import ReviewsView from './views/ReviewsView';
import TelemetryView from './views/TelemetryView';
import IntegrateView from './views/IntegrateView';

// ── Boot Sequence Screen ──
function BootSequence({ onComplete }) {
  const [lines, setLines] = useState([]);
  const bootLines = [
    { text: '> NEXUS v1.0.0 initializing...', delay: 200 },
    { text: '> Loading Gemini AI core...', delay: 400 },
    { text: '> Connecting webhook receivers...', delay: 300 },
    { text: '> GitHub integration: ACTIVE', delay: 250, color: 'var(--color-signal)' },
    { text: '> GitLab integration: ACTIVE', delay: 250, color: 'var(--color-signal)' },
    { text: '> Code analysis engine: READY', delay: 300, color: 'var(--color-signal)' },
    { text: '> System online.', delay: 500, color: 'var(--color-signal-bright)' },
  ];

  useEffect(() => {
    let timeout;
    let currentDelay = 300;

    bootLines.forEach((line, i) => {
      currentDelay += line.delay;
      timeout = setTimeout(() => {
        setLines((prev) => [...prev, line]);
      }, currentDelay);
    });

    // Complete after all lines
    const totalDelay = bootLines.reduce((sum, l) => sum + l.delay, 300) + 600;
    timeout = setTimeout(onComplete, totalDelay);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <motion.div
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--color-void)]"
    >
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--color-signal-glow) 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative w-full max-w-lg px-8">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="flex items-center justify-center mb-8"
        >
          <div className="relative w-16 h-16 flex items-center justify-center">
            <motion.div
              className="absolute inset-0 rounded-xl border border-[var(--color-signal)]/30"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute inset-2 rounded-lg border border-[var(--color-accent)]/20"
              animate={{ rotate: -360 }}
              transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            />
            <div className="w-6 h-6 rotate-45 bg-[var(--color-signal)]"
              style={{ boxShadow: '0 0 24px var(--color-signal-glow)' }} />
          </div>
        </motion.div>

        {/* Boot text */}
        <div className="space-y-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
          {lines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              style={{ color: line.color || 'var(--color-dim)' }}
            >
              {line.text}
            </motion.div>
          ))}
          {/* Blinking cursor */}
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
            className="inline-block w-2 h-4 bg-[var(--color-signal)] mt-1"
          />
        </div>

        {/* Progress bar */}
        <div className="mt-8 h-[2px] bg-[var(--color-muted)]/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[var(--color-signal)] to-[var(--color-accent)]"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ 
              duration: bootLines.reduce((sum, l) => sum + l.delay, 0) / 1000 + 0.3,
              ease: [0.4, 0, 0.2, 1] 
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState('command');
  const [darkMode, setDarkMode] = useState(true);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('light', !darkMode);
  }, [darkMode]);

  const viewComponents = {
    command: CommandView,
    reviews: ReviewsView,
    telemetry: TelemetryView,
    integrate: IntegrateView,
  };

  const ActiveComponent = viewComponents[activeView] || CommandView;

  return (
    <div className="relative min-h-screen">
      {/* ── Boot Sequence ── */}
      <AnimatePresence mode="wait">
        {!booted && <BootSequence onComplete={() => setBooted(true)} />}
      </AnimatePresence>

      {/* ── Ambient background layers ── */}
      <GridBackground />
      
      {/* Radial glow spots */}
      <div className="fixed top-0 right-0 w-[800px] h-[800px] pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle at 70% 20%, var(--color-signal-glow) 0%, transparent 50%)',
          opacity: 0.4,
        }}
      />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle at 30% 80%, var(--color-accent-glow) 0%, transparent 50%)',
          opacity: 0.3,
        }}
      />

      {/* ── Main content (visible after boot) ── */}
      {booted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          {/* ── Command Bar (Navigation) ── */}
          <CommandBar
            activeView={activeView}
            onNavigate={setActiveView}
            darkMode={darkMode}
            onToggleDark={() => setDarkMode((d) => !d)}
          />

          {/* ── View Content with cinematic transitions ── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, filter: 'blur(6px)' }}
              transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
              className="relative z-10"
            >
              <ActiveComponent />
            </motion.div>
          </AnimatePresence>

          {/* ── Footer — Minimal, non-standard ── */}
          <footer className="relative z-10 border-t border-[var(--color-muted)]/8 py-6 px-6 lg:px-10">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-signal)] animate-pulse" />
                <span className="text-xs text-[var(--color-dim)]"
                  style={{ fontFamily: 'var(--font-mono)' }}>
                  NEXUS v1.0 — AI Code Review System
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-[var(--color-muted)]"
                  style={{ fontFamily: 'var(--font-mono)' }}>
                  Powered by Gemini AI
                </span>
                <div className="hidden sm:flex items-center gap-1">
                  {['◆', '◈', '◇'].map((s, i) => (
                    <motion.span
                      key={i}
                      animate={{ opacity: [0.2, 0.6, 0.2] }}
                      transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
                      className="text-[8px] text-[var(--color-signal)]"
                    >
                      {s}
                    </motion.span>
                  ))}
                </div>
              </div>
            </div>
          </footer>
        </motion.div>
      )}
    </div>
  );
}
