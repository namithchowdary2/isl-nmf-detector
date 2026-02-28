"""
ML/NLP Pipeline for ISL Non-Manual Features.

Components:
1. NMFClassifier  — sklearn-based rule-augmented classifier
2. ISLSentenceNLP — NLP model for sentence-level grammatical annotation
3. TemporalBuffer  — rolling window for temporal context across frames
"""
import logging
import numpy as np
from typing import Dict, List, Any, Optional
from collections import deque
import threading

logger = logging.getLogger(__name__)

# ── Feature vector ordering (must be consistent) ─────────────────────────────
FEATURE_KEYS = [
    "eyebrow_raise", "eyebrow_furrow", "brow_asymmetry",
    "eye_widening",  "eye_squint",
    "mouth_open",    "lip_compress",    "mouth_corner_up", "mouth_corner_down",
    "cheek_puff",    "head_tilt_left",  "head_tilt_right",
    "chin_down",     "jaw_drop",        "nose_wrinkle",
]

# ── ISL Grammatical pattern rules (weighted voting) ──────────────────────────
# Each rule: (feature_requirements: dict[key->min_score], label, weight, description)
ISL_GRAMMAR_RULES = [
    # Questions
    ({"eyebrow_raise": 0.45}, "YES_NO_Q", 0.90,
     "Raised brows → yes/no question marker"),
    ({"eyebrow_furrow": 0.40}, "WH_Q", 0.85,
     "Furrowed brows → wh-question marker"),
    ({"eyebrow_furrow": 0.35, "eye_squint": 0.30}, "WH_Q_EMPHATIC", 0.88,
     "Furrow + squint → emphatic wh-question"),

    # Negation
    ({"eyebrow_furrow": 0.38, "mouth_corner_down": 0.30}, "NEGATION", 0.92,
     "Furrow + frown → negation"),
    ({"eyebrow_furrow": 0.38, "lip_compress": 0.30}, "NEGATION", 0.85,
     "Furrow + compressed lips → negation"),
    ({"nose_wrinkle": 0.40}, "NEGATION_STRONG", 0.75,
     "Nose wrinkle → strong negation or disgust"),

    # Affirmation
    ({"chin_down": 0.35}, "AFFIRMATION", 0.85,
     "Chin down → head nod affirmation"),
    ({"mouth_corner_up": 0.35, "eyebrow_raise": 0.25}, "AFFIRMATION", 0.80,
     "Raised corners + brows → positive affirmation"),

    # Intensifiers
    ({"eye_widening": 0.42}, "INTENSIFIER", 0.88,
     "Wide eyes → intensity marker"),
    ({"jaw_drop": 0.40}, "EXCLAMATION", 0.90,
     "Jaw drop → exclamation / strong surprise"),

    # Classifiers
    ({"cheek_puff": 0.40}, "CLASSIFIER_LARGE", 0.85,
     "Cheek puff → large/round object classifier"),

    # Topic structure
    ({"head_tilt_left": 0.35}, "TOPIC_L", 0.80,
     "Left head tilt → topic–comment separator"),
    ({"head_tilt_right": 0.35}, "TOPIC_R", 0.80,
     "Right head tilt → topic–comment separator"),
    ({"brow_asymmetry": 0.40}, "CONTRASTIVE", 0.75,
     "Brow asymmetry → contrastive / rhetorical"),

    # Doubt
    ({"eye_squint": 0.35, "eyebrow_furrow": 0.30}, "DOUBT", 0.82,
     "Squint + furrow → doubt or uncertainty"),

    # Conditional
    ({"eyebrow_raise": 0.35, "head_tilt_left": 0.25}, "CONDITIONAL", 0.78,
     "Raise + tilt → conditional clause marker"),
    ({"eyebrow_raise": 0.35, "head_tilt_right": 0.25}, "CONDITIONAL", 0.78,
     "Raise + tilt → conditional clause marker"),
]

