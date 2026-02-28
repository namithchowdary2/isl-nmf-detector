import React from 'react';
import { motion } from 'framer-motion';

/* ── Card ─────────────────────────────────────────────────────────────────── */
export function Card({ children, style, glow }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${glow ? 'rgba(0,240,255,0.12)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: 20,
      boxShadow: glow ? 'var(--shadow-glow-cyan)' : 'var(--shadow-card)',
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ── Badge ────────────────────────────────────────────────────────────────── */
export function Badge({ label, color = '#00f0ff', small }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: color + '18', border: `1px solid ${color}44`,
      color, borderRadius: 20, padding: small ? '1px 8px' : '3px 10px',
      fontSize: small ? 10 : 11, fontFamily: 'var(--font-mono)',
      fontWeight: 500, letterSpacing: '0.06em', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

/* ── Confidence bar ───────────────────────────────────────────────────────── */
export function ConfidenceBar({ score, color = '#00f0ff', label, desc }) {
  const pct = Math.round(score * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
        <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ color, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{pct}%</span>
      </div>
      <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ height: '100%', background: color, borderRadius: 3, boxShadow: `0 0 8px ${color}88` }}
        />
      </div>
      {desc && <p style={{ color: 'var(--text3)', fontSize: 11, marginTop: 3 }}>{desc}</p>}
    </div>
  );
}

/* ── Context card ─────────────────────────────────────────────────────────── */
export function ContextCard({ ctx }) {
  const ICONS = {
    YES_NO_Q: '❓', WH_Q: '🔍', WH_Q_EMPHATIC: '🔎',
    NEGATION: '❌', NEGATION_STRONG: '🚫', AFFIRMATION: '✅',
    INTENSIFIER: '⚡', EXCLAMATION: '😲', CLASSIFIER_LARGE: '🫧',
    TOPIC_L: '📌', TOPIC_R: '📌', CONTRASTIVE: '⚖️', DOUBT: '🤔', CONDITIONAL: '↩️',
  };
  const icon = ICONS[ctx.type] || '📋';
  const pct  = Math.round((ctx.confidence || 0) * 100);
  return (
    <motion.div
      initial={{ opacity:0, x:-8 }}
      animate={{ opacity:1, x:0 }}
      style={{
        background: 'var(--surface2)',
        border: `1px solid ${ctx.color}33`,
        borderLeft: `3px solid ${ctx.color}`,
        borderRadius: 8, padding: '10px 12px', marginBottom: 8,
      }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
        <span style={{ fontSize:15 }}>{icon}</span>
        <span style={{ color: ctx.color, fontWeight:600, fontSize:13 }}>{ctx.label}</span>
        <Badge label={`${pct}%`} color={ctx.color} small />
        {ctx.grammar_cat && <Badge label={ctx.grammar_cat} color="#64748b" small />}
      </div>
      {ctx.description && (
        <p style={{ color:'var(--text3)', fontSize:11, lineHeight:1.5 }}>{ctx.description}</p>
      )}
    </motion.div>
  );
}

/* ── NLP sentence card ────────────────────────────────────────────────────── */
export function NLPCard({ nlp }) {
  if (!nlp || !nlp.structure) return null;
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(0,240,255,0.04))',
      border: '1px solid rgba(139,92,246,0.2)',
      borderRadius: 10, padding: '14px 16px', marginTop: 12,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <span style={{ fontSize:14 }}>🧠</span>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--violet)', letterSpacing:'0.08em' }}>
          NLP ANALYSIS
        </span>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
        <Badge label={nlp.structure} color="#8b5cf6" />
        {(nlp.tags || []).map((t,i) => <Badge key={i} label={t.tag} color={t.color} small />)}
      </div>
      <p style={{ color:'var(--text2)', fontSize:12, lineHeight:1.5 }}>{nlp.summary}</p>
      {nlp.structure_desc && (
        <p style={{ color:'var(--text3)', fontSize:11, marginTop:4 }}>{nlp.structure_desc}</p>
      )}
    </div>
  );
}

/* ── Status dot ───────────────────────────────────────────────────────────── */
export function StatusDot({ ok, label }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text2)' }}>
      <span style={{
        width:7, height:7, borderRadius:'50%',
        background: ok ? 'var(--green)' : 'var(--red)',
        boxShadow: `0 0 6px ${ok ? 'var(--green)' : 'var(--red)'}`,
        display:'inline-block', flexShrink:0,
        animation: ok ? 'pulse-glow 2s infinite' : 'none',
      }}/>
      {label}
    </span>
  );
}

/* ── Spinner ──────────────────────────────────────────────────────────────── */
export function Spinner({ size=16, color='var(--cyan)' }) {
  return (
    <span style={{
      display:'inline-block', width:size, height:size,
      border:`2px solid ${color}33`, borderTopColor:color,
      borderRadius:'50%', animation:'spin 0.7s linear infinite',
    }}/>
  );
}

/* ── Section header ───────────────────────────────────────────────────────── */
export function SectionHeader({ icon, label, color='var(--cyan)', right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
      {icon && <span style={{ fontSize:14 }}>{icon}</span>}
      <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color, letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:500 }}>
        {label}
      </span>
      {right && <div style={{ marginLeft:'auto' }}>{right}</div>}
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────────────────── */
export function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{ textAlign:'center', padding:'32px 16px', color:'var(--text3)' }}>
      <div style={{ fontSize:36, marginBottom:10 }}>{icon}</div>
      <p style={{ fontWeight:500, color:'var(--text2)', marginBottom:4 }}>{title}</p>
      {subtitle && <p style={{ fontSize:12 }}>{subtitle}</p>}
    </div>
  );
}
