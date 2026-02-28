"""
Analytics & history routes.
"""
import logging
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from models.db import get_session, AnalysisRecord, close_session
from core.nmf_detector import NMF_FUNCTIONS
from core.ml_pipeline import LABEL_META

logger = logging.getLogger(__name__)
analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")


@analytics_bp.route("/history", methods=["GET"])
@jwt_required()
def history():
    uid   = get_jwt_identity()
    limit = min(int(request.args.get("limit", 20)), 100)
    db    = get_session()
    try:
        records = (
            db.query(AnalysisRecord)
            .filter_by(user_id=uid)
            .order_by(AnalysisRecord.created_at.desc())
            .limit(limit)
            .all()
        )
        return jsonify({"records": [r.to_dict() for r in records]})
    finally:
        close_session()


@analytics_bp.route("/stats", methods=["GET"])
@jwt_required()
def stats():
    uid = get_jwt_identity()
    db  = get_session()
    try:
        records = db.query(AnalysisRecord).filter_by(user_id=uid).all()
        total   = len(records)
        faces   = sum(1 for r in records if r.face_detected)

        # Feature frequency
        feat_counts: dict = {}
        for r in records:
            for k in (r.features_json or {}):
                feat_counts[k] = feat_counts.get(k, 0) + 1

        top_features = sorted(feat_counts.items(), key=lambda x: -x[1])[:8]

        # NLP structure frequency
        struct_counts: dict = {}
        for r in records:
            s = (r.nlp_json or {}).get("structure")
            if s:
                struct_counts[s] = struct_counts.get(s, 0) + 1

        avg_ms = (sum(r.processing_ms for r in records if r.processing_ms) /
                  max(1, sum(1 for r in records if r.processing_ms)))

        return jsonify({
            "total_analyses":   total,
            "faces_detected":   faces,
            "detection_rate":   round(faces / max(1, total), 3),
            "top_features":     [{"key": k, "count": v, "label": k.replace("_"," ").title()}
                                  for k, v in top_features],
            "sentence_structures": [{"type": k, "count": v} for k, v in struct_counts.items()],
            "avg_processing_ms":round(avg_ms, 1),
        })
    finally:
        close_session()


@analytics_bp.route("/glossary", methods=["GET"])
def glossary():
    return jsonify({
        "nmf_features": [
            {"key": k, "label": k.replace("_"," ").title(), "function": v}
            for k, v in NMF_FUNCTIONS.items()
        ],
        "grammar_labels": [
            {"type": k, "label": m["display"], "color": m["color"], "category": m["grammar"]}
            for k, m in LABEL_META.items()
        ],
    })
