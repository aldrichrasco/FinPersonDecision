"""
Production-ready backend for FinPerson.

- Postgres when DATABASE_URL is set (Render), SQLite locally (zero setup)
- Real signed session cookies after Google ID-token verification
- Per-user persistence: sandbox state survives sign-out and new devices
- Security headers, CORS allow-list, strict input validation, size limits

Local development:
    pip install -r requirements.txt
    export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
    export SECRET_KEY="any-long-random-string"
    python server.py

Production (Render): see render.yaml — build/start commands and env vars
are declared there; attach a Postgres instance and it's used automatically.
"""

import csv
import hashlib
import io
import os
import re
import secrets
import time

# Load .env if present, so a key can live in a file rather than a shell export.
# Deliberately dependency-free: python-dotenv is not required.
def _load_dotenv(path=".env"):
    try:
        with open(path) as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key, val = key.strip(), val.strip().strip('"').strip("'")
                # Real environment variables always win over the file.
                if key and key not in os.environ:
                    os.environ[key] = val
    except FileNotFoundError:
        pass


_load_dotenv()

from flask import Flask, jsonify, request, send_from_directory, session
from werkzeug.security import generate_password_hash, check_password_hash

import db
import ratelimit
import coach
import coach_agent
import crypto
import llm
import billing
import mailer
import safeguarding
import study
import scenario_gen
import quiz_gen
from ratelimit import rate_limit

try:
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    GOOGLE_AUTH_AVAILABLE = True
except ImportError:
    GOOGLE_AUTH_AVAILABLE = False

app = Flask(__name__, static_folder=".", static_url_path="")

app.config["MAX_CONTENT_LENGTH"] = 32 * 1024
# SECRET_KEY signs the session cookie. In production set it explicitly;
# the random fallback works but invalidates sessions on every restart.
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
# Same flag gates the cookie's Secure attribute and the HSTS header below —
# both are "this is running under real HTTPS" signals, so one env var
# covers both rather than needing two.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "1") == "1"
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=COOKIE_SECURE,
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 30,  # 30 days
)

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
ALLOWED_ORIGINS = {
    o.strip() for o in os.environ.get("ALLOWED_ORIGIN", "").split(",") if o.strip()
}

PERSONA_FINANCE = {
    "steady_saver":            {"income": 5200, "expenses": 3400, "savings": 18000, "investments": 12000, "debt": 2000},
    "cautious_guardian":       {"income": 4800, "expenses": 3100, "savings": 22000, "investments": 8000,  "debt": 1000},
    "conscious_spender":       {"income": 4500, "expenses": 3300, "savings": 9000,  "investments": 6000,  "debt": 3000},
    "ambitious_builder":       {"income": 6200, "expenses": 3800, "savings": 7000,  "investments": 25000, "debt": 15000},
    "strategic_risk_taker":    {"income": 5800, "expenses": 3600, "savings": 5000,  "investments": 30000, "debt": 8000},
    "overconfident_navigator": {"income": 5500, "expenses": 4200, "savings": 3000,  "investments": 18000, "debt": 12000},
    "status_seeker":           {"income": 5900, "expenses": 5300, "savings": 1500,  "investments": 4000,  "debt": 22000},
    "impulsive_spender":       {"income": 4200, "expenses": 4600, "savings": 800,   "investments": 500,   "debt": 9000},
    "anxious_avoider":         {"income": 4300, "expenses": 3200, "savings": 6000,  "investments": 1000,  "debt": 4000},
    "passive_drifter":         {"income": 3900, "expenses": 3300, "savings": 2500,  "investments": 0,     "debt": 6000},
    "purposeful_giver":        {"income": 4700, "expenses": 3500, "savings": 5000,  "investments": 5000,  "debt": 2000},
}
VALID_SLUGS = set(PERSONA_FINANCE)
CLASSROOM_GAMES = {"trust", "goods", "ultimatum"}

# Mirrors fbm.js AXIS_KEYS — kept as a plain set here since the server never
# needs axis labels/poles, only to validate a client-supplied axis key.
FBM_AXIS_KEYS = {
    "impulse_regulation", "risk_disposition", "temporal_orientation",
    "financial_attentiveness", "financial_self_efficacy", "prosocial_orientation",
}

db.init_db()
study.init_study_tables()


# ---------------------------------------------------------------- security

@app.after_request
def add_security_headers(resp):
    ratelimit.prune()
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if COOKIE_SECURE:
        # Only sent when we know we're behind real HTTPS (Render, or any
        # production deploy) — sending it over plain local http:// would
        # just be noise, since browsers ignore HSTS on non-HTTPS origins.
        resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    resp.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; "
        "script-src 'self' https://accounts.google.com; "
        "frame-src https://accounts.google.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://accounts.google.com",
    )
    origin = request.headers.get("Origin")
    if origin and origin in ALLOWED_ORIGINS:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Vary"] = "Origin"
    return resp


@app.route("/api/<path:_any>", methods=["OPTIONS"])
def cors_preflight(_any):
    return ("", 204)


def current_user_id():
    return session.get("user_id")


# ---------------------------------------------------------------- static

@app.route("/")
def index():
    return send_from_directory(".", "index.html")


# ---------------------------------------------------------------- auth

@app.route("/api/auth/verify", methods=["POST"])
@rate_limit(limit=20, window=60, scope="auth")
def verify_auth():
    """Verify a Google ID token server-side and open a signed session."""
    if not GOOGLE_AUTH_AVAILABLE:
        return jsonify({"error": "google-auth not installed"}), 500
    if not GOOGLE_CLIENT_ID:
        return jsonify({"error": "GOOGLE_CLIENT_ID not set on the server"}), 500

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid JSON body"}), 400
    credential = payload.get("credential")
    if not credential or not isinstance(credential, str):
        return jsonify({"error": "missing credential"}), 400

    try:
        info = id_token.verify_oauth2_token(
            credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError as err:
        return jsonify({"error": f"invalid token: {err}"}), 401

    user = db.get_or_create_user(
        google_sub=info["sub"],
        name=info.get("name", ""),
        email=info.get("email", ""),
        picture=info.get("picture", ""),
    )
    session.permanent = True
    session["user_id"] = user["id"]
    return jsonify({"name": user["name"], "email": user["email"], "picture": user["picture"]})


@app.route("/api/auth/session")
def auth_session():
    """Lets the frontend check for an existing session on page load."""
    uid = current_user_id()
    if not uid:
        return jsonify({"signed_in": False})
    return jsonify({"signed_in": True})


@app.route("/api/auth/signout", methods=["POST"])
def signout():
    session.clear()
    return jsonify({"ok": True})


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@app.route("/api/auth/signup", methods=["POST"])
@rate_limit(limit=10, window=3600, scope="signup")
def signup():
    """Email/password registration as an alternative to Google sign-in."""
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid JSON body"}), 400
    email = str(payload.get("email", "")).strip().lower()
    password = payload.get("password", "")
    name = str(payload.get("name", "")).strip()[:80] or email.split("@")[0]

    if not EMAIL_RE.match(email):
        return jsonify({"error": "enter a valid email"}), 400
    if not isinstance(password, str) or len(password) < 8:
        return jsonify({"error": "password must be at least 8 characters"}), 400

    user = db.create_password_user(email, generate_password_hash(password), name)
    if user is None:
        return jsonify({"error": "an account with that email already exists"}), 409

    session.permanent = True
    session["user_id"] = user["id"]
    return jsonify({"name": user["name"], "email": user["email"], "picture": ""})


@app.route("/api/auth/login", methods=["POST"])
@rate_limit(limit=10, window=300, scope="login")
def login():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid JSON body"}), 400
    email = str(payload.get("email", "")).strip().lower()
    password = payload.get("password", "")

    user = db.get_user_by_email(email)
    # Constant-ish response: don't reveal whether the email exists.
    if not user or not user.get("password_hash") or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "incorrect email or password"}), 401

    session.permanent = True
    session["user_id"] = user["id"]
    return jsonify({"name": user["name"], "email": user["email"], "picture": user["picture"]})


