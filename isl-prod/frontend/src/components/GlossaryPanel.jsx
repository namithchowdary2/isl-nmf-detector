import React, { useState, useEffect } from 'react';
import { getGlossary } from '../utils/api';
import { Card, SectionHeader, Badge, Spinner } from './UI';

export default function GlossaryPanel() {
  const [data, setData]     = useState(null);
  const [filter, setFilter] = useState('');
  const [tab, setTab]       = useState('nmf');

  useEffect(() => { getGlossary().then(setData).catch(() => {}); }, []);

  const nmf = (data?.nmf_features||[]).filter(i =>
    i.label.toLowerCase().includes(filter.toLowerCase()) ||
    i.function.toLowerCase().includes(filter.toLowerCase())
  );
  const grammar = (data?.grammar_labels||[]).filter(i =>
    i.label.toLowerCase().includes(filter.toLowerCase()) ||
    i.category.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Card>
      <SectionHeader icon="📚" label="NMF Glossary" />
      <div style={{ display:'flex', gap:12, marginBottom:14 }}>
        <input value={filter} onChange={e=>setFilter(e.target.value)}
          placeholder="Filter…"
          style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', color:'var(--text)', fontSize:13 }}
        />
        <div style={{ display:'flex', gap:4 }}>
          {['nmf','grammar'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding:'7px 14px', borderRadius:7, border:'none',
                background: tab===t ? 'var(--surface3)' : 'transparent',
                color: tab===t ? 'var(--cyan)' : 'var(--text3)',
                fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'0.06em', textTransform:'uppercase',
              }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div style={{ textAlign:'center', padding:24 }}><Spinner/></div>
      ) : tab === 'nmf' ? (
        <div style={{ display:'grid', gap:8 }}>
          {nmf.map(item => (
            <div key={item.key} style={{ background:'var(--surface2)', borderRadius:8, padding:'10px 12px', border:'1px solid var(--border)', display:'flex', gap:10 }}>
              <div style={{ flex:1 }}>
                <p style={{ color:'var(--text)', fontWeight:600, fontSize:13, marginBottom:3 }}>{item.label}</p>
                <p style={{ color:'var(--text3)', fontSize:12 }}>{item.function}</p>
              </div>
              <Badge label={item.key.replace(/_/g,' ')} small />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {grammar.map(item => (
            <div key={item.type} style={{ background:'var(--surface2)', borderRadius:8, padding:'10px 12px', border:`1px solid ${item.color}33`, borderLeft:`3px solid ${item.color}` }}>
              <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:3 }}>
                <span style={{ color:item.color, fontWeight:600, fontSize:13 }}>{item.label}</span>
              </div>
              <Badge label={item.category} color={item.color} small />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
