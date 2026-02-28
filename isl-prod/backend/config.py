"""
Production configuration management.
All secrets come from environment variables.
"""
import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Config:
    # ── App ────────────────────────────────────────────────────────────────
    ENV:            str  = field(default_factory=lambda: os.getenv("FLASK_ENV", "production"))
    DEBUG:          bool = field(default_factory=lambda: os.getenv("DEBUG", "false").lower() == "true")
    PORT:           int  = field(default_factory=lambda: int(os.getenv("PORT", "5000")))
    SECRET_KEY:     str  = field(default_factory=lambda: os.getenv("SECRET_KEY", "change-me-in-production-use-32-bytes"))
    WORKERS:        int  = field(default_factory=lambda: int(os.getenv("WORKERS", "4")))

    # ── JWT ────────────────────────────────────────────────────────────────
    JWT_SECRET:     str  = field(default_factory=lambda: os.getenv("JWT_SECRET", "jwt-secret-change-me"))
    JWT_EXPIRE_MIN: int  = field(default_factory=lambda: int(os.getenv("JWT_EXPIRE_MIN", "1440")))  # 24h

    # ── Database ───────────────────────────────────────────────────────────
    DATABASE_URL:   str  = field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///isl_nmf.db"))

    # ── Redis ──────────────────────────────────────────────────────────────
    REDIS_URL:      str  = field(default_factory=lambda: os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    REDIS_ENABLED:  bool = field(default_factory=lambda: os.getenv("REDIS_ENABLED", "false").lower() == "true")

    # ── Rate limiting ──────────────────────────────────────────────────────
    RATE_LIMIT_DEFAULT:  str = field(default_factory=lambda: os.getenv("RATE_LIMIT_DEFAULT", "200/hour"))
    RATE_LIMIT_DETECT:   str = field(default_factory=lambda: os.getenv("RATE_LIMIT_DETECT",  "60/minute"))
    RATE_LIMIT_AUTH:     str = field(default_factory=lambda: os.getenv("RATE_LIMIT_AUTH",    "10/minute"))

    # ── MediaPipe ──────────────────────────────────────────────────────────
    MP_MIN_DETECTION_CONF: float = field(default_factory=lambda: float(os.getenv("MP_MIN_DETECTION_CONF", "0.5")))
    MP_MIN_TRACKING_CONF:  float = field(default_factory=lambda: float(os.getenv("MP_MIN_TRACKING_CONF",  "0.5")))
    MP_MAX_FACES:          int   = field(default_factory=lambda: int(os.getenv("MP_MAX_FACES", "1")))

    # ── Upload ─────────────────────────────────────────────────────────────
    MAX_UPLOAD_MB:  int  = field(default_factory=lambda: int(os.getenv("MAX_UPLOAD_MB", "10")))

    # ── CORS ───────────────────────────────────────────────────────────────
    CORS_ORIGINS:   str  = field(default_factory=lambda: os.getenv("CORS_ORIGINS", "*"))

    @property
    def MAX_CONTENT_LENGTH(self):
        return self.MAX_UPLOAD_MB * 1024 * 1024


config = Config()
