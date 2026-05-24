import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_ITEMS = [
  { id: 'command', label: 'COMMAND', icon: '◆' },
  { id: 'reviews', label: 'REVIEWS', icon: '◈' },
  { id: 'telemetry', label: 'TELEMETRY', icon: '◇' },
  { id: 'integrate', label: 'INTEGRATE', icon: '▣' },
];

export default function CommandBar({ activeView, onNavigate, darkMode, onToggleDark }) {
  const [time, setTime] = useState(new Date());
  const [scrolled, setScrolled] = useState(false);
  const indicatorRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const formatTime = (d) => {
    return d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'backdrop-blur-xl bg-[var(--color-void)]/80 border-b border-[var(--color-muted)]/30'
          : ''
      }`}
    >
      <div className="flex items-center justify-between px-6 lg:px-10 h-16">
        {/* ── Left: Identity ── */}
        <div className="flex items-center gap-4">
          <motion.div
            className="relative w-9 h-9 flex items-center justify-center"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Rotating outer ring */}
            <motion.div
              className="absolute inset-0 rounded-lg border border-[var(--color-signal)]/40"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            />
            {/* Inner diamond */}
            <div
              className="w-4 h-4 rotate-45 bg-[var(--color-signal)]"
              style={{ boxShadow: '0 0 16px var(--color-signal-glow)' }}
            />
          </motion.div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-[var(--color-bright)]"
              style={{ fontFamily: 'var(--font-display)' }}>
              NEXUS
            </span>
            <span className="text-[10px] tracking-[0.2em] text-[var(--color-dim)]"
              style={{ fontFamily: 'var(--font-mono)' }}>
              CODE REVIEW AI
            </span>
          </div>
        </div>

        {/* ── Center: Navigation ── */}
        <nav className="hidden md:flex items-center gap-1 relative">
          {NAV_ITEMS.map((item) => (
            <motion.button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative px-5 py-2 text-xs tracking-[0.1em] font-semibold transition-colors duration-300 rounded-sm ${
                activeView === item.id
                  ? 'text-[var(--color-signal)]'
                  : 'text-[var(--color-dim)] hover:text-[var(--color-text)]'
              }`}
              style={{ fontFamily: 'var(--font-mono)' }}
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
            >
              <span className="mr-2 opacity-60">{item.icon}</span>
              {item.label}
              {activeView === item.id && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute bottom-0 left-2 right-2 h-[2px] bg-[var(--color-signal)]"
                  style={{ boxShadow: '0 0 12px var(--color-signal-glow)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </motion.button>
          ))}
        </nav>

        {/* ── Right: System Status ── */}
        <div className="flex items-center gap-4">
          {/* Live clock */}
          <div
            className="hidden lg:block text-xs text-[var(--color-dim)] tabular-nums"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {formatTime(time)}
          </div>

          {/* Dark mode toggle */}
          <motion.button
            onClick={onToggleDark}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-[var(--color-muted)]/40 text-[var(--color-dim)] hover:text-[var(--color-signal)] hover:border-[var(--color-signal)]/40 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {darkMode ? '☀' : '☾'}
          </motion.button>

          {/* Status beacon */}
          <div className="signal-badge signal-badge--active">
            <span className="signal-badge-dot" />
            <span className="hidden sm:inline">ONLINE</span>
          </div>

          {/* Mobile menu */}
          <button
            className="md:hidden w-8 h-8 flex flex-col items-center justify-center gap-1"
            onClick={() => {
              // Simple mobile nav toggle
              const mobileNav = document.getElementById('mobile-nav');
              if (mobileNav) mobileNav.classList.toggle('hidden');
            }}
          >
            <span className="w-5 h-[1.5px] bg-[var(--color-text)]" />
            <span className="w-3 h-[1.5px] bg-[var(--color-dim)]" />
            <span className="w-5 h-[1.5px] bg-[var(--color-text)]" />
          </button>
        </div>
      </div>

      {/* ── Mobile Navigation ── */}
      <div
        id="mobile-nav"
        className="hidden md:hidden border-t border-[var(--color-muted)]/20 bg-[var(--color-void)]/95 backdrop-blur-xl"
      >
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onNavigate(item.id);
              document.getElementById('mobile-nav')?.classList.add('hidden');
            }}
            className={`w-full text-left px-6 py-3 text-xs tracking-[0.1em] font-semibold border-b border-[var(--color-muted)]/10 ${
              activeView === item.id
                ? 'text-[var(--color-signal)] bg-[var(--color-signal-glow)]'
                : 'text-[var(--color-dim)]'
            }`}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            <span className="mr-3">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </motion.header>
  );
}