RESET_TOKEN_TTL = 3600  # 1 hour


@app.route("/api/auth/forgot-password", methods=["POST"])
@rate_limit(limit=5, window=3600, scope="forgot-password")
def forgot_password():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid JSON body"}), 400
    email = str(payload.get("email", "")).strip().lower()
    if not EMAIL_RE.match(email):
        return jsonify({"error": "enter a valid email"}), 400

    # Always the same response whether or not the account exists, and
    # whether or not it uses a password at all (a Google-only account has
    # no password_hash) — otherwise this endpoint becomes a way to check
    # who has an account here, same reasoning as the login error above.
    user = db.get_user_by_email(email)
    if user and user.get("password_hash"):
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        db.create_password_reset(user["id"], token_hash, RESET_TOKEN_TTL)
        reset_link = f"{request.host_url.rstrip('/')}/reset-password.html?token={token}"
        mailer.send_email(
            email,
            "Reset your FinPerson password",
            "Someone (hopefully you) asked to reset the password on this FinPerson account.\n\n"
            f"Reset it here — this link works for 1 hour:\n{reset_link}\n\n"
            "If you didn't request this, you can ignore this email and your password will stay the same.",
        )
    return jsonify({"ok": True})


@app.route("/api/auth/reset-password", methods=["POST"])
@rate_limit(limit=10, window=3600, scope="reset-password")
def reset_password():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid JSON body"}), 400
    token = str(payload.get("token", ""))
    password = payload.get("password", "")
    if not token:
        return jsonify({"error": "missing or invalid reset link"}), 400
    if not isinstance(password, str) or len(password) < 8:
        return jsonify({"error": "password must be at least 8 characters"}), 400

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    reset = db.get_password_reset(token_hash)
    if not reset or reset["used"] or reset["expires_at"] < time.time():
        return jsonify({"error": "this reset link is invalid or has expired"}), 400

    db.set_user_password(reset["user_id"], generate_password_hash(password))
    db.consume_password_reset(token_hash)
    return jsonify({"ok": True})


# ---------------------------------------------------------------- admin

@app.route("/api/admin/stats")
def admin_stats():
    uid = current_user_id()
    if not uid or not db.is_admin(uid):
        return jsonify({"error": "forbidden"}), 403
    return jsonify(db.admin_stats())


@app.route("/api/admin/agent-tool-calls")
def admin_agent_tool_calls():
    """Queryable trace of the coaching agent's (LLM_ENGINE=agent) tool use —
    see coach_agent.py's ToolCallLogger. This is what turns "the model
    decides which tool to call" into a demonstrable fact: every row here is
    a real call, in order, grouped by run_id per conversation turn."""
    uid = current_user_id()
    if not uid or not db.is_admin(uid):
        return jsonify({"error": "forbidden"}), 403
    limit = min(200, max(1, request.args.get("limit", 50, type=int) or 50))
    return jsonify({"calls": db.get_recent_agent_tool_calls(limit=limit)})


# ---------------------------------------------------------------- GDPR

@app.route("/api/me/export")
@rate_limit(limit=5, window=3600, scope="export")
def export_me():
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "not signed in"}), 401
    data = db.export_user_data(uid)
    if not data:
        return jsonify({"error": "not found"}), 404
    resp = jsonify(data)
    resp.headers["Content-Disposition"] = "attachment; filename=finperson-my-data.json"
    return resp


@app.route("/api/my/wellbeing-history")
def my_wellbeing_history():
    """A signed-in user's own sandbox wellbeing trajectory, for progress.html's
    real trend chart. Own data only — same auth boundary as /api/me/export."""
    uid = current_user_id()
    if not uid:
        return jsonify({"history": []})
    return jsonify({"history": db.get_wellbeing_history(uid)})


@app.route("/api/my/axis-consistency")
def my_axis_consistency():
    """Per-axis decision consistency for progress.html's radar chart. Own
    data only — same auth boundary as /api/me/export."""
    uid = current_user_id()
    if not uid:
        return jsonify({"by_axis": {}})
    return jsonify({"by_axis": db.get_axis_consistency(uid)})


@app.route("/api/me/delete", methods=["POST"])
@rate_limit(limit=5, window=3600, scope="delete")
def delete_me():
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "not signed in"}), 401
    db.delete_user(uid)
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/research/consent", methods=["GET", "POST"])
def research_consent():
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "not signed in"}), 401
    if request.method == "GET":
        return jsonify(db.get_research_consent(uid))
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid JSON body"}), 400
    consent = bool(payload.get("consent", False))
    source = str(payload.get("source", "onboarding") or "onboarding")[:64]
    version = str(payload.get("version", "v1") or "v1")[:32]
    result = db.set_research_consent(uid, consent, source=source, version=version)
    return jsonify({"ok": True, **result})


@app.route("/api/research/events", methods=["POST"])
def research_events():
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "not signed in"}), 401
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid JSON body"}), 400
    event_type = payload.get("event_type")
    if event_type == "assessment_answer":
        return jsonify(db.log_assessment_answer(uid, payload))
    if event_type == "profile_snapshot":
        return jsonify(db.record_profile_snapshot(uid, payload))
    if event_type == "practice_event":
        return jsonify(db.record_practice_event(uid, payload))
    if event_type == "goal":
        return jsonify(db.record_goal(uid, payload))
    if event_type == "journal_entry":
        return jsonify(db.record_journal_entry(uid, payload))
    if event_type == "report_entitlement":
        return jsonify(db.record_report_entitlement(uid, payload))
    return jsonify({"error": "unknown event type"}), 400


@app.route("/api/research/export")
def research_export():
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "not signed in"}), 401
    if not db.is_admin(uid):
        return jsonify({"error": "forbidden"}), 403
    return jsonify(db.export_research_dataset())


# ---------------------------------------------------------------- data

@app.route("/api/persona-finance/<slug>")
def persona_finance(slug):
    if slug not in VALID_SLUGS:
        return jsonify({"error": "unknown persona"}), 404
    return jsonify(PERSONA_FINANCE[slug])


@app.route("/api/sandbox-state", methods=["GET", "POST"])
@rate_limit(limit=120, window=60, scope="state")
def sandbox_state():
    """Persist sandbox progress for signed-in users; anonymous users get a no-op empty state."""
    uid = current_user_id()
    if not uid:
        if request.method == "GET":
            return jsonify({"state": {}})
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not isinstance(payload.get("state"), dict):
            return jsonify({"error": "invalid JSON body"}), 400
        return jsonify({"ok": True})

    if request.method == "GET":
        state = db.get_state(uid)
        return jsonify({"state": state})
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("state"), dict):
        return jsonify({"error": "invalid JSON body"}), 400
    db.save_state(uid, payload["state"])
    return jsonify({"ok": True})


