import { motion } from 'framer-motion';

/**
 * HUD-style panel with animated corner brackets
 */
export default function HudPanel({
  children,
  className = '',
  corners = true,
  glow = false,
  delay = 0,
  ...props
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay, ease: [0.4, 0, 0.2, 1] }}
      className={`panel relative rounded-lg ${className}`}
      {...props}
    >
      {corners && (
        <>
          <span className="panel-corner panel-corner--tl" />
          <span className="panel-corner panel-corner--tr" />
          <span className="panel-corner panel-corner--bl" />
          <span className="panel-corner panel-corner--br" />
        </>
      )}
      {glow && (
        <div
          className="absolute -inset-px rounded-lg pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, var(--color-signal-glow), transparent 50%, var(--color-accent-glow))',
            filter: 'blur(20px)',
            opacity: 0.3,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
