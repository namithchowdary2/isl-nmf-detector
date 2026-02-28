import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { getStats, getHistory, getDemo } from '../utils/api';
import { Card, SectionHeader, Badge, ConfidenceBar, ContextCard, NLPCard, Spinner, EmptyState } from './UI';
import useAuthStore from '../store/authStore';

const COLORS = ['#00f0ff','#8b5cf6','#f59e0b','#10b981','#f87171','#60a5fa','#a78bfa','#4ade80'];

function StatTile({ label, value, sub, color='var(--cyan)' }) {
  return (
    <div style={{ background:'var(--surface2)', borderRadius:10, padding:'16px 18px', border:'1px solid var(--border)' }}>
      <p style={{ color:'var(--text3)', fontSize:11, fontFamily:'var(--font-mono)', letterSpacing:'0.08em', marginBottom:6 }}>{label}</p>
      <p style={{ color, fontSize:26, fontWeight:700, fontFamily:'var(--font-display)', lineHeight:1 }}>{value}</p>
      {sub && <p style={{ color:'var(--text3)', fontSize:11, marginTop:4 }}>{sub}</p>}
    </div>
  );
}

function DemoSection() {
  const [demo, setDemo]   = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try { setDemo(await getDemo()); }
    catch(_) {}
    finally { setLoading(false); }
  };

  const features = demo?.features || {};
  const radarData = Object.entries(features).map(([k,v]) => ({
    subject: v.label.replace(/Eyebrow /,'').replace(/Mouth /,'').replace(/Head /,''),
    value: Math.round(v.score*100),
  }));

  return (
    <Card>
      <SectionHeader icon="🔬" label="Demo Analysis" />
      <div style={{ textAlign:'center', marginBottom:20 }}>
        <p style={{ color:'var(--text2)', fontSize:13, marginBottom:14 }}>Run a synthetic demo with ML+NLP pipeline.</p>
        <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} onClick={run} disabled={loading}
          style={{
            padding:'10px 28px', borderRadius:8,
            background: loading ? 'var(--surface3)' : 'linear-gradient(135deg,var(--violet),var(--cyan))',
            color:'#fff', border:'none', fontFamily:'var(--font-display)', fontWeight:700,
            fontSize:13, letterSpacing:'0.06em', display:'inline-flex', alignItems:'center', gap:8,
          }}>
          {loading ? <><Spinner size={14} color="#fff"/> Running…</> : '▶ Run Demo'}
        </motion.button>
      </div>

      {demo?.face_detected && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            {Object.entries(features).map(([k,v]) => (
              <ConfidenceBar key={k} score={v.score} label={v.label}
                color={['#00f0ff','#8b5cf6','#f59e0b','#10b981','#f87171'][Object.keys(features).indexOf(k) % 5]}
              />
            ))}
            {(demo.sentence_context||[]).map((c,i) => <ContextCard key={i} ctx={c}/>)}
            <NLPCard nlp={demo.nlp_analysis}/>
          </div>
          {radarData.length >= 3 && (
            <div>
              <p style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text3)', marginBottom:8, letterSpacing:'0.08em' }}>FEATURE RADAR</p>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill:'var(--text2)', fontSize:10 }}/>
                  <Radar dataKey="value" stroke="var(--cyan)" fill="var(--cyan)" fillOpacity={0.12} strokeWidth={2}/>
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function AnalyticsPanel() {
  const { user } = useAuthStore();
  const isGuest  = user?.role === 'guest';
  const [stats,  setStats]  = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isGuest) return;
    setLoading(true);
    Promise.all([getStats(), getHistory(10)])
      .then(([s, h]) => { setStats(s); setHistory(h.records || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isGuest]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <DemoSection />

      {isGuest ? (
        <Card>
          <EmptyState icon="🔒" title="Analytics requires an account"
            subtitle="Register or log in to view your analysis history and stats"/>
        </Card>
      ) : loading ? (
        <Card><div style={{ textAlign:'center', padding:24 }}><Spinner/></div></Card>
      ) : (
        <>
          {stats && (
            <Card>
              <SectionHeader icon="📈" label="Your Stats" color="var(--amber)"/>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
                <StatTile label="TOTAL ANALYSES" value={stats.total_analyses} color="var(--cyan)"/>
                <StatTile label="FACES DETECTED" value={stats.faces_detected} color="var(--green)"/>
                <StatTile label="DETECTION RATE" value={`${Math.round(stats.detection_rate*100)}%`} color="var(--violet)"/>
                <StatTile label="AVG SPEED" value={`${stats.avg_processing_ms}ms`} color="var(--amber)"/>
              </div>
              {stats.top_features?.length > 0 && (
                <>
                  <p style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text3)', letterSpacing:'0.08em', marginBottom:8 }}>TOP FEATURES</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={stats.top_features} margin={{ top:0, bottom:0, left:-20, right:0 }}>
                      <XAxis dataKey="label" tick={{ fill:'var(--text2)', fontSize:9 }} tickFormatter={s=>s.split(' ')[0]}/>
                      <YAxis tick={{ fill:'var(--text3)', fontSize:9 }}/>
                      <Tooltip contentStyle={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }}/>
                      <Bar dataKey="count" radius={[3,3,0,0]}>
                        {stats.top_features.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </Card>
          )}

          {history.length > 0 && (
            <Card>
              <SectionHeader icon="📋" label="Recent Analyses" />
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {history.map(r => (
                  <div key={r.id} style={{ background:'var(--surface2)', borderRadius:8, padding:'10px 12px', border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:16 }}>{r.face_detected ? '👤' : '❌'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {Object.keys(r.features||{}).slice(0,4).map(k => (
                          <Badge key={k} label={k.replace(/_/g,' ')} small />
                        ))}
                      </div>
                      <p style={{ color:'var(--text3)', fontSize:11, marginTop:3 }}>{r.created_at?.slice(0,19).replace('T',' ')}</p>
                    </div>
                    <Badge label={r.mode} color="var(--violet)" small />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
