"""
Auth API routes: register, login, refresh, logout, me.
"""
import logging
from datetime import datetime, timezone, timedelta
from functools import wraps

from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt,
)
from passlib.hash import bcrypt as pw_bcrypt

from models.db import get_session, User, close_session
from utils.validators import validate_email, validate_password

logger = logging.getLogger(__name__)
auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# ── Helpers ───────────────────────────────────────────────────────────────────

def _user_response(user: User, access_token: str, refresh_token: str = None):
    r = {
        "user":         user.to_dict(),
        "access_token": access_token,
        "token_type":   "Bearer",
    }
    if refresh_token:
        r["refresh_token"] = refresh_token
    return r


# ── Routes ────────────────────────────────────────────────────────────────────

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    email     = (data.get("email")    or "").strip().lower()
    username  = (data.get("username") or "").strip()
    password  = data.get("password",  "")
    full_name = (data.get("full_name") or "").strip()

    errors = {}
    if not validate_email(email):
        errors["email"] = "Invalid email address."
    if len(username) < 3 or len(username) > 30:
        errors["username"] = "Username must be 3–30 characters."
    if not username.isalnum() and "_" not in username:
        errors["username"] = "Username may only contain letters, numbers, underscores."
    pw_err = validate_password(password)
    if pw_err:
        errors["password"] = pw_err
    if errors:
        return jsonify({"error": "Validation failed", "fields": errors}), 422

    db = get_session()
    try:
        if db.query(User).filter_by(email=email).first():
            return jsonify({"error": "Email already registered."}), 409
        if db.query(User).filter_by(username=username).first():
            return jsonify({"error": "Username already taken."}), 409

        user = User(
            email=email,
            username=username,
            password_hash=pw_bcrypt.hash(password),
            full_name=full_name or username,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        access  = create_access_token(identity=user.id)
        refresh = create_refresh_token(identity=user.id)
        logger.info(f"New user registered: {email}")
        return jsonify(_user_response(user, access, refresh)), 201

    except Exception as e:
        db.rollback()
        logger.exception("Register error")
        return jsonify({"error": "Registration failed. Please try again."}), 500
    finally:
        close_session()


@auth_bp.route("/login", methods=["POST"])
def login():
    data     = request.get_json(silent=True) or {}
    identity = (data.get("email") or data.get("username") or "").strip().lower()
    password = data.get("password", "")

    if not identity or not password:
        return jsonify({"error": "Email/username and password required."}), 400

    db = get_session()
    try:
        user = db.query(User).filter(
            (User.email == identity) | (User.username == identity.lower())
        ).first()

        if not user or not pw_bcrypt.verify(password, user.password_hash):
            return jsonify({"error": "Invalid credentials."}), 401

        if not user.is_active:
            return jsonify({"error": "Account is deactivated."}), 403

        user.last_login = datetime.now(timezone.utc)
        db.commit()

        access  = create_access_token(identity=user.id)
        refresh = create_refresh_token(identity=user.id)
        logger.info(f"Login: {user.email}")
        return jsonify(_user_response(user, access, refresh))

    except Exception as e:
        logger.exception("Login error")
        return jsonify({"error": "Login failed."}), 500
    finally:
        close_session()


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    access  = create_access_token(identity=user_id)
    return jsonify({"access_token": access, "token_type": "Bearer"})


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    db = get_session()
    try:
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            return jsonify({"error": "User not found."}), 404
        return jsonify({"user": user.to_dict()})
    finally:
        close_session()


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    # Stateless JWT — client deletes token. For production add a blocklist.
    return jsonify({"message": "Logged out successfully."})


# ── Guest / demo token (no auth required) ─────────────────────────────────────
@auth_bp.route("/guest", methods=["POST"])
def guest():
    """Issue a short-lived guest token for demo use."""
    import uuid
    guest_id = f"guest_{uuid.uuid4().hex[:8]}"
    token = create_access_token(identity=guest_id, expires_delta=timedelta(hours=2))
    return jsonify({
        "access_token": token,
        "token_type":   "Bearer",
        "user": {
            "id":        guest_id,
            "username":  "Guest",
            "full_name": "Guest User",
            "role":      "guest",
            "avatar_color": "#f59e0b",
        }
    })