@app.route("/api/learn/progress", methods=["GET", "POST"])
@rate_limit(limit=120, window=60, scope="state")
def learn_progress():
    """Persist Learn-module streak/XP/completed lessons for signed-in users;
    anonymous users get a no-op empty state (client falls back to localStorage)."""
    uid = current_user_id()
    if not uid:
        if request.method == "GET":
            return jsonify({"progress": {}})
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not isinstance(payload.get("progress"), dict):
            return jsonify({"error": "invalid JSON body"}), 400
        return jsonify({"ok": True})

    if request.method == "GET":
        progress = db.get_learning_progress(uid)
        return jsonify({"progress": progress or {}})
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("progress"), dict):
        return jsonify({"error": "invalid JSON body"}), 400
    db.save_learning_progress(uid, payload["progress"])
    return jsonify({"ok": True})


@app.route("/api/roadmap/progress", methods=["GET", "POST"])
@rate_limit(limit=120, window=60, scope="state")
def roadmap_progress():
    """Persist the app-wide roadmap's XP/streak/completed levels (roadmap.js)
    for signed-in users; anonymous users get a no-op empty state (client
    falls back to localStorage). Same shape and pattern as /api/learn/
    progress above, kept as a separate store — see db.py's ddl_roadmap_progress
    comment for why."""
    uid = current_user_id()
    if not uid:
        if request.method == "GET":
            return jsonify({"progress": {}})
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not isinstance(payload.get("progress"), dict):
            return jsonify({"error": "invalid JSON body"}), 400
        return jsonify({"ok": True})

    if request.method == "GET":
        progress = db.get_roadmap_progress(uid)
        return jsonify({"progress": progress or {}})
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("progress"), dict):
        return jsonify({"error": "invalid JSON body"}), 400
    db.save_roadmap_progress(uid, payload["progress"])
    return jsonify({"ok": True})


@app.route("/api/training/progress", methods=["GET", "POST"])
@rate_limit(limit=120, window=60, scope="state")
def training_progress():
    """Persist Behavioral Training's per-level spaced-repetition state
    (training.js) for signed-in users; anonymous users get a no-op empty
    state (client falls back to localStorage). Same pattern as /api/learn/
    progress and /api/roadmap/progress above."""
    uid = current_user_id()
    if not uid:
        if request.method == "GET":
            return jsonify({"progress": {}})
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not isinstance(payload.get("progress"), dict):
            return jsonify({"error": "invalid JSON body"}), 400
        return jsonify({"ok": True})

    if request.method == "GET":
        progress = db.get_training_progress(uid)
        return jsonify({"progress": progress or {}})
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("progress"), dict):
        return jsonify({"error": "invalid JSON body"}), 400
    db.save_training_progress(uid, payload["progress"])
    return jsonify({"ok": True})


@app.route("/api/idm-state", methods=["GET", "POST"])
@rate_limit(limit=120, window=60, scope="state")
def idm_state():
    """Persist idm.js calibration state for signed-in users; anonymous users
    get a no-op empty state (client falls back to localStorage-only)."""
    uid = current_user_id()
    if not uid:
        if request.method == "GET":
            return jsonify({"state": {}})
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not isinstance(payload.get("state"), dict):
            return jsonify({"error": "invalid JSON body"}), 400
        return jsonify({"ok": True})

    if request.method == "GET":
        state = db.get_idm_state(uid)
        return jsonify({"state": state or {}})
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("state"), dict):
        return jsonify({"error": "invalid JSON body"}), 400
    db.save_idm_state(uid, payload["state"])
    return jsonify({"ok": True})


@app.route("/api/achievements", methods=["GET", "POST"])
@rate_limit(limit=120, window=60, scope="state")
def achievements():
    """Persist unlocked achievement ids for signed-in users; anonymous users
    get a no-op empty list (client falls back to localStorage-only)."""
    uid = current_user_id()
    if not uid:
        if request.method == "GET":
            return jsonify({"unlocked": []})
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not isinstance(payload.get("unlocked"), list):
            return jsonify({"error": "invalid JSON body"}), 400
        return jsonify({"ok": True})

    if request.method == "GET":
        return jsonify({"unlocked": db.get_achievements(uid)})
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("unlocked"), list):
        return jsonify({"error": "invalid JSON body"}), 400
    ids = [str(i)[:64] for i in payload["unlocked"] if isinstance(i, str)][:100]
    db.save_achievements(uid, ids)
    return jsonify({"ok": True})


def _sanitize_goals(items):
    """Same shape goals.js keeps in localStorage — validated defensively
    since it arrives as arbitrary client JSON."""
    cleaned = []
    for g in items[:200]:
        if not isinstance(g, dict):
            continue
        gid, title = g.get("id"), g.get("title")
        if not isinstance(gid, str) or not isinstance(title, str) or not title.strip():
            continue
        target = g.get("targetAmount")
        saved = g.get("savedAmount")
        cleaned.append({
            "id": gid[:64],
            "title": title[:120],
            "note": g.get("note")[:400] if isinstance(g.get("note"), str) else "",
            "targetAmount": target if isinstance(target, (int, float)) else None,
            "savedAmount": saved if isinstance(saved, (int, float)) else 0,
            "done": bool(g.get("done")),
        })
    return cleaned


@app.route("/api/goals", methods=["GET", "POST"])
@rate_limit(limit=120, window=60, scope="state")
def goals():
    """Persist goals.js's per-user goal list for signed-in users; anonymous
    users get a no-op empty list (client falls back to localStorage-only)."""
    uid = current_user_id()
    if not uid:
        if request.method == "GET":
            return jsonify({"goals": []})
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not isinstance(payload.get("goals"), list):
            return jsonify({"error": "invalid JSON body"}), 400
        return jsonify({"ok": True})

    if request.method == "GET":
        return jsonify({"goals": db.get_user_goals(uid) or []})
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("goals"), list):
        return jsonify({"error": "invalid JSON body"}), 400
    db.save_user_goals(uid, _sanitize_goals(payload["goals"]))
    return jsonify({"ok": True})


def _valid_profile_blob(payload):
    if not isinstance(payload, dict):
        return None
    profile = payload.get("profile")
    if not isinstance(profile, dict) or set(profile) != FBM_AXIS_KEYS:
        return None
    for v in profile.values():
        if not isinstance(v, (int, float)) or not (0 <= v <= 100):
            return None
    archetype = payload.get("archetype")
    if archetype is not None and archetype not in VALID_SLUGS:
        return None
    capability = payload.get("capability")
    if capability is not None and (not isinstance(capability, (int, float)) or not (0 <= capability <= 100)):
        return None
    at = payload.get("at")
    if not isinstance(at, (int, float)):
        return None
    return {"profile": profile, "archetype": archetype, "capability": capability, "at": at}


