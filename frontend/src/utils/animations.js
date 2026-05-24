// Animation presets for Framer Motion — reusable across all components
export const ease = {
  smooth: [0.4, 0, 0.2, 1],
  bounce: [0.68, -0.55, 0.265, 1.55],
  snap: [0.25, 0.46, 0.45, 0.94],
  cinematic: [0.76, 0, 0.24, 1],
};

// Stagger children container
export const stagger = (staggerMs = 0.08, delayMs = 0) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: staggerMs,
      delayChildren: delayMs,
    },
  },
});

// Fade + slide from direction
export const slideIn = (direction = 'up', distance = 30) => {
  const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';
  const sign = direction === 'down' || direction === 'right' ? -1 : 1;
  return {
    hidden: { opacity: 0, [axis]: sign * distance },
    visible: {
      opacity: 1,
      [axis]: 0,
      transition: { duration: 0.6, ease: ease.smooth },
    },
  };
};

// Scale in with blur
export const scaleIn = {
  hidden: { opacity: 0, scale: 0.9, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: ease.smooth },
  },
};

// Cinematic text reveal
export const textReveal = {
  hidden: { opacity: 0, y: 40, skewY: 3 },
  visible: {
    opacity: 1,
    y: 0,
    skewY: 0,
    transition: { duration: 0.8, ease: ease.cinematic },
  },
};

// Counter animation (for stat numbers)
export const countUp = (end, duration = 1.5) => ({
  from: 0,
  to: end,
  duration,
  ease: ease.smooth,
});

// Magnetic hover effect helper
export const magneticHover = {
  whileHover: { scale: 1.03 },
  whileTap: { scale: 0.97 },
  transition: { type: 'spring', stiffness: 400, damping: 17 },
};

// Viewport-triggered animation
export const viewport = {
  once: true,
  amount: 0.3,
  margin: '-50px',
};

// Panel entrance
export const panelReveal = (delay = 0) => ({
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      delay,
      ease: ease.smooth,
    },
  },
});

// Glitch text variant
export const glitchText = {
  animate: {
    textShadow: [
      '2px 0 #00e5a0, -2px 0 #c084fc',
      '-2px 0 #00e5a0, 2px 0 #ff5577',
      '0 0 #00e5a0, 0 0 #c084fc',
      '2px 0 #ff5577, -2px 0 #00e5a0',
      '2px 0 #00e5a0, -2px 0 #c084fc',
    ],
    transition: {
      duration: 0.5,
      repeat: Infinity,
      repeatDelay: 4,
    },
  },
};