LABEL_META = {
    "YES_NO_Q":        {"display": "Yes/No Question",     "color": "#4ade80",  "grammar": "Sentence type"},
    "WH_Q":            {"display": "Wh- Question",         "color": "#facc15",  "grammar": "Sentence type"},
    "WH_Q_EMPHATIC":   {"display": "Emphatic Wh- Question","color": "#fbbf24",  "grammar": "Sentence type"},
    "NEGATION":        {"display": "Negation",             "color": "#f87171",  "grammar": "Polarity"},
    "NEGATION_STRONG": {"display": "Strong Negation",      "color": "#ef4444",  "grammar": "Polarity"},
    "AFFIRMATION":     {"display": "Affirmation",          "color": "#34d399",  "grammar": "Polarity"},
    "INTENSIFIER":     {"display": "Intensifier",          "color": "#a78bfa",  "grammar": "Degree"},
    "EXCLAMATION":     {"display": "Exclamation",          "color": "#f59e0b",  "grammar": "Sentence type"},
    "CLASSIFIER_LARGE":{"display": "Classifier (Large)",   "color": "#fb923c",  "grammar": "Morphology"},
    "TOPIC_L":         {"display": "Topic Marker (L)",     "color": "#60a5fa",  "grammar": "Discourse"},
    "TOPIC_R":         {"display": "Topic Marker (R)",     "color": "#60a5fa",  "grammar": "Discourse"},
    "CONTRASTIVE":     {"display": "Contrastive/Rhetorical","color": "#818cf8", "grammar": "Discourse"},
    "DOUBT":           {"display": "Doubt/Uncertainty",    "color": "#94a3b8",  "grammar": "Modality"},
    "CONDITIONAL":     {"display": "Conditional Clause",   "color": "#38bdf8",  "grammar": "Syntax"},
}


class NMFClassifier:
    """
    Rule-augmented ensemble classifier for NMF → grammatical label.
    Uses sklearn RandomForest as secondary model for ambiguous cases.
    """

    def __init__(self):
        self._rf = None
        self._init_sklearn()

    def _init_sklearn(self):
        try:
            from sklearn.ensemble import RandomForestClassifier
            # Train a tiny synthetic model on rule-generated samples
            X, y = self._generate_synthetic_data(n=2000)
            self._rf = RandomForestClassifier(
                n_estimators=100, max_depth=8, n_jobs=-1, random_state=42
            )
            self._rf.fit(X, y)
            logger.info("RandomForest NMF classifier trained on synthetic data.")
        except Exception as e:
            logger.warning(f"sklearn unavailable: {e}. Rule-only mode.")
            self._rf = None

    def _generate_synthetic_data(self, n: int):
        """Generate labelled feature vectors from grammar rules."""
        rng = np.random.RandomState(42)
        X, y = [], []

        label_to_int = {lbl: i for i, lbl in enumerate(LABEL_META)}

        for _ in range(n):
            vec = rng.uniform(0, 0.2, len(FEATURE_KEYS))
            feats_dict = dict(zip(FEATURE_KEYS, vec))

            # Activate one random rule
            rule = ISL_GRAMMAR_RULES[rng.randint(len(ISL_GRAMMAR_RULES))]
            reqs, label, _, _ = rule
            for k, min_v in reqs.items():
                if k in feats_dict:
                    idx = FEATURE_KEYS.index(k)
                    vec[idx] = rng.uniform(min_v, min(1.0, min_v + 0.3))

            if label in label_to_int:
                X.append(vec)
                y.append(label_to_int[label])

        return np.array(X), np.array(y)

    def classify(self, features: Dict[str, float]) -> List[Dict[str, Any]]:
        """
        Given a features dict (key → score 0-1), return list of
        grammatical annotations sorted by confidence.
        """
        results: Dict[str, float] = {}

        # ── Rule-based voting ─────────────────────────────────────────────
        for reqs, label, weight, desc in ISL_GRAMMAR_RULES:
            satisfied = all(features.get(k, 0) >= v for k, v in reqs.items())
            if satisfied:
                # Confidence = weight × mean activation of required features
                activation = np.mean([features.get(k, 0) for k in reqs])
                conf = float(weight * min(1.0, activation / 0.55))
                if label not in results or results[label] < conf:
                    results[label] = conf

        # ── RF secondary pass (only for uncertain cases) ──────────────────
        if self._rf and len(results) == 0:
            vec = np.array([features.get(k, 0) for k in FEATURE_KEYS]).reshape(1, -1)
            try:
                proba = self._rf.predict_proba(vec)[0]
                label_names = list(LABEL_META.keys())
                top = np.argsort(proba)[::-1][:3]
                for idx in top:
                    if idx < len(label_names) and proba[idx] > 0.30:
                        lbl = label_names[idx]
                        if lbl not in results:
                            results[lbl] = float(proba[idx]) * 0.80  # slight discount for RF

            except Exception:
                pass

        # ── Build output list ─────────────────────────────────────────────
        out = []
        for lbl, conf in sorted(results.items(), key=lambda x: -x[1]):
            meta = LABEL_META.get(lbl, {})
            out.append({
                "type":        lbl,
                "label":       meta.get("display", lbl),
                "confidence":  round(conf, 4),
                "color":       meta.get("color", "#aaa"),
                "grammar_cat": meta.get("grammar", ""),
                "description": next((r[3] for r in ISL_GRAMMAR_RULES if r[1] == lbl), ""),
            })

        return out[:5]  # top-5 predictions


