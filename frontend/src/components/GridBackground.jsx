import { useEffect, useRef } from 'react';

/**
 * Animated grid background — futuristic HUD style
 * Renders a perspective grid with moving scan lines and particles
 */
export default function GridBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let time = 0;
    let mouseX = 0.5;
    let mouseY = 0.5;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const handleMouse = (e) => {
      mouseX = e.clientX / window.innerWidth;
      mouseY = e.clientY / window.innerHeight;
    };
    window.addEventListener('mousemove', handleMouse);

    // Particle system
    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0003,
      vy: (Math.random() - 0.5) * 0.0003,
      size: Math.random() * 2 + 0.5,
      pulse: Math.random() * Math.PI * 2,
      type: Math.random() > 0.7 ? 'accent' : 'signal',
    }));

    const draw = () => {
      time += 0.004;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // ── Perspective Grid Floor ──
      const cx = w * (0.45 + mouseX * 0.1);
      const horizon = h * 0.3;
      const lineCount = 35;

      // Vertical perspective lines
      for (let i = -lineCount; i <= lineCount; i++) {
        const spread = (i / lineCount) * w * 0.9;
        const alpha = 0.02 + Math.abs(i / lineCount) * 0.015;
        ctx.strokeStyle = `rgba(0, 229, 160, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx + spread * 0.05, horizon);
        ctx.lineTo(cx + spread, h);
        ctx.stroke();
      }

      // Horizontal grid lines with parallax depth
      const hLines = 24;
      for (let i = 0; i < hLines; i++) {
        const t = (i / hLines + time * 0.25) % 1;
        const y = horizon + (h - horizon) * t * t;
        const alpha = 0.015 + t * 0.04;
        const xShrink = 1 - (1 - t) * 0.95;
        ctx.strokeStyle = `rgba(0, 229, 160, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx - w * xShrink * 0.5, y);
        ctx.lineTo(cx + w * xShrink * 0.5, y);
        ctx.stroke();
      }

      // ── Top hex grid pattern ──
      const hexSize = 30;
      const hexH = hexSize * Math.sqrt(3);
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < Math.ceil(w / (hexSize * 3)) + 1; col++) {
          const offsetX = row % 2 === 0 ? 0 : hexSize * 1.5;
          const hx = col * hexSize * 3 + offsetX;
          const hy = row * hexH * 0.5 + 20;
          const distToMouse = Math.hypot(hx / w - mouseX, hy / h - mouseY);
          const alpha = Math.max(0, 0.04 - distToMouse * 0.06);
          if (alpha > 0.005) {
            ctx.strokeStyle = `rgba(192, 132, 252, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            for (let s = 0; s < 6; s++) {
              const angle = (Math.PI / 3) * s - Math.PI / 6;
              const px = hx + hexSize * 0.4 * Math.cos(angle);
              const py = hy + hexSize * 0.4 * Math.sin(angle);
              if (s === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
          }
        }
      }

      // ── Floating Particles ──
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += 0.02;

        // Wrap around
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1;
        if (p.y > 1) p.y = 0;

        // Gentle attraction to mouse
        p.vx += (mouseX - p.x) * 0.00001;
        p.vy += (mouseY - p.y) * 0.00001;

        const px = p.x * w;
        const py = p.y * h;
        const size = p.size * (0.8 + Math.sin(p.pulse) * 0.3);
        const alpha = 0.12 + Math.sin(p.pulse) * 0.08;

        if (p.type === 'accent') {
          ctx.fillStyle = `rgba(192, 132, 252, ${alpha})`;
        } else {
          ctx.fillStyle = `rgba(0, 229, 160, ${alpha})`;
        }
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        ctx.fillStyle = p.type === 'accent'
          ? `rgba(192, 132, 252, ${alpha * 0.2})`
          : `rgba(0, 229, 160, ${alpha * 0.2})`;
        ctx.beginPath();
        ctx.arc(px, py, size * 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // ── Connect nearby particles ──
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = (particles[i].x - particles[j].x) * w;
          const dy = (particles[i].y - particles[j].y) * h;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const alpha = (1 - dist / 150) * 0.05;
            ctx.strokeStyle = `rgba(0, 229, 160, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x * w, particles[i].y * h);
            ctx.lineTo(particles[j].x * w, particles[j].y * h);
            ctx.stroke();
          }
        }
      }

      // ── Scan line effect ──
      const scanY = ((time * 60) % (h + 300)) - 150;
      const scanGrad = ctx.createLinearGradient(0, scanY - 50, 0, scanY + 50);
      scanGrad.addColorStop(0, 'rgba(0, 229, 160, 0)');
      scanGrad.addColorStop(0.5, 'rgba(0, 229, 160, 0.035)');
      scanGrad.addColorStop(1, 'rgba(0, 229, 160, 0)');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 50, w, 100);

      // ── Corner HUD decorations ──
      ctx.strokeStyle = 'rgba(0, 229, 160, 0.12)';
      ctx.lineWidth = 1;

      // Top-left bracket
      ctx.beginPath();
      ctx.moveTo(20, 60);
      ctx.lineTo(20, 20);
      ctx.lineTo(60, 20);
      ctx.stroke();

      // Top-right bracket
      ctx.beginPath();
      ctx.moveTo(w - 60, 20);
      ctx.lineTo(w - 20, 20);
      ctx.lineTo(w - 20, 60);
      ctx.stroke();

      // Bottom-left bracket
      ctx.beginPath();
      ctx.moveTo(20, h - 60);
      ctx.lineTo(20, h - 20);
      ctx.lineTo(60, h - 20);
      ctx.stroke();

      // Bottom-right bracket
      ctx.beginPath();
      ctx.moveTo(w - 60, h - 20);
      ctx.lineTo(w - 20, h - 20);
      ctx.lineTo(w - 20, h - 60);
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ opacity: 0.7 }}
    />
  );
}
