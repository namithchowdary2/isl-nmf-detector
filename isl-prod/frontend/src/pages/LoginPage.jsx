import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Zap } from 'lucide-react';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

/* ── Animated particle field canvas ──────────────────────────────────────── */
function ParticleCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = canvas.width  = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    let raf;

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);

    // ISL hand keypoint-inspired dot clusters
    const CLUSTERS = [
      { cx: W*0.15, cy: H*0.5,  r: 120 },
      { cx: W*0.85, cy: H*0.5,  r: 120 },
      { cx: W*0.5,  cy: H*0.25, r: 80  },
      { cx: W*0.5,  cy: H*0.75, r: 80  },
    ];

    const particles = Array.from({ length: 90 }, () => {
      const cl = CLUSTERS[Math.floor(Math.random() * CLUSTERS.length)];
      const angle = Math.random() * Math.PI * 2;
      const dist  = Math.random() * cl.r;
      return {
        x:  cl.cx + Math.cos(angle) * dist,
        y:  cl.cy + Math.sin(angle) * dist,
        ox: cl.cx + Math.cos(angle) * dist,
        oy: cl.cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r:  Math.random() * 1.8 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
        hue: Math.random() > 0.6 ? 185 : 270,
      };
    });

    // Connection lines
    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i+1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d  = Math.sqrt(dx*dx + dy*dy);
          if (d < 90) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const a = (1 - d/90) * 0.12;
            ctx.strokeStyle = `hsla(${particles[i].hue},100%,70%,${a})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw dots
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fillStyle = `hsla(${p.hue},100%,72%,${p.alpha})`;
        ctx.fill();
        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI*2);
        ctx.fillStyle = `hsla(${p.hue},100%,72%,${p.alpha * 0.15})`;
        ctx.fill();
      });

      // Move particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        // Drift back toward origin
        p.vx += (p.ox - p.x) * 0.002;
        p.vy += (p.oy - p.y) * 0.002;
        // Dampen
        p.vx *= 0.98;
        p.vy *= 0.98;
      });

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} style={{ position:'fixed',inset:0,pointerEvents:'none',zIndex:0 }} />;
}

/* ── Input field ──────────────────────────────────────────────────────────── */
function Field({ label, type, value, onChange, error, placeholder, right }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display: 'block', marginBottom: 6,
        fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em',
        color: focused ? 'var(--cyan)' : 'var(--text2)',
        textTransform: 'uppercase', transition: 'color 0.2s',
      }}>
        {label}
      </label>
      <div style={{ position:'relative' }}>
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            background: focused ? 'rgba(0,240,255,0.03)' : 'var(--surface2)',
            border: `1px solid ${error ? 'var(--red)' : focused ? 'var(--cyan)' : 'var(--border2)'}`,
            borderRadius: 8,
            padding: '12px 14px',
            paddingRight: right ? '44px' : '14px',
            color: 'var(--text)',
            fontSize: 14,
            boxShadow: focused ? '0 0 0 3px rgba(0,240,255,0.08)' : 'none',
            transition: 'all 0.2s',
          }}
        />
        {right && (
          <div style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)' }}>
            {right}
          </div>
        )}
      </div>
      {error && <p style={{ color:'var(--red)', fontSize:11, marginTop:4 }}>{error}</p>}
    </div>
  );
}

/* ── Main Login page ──────────────────────────────────────────────────────── */
export default function LoginPage() {
  const [mode, setMode]       = useState('login');   // login | register
  const [showPw, setShowPw]   = useState(false);
  const [form, setForm]       = useState({ email:'', username:'', password:'', full_name:'' });
  const [fieldErrors, setFieldErrors] = useState({});

  const { login, register, loginAsGuest, isLoading } = useAuthStore();

  const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setFieldErrors({});
    if (mode === 'login') {
      const res = await login(form.email, form.password);
      if (!res.ok) toast.error(res.error);
    } else {
      const res = await register({
        email: form.email, username: form.username,
        password: form.password, full_name: form.full_name,
      });
      if (!res.ok) {
        toast.error(res.error);
        if (res.fields) setFieldErrors(res.fields);
      }
    }
  };

  const guest = async () => {
    const res = await loginAsGuest();
    if (!res.ok) toast.error(res.error);
    else toast.success('Exploring as Guest');
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden', background:'var(--bg)' }}>
      <ParticleCanvas />

      {/* Background radial glows */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:1 }}>
        <div style={{ position:'absolute', top:'10%', left:'5%', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle, rgba(0,240,255,0.04) 0%, transparent 70%)', }} />
        <div style={{ position:'absolute', bottom:'10%', right:'5%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', }} />
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity:0, y:24, scale:0.97 }}
        animate={{ opacity:1, y:0, scale:1 }}
        transition={{ duration:0.5, ease:[0.25,0.1,0.25,1] }}
        style={{ position:'relative', zIndex:10, width:'100%', maxWidth:420, padding:'0 16px' }}
      >
        <div style={{
          background: 'rgba(13,15,21,0.92)',
          backdropFilter: 'blur(32px)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 20,
          padding: '36px 32px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,240,255,0.04)',
        }}>
          {/* Logo */}
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <motion.div
              animate={{ rotate:[0,5,-5,0] }}
              transition={{ duration:4, repeat:Infinity, ease:'easeInOut' }}
              style={{ fontSize:40, marginBottom:10, display:'inline-block' }}
            >🤟</motion.div>
            <h1 style={{
              fontFamily:'var(--font-display)', fontSize:20, fontWeight:800,
              color:'var(--text)', letterSpacing:'-0.02em', marginBottom:4,
            }}>
              ISL·NMF·<span style={{ color:'var(--cyan)' }}>DETECTOR</span>
            </h1>
            <p style={{ color:'var(--text3)', fontSize:11, fontFamily:'var(--font-mono)', letterSpacing:'0.08em' }}>
              NON-MANUAL FEATURES · INDIAN SIGN LANGUAGE
            </p>
          </div>

          {/* Tab switcher */}
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr',
            background:'var(--surface)', borderRadius:8,
            padding:3, marginBottom:24, gap:3,
          }}>
            {['login','register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setFieldErrors({}); }}
                style={{
                  padding:'8px 0', borderRadius:6, border:'none',
                  background: mode===m ? 'var(--surface3)' : 'transparent',
                  color: mode===m ? 'var(--cyan)' : 'var(--text3)',
                  fontFamily:'var(--font-display)', fontWeight:600, fontSize:12,
                  letterSpacing:'0.06em', textTransform:'uppercase',
                  transition:'all 0.2s',
                  boxShadow: mode===m ? '0 0 0 1px rgba(0,240,255,0.15)' : 'none',
                }}>
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={submit}>
            <AnimatePresence mode="wait">
              <motion.div key={mode}
                initial={{ opacity:0, x: mode==='register'?20:-20 }}
                animate={{ opacity:1, x:0 }}
                exit={{ opacity:0, x: mode==='register'?-20:20 }}
                transition={{ duration:0.2 }}
              >
                {mode === 'register' && (
                  <>
                    <Field label="Full Name" type="text" value={form.full_name}
                      onChange={set('full_name')} placeholder="Your name"
                      error={fieldErrors.full_name} />
                    <Field label="Username" type="text" value={form.username}
                      onChange={set('username')} placeholder="username"
                      error={fieldErrors.username} />
                  </>
                )}
                <Field label="Email" type="email" value={form.email}
                  onChange={set('email')} placeholder="you@example.com"
                  error={fieldErrors.email} />
                <Field
                  label="Password" type={showPw ? 'text' : 'password'}
                  value={form.password} onChange={set('password')}
                  placeholder="••••••••" error={fieldErrors.password}
                  right={
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      style={{ background:'none', color:'var(--text3)', display:'flex' }}>
                      {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  }
                />
              </motion.div>
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                width:'100%', padding:'13px 0', marginBottom:12,
                background: isLoading
                  ? 'var(--surface3)'
                  : 'linear-gradient(135deg, var(--cyan) 0%, #0090a0 100%)',
                color: isLoading ? 'var(--text3)' : '#040506',
                borderRadius:8, border:'none', fontFamily:'var(--font-display)',
                fontWeight:700, fontSize:14, letterSpacing:'0.06em',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow: isLoading ? 'none' : '0 0 20px rgba(0,240,255,0.25)',
                transition:'background 0.2s, color 0.2s',
              }}>
              {isLoading
                ? <span style={{ animation:'spin 0.8s linear infinite', display:'inline-block', width:16, height:16, border:'2px solid var(--text3)', borderTopColor:'transparent', borderRadius:'50%' }} />
                : <>{mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={16}/></>
              }
            </motion.button>
          </form>

          {/* Divider */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{ flex:1, height:1, background:'var(--border)' }} />
            <span style={{ color:'var(--text3)', fontSize:11, fontFamily:'var(--font-mono)' }}>OR</span>
            <div style={{ flex:1, height:1, background:'var(--border)' }} />
          </div>

          {/* Guest */}
          <motion.button
            onClick={guest}
            whileHover={{ scale:1.01 }}
            whileTap={{ scale:0.98 }}
            style={{
              width:'100%', padding:'11px 0',
              background:'transparent', border:'1px solid var(--border2)',
              borderRadius:8, color:'var(--text2)',
              fontFamily:'var(--font-body)', fontSize:13,
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              transition:'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--violet)'; e.currentTarget.style.color='var(--violet)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.color='var(--text2)'; }}
          >
            <Zap size={14}/> Continue as Guest
          </motion.button>

          <p style={{ textAlign:'center', color:'var(--text3)', fontSize:11, marginTop:20, fontFamily:'var(--font-mono)' }}>
            v2.0 · Flask + MediaPipe + sklearn + React
          </p>
        </div>
      </motion.div>
    </div>
  );
}