@app.route("/api/profile", methods=["GET", "POST"])
@rate_limit(limit=120, window=60, scope="state")
def profile():
    """Server copy of data.js's six-axis quiz profile (getProfile()/
    saveProfile()), same anonymous-no-op / signed-in-real-persistence shape
    as /api/goals above. Anonymous users keep working entirely on
    localStorage; only signed-in profiles ever reach this table."""
    uid = current_user_id()
    if not uid:
        if request.method == "GET":
            return jsonify({"profile": None})
        blob = _valid_profile_blob(request.get_json(silent=True))
        if blob is None:
            return jsonify({"error": "invalid JSON body"}), 400
        return jsonify({"ok": True})

    if request.method == "GET":
        return jsonify({"profile": db.get_user_profile(uid)})
    blob = _valid_profile_blob(request.get_json(silent=True))
    if blob is None:
        return jsonify({"error": "invalid JSON body"}), 400
    db.save_user_profile(uid, blob)
    return jsonify({"ok": True})


@app.route("/api/profile/nudge-log", methods=["GET", "POST"])
@rate_limit(limit=120, window=60, scope="state")
def profile_nudge_log():
    """Audit trail for classroom-driven profile nudges (see nudgeAxis() in
    classroom-page.js) — signed-in only, since a nudge only ever applies to
    an identifiable person's own saved profile, not an anonymous play."""
    uid = current_user_id()
    if not uid:
        if request.method == "GET":
            return jsonify({"entries": []})
        return jsonify({"ok": True})

    if request.method == "GET":
        return jsonify({"entries": db.get_profile_nudge_log(uid)})

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid JSON body"}), 400
    axis = payload.get("axis")
    delta = payload.get("delta")
    source = payload.get("source")
    if axis not in FBM_AXIS_KEYS:
        return jsonify({"error": "invalid axis"}), 400
    if not isinstance(delta, int) or not (-4 <= delta <= 4):
        return jsonify({"error": "invalid delta"}), 400
    if source is not None and (not isinstance(source, str) or len(source) > 64):
        return jsonify({"error": "invalid source"}), 400
    db.record_profile_nudge(uid, axis, delta, source)
    return jsonify({"ok": True})


@app.route("/api/billing/create-checkout-session", methods=["POST"])
@rate_limit(limit=10, window=60, scope="billing")
def billing_create_checkout_session():
    """Starts a real Stripe Checkout session for a monthly-supporter
    subscription — Stripe's hosted page collects the card, FinPerson never
    sees it. Nothing is gated on the result yet; see billing.py."""
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "not signed in"}), 401
    if not billing.billing_configured():
        return jsonify({"error": "billing not configured"}), 503
    email = db.get_user_email(uid)
    base = request.host_url.rstrip("/")
    try:
        url = billing.create_checkout_session(
            customer_email=email,
            client_reference_id=str(uid),
            success_url=f"{base}/donate.html?billing=success",
            cancel_url=f"{base}/donate.html?billing=cancel",
        )
    except billing.BillingError as err:
        app.logger.warning("billing error: %s", err)
        return jsonify({"error": "could not start checkout"}), 503
    return jsonify({"url": url})


@app.route("/api/billing/webhook", methods=["POST"])
def billing_webhook():
    """Stripe calls this directly (no session cookie) — authenticity comes
    from the signature, not from being signed in. Not rate-limited by IP
    since Stripe's own webhook IPs would all share whatever bucket."""
    if not billing.billing_configured():
        return jsonify({"error": "billing not configured"}), 503
    sig = request.headers.get("Stripe-Signature", "")
    try:
        event = billing.parse_webhook_event(request.get_data(), sig)
    except billing.BillingError as err:
        app.logger.warning("billing webhook rejected: %s", err)
        return jsonify({"error": "invalid signature"}), 400

    obj = event.get("data", {}).get("object", {})
    event_type = event.get("type")
    if event_type in ("checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted"):
        # checkout.session.completed carries `subscription`/`customer`;
        # customer.subscription.* events carry `id`/`customer` directly.
        provider_subscription_id = obj.get("subscription") or obj.get("id")
        provider_customer_id = obj.get("customer")
        status = obj.get("status", "active" if event_type == "checkout.session.completed" else "unknown")
        # client_reference_id only ever appears on checkout.session.completed
        # (it's a Checkout-session field, not a Subscription field) — that's
        # the one moment we can link a Stripe subscription to a FinPerson
        # user_id. Later customer.subscription.* events for the same
        # provider_subscription_id update that same row without needing it
        # again, since upsert_subscription only touches user_id on insert.
        raw_uid = obj.get("client_reference_id")
        user_id = int(raw_uid) if raw_uid and str(raw_uid).isdigit() else None
        if provider_subscription_id:
            db.upsert_subscription(
                user_id=user_id,
                provider="stripe",
                provider_customer_id=provider_customer_id,
                provider_subscription_id=provider_subscription_id,
                plan="supporter",
                status=status,
                current_period_end=obj.get("current_period_end"),
            )
    return jsonify({"ok": True})


@app.route("/api/billing/status")
@rate_limit(limit=60, window=60, scope="billing")
def billing_status():
    uid = current_user_id()
    if not uid:
        return jsonify({"plan": None})
    sub = db.get_subscription(uid)
    return jsonify(sub or {"plan": None})


def subscription_active(uid):
    """Gate for FinPerson Pro features (the Turtle Trading simulation).
    Nothing else in the app reads this — the retail product stays free."""
    if not uid:
        return False
    sub = db.get_subscription(uid)
    return bool(sub and sub.get("status") in ("active", "trialing"))


@app.route("/api/turtle/session", methods=["GET", "POST"])
@rate_limit(limit=60, window=60, scope="turtle")
def turtle_session():
    """Save/list completed Turtle Trading simulation runs — gated behind an
    active subscription, not just sign-in. The quiz in pro-investors.html
    stays free; this is the paid depth."""
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "not signed in"}), 401
    if not subscription_active(uid):
        return jsonify({"error": "subscription required"}), 402

    if request.method == "GET":
        return jsonify({"sessions": db.get_turtle_sessions(uid)})

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid JSON body"}), 400
    rounds = payload.get("rounds")
    final_rule_equity = payload.get("final_rule_equity")
    final_player_equity = payload.get("final_player_equity")
    override_count = payload.get("override_count")
    if not isinstance(rounds, list) or len(rounds) > 200:
        return jsonify({"error": "invalid rounds"}), 400
    if not all(isinstance(v, (int, float)) for v in (final_rule_equity, final_player_equity)):
        return jsonify({"error": "invalid equity values"}), 400
    if not isinstance(override_count, int) or override_count < 0:
        return jsonify({"error": "invalid override_count"}), 400
    db.record_turtle_session(uid, rounds, final_rule_equity, final_player_equity, override_count)
    return jsonify({"ok": True})


