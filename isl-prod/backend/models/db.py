"""
SQLAlchemy ORM models.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Text, Float, Integer, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, scoped_session
from config import config

Base = declarative_base()

def _utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id          = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    email       = Column(String(255), unique=True, nullable=False, index=True)
    username    = Column(String(80),  unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name   = Column(String(200), nullable=True)
    role        = Column(String(20),  default="user")          # user | admin | researcher
    is_active   = Column(Boolean,     default=True)
    is_verified = Column(Boolean,     default=True)            # simplified: no email verify
    created_at  = Column(DateTime,    default=_utcnow)
    last_login  = Column(DateTime,    nullable=True)
    api_key     = Column(String(64),  nullable=True, unique=True)
    avatar_color= Column(String(10),  default="#00e5ff")

    def to_dict(self):
        return {
            "id":          self.id,
            "email":       self.email,
            "username":    self.username,
            "full_name":   self.full_name,
            "role":        self.role,
            "created_at":  self.created_at.isoformat() if self.created_at else None,
            "last_login":  self.last_login.isoformat() if self.last_login else None,
            "avatar_color":self.avatar_color,
        }


class AnalysisRecord(Base):
    __tablename__ = "analysis_records"

    id           = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id      = Column(String(36), nullable=True, index=True)
    mode         = Column(String(20), default="image")   # image | stream | video
    face_detected= Column(Boolean,    default=False)
    features_json= Column(JSON,       nullable=True)
    context_json = Column(JSON,       nullable=True)
    nlp_json     = Column(JSON,       nullable=True)
    processing_ms= Column(Float,      nullable=True)
    image_w      = Column(Integer,    nullable=True)
    image_h      = Column(Integer,    nullable=True)
    created_at   = Column(DateTime,   default=_utcnow)

    def to_dict(self):
        return {
            "id":           self.id,
            "mode":         self.mode,
            "face_detected":self.face_detected,
            "features":     self.features_json,
            "context":      self.context_json,
            "nlp":          self.nlp_json,
            "processing_ms":self.processing_ms,
            "created_at":   self.created_at.isoformat() if self.created_at else None,
        }


# ── Engine & session factory ──────────────────────────────────────────────────
_engine = None
_Session = None

def get_engine():
    global _engine
    if _engine is None:
        connect_args = {}
        if config.DATABASE_URL.startswith("sqlite"):
            connect_args = {"check_same_thread": False}
        _engine = create_engine(
            config.DATABASE_URL,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
            connect_args=connect_args,
            echo=config.DEBUG,
        )
        Base.metadata.create_all(_engine)
    return _engine

def get_session():
    global _Session
    if _Session is None:
        _Session = scoped_session(sessionmaker(bind=get_engine()))
    return _Session()

def close_session(exception=None):
    global _Session
    if _Session:
        _Session.remove()
