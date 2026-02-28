"""
Production NMF Detector — thread-safe, pooled MediaPipe instances.
Each worker thread gets its own FaceMesh instance via threading.local().
"""
import threading
import logging
import numpy as np
import cv2
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# ── MediaPipe thread-local pool ───────────────────────────────────────────────
_local = threading.local()


def _get_face_mesh(min_det: float = 0.5, min_track: float = 0.5, max_faces: int = 1):
    """Return a thread-local FaceMesh instance (created on first use per thread)."""
    if not hasattr(_local, "face_mesh"):
        try:
            import mediapipe as mp
            _local.face_mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=True,
                max_num_faces=max_faces,
                refine_landmarks=True,
                min_detection_confidence=min_det,
                min_tracking_confidence=min_track,
            )
            _local.mp_available = True
            logger.info(f"FaceMesh initialized for thread {threading.current_thread().name}")
        except Exception as e:
            logger.warning(f"MediaPipe unavailable ({e}). Using mock mode.")
            _local.face_mesh = None
            _local.mp_available = False
    return _local.face_mesh, getattr(_local, "mp_available", False)


# ── Landmark indices (MediaPipe 468-point mesh) ───────────────────────────────
LM = {
    "left_brow_inner":   70,  "left_brow_outer":   63,  "left_brow_mid":   105,
    "right_brow_inner": 300,  "right_brow_outer":  293, "right_brow_mid":  334,
    "left_eye_top":     159,  "left_eye_bottom":   145,
    "left_eye_left":     33,  "left_eye_right":    133,
    "right_eye_top":    386,  "right_eye_bottom":  374,
    "right_eye_left":   362,  "right_eye_right":   263,
    "mouth_top":         13,  "mouth_bottom":       14,
    "mouth_left":        61,  "mouth_right":       291,
    "upper_lip_top":      0,  "lower_lip_bottom":   17,
    "nose_tip":           4,  "chin":              152,
    "left_cheek":       234,  "right_cheek":       454, "forehead":         10,
    "left_iris":        468,  "right_iris":        473,
}

NMF_FUNCTIONS = {
    "eyebrow_raise":     "Yes/No question marker, topic marking",
    "eyebrow_furrow":    "Wh- questions, negation, conditional clauses",
    "brow_asymmetry":    "Rhetorical / contrastive sentence structure",
    "eye_widening":      "Intensifier, surprise, emphasis",
    "eye_squint":        "Doubt, uncertainty, scrutiny",
    "mouth_open":        "Exclamation, surprise interjection",
    "lip_compress":      "Negation reinforcement, effort marker",
    "mouth_corner_up":   "Affirmation, positive assertion",
    "mouth_corner_down": "Negative affect, rejection",
    "cheek_puff":        "Classifier: large/round object; effort",
    "head_tilt_left":    "Topic–comment separator, conditional marker",
    "head_tilt_right":   "Topic–comment separator, conditional marker",
    "chin_down":         "Head nod — affirmation / agreement component",
    "jaw_drop":          "Strong surprise / exclamation",
    "nose_wrinkle":      "Disgust, strong negation reinforcement",
}


def _dist(a, b):
    return float(np.linalg.norm(np.array(a) - np.array(b)))


def _lm_px(landmarks, key, w, h):
    idx = LM.get(key)
    if idx is None or idx >= len(landmarks):
        return np.array([0.0, 0.0])
    lm = landmarks[idx]
    return np.array([lm.x * w, lm.y * h])


