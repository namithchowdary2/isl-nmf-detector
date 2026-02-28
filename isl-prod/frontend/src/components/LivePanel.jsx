import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';
import { detectStream } from '../utils/api';
import { Card, ConfidenceBar, ContextCard, NLPCard, SectionHeader, Spinner, StatusDot, EmptyState } from './UI';

const FEAT_COLOR = {
  eyebrow_raise:'#4ade80', eyebrow_furrow:'#facc15', brow_asymmetry:'#fb923c',
  eye_widening:'#a78bfa',  eye_squint:'#e879f9',
  mouth_open:'#60a5fa',    lip_compress:'#f87171',
  mouth_corner_up:'#34d399', mouth_corner_down:'#fb923c',
  cheek_puff:'#fbbf24', head_tilt_left:'#38bdf8', head_tilt_right:'#38bdf8',
  chin_down:'#6ee7b7', jaw_drop:'#f59e0b', nose_wrinkle:'#94a3b8',
};

export default function LivePanel() {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const timerRef  = useRef(null);
  const fpsRef    = useRef({ count:0, last:Date.now() });

  const [active,  setActive]  = useState(false);
  const [result,  setResult]  = useState(null);
  const [fps,     setFps]     = useState(0);
  const [error,   setError]   = useState(null);
  const [pending, setPending] = useState(false);

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width:{ ideal:640 }, height:{ ideal:480 }, facingMode:'user' },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setActive(true);
    } catch(e) {
      setError('Camera access denied or unavailable.');
    }
  };

  const stopCamera = () => {
    clearInterval(timerRef.current);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setActive(false); setResult(null); setFps(0); setPending(false);
  };

  const capture = useCallback(async () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c || v.readyState < 2 || pending) return;
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext('2d').drawImage(v, 0, 0);
    const frame = c.toDataURL('image/jpeg', 0.65);
    setPending(true);
    try {
      const data = await detectStream(frame);
      setResult(data);
      fpsRef.current.count++;
      const now = Date.now();
      if (now - fpsRef.current.last >= 1000) {
        setFps(fpsRef.current.count);
        fpsRef.current = { count:0, last:now };
      }
    } catch(_) {}
    finally { setPending(false); }
  }, [pending]);

  useEffect(() => {
    if (active) { timerRef.current = setInterval(capture, 450); }
    return () => clearInterval(timerRef.current);
  }, [active, capture]);

  const features = result?.features || {};
  const contexts = [...(result?.sentence_context||[]), ...(result?.ml_classifications||[])];
  const uniqueCtx = contexts.filter((c,i,a) => a.findIndex(x=>x.type===c.type)===i).slice(0,6);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
      {/* Camera feed */}
      <Card>
        <SectionHeader icon="📷" label="Live Camera"
          right={active && <StatusDot ok={result?.face_detected} label={result?.face_detected ? 'Face detected' : 'No face'} />}
        />
        <div style={{
          background:'#000', borderRadius:10, overflow:'hidden',
          border: active ? '1px solid rgba(0,240,255,0.2)' : '1px solid var(--border)',
          position:'relative', aspectRatio:'4/3',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow: active && result?.face_detected ? 'var(--shadow-glow-cyan)' : 'none',
          transition:'box-shadow 0.3s',
        }}>
          <video ref={videoRef}
            style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)', display:active?'block':'none' }}
            muted playsInline />
          {!active && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--text3)', gap:8 }}>
              <CameraOff size={36}/><span>Camera inactive</span>
            </div>
          )}
          {active && result && (
            <div style={{
              position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.75)',
              borderRadius:6, padding:'3px 8px',
              fontFamily:'var(--font-mono)', fontSize:10,
              color: result.face_detected ? '#4ade80' : '#f87171',
            }}>
              {result.face_detected ? '● FACE' : '○ NO FACE'} | {fps}fps
              {pending && <span style={{ color:'var(--cyan)', marginLeft:6 }}>●</span>}
            </div>
          )}
          <canvas ref={canvasRef} style={{ display:'none' }} />
        </div>

        {error && (
          <div style={{ marginTop:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:10, color:'#f87171', fontSize:12 }}>
            {error}
          </div>
        )}

        <div style={{ display:'flex', gap:10, marginTop:12 }}>
          <motion.button
            whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
            onClick={active ? stopCamera : startCamera}
            style={{
              flex:1, padding:'11px 0', borderRadius:8, border:'none',
              background: active ? 'rgba(239,68,68,0.12)' : 'var(--cyan)',
              color: active ? '#f87171' : '#040506',
              fontFamily:'var(--font-display)', fontWeight:700, fontSize:13,
              display:'flex', alignItems:'center', justifyContent:'center', gap:7,
              boxShadow: !active ? '0 0 16px rgba(0,240,255,0.2)' : 'none',
            }}>
            {active ? <><CameraOff size={14}/> Stop</> : <><Camera size={14}/> Start Camera</>}
          </motion.button>
          {active && (
            <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
              onClick={() => { setResult(null); }}
              style={{ padding:'11px 14px', borderRadius:8, border:'1px solid var(--border2)', background:'transparent', color:'var(--text2)' }}>
              <RefreshCw size={14}/>
            </motion.button>
          )}
        </div>

        {result?.processing_ms && (
          <p style={{ marginTop:6, color:'var(--text3)', fontFamily:'var(--font-mono)', fontSize:10 }}>
            ⏱ {result.processing_ms}ms/frame{result._mock ? ' · mock' : ''}
          </p>
        )}
      </Card>

      {/* Live results */}
      <div style={{ overflowY:'auto', maxHeight:560, display:'flex', flexDirection:'column', gap:12 }}>
        {result?.face_detected ? (
          <>
            {Object.keys(features).length > 0 && (
              <Card>
                <SectionHeader icon="📡" label="Live NMFs (smoothed)" />
                {Object.entries(features).map(([k,v]) => (
                  <ConfidenceBar key={k} score={v.score} label={v.label}
                    color={FEAT_COLOR[k]||'var(--cyan)'} desc={v.function}/>
                ))}
              </Card>
            )}
            {uniqueCtx.length > 0 && (
              <Card>
                <SectionHeader icon="💬" label="Grammar Context" color="var(--violet)"/>
                {uniqueCtx.map((c,i) => <ContextCard key={i} ctx={c}/>)}
                <NLPCard nlp={result.nlp_analysis}/>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <EmptyState icon="🤟"
              title={active ? 'Position face in frame' : 'Start camera to begin'}
              subtitle="Face must be clearly visible for detection"
            />
          </Card>
        )}
      </div>
    </div>
  );
}