def _classroom_stats(game, plays):
    """Aggregate stats are computed per-game here (not in db.py) since each
    game's detail_json has a different shape and db.py shouldn't need to
    know what a 'sent' or an 'offer' means for any particular game."""
    details = [p["detail"] for p in plays if isinstance(p.get("detail"), dict)]
    count = len(details)
    if game == "trust":
        sents = [d["sent"] for d in details if isinstance(d.get("sent"), (int, float))]
        return_pcts = [
            d["returned"] / d["pool"] for d in details
            if isinstance(d.get("returned"), (int, float)) and isinstance(d.get("pool"), (int, float)) and d["pool"] > 0
        ]
        return {
            "count": count,
            "avg_sent": round(sum(sents) / len(sents), 2) if sents else None,
            "avg_return_pct": round(sum(return_pcts) / len(return_pcts) * 100, 1) if return_pcts else None,
        }
    if game == "ultimatum":
        offer_pcts = [
            d["offer"] / d["pot"] for d in details
            if isinstance(d.get("offer"), (int, float)) and isinstance(d.get("pot"), (int, float)) and d["pot"] > 0
        ]
        accepted_flags = [d["accepted"] for d in details if isinstance(d.get("accepted"), bool)]
        return {
            "count": count,
            "avg_offer_pct": round(sum(offer_pcts) / len(offer_pcts) * 100, 1) if offer_pcts else None,
            "rejection_rate_pct": round((1 - sum(accepted_flags) / len(accepted_flags)) * 100, 1) if accepted_flags else None,
        }
    if game == "goods":
        firsts = [d["firstRoundTotal"] for d in details if isinstance(d.get("firstRoundTotal"), (int, float))]
        lasts = [d["lastRoundTotal"] for d in details if isinstance(d.get("lastRoundTotal"), (int, float))]
        return {
            "count": count,
            "avg_first_round_total": round(sum(firsts) / len(firsts), 2) if firsts else None,
            "avg_last_round_total": round(sum(lasts) / len(lasts), 2) if lasts else None,
        }
    return {"count": count}


@app.route("/api/classroom-play", methods=["POST"])
@rate_limit(limit=300, window=60, scope="classroom-write")
def classroom_play():
    """Log one classroom.html game result. No user_id is stored — this is
    anonymous by construction, works the same signed-in or not, and a
    school's whole class is often behind one shared IP, hence the higher
    per-IP limit than most write endpoints."""
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid JSON body"}), 400
    game = payload.get("game")
    role = payload.get("role")
    archetype = payload.get("archetype")
    detail = payload.get("detail")
    cohort = payload.get("cohort")
    if game not in CLASSROOM_GAMES:
        return jsonify({"error": "invalid game"}), 400
    if archetype not in VALID_SLUGS:
        return jsonify({"error": "invalid archetype"}), 400
    if not isinstance(role, str) or len(role) > 32:
        return jsonify({"error": "invalid role"}), 400
    if not isinstance(detail, dict):
        return jsonify({"error": "invalid detail"}), 400
    if cohort is not None and (not isinstance(cohort, str) or not cohort.strip() or len(cohort) > 32):
        return jsonify({"error": "invalid cohort"}), 400
    db.record_classroom_play(game, role, archetype, detail, cohort=(cohort.strip() if cohort else None))
    return jsonify({"ok": True})


@app.route("/api/classroom-stats")
@rate_limit(limit=120, window=60, scope="classroom-read")
def classroom_stats():
    """Aggregate, anonymized stats across everyone who's played a given
    classroom game — public, no auth required, since none of this is
    personal data. ?format=csv returns the underlying (still anonymous)
    rows for a quick download instead of the summary."""
    game = request.args.get("game", "")
    cohort = request.args.get("cohort") or None
    if game not in CLASSROOM_GAMES:
        return jsonify({"error": "invalid game"}), 400
    plays = db.get_classroom_plays(game, cohort=cohort, limit=1000)

    if request.args.get("format") == "csv":
        buf = io.StringIO()
        detail_keys = sorted({k for p in plays for k in p["detail"].keys()})
        fieldnames = ["role", "archetype", "created_at"] + detail_keys
        writer = csv.DictWriter(buf, fieldnames=fieldnames)
        writer.writeheader()
        for p in plays:
            row = {"role": p["role"], "archetype": p["archetype"], "created_at": p["created_at"]}
            row.update(p["detail"])
            writer.writerow(row)
        resp = app.response_class(buf.getvalue(), mimetype="text/csv")
        resp.headers["Content-Disposition"] = f"attachment; filename={game}-plays.csv"
        return resp

    return jsonify(_classroom_stats(game, plays))


@app.route("/api/scenario-choice", methods=["POST"])
@rate_limit(limit=120, window=60, scope="write")
def scenario_choice():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid JSON body"}), 400

    # Optional PIPE telemetry, validated against known values so the analytics
    # tables can't be poisoned by arbitrary client input.
    raw = payload.get("homeostasis")
    homeostasis = None
    if isinstance(raw, dict):
        zone = raw.get("zone")
        trig = raw.get("trigger_kind")
        homeostasis = {
            "decision_index": raw.get("decision_index"),
            "wellbeing": raw.get("wellbeing"),
            "zone": zone if zone in ("homeostasis", "breakdown", "distortion") else None,
            "archetype_expected": raw.get("archetype_expected"),
            "gap": raw.get("gap"),
            "trigger_kind": trig if trig in ("breakdown", "distortion") else None,
            "characteristic_drift": raw.get("characteristic_drift"),
            "session_id": raw.get("session_id"),
            "principle": raw.get("principle"),
            "surface": raw.get("surface"),
            "dlo_band": raw.get("dlo_band"),
            "dlo_score": raw.get("dlo_score"),
            "titration": raw.get("titration"),
            "predicted": raw.get("predicted"),
            "prediction_correct": raw.get("prediction_correct"),
            "confidence": raw.get("confidence"),
            "surprise": raw.get("surprise"),
            "c_level": raw.get("c_level"),
            "primary_axis": raw.get("primary_axis") if raw.get("primary_axis") in FBM_AXIS_KEYS else None,
        }

    db.log_choice(
        user_id=current_user_id(),  # None is fine for anonymous users
        persona=payload.get("persona", ""),
        difficulty=payload.get("difficulty", ""),
        choice=payload.get("choice", ""),
        homeostasis=homeostasis,
    )
    return jsonify({"ok": True})


# ---------------------------------------------------------------- coaching chat

MAX_HISTORY_MESSAGES = 20
MAX_MESSAGE_CHARS = 2000

# "direct" (default) is coach.py's static prompt + llm.py's single-shot call.
# "agent" swaps in coach_agent.py: a LangChain tool-using agent that looks up
# the signed-in user's own profile/decisions/goals from the database itself
# instead of trusting a client-supplied context blob. Falls back to "direct"
# automatically if langchain isn't installed (see coach_agent.AgentUnavailable
# below) — this is a config switch, not a hard dependency.
LLM_ENGINE = os.environ.get("LLM_ENGINE", "direct").lower()