def analyze_frame(
    image_bgr: np.ndarray,
    min_det: float = 0.5,
    min_track: float = 0.5,
) -> Dict[str, Any]:
    """
    Full NMF analysis on a BGR frame.
    Thread-safe. Returns serializable dict.
    """
    h, w = image_bgr.shape[:2]
    face_mesh, mp_available = _get_face_mesh(min_det, min_track)

    if not mp_available or face_mesh is None:
        return _mock_result()

    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb)

    if not results.multi_face_landmarks:
        return {"face_detected": False, "features": {}, "sentence_context": [], "key_points": {}, "image_size": {"width": w, "height": h}}

    lms = results.multi_face_landmarks[0].landmark

    def lm(key):
        return _lm_px(lms, key, w, h)

    face_w  = _dist(lm("left_cheek"),  lm("right_cheek"))
    face_h  = _dist(lm("forehead"),    lm("chin"))
    if face_w < 1 or face_h < 1:
        return {"face_detected": False, "features": {}, "sentence_context": [], "key_points": {}, "image_size": {"width": w, "height": h}}

    feats: Dict[str, float] = {}

    # ── Eyebrow raise ─────────────────────────────────────────────────────
    lb_h  = lm("left_eye_top")[1]  - lm("left_brow_mid")[1]
    rb_h  = lm("right_eye_top")[1] - lm("right_brow_mid")[1]
    brow_raise_norm = ((lb_h + rb_h) / 2) / face_h
    s = _clamp((brow_raise_norm - 0.030) / 0.060)
    if s > 0.30: feats["eyebrow_raise"] = s

    # ── Eyebrow furrow ────────────────────────────────────────────────────
    gap   = abs(lm("left_brow_inner")[0] - lm("right_brow_inner")[0]) / face_w
    furrow = _clamp(1.0 - gap / 0.35)
    if furrow > 0.38: feats["eyebrow_furrow"] = furrow

    # ── Brow asymmetry ────────────────────────────────────────────────────
    asym = abs(lb_h - rb_h) / face_h
    s = _clamp(asym / 0.04)
    if s > 0.25: feats["brow_asymmetry"] = s

    # ── Eye aspect ratios ─────────────────────────────────────────────────
    def ear(top, bot, left, right):
        v = _dist(lm(top), lm(bot))
        h_ = _dist(lm(left), lm(right))
        return v / h_ if h_ > 0 else 0.28

    avg_ear = (ear("left_eye_top","left_eye_bottom","left_eye_left","left_eye_right") +
               ear("right_eye_top","right_eye_bottom","right_eye_left","right_eye_right")) / 2

    s = _clamp((avg_ear - 0.36) / 0.16)
    if s > 0.25: feats["eye_widening"] = s
    s = _clamp((0.22 - avg_ear) / 0.10)
    if s > 0.25: feats["eye_squint"] = s

    # ── Mouth aspect ratio ────────────────────────────────────────────────
    m_h   = _dist(lm("mouth_top"), lm("mouth_bottom"))
    m_w   = _dist(lm("mouth_left"), lm("mouth_right"))
    mar   = m_h / m_w if m_w > 0 else 0.2

    s = _clamp((mar - 0.42) / 0.38)
    if s > 0.20: feats["mouth_open"] = s
    s = _clamp((0.10 - mar) / 0.08)
    if s > 0.20: feats["lip_compress"] = s

    # Jaw drop (extreme open)
    jaw_h = _dist(lm("upper_lip_top"), lm("lower_lip_bottom")) / face_h
    s = _clamp((jaw_h - 0.12) / 0.10)
    if s > 0.25: feats["jaw_drop"] = s

    # ── Mouth corners ─────────────────────────────────────────────────────
    mid_y   = (lm("mouth_top")[1] + lm("mouth_bottom")[1]) / 2
    corn_y  = (lm("mouth_left")[1] + lm("mouth_right")[1]) / 2
    delta   = (mid_y - corn_y) / face_h

    s = _clamp(delta / 0.030)
    if s > 0.20: feats["mouth_corner_up"] = s
    s = _clamp(-delta / 0.030)
    if s > 0.20: feats["mouth_corner_down"] = s

    # ── Cheek puff ────────────────────────────────────────────────────────
    cheek_r = _dist(lm("left_cheek"), lm("right_cheek")) / \
              max(1, _dist(lm("left_eye_left"), lm("right_eye_right")))
    s = _clamp((cheek_r - 2.05) / 0.40)
    if s > 0.20: feats["cheek_puff"] = s

    # ── Head tilt (roll from cheek baseline) ──────────────────────────────
    lc, rc  = lm("left_cheek"), lm("right_cheek")
    angle   = float(np.degrees(np.arctan2(rc[1] - lc[1], rc[0] - lc[0])))
    if abs(angle) > 4:
        s = _clamp(abs(angle) / 25)
        if angle > 0: feats["head_tilt_right"] = s
        else:         feats["head_tilt_left"]  = s

    # ── Chin down (pitch approximation) ───────────────────────────────────
    nose_y  = lm("nose_tip")[1]
    fore_y  = lm("forehead")[1]
    rel     = (nose_y - fore_y) / face_h
    s = _clamp((rel - 0.50) / 0.08)
    if s > 0.20: feats["chin_down"] = s

    # ── Nose wrinkle (crude: nostril compression) ─────────────────────────
    nose_w  = abs(lm("left_cheek")[0] - lm("right_cheek")[0]) / face_w
    s = _clamp((0.38 - nose_w) / 0.06)
    if s > 0.20: feats["nose_wrinkle"] = s

    # ── Key points for overlay ────────────────────────────────────────────
    key_points = {}
    for k in LM:
        if k in ("left_iris", "right_iris"):
            continue
        try:
            key_points[k] = [float(lm(k)[0]), float(lm(k)[1])]
        except Exception:
            pass

    contexts = _infer_sentence_context(feats)

    return {
        "face_detected":   True,
        "features":        {k: {"score": round(v, 4),
                                "label": k.replace("_", " ").title(),
                                "function": NMF_FUNCTIONS.get(k, "")}
                            for k, v in feats.items()},
        "sentence_context": contexts,
        "key_points":       key_points,
        "image_size":       {"width": w, "height": h},
        "_mock":            False,
    }


