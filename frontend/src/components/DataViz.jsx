import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Animated counter that counts up to a target value
 */
export function AnimatedNumber({ value, duration = 1.5, decimals = 0 }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = typeof value === 'number' ? value : parseInt(value) || 0;
    const startTime = performance.now();
    const dur = duration * 1000;

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / dur, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplay(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevRef.current = end;
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{display.toFixed(decimals)}</span>;
}

/**
 * Score ring with animated SVG circle
 */
export function ScoreRing({ score, size = 120, strokeWidth = 4 }) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = Math.min(100, Math.max(0, score));
  const offset = circumference - (normalizedScore / 100) * circumference;

  const getColor = (s) => {
    if (s >= 80) return 'var(--color-signal)';
    if (s >= 60) return 'var(--color-info)';
    if (s >= 40) return 'var(--color-warn)';
    return 'var(--color-danger)';
  };

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(normalizedScore)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
          style={{
            filter: `drop-shadow(0 0 8px ${getColor(normalizedScore)})`,
          }}
        />
      </svg>
      <div className="score-ring-value">
        <AnimatedNumber value={normalizedScore} />
      </div>
    </div>
  );
}

/**
 * Hexagonal stat display — unique alternative to cards
 */
export function HexStat({ label, value, icon, color = 'var(--color-signal)', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.4, 0, 0.2, 1] }}
      className="relative group"
    >
      <div className="relative flex flex-col items-center gap-2">
        {/* Hex outline */}
        <div
          className="relative w-24 h-24 flex items-center justify-center"
          style={{
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            background: `linear-gradient(135deg, ${color}15, ${color}08)`,
          }}
        >
          <div
            className="absolute inset-[2px]"
            style={{
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              background: 'var(--color-abyss)',
            }}
          />
          <span
            className="relative z-10 text-2xl font-bold data-readout"
            style={{ color, fontFamily: 'var(--font-display)' }}
          >
            <AnimatedNumber value={value} />
          </span>
        </div>

        {/* Label */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs opacity-40">{icon}</span>
          <span className="text-label">{label}</span>
        </div>

        {/* Hover glow */}
        <motion.div
          className="absolute top-0 w-24 h-24 rounded-full pointer-events-none"
          style={{ background: color, filter: 'blur(30px)', opacity: 0 }}
          whileHover={{ opacity: 0.15 }}
        />
      </div>
    </motion.div>
  );
}