@app.route("/api/chat/<slug>", methods=["POST"])
@rate_limit(limit=30, window=60, scope="chat")
def chat(slug):
    """Persona-voiced coaching reply. Anonymous users are allowed."""
    if not coach.is_valid_persona(slug):
        return jsonify({"error": "unknown persona"}), 404

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid JSON body"}), 400

    raw_history = payload.get("messages")
    if not isinstance(raw_history, list) or not raw_history:
        return jsonify({"error": "messages required"}), 400

    # Sanitize: keep only well-formed user/assistant turns, cap length + count.
    messages = []
    for m in raw_history[-MAX_HISTORY_MESSAGES:]:
        if not isinstance(m, dict):
            continue
        role = m.get("role")
        content = m.get("content")
        if role not in ("user", "assistant") or not isinstance(content, str):
            continue
        messages.append({"role": role, "content": content[:MAX_MESSAGE_CHARS]})
    if not messages or messages[-1]["role"] != "user":
        return jsonify({"error": "last message must be from the user"}), 400

    # Safeguarding is computed before the paywall gate below and never
    # blocked by it — a person in real distress must never be turned away
    # by a subscription check. See the "never silently fail" comment further
    # down for why this same signal is threaded through every later branch.
    signal = safeguarding.detect(messages[-1]["content"])

    # AI coaching is the paid tier; the quiz/archetype match (the "Financial
    # MRI") and the practice sandbox stay free. Same subscription_active()
    # gate as /api/turtle/session.
    if not subscription_active(current_user_id()):
        if signal:
            return jsonify({
                "reply": "",
                "persona": slug,
                "safeguarding": safeguarding.response_for(signal),
            })
        return jsonify({"error": "subscription required", "paywall": True}), 402

    # Optional sandbox context. Every field is bounds-checked and type-coerced:
    # this text goes into a model prompt, so untrusted input must not pass
    # through freely.
    ctx = None
    raw_ctx = payload.get("context")
    if isinstance(raw_ctx, dict):
        def _clamp_int(v, lo, hi):
            try:
                return max(lo, min(hi, int(v)))
            except (TypeError, ValueError):
                return None

        zone = raw_ctx.get("zone")
        last_trigger = raw_ctx.get("lastTrigger")
        ctx = {
            "wellbeing": _clamp_int(raw_ctx.get("wellbeing"), 0, 100),
            "zone": zone if zone in ("homeostasis", "breakdown", "distortion") else None,
            "gap": _clamp_int(raw_ctx.get("gap"), -100, 100),
            "totalDecisions": _clamp_int(raw_ctx.get("totalDecisions"), 0, 10000),
            "inZoneCount": _clamp_int(raw_ctx.get("inZoneCount"), 0, 10000),
            "triggerCount": _clamp_int(raw_ctx.get("triggerCount"), 0, 10000),
            "lastTrigger": last_trigger if last_trigger in ("breakdown", "distortion") else None,
            "characteristicDrift": bool(raw_ctx.get("characteristicDrift")),
            "calibration": _clean_calibration(raw_ctx.get("calibration")),
            "recentDecisions": [],
            "quizCapability": _clamp_int(raw_ctx.get("quizCapability"), 0, 100),
            "topStrengthAxis": None,
            "topGrowthAxis": None,
            "learningCompletedCount": _clamp_int(raw_ctx.get("learningCompletedCount"), 0, 1000),
            "learningStreak": _clamp_int(raw_ctx.get("learningStreak"), 0, 1000),
            "goals": [],
        }
        strength_axis = raw_ctx.get("topStrengthAxis")
        if isinstance(strength_axis, str):
            ctx["topStrengthAxis"] = strength_axis[:60]
        growth_axis = raw_ctx.get("topGrowthAxis")
        if isinstance(growth_axis, str):
            ctx["topGrowthAxis"] = growth_axis[:60]
        raw_goals = raw_ctx.get("goals")
        if isinstance(raw_goals, list):
            for goal in raw_goals[:5]:
                if not isinstance(goal, dict):
                    continue
                title = goal.get("title")
                if isinstance(title, str) and title.strip():
                    ctx["goals"].append({"title": title[:120], "done": bool(goal.get("done"))})
        raw_decisions = raw_ctx.get("recentDecisions")
        if isinstance(raw_decisions, list):
            for decision in raw_decisions[-5:]:
                if not isinstance(decision, dict):
                    continue
                choice = decision.get("choice")
                changes = decision.get("changes")
                zone = decision.get("zone")
                if isinstance(choice, str) and isinstance(changes, str):
                    ctx["recentDecisions"].append({
                        "choice": choice[:160],
                        "changes": changes[:240],
                        "zone": zone if zone in ("homeostasis", "breakdown", "distortion") else None,
                    })

    # Inline decision coaching: a scenario currently open on screen.
    raw_scn = payload.get("scenario")
    scenario_ctx = None
    if isinstance(raw_scn, dict):
        opts = raw_scn.get("options")
        scenario_ctx = {
            "text": str(raw_scn.get("text", ""))[:400],
            "options": [str(o)[:120] for o in opts[:4]] if isinstance(opts, list) else [],
        }

    # Signal was already computed above (before the paywall gate). It never
    # blocks the reply — it augments the system prompt and attaches
    # resources alongside, because being cut off mid-disclosure is its own harm.
    # Built once and threaded into whichever engine runs below, so the
    # safeguarding instruction reaches the model the same way regardless of
    # which one is active.
    signal_instruction = None
    if signal:
        signal_instruction = safeguarding.coach_instruction(signal)
        app.logger.info("safeguarding signal: %s/%s", signal["severity"], signal["category"])

    try:
        if LLM_ENGINE == "agent":
            # coach_agent builds its own system prompt (guardrails +
            # homeostasis + persona, same building blocks as coach.py) and
            # fetches its own context via tools instead of the client-
            # supplied `ctx` blob — see coach_agent.py's module docstring.
            reply = coach_agent.run(
                slug, current_user_id(), messages,
                scenario=scenario_ctx, extra_system=signal_instruction,
            )
        else:
            system = (coach.build_decision_prompt(slug, context=ctx, scenario=scenario_ctx)
                      if scenario_ctx else coach.build_system_prompt(slug, context=ctx))
            if signal_instruction:
                system += signal_instruction
            reply = llm.chat(system, messages)
    except (llm.LLMError, coach_agent.AgentUnavailable) as err:
        # Never leak provider/key details to the client; log server-side.
        app.logger.warning("LLM error (%s engine): %s", LLM_ENGINE, err)
        # A safeguarding signal must still reach the person even if the model
        # is unavailable — this is the one path that cannot silently fail.
        if signal:
            return jsonify({
                "reply": "",
                "persona": slug,
                "safeguarding": safeguarding.response_for(signal),
            })
        return jsonify({"error": "the coach is unavailable right now"}), 503

    out = {"reply": reply, "persona": slug}
    if signal:
        out["safeguarding"] = safeguarding.response_for(signal)
    return jsonify(out)


# ---------------------------------------------------------------- crypto impulse check

CRYPTO_VOLATILITY_THRESHOLD_PCT = 8


@app.route("/api/crypto/price")
@rate_limit(limit=30, window=60, scope="crypto")
def crypto_price():
    coin = request.args.get("coin", "bitcoin")
    try:
        price = crypto.get_current_price(coin)
    except ValueError:
        return jsonify({"error": "unsupported coin"}), 400
    except crypto.CryptoAPIError as err:
        app.logger.warning("crypto price fetch failed: %s", err)
        return jsonify({"error": "price data unavailable right now"}), 503
    return jsonify({"coin": coin, "usd": price})