def _clamp(v: float) -> float:
    return float(max(0.0, min(1.0, v)))


def _infer_sentence_context(feats: Dict[str, float]):
    def has(k, thresh=0.38): return feats.get(k, 0) > thresh

    contexts = []

    # Yes/No question
    if has("eyebrow_raise") and not has("eyebrow_furrow"):
        contexts.append({
            "type": "YES_NO_QUESTION", "label": "Yes/No Question",
            "confidence": round(feats["eyebrow_raise"], 3),
            "description": "Raised eyebrows signal a polar (yes/no) question in ISL.",
            "color": "#4ade80",
        })

    # Wh-question
    if has("eyebrow_furrow") and not has("eyebrow_raise"):
        contexts.append({
            "type": "WH_QUESTION", "label": "Wh- Question",
            "confidence": round(feats["eyebrow_furrow"], 3),
            "description": "Furrowed brows accompany wh-words (what, where, who…) in ISL.",
            "color": "#facc15",
        })

    # Negation
    if has("eyebrow_furrow") and (has("mouth_corner_down") or has("lip_compress")):
        score = max(feats.get("eyebrow_furrow",0), feats.get("mouth_corner_down",0))
        contexts.append({
            "type": "NEGATION", "label": "Negation",
            "confidence": round(score, 3),
            "description": "Furrowed brows + downturned mouth corners signal negation in ISL.",
            "color": "#f87171",
        })

    # Affirmation
    if has("chin_down") or (has("mouth_corner_up") and has("eyebrow_raise")):
        contexts.append({
            "type": "AFFIRMATION", "label": "Affirmation",
            "confidence": round(max(feats.get("chin_down",0), feats.get("mouth_corner_up",0)), 3),
            "description": "Head nod or positive facial expression indicating agreement.",
            "color": "#34d399",
        })

    # Intensifier
    if has("eye_widening"):
        contexts.append({
            "type": "INTENSIFIER", "label": "Intensifier",
            "confidence": round(feats["eye_widening"], 3),
            "description": "Wide eyes intensify the meaning of the accompanying sign.",
            "color": "#a78bfa",
        })

    # Classifier
    if has("cheek_puff"):
        contexts.append({
            "type": "CLASSIFIER", "label": "Classifier (Large/Round)",
            "confidence": round(feats["cheek_puff"], 3),
            "description": "Puffed cheeks indicate large or round object classifiers in ISL.",
            "color": "#fb923c",
        })

    # Topic marker
    tilt = max(feats.get("head_tilt_left",0), feats.get("head_tilt_right",0))
    if tilt > 0.35:
        contexts.append({
            "type": "TOPIC_MARKER", "label": "Topic / Conditional Marker",
            "confidence": round(tilt, 3),
            "description": "Head tilt marks topic-comment structure or conditional clauses.",
            "color": "#60a5fa",
        })

    # Surprise / exclamation
    if has("jaw_drop") or (has("eye_widening") and has("mouth_open")):
        contexts.append({
            "type": "EXCLAMATION", "label": "Exclamation / Surprise",
            "confidence": round(max(feats.get("jaw_drop",0), feats.get("mouth_open",0)), 3),
            "description": "Open jaw and wide eyes signal strong surprise or exclamation.",
            "color": "#f59e0b",
        })

    # Doubt
    if has("eye_squint") and has("eyebrow_furrow"):
        contexts.append({
            "type": "DOUBT", "label": "Doubt / Uncertainty",
            "confidence": round((feats.get("eye_squint",0) + feats.get("eyebrow_furrow",0)) / 2, 3),
            "description": "Squinted eyes + furrowed brows express doubt in ISL.",
            "color": "#94a3b8",
        })

    return contexts


def _mock_result():
    import random
    r = random.Random()
    feats = {
        "eyebrow_raise": round(r.uniform(0.5, 0.9), 3),
        "eye_widening":  round(r.uniform(0.3, 0.7), 3),
        "mouth_open":    round(r.uniform(0.1, 0.4), 3),
    }
    return {
        "face_detected": True,
        "features": {k: {"score": v, "label": k.replace("_"," ").title(), "function": NMF_FUNCTIONS.get(k,"")}
                     for k, v in feats.items()},
        "sentence_context": _infer_sentence_context(feats),
        "key_points": {},
        "image_size": {"width": 640, "height": 480},
        "_mock": True,
    }
