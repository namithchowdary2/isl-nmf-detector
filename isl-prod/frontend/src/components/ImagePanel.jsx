import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, AlertCircle } from 'lucide-react';
import { detectImage } from '../utils/api';
import { Card, ConfidenceBar, ContextCard, NLPCard, SectionHeader, Spinner, EmptyState } from './UI';

/* ── Landmark overlay canvas ─────────────────────────────────────────────── */
function LandmarkOverlay({ kp, imageSize, w, h }) {
  const ref = useRef(null);
  React.useEffect(() => {
    if (!kp || !imageSize || Object.keys(kp).length === 0) return;
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const sx = w / imageSize.width, sy = h / imageSize.height;
    const COLORS = {
      left_brow_mid:'#facc15', right_brow_mid:'#facc15',
      left_brow_inner:'#facc15', right_brow_inner:'#facc15',
      left_eye_top:'#60a5fa', left_eye_bottom:'#60a5fa',
      right_eye_top:'#60a5fa', right_eye_bottom:'#60a5fa',
      mouth_top:'#f87171', mouth_bottom:'#f87171',
      mouth_left:'#f87171', mouth_right:'#f87171',
      nose_tip:'#a78bfa', chin:'#34d399',
      left_cheek:'#fb923c', right_cheek:'#fb923c', forehead:'#38bdf8',
    };
    Object.entries(kp).forEach(([key, [x, y]]) => {
      const px = x*sx, py = y*sy;
      const col = COLORS[key] || '#00f0ff';
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI*2);
      ctx.fillStyle = col; ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI*2);
      ctx.fillStyle = col + '30'; ctx.fill();
    });
  }, [kp, imageSize, w, h]);
  return <canvas ref={ref} width={w} height={h} style={{ position:'absolute',top:0,left:0,pointerEvents:'none' }}/>;
}

export default function ImagePanel() {
  const [preview, setPreview] = useState(null);
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [imgSize, setImgSize] = useState({ w:0,h:0 });
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setError(null); setResult(null);
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      const data = await detectImage(file);
      setResult(data);
    } catch(e) {
      setError(e?.response?.data?.error || 'Detection failed — is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const features = result?.features || {};
  const contexts = [...(result?.sentence_context||[]), ...(result?.ml_classifications||[])];
  const uniqueCtx = contexts.filter((c,i,a) => a.findIndex(x=>x.type===c.type)===i);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
      {/* Left: upload */}
      <Card>
        <SectionHeader icon="🖼️" label="Upload Image" />
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          style={{
            border: `2px dashed ${dragOver ? 'var(--cyan)' : preview ? 'var(--border2)' : 'var(--border)'}`,
            borderRadius: 12, overflow:'hidden', minHeight:260,
            display:'flex', alignItems:'center', justifyContent:'center',
            background: dragOver ? 'rgba(0,240,255,0.04)' : 'var(--surface2)',
            transition:'all 0.2s', position:'relative',
          }}
        >
          {preview ? (
            <div style={{ position:'relative', display:'inline-block' }}>
              <img src={preview} alt=""
                style={{ maxWidth:'100%', maxHeight:340, display:'block', borderRadius:8 }}
                onLoad={e => setImgSize({ w:e.target.offsetWidth, h:e.target.offsetHeight })}
              />
              {result?.key_points && imgSize.w > 0 && (
                <LandmarkOverlay kp={result.key_points} imageSize={result.image_size} w={imgSize.w} h={imgSize.h}/>
              )}
            </div>
          ) : (
            <div style={{ textAlign:'center', color:'var(--text3)', padding:24 }}>
              <Upload size={32} style={{ marginBottom:10, display:'block', margin:'0 auto 10px' }}/>
              <p style={{ fontWeight:500 }}>Drop image or click to upload</p>
              <p style={{ fontSize:12, marginTop:4 }}>JPG · PNG · WebP · max 10MB</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
          onChange={e => handleFile(e.target.files[0])} />

        {loading && (
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:12, color:'var(--cyan)' }}>
            <Spinner /> <span style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>Analyzing frame…</span>
          </div>
        )}
        {error && (
          <div style={{ marginTop:12, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:10, display:'flex', gap:8, color:'#f87171', fontSize:12 }}>
            <AlertCircle size={14} style={{ flexShrink:0, marginTop:1 }}/> {error}
          </div>
        )}
        {result && !result.face_detected && !error && (
          <div style={{ marginTop:12, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:8, padding:10, color:'#fbbf24', fontSize:12 }}>
            ⚠️ No face detected in this image.
          </div>
        )}
        {result?.processing_ms && (
          <p style={{ marginTop:8, color:'var(--text3)', fontFamily:'var(--font-mono)', fontSize:10 }}>
            ⏱ {result.processing_ms}ms · {result._mock ? 'mock mode' : 'MediaPipe'}
          </p>
        )}
      </Card>

      {/* Right: results */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <AnimatePresence>
          {result?.face_detected ? (
            <motion.div key="results" initial={{opacity:0}} animate={{opacity:1}}>
              <Card>
                <SectionHeader icon="📊" label={`Detected NMFs (${Object.keys(features).length})`} />
                {Object.keys(features).length === 0
                  ? <p style={{ color:'var(--text3)', fontSize:13 }}>No significant NMFs detected.</p>
                  : Object.entries(features).map(([k,v]) => (
                    <ConfidenceBar key={k} score={v.score} label={v.label} desc={v.function}
                      color={FEAT_COLOR[k] || 'var(--cyan)'}/>
                  ))
                }
              </Card>

              {uniqueCtx.length > 0 && (
                <Card>
                  <SectionHeader icon="🔤" label="Sentence Context" color="var(--violet)"/>
                  {uniqueCtx.map((c,i) => <ContextCard key={i} ctx={c}/>)}
                  <NLPCard nlp={result.nlp_analysis}/>
                </Card>
              )}
            </motion.div>
          ) : !loading && (
            <Card>
              <EmptyState icon="👆" title="Upload an image to analyze"
                subtitle="Supports signer photos with visible face"/>
            </Card>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const FEAT_COLOR = {
  eyebrow_raise:'#4ade80', eyebrow_furrow:'#facc15', brow_asymmetry:'#fb923c',
  eye_widening:'#a78bfa',  eye_squint:'#e879f9',
  mouth_open:'#60a5fa',    lip_compress:'#f87171',
  mouth_corner_up:'#34d399', mouth_corner_down:'#fb923c',
  cheek_puff:'#fbbf24', head_tilt_left:'#38bdf8', head_tilt_right:'#38bdf8',
  chin_down:'#6ee7b7', jaw_drop:'#f59e0b', nose_wrinkle:'#94a3b8',
};