@app.route("/api/crypto/scenario")
@rate_limit(limit=20, window=60, scope="crypto")
def crypto_scenario():
    """A real historical BTC/ETH volatility event, WITHOUT its outcome —
    only the lead-in price path up to and including the event day. The
    outcome is revealed by POST /api/crypto/decision, keyed by
    event_timestamp so the same real event is looked up again rather than
    trusting anything the client could have seen.

    With no event_timestamp, picks a random event (single-scenario mode).
    With one, returns that specific event — used by the chained-decision
    flow to walk /api/crypto/session-events' roadmap in chronological
    order rather than randomly."""
    coin = request.args.get("coin", "bitcoin")
    event_timestamp = request.args.get("event_timestamp", type=float)
    try:
        if event_timestamp is not None:
            scenario = crypto.find_event_by_timestamp(coin, event_timestamp, threshold_pct=CRYPTO_VOLATILITY_THRESHOLD_PCT)
        else:
            scenario = crypto.pick_scenario(coin, threshold_pct=CRYPTO_VOLATILITY_THRESHOLD_PCT)
    except ValueError:
        return jsonify({"error": "unsupported coin"}), 400
    except crypto.CryptoAPIError as err:
        app.logger.warning("crypto scenario fetch failed: %s", err)
        return jsonify({"error": "price data unavailable right now"}), 503
    if not scenario:
        return jsonify({"error": "no volatility event found in the available window"}), 404
    return jsonify({
        "coin": coin,
        "event_timestamp": scenario["event_timestamp"],
        "direction": scenario["direction"],
        "pct_change": scenario["pct_change"],
        "price_at_event": scenario["price_at_event"],
        "lead_in": scenario["lead_in"],
        # Whether this real move was ALSO a Donchian channel breakout (the
        # turtle-sim.js rule) — safe to reveal pre-decision, it's a fact
        # about the lead-in data the player can already see, not the
        # outcome. breakout_continued stays out of this response.
        "breakout_signal": scenario["breakout_signal"],
        "breakout_period": crypto.DONCHIAN_PERIOD,
    })


@app.route("/api/crypto/breakout-stats")
@rate_limit(limit=20, window=60, scope="crypto")
def crypto_breakout_stats():
    """Aggregate, real-data answer to "does a breakout like this usually
    continue?" across every volatility event in the last year for this
    coin — the turtle-trading question crypto-impulse-page.js surfaces
    alongside each scenario."""
    coin = request.args.get("coin", "bitcoin")
    try:
        stats = crypto.get_breakout_stats(coin, threshold_pct=CRYPTO_VOLATILITY_THRESHOLD_PCT)
    except ValueError:
        return jsonify({"error": "unsupported coin"}), 400
    except crypto.CryptoAPIError as err:
        app.logger.warning("crypto breakout stats fetch failed: %s", err)
        return jsonify({"error": "price data unavailable right now"}), 503
    return jsonify(stats)


@app.route("/api/crypto/session-events")
@rate_limit(limit=20, window=60, scope="crypto")
def crypto_session_events():
    """The chronological roadmap a chained decision run steps through —
    every real event_timestamp for this coin, oldest first, with the
    lightweight facts (direction/pct_change/breakout_signal) already safe
    to reveal pre-decision. The client fetches each round's full scenario
    one at a time via GET /api/crypto/scenario?event_timestamp=..."""
    coin = request.args.get("coin", "bitcoin")
    try:
        rounds = crypto.list_session_events(coin, threshold_pct=CRYPTO_VOLATILITY_THRESHOLD_PCT)
    except ValueError:
        return jsonify({"error": "unsupported coin"}), 400
    except crypto.CryptoAPIError as err:
        app.logger.warning("crypto session-events fetch failed: %s", err)
        return jsonify({"error": "price data unavailable right now"}), 503
    if not rounds:
        return jsonify({"error": "no volatility event found in the available window"}), 404
    return jsonify({"coin": coin, "rounds": rounds})


@app.route("/api/crypto/decision", methods=["POST"])
@rate_limit(limit=20, window=60, scope="crypto")
def crypto_decision():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid JSON body"}), 400

    coin = payload.get("coin", "bitcoin")
    choice = payload.get("choice")
    event_timestamp = payload.get("event_timestamp")
    if choice not in ("buy", "hold", "sell"):
        return jsonify({"error": "choice must be buy, hold, or sell"}), 400
    if not isinstance(event_timestamp, (int, float)):
        return jsonify({"error": "event_timestamp required"}), 400

    try:
        event = crypto.find_event_by_timestamp(coin, event_timestamp, threshold_pct=CRYPTO_VOLATILITY_THRESHOLD_PCT)
    except ValueError:
        return jsonify({"error": "unsupported coin"}), 400
    except crypto.CryptoAPIError as err:
        app.logger.warning("crypto decision fetch failed: %s", err)
        return jsonify({"error": "price data unavailable right now"}), 503
    if not event or not event["outcome"]:
        return jsonify({"error": "event not found — it may have aged out of the data window"}), 404

    price_after = event["price_after_outcome"]
    outcome_pct_change = round((price_after - event["price_at_event"]) / event["price_at_event"] * 100, 2)
    player_return_pct = crypto.action_return_pct(event, choice)
    rule_return_pct = crypto.action_return_pct(event, event["breakout_signal"])

    db.record_crypto_impulse_decision(
        user_id=current_user_id(),
        coin_id=coin,
        event_timestamp=event["event_timestamp"],
        direction=event["direction"],
        pct_change=event["pct_change"],
        choice=choice,
        outcome_pct_change=outcome_pct_change,
    )

    return jsonify({
        "coin": coin,
        "choice": choice,
        "direction": event["direction"],
        "pct_change": event["pct_change"],
        "outcome": event["outcome"],
        "outcome_pct_change": outcome_pct_change,
        "breakout_signal": event["breakout_signal"],
        "breakout_continued": event["breakout_continued"],
        "breakout_period": crypto.DONCHIAN_PERIOD,
        "player_return_pct": player_return_pct,
        "rule_return_pct": rule_return_pct,
    })


# ---------------------------------------------------------------- study

def _clean_calibration(raw):
    """Bounds-check calibration state before it reaches a model prompt."""
    if not isinstance(raw, dict):
        return None

    def _f(v, lo, hi):
        try:
            return max(lo, min(hi, float(v)))
        except (TypeError, ValueError):
            return None

    return {
        "confidenceAccuracyGap": _f(raw.get("confidenceAccuracyGap"), -1, 1),
        "meanRecognitionRank": _f(raw.get("meanRecognitionRank"), 0, 3),
        "modelsTransferred": _f(raw.get("modelsTransferred"), 0, 50),
    }


def _study_code():
    """Study code from header or session. Never from a URL, which would leak
    into logs and referrers."""
    return request.headers.get("X-Study-Code") or session.get("study_code")


@app.route("/api/study/enrol", methods=["POST"])
@rate_limit(limit=20, window=3600, scope="enrol")
def study_enrol():
    payload = request.get_json(silent=True) or {}
    code = str(payload.get("code", "")).strip().upper()
    if not code or len(code) > 40 or not code.replace("-", "").isalnum():
        return jsonify({"error": "invalid study code"}), 400
    p = study.enrol(code, cohort=str(payload.get("cohort", ""))[:32] or None)
    if not p:
        return jsonify({"error": "could not enrol"}), 400
    session["study_code"] = p["code"]
    return jsonify({
        "code": p["code"],
        "consented": study.has_valid_consent(p["code"]),
        "consent_version": study.CONSENT_VERSION,
        "features": study.features_for(p["code"]),
    })


@app.route("/api/study/consent", methods=["POST"])
def study_consent():
    code = _study_code()
    if not code:
        return jsonify({"error": "not enrolled"}), 400
    payload = request.get_json(silent=True) or {}
    if payload.get("agreed") is not True:
        return jsonify({"error": "consent not given"}), 400
    p = study.record_consent(code)
    return jsonify({"consented": True, "features": study.features_for(p["code"])})


