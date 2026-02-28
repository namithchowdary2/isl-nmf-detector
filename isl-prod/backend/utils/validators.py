import re

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")

def validate_email(email: str) -> bool:
    return bool(email and _EMAIL_RE.match(email))

def validate_password(password: str) -> str:
    """Return error string or empty string if OK."""
    if len(password) < 8:
        return "Password must be at least 8 characters."
    if not any(c.isdigit() for c in password):
        return "Password must contain at least one number."
    return ""
