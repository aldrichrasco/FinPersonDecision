// Shared across index.html (deck + quiz) and dashboard.html (sandbox).
// Single source of truth — edit personas and baselines here only.

const PERSONAS = [
  { slug: "steady_saver",            name: "Steady Saver",            trait: "Consistent, low-risk saving",     group: "conservative" },
  { slug: "cautious_guardian",       name: "Cautious Guardian",       trait: "Protects against every downside", group: "conservative" },
  { slug: "conscious_spender",       name: "Conscious Spender",       trait: "Spends deliberately, on values",  group: "conservative" },
  { slug: "ambitious_builder",       name: "Ambitious Builder",       trait: "Invests for long-term growth",    group: "growth" },
  { slug: "strategic_risk_taker",    name: "Strategic Risk-Taker",    trait: "Calculated bets, not gambles",    group: "growth" },
  { slug: "overconfident_navigator", name: "Overconfident Navigator", trait: "Trusts gut over the numbers",     group: "growth" },
  { slug: "status_seeker",           name: "Status Seeker",           trait: "Spends to signal success",        group: "growth" },
  { slug: "impulsive_spender",       name: "Impulsive Spender",       trait: "Buys first, thinks after",        group: "impulsive" },
  { slug: "anxious_avoider",         name: "Anxious Avoider",         trait: "Avoids looking at the numbers",   group: "uncertain" },
  { slug: "passive_drifter",         name: "Passive Drifter",         trait: "No plan, goes with the flow",     group: "uncertain" },
  { slug: "purposeful_giver",        name: "Purposeful Giver",        trait: "Gives first, budgets around it",  group: "generous" },
];

// Illustrative monthly starting figures per persona, used to seed the
// sandbox. Replace with real user data once accounts are connected.
const PERSONA_FINANCE = {
  steady_saver:            { income: 5200, expenses: 3400, savings: 18000, investments: 12000, debt: 2000 },
  cautious_guardian:       { income: 4800, expenses: 3100, savings: 22000, investments: 8000,  debt: 1000 },
  conscious_spender:       { income: 4500, expenses: 3300, savings: 9000,  investments: 6000,  debt: 3000 },
  ambitious_builder:       { income: 6200, expenses: 3800, savings: 7000,  investments: 25000, debt: 15000 },
  strategic_risk_taker:    { income: 5800, expenses: 3600, savings: 5000,  investments: 30000, debt: 8000 },
  overconfident_navigator: { income: 5500, expenses: 4200, savings: 3000,  investments: 18000, debt: 12000 },
  status_seeker:           { income: 5900, expenses: 5300, savings: 1500,  investments: 4000,  debt: 22000 },
  impulsive_spender:       { income: 4200, expenses: 4600, savings: 800,   investments: 500,   debt: 9000 },
  anxious_avoider:         { income: 4300, expenses: 3200, savings: 6000,  investments: 1000,  debt: 4000 },
  passive_drifter:         { income: 3900, expenses: 3300, savings: 2500,  investments: 0,     debt: 6000 },
  purposeful_giver:        { income: 4700, expenses: 3500, savings: 5000,  investments: 5000,  debt: 2000 },
};

// Group -> the persona shown as the quiz's headline match for that group.
const GROUP_PRIMARY = {
  conservative: "steady_saver",
  growth: "ambitious_builder",
  impulsive: "impulsive_spender",
  uncertain: "anxious_avoider",
  generous: "purposeful_giver",
};

const GROUP_LABEL = {
  conservative: "Conservative",
  growth: "Growth-seeking",
  impulsive: "Impulsive",
  uncertain: "Uncertain",
  generous: "Generous",
};

// Shared helpers used by script.js, quiz.js, and dashboard.js.
// Links a persona to its coaching chat page.
function personaUrl(slug) {
  return `chat.html?persona=${slug}`;
}

function monogram(name) {
  return name.split(/[\s-]+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// Escapes text before it's placed into innerHTML. Persona data is
// currently local and trusted, but once any of it can come from a
// backend or URL, everything user-facing should pass through this.
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Carries the quiz's matched persona into the sandbox. Falls back to
// localStorage so a plain link (no query param) still works on repeat
// visits. Swap for your real user-profile storage once accounts exist.
const PERSONA_STORAGE_KEY = "finperson_persona";

function savePersona(slug) {
  try { localStorage.setItem(PERSONA_STORAGE_KEY, slug); } catch (e) {}
}

function getSavedPersona() {
  const url = new URLSearchParams(window.location.search).get("persona");
  if (url && PERSONA_FINANCE[url]) return url;
  try {
    const stored = localStorage.getItem(PERSONA_STORAGE_KEY);
    if (stored && PERSONA_FINANCE[stored]) return stored;
  } catch (e) {}
  return null;
}

const QUIZ_PREDICTION_STORAGE_KEY = "finperson_quiz_prediction";

function saveQuizPrediction(slug, profile, capability) {
  try {
    localStorage.setItem(QUIZ_PREDICTION_STORAGE_KEY, JSON.stringify({ slug, profile, capability, at: Date.now() }));
  } catch (e) {}
}

function getQuizPrediction() {
  try {
    const raw = localStorage.getItem(QUIZ_PREDICTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearQuizPrediction() {
  try { localStorage.removeItem(QUIZ_PREDICTION_STORAGE_KEY); } catch (e) {}
}

// --- Behavioural profile + capability tracking (Personalisation + Evolution) ---
const PROFILE_STORAGE_KEY = "finperson_profile";
const CAPABILITY_HISTORY_KEY = "finperson_capability_history";

// Saves the six-axis profile, matched archetype, and appends the capability
// score to a dated history so change over time is measurable.
function saveProfile(profile, archetype, capability) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ profile, archetype, capability, at: Date.now() }));
    const hist = getCapabilityHistory();
    hist.push({ capability, at: Date.now() });
    localStorage.setItem(CAPABILITY_HISTORY_KEY, JSON.stringify(hist.slice(-50)));
  } catch (e) {}
}

function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function getCapabilityHistory() {
  try {
    const raw = localStorage.getItem(CAPABILITY_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// --- Homeostasis snapshot (shared between sandbox and coach) ---
// A small, current-state summary the coaching chat reads so it can respond to
// where the learner actually is. Deliberately minimal: no full trajectory, no
// money amounts — only what the coach needs to be relevant.
const HOMEOSTASIS_SNAPSHOT_KEY = "finperson_homeostasis";

function saveHomeostasisSnapshot(snapshot) {
  try {
    localStorage.setItem(HOMEOSTASIS_SNAPSHOT_KEY, JSON.stringify({ ...snapshot, at: Date.now() }));
  } catch (e) {}
}

function getHomeostasisSnapshot(maxAgeMs = 1000 * 60 * 60 * 24 * 14) {
  try {
    const raw = localStorage.getItem(HOMEOSTASIS_SNAPSHOT_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    // Stale context is worse than none — it makes the coach say wrong things.
    if (!snap.at || Date.now() - snap.at > maxAgeMs) return null;
    return snap;
  } catch (e) {
    return null;
  }
}

function clearHomeostasisSnapshot() {
  try { localStorage.removeItem(HOMEOSTASIS_SNAPSHOT_KEY); } catch (e) {}
}