@app.route("/api/study/status")
def study_status():
    code = _study_code()
    if not code:
        return jsonify({"enrolled": False})
    p = study.get_participant(code)
    if not p:
        return jsonify({"enrolled": False})
    consented = study.has_valid_consent(code)
    return jsonify({
        "enrolled": True,
        "consented": consented,
        "consent_version_current": study.CONSENT_VERSION,
        "consent_version_given": p["consent_version"],
        "features": study.features_for(code),
        # Only ever revealed to an already-consented participant, and only
        # once a batch's code is actually configured — never shown to prove
        # completion before it's earned.
        "completion_code": study.COMPLETION_CODE if consented and study.COMPLETION_CODE else None,
    })


@app.route("/api/study/event", methods=["POST"])
@rate_limit(limit=600, window=60, scope="events")
def study_event():
    """Event capture. Silently no-ops without consent rather than erroring, so
    an unconsented participant's experience is identical to a consented one."""
    code = _study_code()
    payload = request.get_json(silent=True) or {}
    events = payload.get("events")
    if not isinstance(events, list):
        events = [payload]
    written = 0
    for e in events[:50]:
        if not isinstance(e, dict):
            continue
        if study.log_event(code, e.get("session_id"), e.get("type"),
                           e.get("payload"), e.get("ts")):
            written += 1
    return jsonify({"ok": True, "written": written})


@app.route("/api/study/responses", methods=["POST"])
def study_responses():
    code = _study_code()
    payload = request.get_json(silent=True) or {}
    n = study.save_responses(
        code,
        str(payload.get("instrument", ""))[:64],
        str(payload.get("timepoint", "")),
        payload.get("responses"),
    )
    return jsonify({"ok": True, "saved": n})


@app.route("/api/study/withdraw", methods=["POST"])
def study_withdraw():
    code = _study_code()
    if not code:
        return jsonify({"error": "not enrolled"}), 400
    study.withdraw(code)
    session.pop("study_code", None)
    return jsonify({"ok": True})


@app.route("/api/study/summary")
def study_summary_route():
    uid = current_user_id()
    if not uid or not db.is_admin(uid):
        return jsonify({"error": "forbidden"}), 403
    return jsonify(study.study_summary())


@app.route("/api/study/export/<dataset>")
def study_export(dataset):
    uid = current_user_id()
    if not uid or not db.is_admin(uid):
        return jsonify({"error": "forbidden"}), 403
    exporters = {
        "participants": study.export_participants_csv,
        "events": study.export_events_csv,
        "responses": study.export_responses_csv,
        "decisions": study.export_decisions_csv,
        "calibration": study.export_calibration_csv,
    }
    fn = exporters.get(dataset)
    if not fn:
        return jsonify({"error": "unknown dataset"}), 404
    csv_text = fn()
    resp = app.response_class(csv_text, mimetype="text/csv")
    resp.headers["Content-Disposition"] = f"attachment; filename=finperson-{dataset}.csv"
    return resp


@app.route("/api/help-resources")
def help_resources():
    """Always-available signposting, independent of the coach or any AI."""
    return jsonify({
        "support": safeguarding.resources_for(safeguarding.SEVERITY_SUPPORT),
        "urgent": safeguarding.resources_for(safeguarding.SEVERITY_URGENT),
        "crisis": safeguarding.resources_for(safeguarding.SEVERITY_CRISIS),
    })


@app.route("/api/scenario/generate", methods=["POST"])
@rate_limit(limit=40, window=300, scope="scengen")
def generate_scenario():
    """
    Generates a scenario. Returns 204 (not an error) when unavailable, so the
    client falls back to the authored pool silently rather than surfacing a
    failure mid-decision.
    """
    if not scenario_gen.ENABLED:
        return ("", 204)

    # Stimulus control: enrolled participants get the fixed pool unless the
    # protocol explicitly permits generation.
    code = _study_code()
    if code and study.get_participant(code) and not scenario_gen.ALLOW_IN_STUDY:
        return ("", 204)

    payload = request.get_json(silent=True) or {}
    zone = payload.get("zone")
    zone = zone if zone in scenario_gen.VALID_ZONES else "general"
    slug = str(payload.get("persona", ""))[:64]
    persona = coach.PERSONAS.get(slug)
    name, trait = (persona[0], persona[1]) if persona else ("Coach", "")

    # Optional transfer targeting: request a known principle on a new surface.
    principle = payload.get("principle")
    surface = payload.get("surface")
    scenario = scenario_gen.generate(
        zone=zone, persona_name=name, trait=trait,
        principle=principle if principle in scenario_gen.VALID_PRINCIPLES else None,
        surface=surface if surface in scenario_gen.VALID_SURFACES else None,
    )
    if not scenario:
        return ("", 204)
    return jsonify(scenario)


@app.route("/api/quiz/generate-question", methods=["POST"])
@rate_limit(limit=40, window=300, scope="scengen")
def generate_quiz_question():
    """
    Generates a tie-breaking quiz question. Returns 204 (not an error) when
    unavailable, so the client falls back to the fixed TIEBREAKER_QUESTIONS
    bank in quiz.js silently rather than surfacing a failure mid-quiz.
    """
    if not quiz_gen.ENABLED:
        return ("", 204)

    # Stimulus control: enrolled participants get the fixed bank unless the
    # protocol explicitly permits generation — same reasoning as
    # /api/scenario/generate.
    code = _study_code()
    if code and study.get_participant(code) and not quiz_gen.ALLOW_IN_STUDY:
        return ("", 204)

    payload = request.get_json(silent=True) or {}
    situation = str(payload.get("situation", ""))[:120]
    axis_a = payload.get("axisA")
    axis_b = payload.get("axisB")
    if axis_a not in quiz_gen.VALID_AXES or axis_b not in quiz_gen.VALID_AXES:
        return ("", 204)

    question = quiz_gen.generate(situation, axis_a, axis_b)
    if not question:
        return ("", 204)
    return jsonify(question)


@app.route("/api/chat-info")
def chat_info():
    """Lets the frontend know whether the coach is configured."""
    import os as _os
    provider = _os.environ.get("LLM_PROVIDER", "anthropic").lower()
    key_present = bool(
        _os.environ.get("ANTHROPIC_API_KEY")
        or _os.environ.get("OPENAI_API_KEY")
        or _os.environ.get("GOOGLE_API_KEY")
    )
    return jsonify({
        "enabled": key_present, "provider": provider, "engine": LLM_ENGINE,
        "tracing": coach_agent.tracing_enabled(),
    })


# ---------------------------------------------------------------- errors

@app.errorhandler(404)
def not_found(_e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "not found"}), 404
    return send_from_directory(".", "index.html")


@app.errorhandler(413)
def too_large(_e):
    return jsonify({"error": "request too large"}), 413


@app.errorhandler(500)
def server_error(e):
    # Never leak stack traces to clients, but do log the real exception —
    # without this, a production crash shows up in Railway/Render's log
    # viewer as just "internal error" with no way to tell what broke.
    app.logger.exception("unhandled server error: %s", e)
    return jsonify({"error": "internal error"}), 500


# ---------------------------------------------------------------- health

@app.route("/health")
def health():
    """Liveness/readiness check for Railway/Render — verifies the app can
    actually reach its database, not just that the process is up. A cheap
    query, not a full init_db() — this can be polled every few seconds."""
    try:
        db.ping()
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        app.logger.exception("health check failed: %s", e)
        return jsonify({"status": "error"}), 503


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG") == "1"
    app.run(debug=debug, port=int(os.environ.get("PORT", 5000)))
