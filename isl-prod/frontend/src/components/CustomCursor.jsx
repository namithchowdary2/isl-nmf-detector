import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef   = useRef(null);
  const ringRef  = useRef(null);
  const trailsRef = useRef([]);
  const mouse    = useRef({ x: -100, y: -100 });
  const ring     = useRef({ x: -100, y: -100 });
  const clicked  = useRef(false);
  const hovering = useRef(false);
  const rafRef   = useRef(null);

  useEffect(() => {
    // Create dot
    const dot = document.createElement('div');
    dot.id = 'cursor-dot';
    Object.assign(dot.style, {
      position: 'fixed', top: 0, left: 0, pointerEvents: 'none',
      zIndex: 99999, width: '6px', height: '6px', borderRadius: '50%',
      background: '#00f0ff', boxShadow: '0 0 8px #00f0ff, 0 0 16px #00f0ff',
      transform: 'translate(-50%,-50%)', transition: 'width 0.15s, height 0.15s',
      willChange: 'transform',
    });
    document.body.appendChild(dot);
    dotRef.current = dot;

    // Create ring
    const ring_el = document.createElement('div');
    ring_el.id = 'cursor-ring';
    Object.assign(ring_el.style, {
      position: 'fixed', top: 0, left: 0, pointerEvents: 'none',
      zIndex: 99998, width: '36px', height: '36px', borderRadius: '50%',
      border: '1.5px solid rgba(0,240,255,0.6)',
      transform: 'translate(-50%,-50%)',
      willChange: 'transform',
      transition: 'width 0.2s, height 0.2s, border-color 0.2s',
    });
    document.body.appendChild(ring_el);
    ringRef.current = ring_el;

    // Trail particles
    const TRAIL_COUNT = 6;
    for (let i = 0; i < TRAIL_COUNT; i++) {
      const t = document.createElement('div');
      Object.assign(t.style, {
        position: 'fixed', top: 0, left: 0, pointerEvents: 'none',
        zIndex: 99997 - i,
        width: `${5 - i * 0.6}px`, height: `${5 - i * 0.6}px`,
        borderRadius: '50%',
        background: `rgba(0,240,255,${0.35 - i * 0.05})`,
        transform: 'translate(-50%,-50%)',
        willChange: 'transform',
      });
      document.body.appendChild(t);
      trailsRef.current.push({ el: t, x: -100, y: -100 });
    }

    // Mouse move
    const onMove = (e) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    const onDown = () => {
      clicked.current = true;
      dot.style.width  = '10px';
      dot.style.height = '10px';
      ring_el.style.width  = '50px';
      ring_el.style.height = '50px';
      ring_el.style.borderColor = 'rgba(139,92,246,0.8)';
      dot.style.background = '#8b5cf6';
      dot.style.boxShadow  = '0 0 12px #8b5cf6, 0 0 24px #8b5cf6';
    };
    const onUp = () => {
      clicked.current = false;
      dot.style.width  = hovering.current ? '10px' : '6px';
      dot.style.height = hovering.current ? '10px' : '6px';
      ring_el.style.width  = hovering.current ? '50px' : '36px';
      ring_el.style.height = hovering.current ? '50px' : '36px';
      ring_el.style.borderColor = 'rgba(0,240,255,0.6)';
      dot.style.background = '#00f0ff';
      dot.style.boxShadow  = '0 0 8px #00f0ff, 0 0 16px #00f0ff';
    };

    // Hover detection
    const onOver = (e) => {
      const el = e.target;
      if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT' ||
          el.tagName === 'LABEL' || el.closest('button') || el.closest('a') ||
          el.dataset.hover === 'true') {
        hovering.current = true;
        dot.style.width  = '10px';
        dot.style.height = '10px';
        ring_el.style.width  = '54px';
        ring_el.style.height = '54px';
        ring_el.style.borderColor = 'rgba(139,92,246,0.7)';
        dot.style.background = '#8b5cf6';
        dot.style.boxShadow  = '0 0 12px #8b5cf6, 0 0 24px #8b5cf6';
      }
    };
    const onOut = () => {
      if (!clicked.current) {
        hovering.current = false;
        dot.style.width  = '6px';
        dot.style.height = '6px';
        ring_el.style.width  = '36px';
        ring_el.style.height = '36px';
        ring_el.style.borderColor = 'rgba(0,240,255,0.6)';
        dot.style.background = '#00f0ff';
        dot.style.boxShadow  = '0 0 8px #00f0ff, 0 0 16px #00f0ff';
      }
    };

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup',   onUp);
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout',  onOut);

    // Lag-follow animation
    const TRAIL_DELAYS = [0.08, 0.12, 0.16, 0.20, 0.24, 0.28];

    const animate = () => {
      // Dot snaps directly
      dot.style.transform = `translate(calc(${mouse.current.x}px - 50%), calc(${mouse.current.y}px - 50%))`;

      // Ring lags
      ring.current.x += (mouse.current.x - ring.current.x) * 0.12;
      ring.current.y += (mouse.current.y - ring.current.y) * 0.12;
      ring_el.style.transform = `translate(calc(${ring.current.x}px - 50%), calc(${ring.current.y}px - 50%))`;

      // Trails
      let prev = mouse.current;
      trailsRef.current.forEach((t, i) => {
        t.x += (prev.x - t.x) * (0.28 - i * 0.035);
        t.y += (prev.y - t.y) * (0.28 - i * 0.035);
        t.el.style.transform = `translate(calc(${t.x}px - 50%), calc(${t.y}px - 50%))`;
        prev = { x: t.x, y: t.y };
      });

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup',   onUp);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout',  onOut);
      dot.remove();
      ring_el.remove();
      trailsRef.current.forEach(t => t.el.remove());
    };
  }, []);

  return null;
}
