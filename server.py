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
import llm
import safeguarding
import study
import scenario_gen
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
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "1") == "1",
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


# ---------------------------------------------------------------- admin

@app.route("/api/admin/stats")
def admin_stats():
    uid = current_user_id()
    if not uid or not db.is_admin(uid):
        return jsonify({"error": "forbidden"}), 403
    return jsonify(db.admin_stats())


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

    system = (coach.build_decision_prompt(slug, context=ctx, scenario=scenario_ctx)
              if scenario_ctx else coach.build_system_prompt(slug, context=ctx))

    # Safeguarding runs on the person's latest message. It never blocks the
    # reply — it augments the system prompt and attaches resources alongside,
    # because being cut off mid-disclosure is its own harm.
    signal = safeguarding.detect(messages[-1]["content"])
    if signal:
        system += safeguarding.coach_instruction(signal)
        app.logger.info("safeguarding signal: %s/%s", signal["severity"], signal["category"])

    try:
        reply = llm.chat(system, messages)
    except llm.LLMError as err:
        # Never leak provider/key details to the client; log server-side.
        app.logger.warning("LLM error: %s", err)
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
    return jsonify({
        "enrolled": True,
        "consented": study.has_valid_consent(code),
        "consent_version_current": study.CONSENT_VERSION,
        "consent_version_given": p["consent_version"],
        "features": study.features_for(code),
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
    return jsonify({"enabled": key_present, "provider": provider})


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
def server_error(_e):
    # Never leak stack traces to clients.
    return jsonify({"error": "internal error"}), 500


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG") == "1"
    app.run(debug=debug, port=int(os.environ.get("PORT", 5000)))
