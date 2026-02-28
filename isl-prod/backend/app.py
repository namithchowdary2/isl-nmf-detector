"""
ISL Non-Manual Features Detector — Production Flask Application
"""
import os
import sys
import logging
import time
from datetime import timedelta

# ── Ensure backend/ is in path ────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify, request, g
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from config import config
from models.db import get_engine, close_session
from api.auth import auth_bp
from api.detect import detect_bp
from api.analytics import analytics_bp

# ── Structured logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if config.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def create_app() -> Flask:
    app = Flask(__name__)

    # ── Core config ───────────────────────────────────────────────────────────
    app.config["SECRET_KEY"]              = config.SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"]      = config.MAX_CONTENT_LENGTH
    app.config["JWT_SECRET_KEY"]          = config.JWT_SECRET
    app.config["JWT_ACCESS_TOKEN_EXPIRES"]= timedelta(minutes=config.JWT_EXPIRE_MIN)
    app.config["JWT_REFRESH_TOKEN_EXPIRES"]= timedelta(days=30)
    app.config["JSON_SORT_KEYS"]          = False

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS(app, resources={
        r"/api/*": {
            "origins":  config.CORS_ORIGINS.split(","),
            "methods":  ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-Request-ID"],
            "expose_headers": ["X-Processing-Time", "X-Request-ID"],
            "supports_credentials": True,
        }
    })

    # ── JWT ───────────────────────────────────────────────────────────────────
    jwt = JWTManager(app)

    @jwt.expired_token_loader
    def expired(_jwt_header, _jwt_payload):
        return jsonify({"error": "Token has expired.", "code": "TOKEN_EXPIRED"}), 401

    @jwt.invalid_token_loader
    def invalid(reason):
        return jsonify({"error": f"Invalid token: {reason}", "code": "TOKEN_INVALID"}), 401

    @jwt.unauthorized_loader
    def unauthorized(reason):
        return jsonify({"error": "Authentication required.", "code": "UNAUTHORIZED"}), 401

    # ── Rate limiting (memory backend; swap Redis in production) ──────────────
    storage_uri = config.REDIS_URL if config.REDIS_ENABLED else "memory://"
    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=[config.RATE_LIMIT_DEFAULT],
        storage_uri=storage_uri,
        strategy="fixed-window",
    )
    # Apply specific limits per blueprint
    limiter.limit(config.RATE_LIMIT_AUTH)(auth_bp)
    limiter.limit(config.RATE_LIMIT_DETECT)(detect_bp)

    # ── DB init ───────────────────────────────────────────────────────────────
    get_engine()  # Creates tables on startup

    # ── Blueprints ────────────────────────────────────────────────────────────
    app.register_blueprint(auth_bp)
    app.register_blueprint(detect_bp)
    app.register_blueprint(analytics_bp)

    # ── Request lifecycle ─────────────────────────────────────────────────────
    @app.before_request
    def before():
        g.start_time = time.perf_counter()

    @app.after_request
    def after(response):
        elapsed = round((time.perf_counter() - g.get("start_time", time.perf_counter())) * 1000, 1)
        response.headers["X-Processing-Time"] = f"{elapsed}ms"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    @app.teardown_appcontext
    def teardown(exc):
        close_session(exc)

    # ── Global error handlers ─────────────────────────────────────────────────
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Bad request.", "detail": str(e)}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Endpoint not found."}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed."}), 405

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({"error": f"File too large. Max {config.MAX_UPLOAD_MB}MB."}), 413

    @app.errorhandler(429)
    def rate_limited(e):
        return jsonify({"error": "Too many requests. Please slow down.", "code": "RATE_LIMITED"}), 429

    @app.errorhandler(500)
    def server_error(e):
        logger.exception("Unhandled server error")
        return jsonify({"error": "Internal server error. Please try again."}), 500

    # ── Health & info ─────────────────────────────────────────────────────────
    @app.route("/api/health")
    def health():
        try:
            from core.nmf_detector import _get_face_mesh
            _, mp_ok = _get_face_mesh()
        except Exception:
            mp_ok = False
        try:
            from core.ml_pipeline import get_classifier
            clf = get_classifier()
            ml_ok = clf._rf is not None
        except Exception:
            ml_ok = False
        return jsonify({
            "status":          "ok",
            "mediapipe_ready": mp_ok,
            "ml_ready":        ml_ok,
            "mode":            config.ENV,
            "version":         "2.0.0",
        })

    @app.route("/api/demo")
    def demo():
        from core.nmf_detector import _mock_result
        from core.ml_pipeline  import get_classifier, get_nlp
        result  = _mock_result()
        feats   = {k: v["score"] for k, v in result.get("features", {}).items()}
        clf     = get_classifier()
        nlp     = get_nlp()
        result["ml_classifications"] = clf.classify(feats)
        result["nlp_analysis"]       = nlp.analyze_sentence([result.get("sentence_context", [])])
        result["_demo"]              = True
        return jsonify(result)

    logger.info(f"ISL NMF Detector app created. ENV={config.ENV}")
    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=config.PORT, debug=config.DEBUG, threaded=True)
