"""
Detection API routes.
All detection endpoints are rate-limited and optionally authenticated.
"""
import time
import logging
import base64
import numpy as np
import cv2

from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from core.nmf_detector import analyze_frame
from core.ml_pipeline  import get_classifier, get_nlp, TemporalBuffer, FEATURE_KEYS
from models.db         import get_session, AnalysisRecord, close_session

logger = logging.getLogger(__name__)
detect_bp = Blueprint("detect", __name__, url_prefix="/api/detect")

# Per-session temporal buffers (keyed by user_id or IP)
_buffers: dict = {}
_BUFFER_LIMIT = 500  # max simultaneous buffers


def _get_buffer(key: str) -> TemporalBuffer:
    if key not in _buffers:
        if len(_buffers) > _BUFFER_LIMIT:
            # Evict oldest 10%
            for k in list(_buffers.keys())[:50]:
                del _buffers[k]
        _buffers[key] = TemporalBuffer(window=8)
    return _buffers[key]


def _decode_image(data: bytes) -> np.ndarray:
    nparr = np.frombuffer(data, np.uint8)
    img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    # Cap resolution to 1280px wide for performance
    h, w = img.shape[:2]
    if w > 1280:
        scale = 1280 / w
        img   = cv2.resize(img, (1280, int(h * scale)))
    return img


def _decode_b64(b64_str: str) -> np.ndarray:
    b64 = b64_str.split(",")[-1]
    return _decode_image(base64.b64decode(b64))


def _optional_user_id() -> str:
    try:
        verify_jwt_in_request(optional=True)
        uid = get_jwt_identity()
        return uid or get_remote_address()
    except Exception:
        return get_remote_address()


def _save_record(user_id, mode, result, nlp_result, elapsed_ms):
    try:
        db = get_session()
        rec = AnalysisRecord(
            user_id      = user_id if not user_id.startswith("guest") else None,
            mode         = mode,
            face_detected= result.get("face_detected", False),
            features_json= {k: v["score"] for k, v in result.get("features", {}).items()},
            context_json = result.get("sentence_context"),
            nlp_json     = nlp_result,
            processing_ms= elapsed_ms,
            image_w      = result.get("image_size", {}).get("width"),
            image_h      = result.get("image_size", {}).get("height"),
        )
        db.add(rec)
        db.commit()
    except Exception:
        logger.warning("Could not save analysis record", exc_info=True)
    finally:
        try: close_session()
        except Exception: pass


# ── Endpoints ─────────────────────────────────────────────────────────────────

@detect_bp.route("/image", methods=["POST"])
def detect_image():
    """Analyze a single image (multipart file or base64 JSON)."""
    t0 = time.perf_counter()

    try:
        content_type = request.content_type or ""
        if "multipart" in content_type:
            f = request.files.get("file")
            if not f:
                return jsonify({"error": "No file provided"}), 400
            img = _decode_image(f.read())
        else:
            data = request.get_json(silent=True) or {}
            if "image" not in data:
                return jsonify({"error": "No image data provided"}), 400
            img = _decode_b64(data["image"])
    except Exception as e:
        return jsonify({"error": f"Image decode failed: {e}"}), 400

    # NMF detection
    result = analyze_frame(img)

    # ML classification
    features_scores = {k: v["score"] for k, v in result.get("features", {}).items()}
    clf     = get_classifier()
    ml_tags = clf.classify(features_scores) if result.get("face_detected") else []
    result["ml_classifications"] = ml_tags

    # NLP sentence analysis
    nlp     = get_nlp()
    nlp_res = nlp.analyze_sentence([result.get("sentence_context", [])]) if result.get("face_detected") else {}
    result["nlp_analysis"] = nlp_res

    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    result["processing_ms"] = elapsed

    # Async save (non-blocking)
    try:
        uid = _optional_user_id()
        import threading
        threading.Thread(target=_save_record,
                         args=(uid, "image", result, nlp_res, elapsed),
                         daemon=True).start()
    except Exception:
        pass

    return jsonify(result)


@detect_bp.route("/stream", methods=["POST"])
def detect_stream():
    """
    Lightweight streaming endpoint.
    Accepts base64 JPEG frame; returns smoothed results with temporal context.
    """
    t0 = time.perf_counter()

    data = request.get_json(silent=True) or {}
    if "frame" not in data:
        return jsonify({"error": "No frame data"}), 400

    try:
        img = _decode_b64(data["frame"])
    except Exception as e:
        return jsonify({"error": f"Frame decode failed: {e}"}), 400

    uid    = _optional_user_id()
    buf    = _get_buffer(uid)

    # NMF detection on raw frame
    result = analyze_frame(img)
    if not result.get("face_detected"):
        buf.clear()
        return jsonify({**result, "processing_ms": round((time.perf_counter()-t0)*1000,1)})

    # Push to temporal buffer
    raw_feats = {k: v["score"] for k, v in result.get("features", {}).items()}
    raw_ctxs  = result.get("sentence_context", [])
    buf.push(raw_feats, raw_ctxs)

    # Use smoothed features
    smooth = buf.smoothed_features()
    clf    = get_classifier()
    ml_tags = clf.classify(smooth)

    # NLP over recent frames
    nlp     = get_nlp()
    nlp_res = nlp.analyze_sentence(buf.recent_contexts())

    # Rebuild feature dicts with smoothed scores
    from core.nmf_detector import NMF_FUNCTIONS
    smoothed_features = {
        k: {
            "score":    round(smooth.get(k, 0), 4),
            "label":    k.replace("_", " ").title(),
            "function": NMF_FUNCTIONS.get(k, ""),
        }
        for k in smooth
    }

    result["features"]           = smoothed_features
    result["ml_classifications"] = ml_tags
    result["nlp_analysis"]       = nlp_res
    result["processing_ms"]      = round((time.perf_counter() - t0) * 1000, 1)

    return jsonify(result)


@detect_bp.route("/reset-buffer", methods=["POST"])
def reset_buffer():
    """Clear temporal buffer for current user/session."""
    uid = _optional_user_id()
    if uid in _buffers:
        _buffers[uid].clear()
    return jsonify({"message": "Buffer cleared"})