class ISLSentenceNLP:
    """
    NLP-level analysis: given a sequence of NMF-annotated frames,
    produce a sentence-level parse with grammatical structure tags.

    Uses a rule-based + simple n-gram approach (no heavy transformer
    needed for pure non-manual feature grammar).
    """

    # ISL grammatical sentence structures (simplified)
    STRUCTURES = {
        "SVO":         "Subject–Verb–Object (canonical ISL word order)",
        "SOV":         "Subject–Object–Verb (common in ISL declarative)",
        "TOPIC_COMMENT": "Topic–Comment structure (marked by head tilt + brow raise)",
        "QUESTION":    "Interrogative (yes/no or wh-)",
        "NEG_SENTENCE":"Negative sentence",
        "CONDITIONAL": "If–Then conditional",
        "EXCLAMATORY": "Exclamatory sentence",
    }

    def analyze_sentence(self, frame_contexts: List[List[Dict]]) -> Dict[str, Any]:
        """
        Takes a list of per-frame context annotations (from classifier)
        and produces sentence-level analysis.
        """
        if not frame_contexts:
            return {"structure": None, "tags": [], "summary": "No data"}

        # Flatten all context types across frames
        all_types = []
        for frame in frame_contexts:
            for ctx in frame:
                all_types.append(ctx.get("type", ""))

        type_counts = {}
        for t in all_types:
            type_counts[t] = type_counts.get(t, 0) + 1

        dominant = max(type_counts, key=type_counts.get) if type_counts else None

        # Infer sentence structure
        structure = self._infer_structure(type_counts)

        # Build tags
        tags = []
        if "YES_NO_Q" in type_counts or "WH_Q" in type_counts:
            tags.append({"tag": "QUESTION",   "color": "#facc15"})
        if "NEGATION" in type_counts or "NEGATION_STRONG" in type_counts:
            tags.append({"tag": "NEGATIVE",   "color": "#f87171"})
        if "AFFIRMATION" in type_counts:
            tags.append({"tag": "AFFIRMATIVE","color": "#4ade80"})
        if "TOPIC_L" in type_counts or "TOPIC_R" in type_counts:
            tags.append({"tag": "TOPIC-COMMENT", "color": "#60a5fa"})
        if "INTENSIFIER" in type_counts:
            tags.append({"tag": "INTENSIFIED","color": "#a78bfa"})
        if "CONDITIONAL" in type_counts:
            tags.append({"tag": "CONDITIONAL","color": "#38bdf8"})

        # NMF summary text
        summary = self._build_summary(type_counts, structure)

        return {
            "structure":     structure,
            "structure_desc":self.STRUCTURES.get(structure, ""),
            "tags":          tags,
            "dominant_nmf":  dominant,
            "type_counts":   type_counts,
            "summary":       summary,
            "frame_count":   len(frame_contexts),
        }

    def _infer_structure(self, type_counts: Dict[str, int]) -> str:
        has = lambda *keys: any(type_counts.get(k, 0) > 0 for k in keys)

        if has("YES_NO_Q", "WH_Q", "WH_Q_EMPHATIC"):
            return "QUESTION"
        if has("NEGATION", "NEGATION_STRONG"):
            return "NEG_SENTENCE"
        if has("TOPIC_L", "TOPIC_R") and has("AFFIRMATION"):
            return "TOPIC_COMMENT"
        if has("CONDITIONAL"):
            return "CONDITIONAL"
        if has("EXCLAMATION"):
            return "EXCLAMATORY"
        return "SOV"

    def _build_summary(self, type_counts: Dict[str, int], structure: str) -> str:
        parts = []
        if structure == "QUESTION":
            q_type = "yes/no question" if "YES_NO_Q" in type_counts else "wh-question"
            parts.append(f"Signer is asking a {q_type}.")
        elif structure == "NEG_SENTENCE":
            parts.append("Signer is producing a negative sentence.")
        elif structure == "TOPIC_COMMENT":
            parts.append("Topic–comment structure detected.")
        elif structure == "CONDITIONAL":
            parts.append("Conditional clause detected.")
        elif structure == "EXCLAMATORY":
            parts.append("Exclamatory or surprise expression.")
        else:
            parts.append("Declarative ISL sentence (SOV order).")

        if "INTENSIFIER" in type_counts:
            parts.append("Intensity markers present.")
        if "CLASSIFIER_LARGE" in type_counts:
            parts.append("Large/round object classifier in use.")
        if "CONTRASTIVE" in type_counts:
            parts.append("Contrastive or rhetorical structure.")

        return " ".join(parts)


