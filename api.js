// Thin data-access layer between the sandbox UI and your backend.
//
// Set API_BASE_URL once you have a real backend and these functions
// switch from mock data to live calls automatically — nothing in
// dashboard.js needs to change either way.
//
// Expected contract for your backend:
//   GET  {API_BASE_URL}/api/persona-finance/:slug
//        -> 200 { income, expenses, savings, investments, debt }
//   POST {API_BASE_URL}/api/scenario-choice
//        body: { persona, difficulty, scenario, choice, delta, timestamp }
//        -> 200 (fire-and-forget from the client; response is ignored)
//   POST {API_BASE_URL}/api/auth/verify
//        body: { credential }  (the raw Google ID token)
//        -> 200 { name, email, picture }  — only after real server-side verification
//
// server.py in this repo implements all three against Google's actual
// verification library — see README for how to run it.

const API_BASE_URL = ""; // "" = same origin (works when server.py serves the frontend).
// Set a full URL only if the API lives on a different domain. On static
// hosting with no backend, every call below fails fast and falls back
// to mock data / localStorage automatically.

async function fetchPersonaFinance(slug) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/persona-finance/${slug}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("finperson: falling back to mock persona finance data —", err.message);
    return { ...PERSONA_FINANCE[slug] };
  }
}

function logScenarioChoice(payload) {
  fetch(`${API_BASE_URL}/api/scenario-choice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
  }).catch(err => console.warn("finperson: could not log scenario choice —", err.message));
}

// Sends the Google ID token to the backend for real verification
// (see server.py's /api/auth/verify). Returns the verified user object
// from the server if available, or null if there's no backend configured
// or verification fails — callers should keep using the client-side
// decode as a display-only fallback in that case.
async function verifyGoogleCredential(credential) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("finperson: backend token verification unavailable, using client-side decode only —", err.message);
    return null;
  }
}

// --- Signed-in persistence -----------------------------------------
// These no-op harmlessly when there's no backend or no session, so the
// sandbox works identically for anonymous users (localStorage only).

async function fetchSandboxState() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sandbox-state`, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()).state;
  } catch (e) {
    return null;
  }
}

function saveSandboxState(state) {
  fetch(`${API_BASE_URL}/api/sandbox-state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ state }),
  }).catch(() => {});
}

async function fetchLearnProgress() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/learn/progress`, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()).progress;
  } catch (e) {
    return null;
  }
}

function saveLearnProgress(progress) {
  fetch(`${API_BASE_URL}/api/learn/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ progress }),
  }).catch(() => {});
}

// Fire-and-forget, same style as logScenarioChoice. No-ops for anonymous
// users (server 401s, which we ignore) — this is supplementary research
// telemetry, not something the quiz flow depends on.
function logProfileSnapshot(profile, archetype, confidence) {
  fetch(`${API_BASE_URL}/api/research/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      event_type: "profile_snapshot",
      scored_axes: profile,
      persona_hypothesis: archetype,
      confidence,
    }),
  }).catch(() => {});
}

async function fetchAchievements() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/achievements`, { credentials: "include" });
    if (!res.ok) return [];
    return (await res.json()).unlocked || [];
  } catch (e) {
    return [];
  }
}

function saveAchievements(unlocked) {
  fetch(`${API_BASE_URL}/api/achievements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ unlocked }),
  }).catch(() => {});
}

async function fetchIdmState() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/idm-state`, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()).state;
  } catch (e) {
    return null;
  }
}

function saveIdmState(state) {
  fetch(`${API_BASE_URL}/api/idm-state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ state }),
  }).catch(() => {});
}

// Short timeout — a slow/failed generation must never stall the quiz.
// Caller always has the fixed TIEBREAKER_QUESTIONS bank to fall back to.
async function fetchGeneratedQuizQuestion(situationLabel, axisA, axisB) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${API_BASE_URL}/api/quiz/generate-question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: controller.signal,
      body: JSON.stringify({ situation: situationLabel, axisA, axisB }),
    });
    clearTimeout(timeout);
    if (!res.ok || res.status === 204) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function fetchAxisConsistency() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/my/axis-consistency`, { credentials: "include" });
    if (!res.ok) return {};
    return (await res.json()).by_axis || {};
  } catch (e) {
    return {};
  }
}

async function fetchWellbeingHistory() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/my/wellbeing-history`, { credentials: "include" });
    if (!res.ok) return [];
    return (await res.json()).history || [];
  } catch (e) {
    return [];
  }
}

// Fire-and-forget, mirrors logProfileSnapshot. Records that a goal was
// added or its done-state changed, so the "Personal finance diary" feature
// actually feeds research analytics instead of staying localStorage-only.
function logGoalEvent(title, done) {
  fetch(`${API_BASE_URL}/api/research/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ event_type: "goal", title, status: done ? "done" : "active" }),
  }).catch(() => {});
}

function serverSignOut() {
  fetch(`${API_BASE_URL}/api/auth/signout`, { method: "POST", credentials: "include" }).catch(() => {});
}
