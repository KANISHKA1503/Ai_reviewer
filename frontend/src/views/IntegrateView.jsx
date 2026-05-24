import { useState } from 'react';
import { motion } from 'framer-motion';
import HudPanel from '../components/HudPanel';

const STEPS = [
  {
    platform: 'GitHub',
    icon: '⬡',
    color: 'var(--color-signal)',
    steps: [
      { text: 'Navigate to your repository', detail: 'Settings → Webhooks → Add webhook' },
      { text: 'Set the Payload URL', detail: 'http://your-server-domain/webhook', code: true },
      { text: 'Configure Content Type', detail: 'application/json', code: true },
      { text: 'Select events', detail: 'Choose "Let me select individual events" → check Pull requests' },
      { text: 'Activate', detail: 'Check Active and submit' },
    ],
  },
  {
    platform: 'GitLab',
    icon: '⬢',
    color: 'var(--color-accent)',
    steps: [
      { text: 'Navigate to project', detail: 'Settings → Webhooks' },
      { text: 'Set URL', detail: 'http://your-server-domain/webhook', code: true },
      { text: 'Select trigger', detail: 'Check Merge request events and submit' },
    ],
  },
];

const ENDPOINTS = [
  { scope: 'Webhook Receiver', route: '/webhook', method: 'POST', format: 'JSON payload' },
  { scope: 'Manual Review', route: '/api/review', method: 'POST', format: '{"pr_url": "url"}' },
  { scope: 'Reviews List', route: '/api/reviews', method: 'GET', format: 'JSON array' },
  { scope: 'Console Telemetry', route: '/api/events', method: 'GET', format: 'JSON array' },
  { scope: 'Statistics', route: '/api/stats', method: 'GET', format: 'JSON object' },
];

export default function IntegrateView() {
  const [activePlatform, setActivePlatform] = useState(0);
  const [copiedRoute, setCopiedRoute] = useState(null);

  const copyToClipboard = (text, route) => {
    navigator.clipboard.writeText(text);
    setCopiedRoute(route);
    setTimeout(() => setCopiedRoute(null), 2000);
  };

  return (
    <div className="min-h-screen pt-20 px-4 lg:px-10 pb-16">
      <div className="max-w-6xl mx-auto">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="text-label text-[var(--color-signal)] flex items-center gap-2 mb-2">
            <span className="w-8 h-px bg-[var(--color-signal)]" />
            SYSTEM INTEGRATION
          </div>
          <h2 className="text-editorial text-3xl lg:text-4xl text-[var(--color-white)] mb-3">
            Connect Your Pipeline
          </h2>
          <p className="text-[var(--color-dim)] text-base max-w-2xl leading-relaxed">
            Wire up your repositories to enable fully automated, real-time code reviews 
            directly inside your pull requests and merge requests.
          </p>
        </motion.div>

        {/* ── Platform Selector — Split layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
          {/* Left: Platform tabs */}
          <div className="lg:col-span-4 space-y-3">
            {STEPS.map((p, i) => (
              <motion.button
                key={p.platform}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setActivePlatform(i)}
                className={`w-full text-left p-4 rounded-lg border transition-all duration-300 ${
                  activePlatform === i
                    ? 'bg-[var(--color-surface)]/60 border-[var(--color-signal)]/30'
                    : 'bg-transparent border-[var(--color-muted)]/10 hover:border-[var(--color-muted)]/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl" style={{ color: p.color }}>{p.icon}</span>
                  <div>
                    <div className="text-sm font-bold text-[var(--color-bright)]">
                      {p.platform}
                    </div>
                    <div className="text-xs text-[var(--color-dim)]">
                      {p.steps.length} steps to connect
                    </div>
                  </div>
                  {activePlatform === i && (
                    <motion.div
                      layoutId="platform-indicator"
                      className="ml-auto w-1.5 h-8 rounded-full"
                      style={{ background: p.color }}
                    />
                  )}
                </div>
              </motion.button>
            ))}
          </div>

          {/* Right: Step-by-step guide — Timeline layout */}
          <div className="lg:col-span-8">
            <HudPanel className="p-6 rounded-xl" delay={0.2}>
              <div className="space-y-6">
                {STEPS[activePlatform].steps.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-4"
                  >
                    {/* Timeline connector */}
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{
                          background: `${STEPS[activePlatform].color}20`,
                          color: STEPS[activePlatform].color,
                          border: `1px solid ${STEPS[activePlatform].color}40`,
                        }}
                      >
                        {i + 1}
                      </div>
                      {i < STEPS[activePlatform].steps.length - 1 && (
                        <div
                          className="w-px flex-1 min-h-[20px]"
                          style={{ background: `${STEPS[activePlatform].color}20` }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-2">
                      <div className="text-sm font-semibold text-[var(--color-bright)] mb-1">
                        {step.text}
                      </div>
                      {step.code ? (
                        <div className="flex items-center gap-2">
                          <code
                            className="px-3 py-1.5 rounded bg-[var(--color-abyss)] border border-[var(--color-muted)]/20 text-xs text-[var(--color-signal)]"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {step.detail}
                          </code>
                          <button
                            onClick={() => copyToClipboard(step.detail, `${activePlatform}-${i}`)}
                            className="text-xs text-[var(--color-dim)] hover:text-[var(--color-signal)] transition-colors"
                          >
                            {copiedRoute === `${activePlatform}-${i}` ? '✓' : '⧉'}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--color-dim)] leading-relaxed">{step.detail}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </HudPanel>
          </div>
        </div>

        {/* ── API Endpoints — Diagonal section ── */}
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--color-muted)]/30 to-transparent" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 bg-[var(--color-void)] text-label text-[var(--color-accent)]">
              ▣ API ENDPOINTS
            </span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <HudPanel className="rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-4 gap-4 px-6 py-3 border-b border-[var(--color-muted)]/15"
              style={{ fontFamily: 'var(--font-mono)' }}>
              <div className="text-label">SCOPE</div>
              <div className="text-label">ROUTE</div>
              <div className="text-label">METHOD</div>
              <div className="text-label">FORMAT</div>
            </div>

            {/* Rows */}
            {ENDPOINTS.map((ep, i) => (
              <motion.div
                key={ep.route}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.05 }}
                className="grid grid-cols-4 gap-4 px-6 py-3 border-b border-[var(--color-muted)]/8 hover:bg-[var(--color-surface)]/30 transition-colors group"
              >
                <div className="text-sm text-[var(--color-bright)] font-medium">
                  {ep.scope}
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-[var(--color-signal)]"
                    style={{ fontFamily: 'var(--font-mono)' }}>
                    {ep.route}
                  </code>
                  <button
                    onClick={() => copyToClipboard(ep.route, ep.route)}
                    className="opacity-0 group-hover:opacity-100 text-xs text-[var(--color-dim)] hover:text-[var(--color-signal)] transition-all"
                  >
                    {copiedRoute === ep.route ? '✓' : '⧉'}
                  </button>
                </div>
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    ep.method === 'POST'
                      ? 'bg-[var(--color-warn)]/15 text-[var(--color-warn)]'
                      : 'bg-[var(--color-info)]/15 text-[var(--color-info)]'
                  }`} style={{ fontFamily: 'var(--font-mono)' }}>
                    {ep.method}
                  </span>
                </div>
                <div className="text-xs text-[var(--color-dim)]"
                  style={{ fontFamily: 'var(--font-mono)' }}>
                  {ep.format}
                </div>
              </motion.div>
            ))}
          </HudPanel>
        </motion.div>
      </div>
    </div>
  );
}
