import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Image, Camera, BarChart2, BookOpen, Activity, ChevronRight } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { getHealth } from '../utils/api';
import { StatusDot } from './UI';
import ImagePanel   from './ImagePanel';
import LivePanel    from './LivePanel';
import AnalyticsPanel from './AnalyticsPanel';
import GlossaryPanel  from './GlossaryPanel';
import toast from 'react-hot-toast';

const TABS = [
  { id:'image',     icon:<Image size={15}/>,     label:'Image Upload' },
  { id:'live',      icon:<Camera size={15}/>,    label:'Live Camera' },
  { id:'analytics', icon:<BarChart2 size={15}/>, label:'Analytics' },
  { id:'glossary',  icon:<BookOpen size={15}/>,  label:'Glossary' },
];

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const [tab,    setTab]    = useState('image');
  const [health, setHealth] = useState(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth({ status:'error' }));
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Signed out');
  };

  const initials = (user?.full_name || user?.username || 'G').slice(0,2).toUpperCase();

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:'var(--bg)' }}>
      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <header style={{
        height:56, borderBottom:'1px solid var(--border)',
        padding:'0 24px', display:'flex', alignItems:'center', gap:16,
        background:'rgba(6,7,9,0.95)', backdropFilter:'blur(20px)',
        position:'sticky', top:0, zIndex:100,
      }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:22 }}>🤟</span>
          <div>
            <h1 style={{ fontFamily:'var(--font-display)', fontSize:13, fontWeight:800, color:'var(--text)', letterSpacing:'-0.01em' }}>
              ISL·NMF·<span style={{ color:'var(--cyan)' }}>DETECTOR</span>
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <nav style={{ display:'flex', gap:2, flex:1, justifyContent:'center' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'6px 14px', borderRadius:7, border:'none',
                background: tab===t.id ? 'var(--surface2)' : 'transparent',
                color: tab===t.id ? 'var(--cyan)' : 'var(--text3)',
                fontSize:12, fontFamily:'var(--font-body)', fontWeight:tab===t.id?600:400,
                transition:'all 0.15s',
                boxShadow: tab===t.id ? '0 0 0 1px rgba(0,240,255,0.12)' : 'none',
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        {/* Right: status + user */}
        <div style={{ display:'flex', alignItems:'center', gap:16, marginLeft:'auto' }}>
          {health && (
            <div style={{ display:'flex', gap:10 }}>
              <StatusDot ok={health.mediapipe_ready} label="MediaPipe" />
              <StatusDot ok={health.ml_ready} label="ML" />
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{
              width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
              background: user?.avatar_color || 'var(--cyan)', color:'#000',
              fontFamily:'var(--font-display)', fontWeight:800, fontSize:11,
            }}>
              {initials}
            </div>
            <div style={{ lineHeight:1.3 }}>
              <p style={{ color:'var(--text)', fontSize:12, fontWeight:600 }}>{user?.full_name || user?.username}</p>
              <p style={{ color:'var(--text3)', fontSize:10, fontFamily:'var(--font-mono)' }}>{user?.role?.toUpperCase()}</p>
            </div>
            <button onClick={handleLogout}
              style={{ background:'transparent', color:'var(--text3)', padding:6, borderRadius:6, transition:'color 0.2s' }}
              onMouseEnter={e=>e.currentTarget.style.color='var(--red)'}
              onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}
              title="Sign out">
              <LogOut size={14}/>
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero strip ───────────────────────────────────────────────────── */}
      <div style={{
        borderBottom:'1px solid var(--border)', padding:'10px 24px',
        background:'linear-gradient(90deg, rgba(0,240,255,0.04) 0%, rgba(139,92,246,0.03) 100%)',
        display:'flex', alignItems:'center', gap:10,
      }}>
        <Activity size={13} style={{ color:'var(--cyan)' }}/>
        <p style={{ color:'var(--text2)', fontSize:12 }}>
          <strong style={{ color:'var(--cyan)', fontFamily:'var(--font-mono)' }}>Detection of Non-Manual Features in Indian Sign Language Sentences</strong>
          {' · '}MediaPipe FaceMesh · sklearn RandomForest · ISL Grammar NLP
        </p>
        <ChevronRight size={13} style={{ color:'var(--text3)', marginLeft:'auto' }}/>
        {health && <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text3)' }}>v{health.version}</span>}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main style={{ flex:1, padding:'20px 24px', maxWidth:1200, margin:'0 auto', width:'100%' }}>
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity:0, y:8 }}
            animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-8 }}
            transition={{ duration:0.2 }}
          >
            {tab === 'image'     && <ImagePanel />}
            {tab === 'live'      && <LivePanel  />}
            {tab === 'analytics' && <AnalyticsPanel />}
            {tab === 'glossary'  && <GlossaryPanel />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop:'1px solid var(--border)', padding:'10px 24px', textAlign:'center', color:'var(--text3)', fontFamily:'var(--font-mono)', fontSize:10 }}>
        ISL-NMF-DETECTOR v2.0 · Flask + MediaPipe + sklearn + React · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