# ── Temporal rolling buffer (for live streaming) ─────────────────────────────
class TemporalBuffer:
    """
    Thread-safe rolling window of feature dicts.
    Smooths per-frame predictions to reduce flicker.
    """

    def __init__(self, window: int = 8):
        self._window = window
        self._lock   = threading.Lock()
        self._buf: deque = deque(maxlen=window)
        self._ctx_buf: deque = deque(maxlen=window)

    def push(self, features: Dict, contexts: List):
        with self._lock:
            self._buf.append(features)
            self._ctx_buf.append(contexts)

    def smoothed_features(self) -> Dict[str, float]:
        with self._lock:
            if not self._buf:
                return {}
            keys = set()
            for f in self._buf:
                keys.update(f.keys())
            out = {}
            for k in keys:
                vals = [f.get(k, 0) for f in self._buf]
                out[k] = float(np.mean(vals))
            # Threshold: only keep if mean > 0.2
            return {k: v for k, v in out.items() if v > 0.20}

    def recent_contexts(self) -> List[List[Dict]]:
        with self._lock:
            return list(self._ctx_buf)

    def clear(self):
        with self._lock:
            self._buf.clear()
            self._ctx_buf.clear()


# ── Singletons ────────────────────────────────────────────────────────────────
_classifier_lock = threading.Lock()
_classifier_instance: Optional[NMFClassifier] = None
_nlp_instance: Optional[ISLSentenceNLP] = None


def get_classifier() -> NMFClassifier:
    global _classifier_instance
    if _classifier_instance is None:
        with _classifier_lock:
            if _classifier_instance is None:
                _classifier_instance = NMFClassifier()
    return _classifier_instance


def get_nlp() -> ISLSentenceNLP:
    global _nlp_instance
    if _nlp_instance is None:
        _nlp_instance = ISLSentenceNLP()
    return _nlp_instance
