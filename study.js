// Client-side study layer.
//
// Handles enrolment, consent, event capture and feature gating. Loaded on
// every surface but inert unless a study code is present, so ordinary users
// are unaffected and no research data is collected from them.
//
// Capture is batched and flushed on a timer, on page hide, and on unload —
// beacon where available — because losing the tail of a session loses exactly
// the part where drop-off happens.

const STUDY_CODE_KEY = "finperson_study_code";
const FLUSH_INTERVAL_MS = 8000;
const MAX_BUFFER = 40;

let studyCode = null;
let studyFeatures = null;   // null = not in a study; all features on
let studyConsented = false;
let eventBuffer = [];
let flushTimer = null;

const studySession = (() => {
  try {
    return (crypto.randomUUID && crypto.randomUUID()) ||
      String(Date.now()) + Math.random().toString(36).slice(2, 10);
  } catch (e) {
    return String(Date.now()) + Math.random().toString(36).slice(2, 10);
  }
})();

// --- feature gating --------------------------------------------------------
// Every call site asks this rather than checking an arm directly, so adding an
// arm never requires touching feature logic.
function featureEnabled(name) {
  if (!studyFeatures) return true;      // not in a study: full artefact
  return studyFeatures[name] !== false;
}

function studyArm() {
  return studyFeatures ? studyFeatures.arm : null;
}

// --- capture ---------------------------------------------------------------
function track(type, payload) {
  if (!studyCode || !studyConsented) return;
  eventBuffer.push({ type, payload, session_id: studySession, ts: Date.now() });
  if (eventBuffer.length >= MAX_BUFFER) flushEvents();
}

function flushEvents(useBeacon = false) {
  if (!studyCode || !studyConsented || !eventBuffer.length) return;
  const batch = eventBuffer.splice(0, eventBuffer.length);
  const body = JSON.stringify({ events: batch });
  const url = `${typeof API_BASE_URL !== "undefined" ? API_BASE_URL : ""}/api/study/event`;

  // sendBeacon survives page unload; fetch does not reliably.
  if (useBeacon && navigator.sendBeacon) {
    try {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    } catch (e) { /* fall through */ }
  }
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Study-Code": studyCode },
    credentials: "include",
    body,
    keepalive: true,
  }).catch(() => {
    // Put them back rather than dropping — a failed flush is usually transient.
    eventBuffer = batch.concat(eventBuffer).slice(-200);
  });
}

function startFlushLoop() {
  clearInterval(flushTimer);
  flushTimer = setInterval(flushEvents, FLUSH_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushEvents(true);
  });
  window.addEventListener("pagehide", () => {
    track("session_end", { page: location.pathname });
    flushEvents(true);
  });
}

// --- enrolment / consent ---------------------------------------------------
async function enrolStudy(code) {
  const url = `${typeof API_BASE_URL !== "undefined" ? API_BASE_URL : ""}/api/study/enrol`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "enrolment failed");
  const data = await res.json();
  studyCode = data.code;
  studyConsented = data.consented;
  studyFeatures = data.features;
  try { localStorage.setItem(STUDY_CODE_KEY, studyCode); } catch (e) {}
  return data;
}

async function giveConsent() {
  const url = `${typeof API_BASE_URL !== "undefined" ? API_BASE_URL : ""}/api/study/consent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Study-Code": studyCode },
    credentials: "include",
    body: JSON.stringify({ agreed: true }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  studyConsented = true;
  studyFeatures = data.features;
  startFlushLoop();
  track("session_start", { page: location.pathname, arm: studyArm() });
  return true;
}

async function withdrawStudy() {
  const url = `${typeof API_BASE_URL !== "undefined" ? API_BASE_URL : ""}/api/study/withdraw`;
  await fetch(url, {
    method: "POST",
    headers: { "X-Study-Code": studyCode },
    credentials: "include",
  }).catch(() => {});
  try { localStorage.removeItem(STUDY_CODE_KEY); } catch (e) {}
  studyCode = null; studyConsented = false; studyFeatures = null;
  eventBuffer = [];
}

// --- boot ------------------------------------------------------------------
async function initStudy() {
  // A code may arrive by URL once (from an invitation), then persists locally.
  const urlCode = new URLSearchParams(location.search).get("sc");
  let stored = null;
  try { stored = localStorage.getItem(STUDY_CODE_KEY); } catch (e) {}
  const code = urlCode || stored;
  if (!code) return;

  try {
    await enrolStudy(code);
  } catch (e) {
    return; // invalid code: behave as a normal user
  }

  // Remove the code from the URL so it doesn't leak via sharing or referrer.
  if (urlCode && history.replaceState) {
    const u = new URL(location.href);
    u.searchParams.delete("sc");
    history.replaceState({}, "", u);
  }

  renderStudyBadge();

  if (studyConsented) {
    startFlushLoop();
    track("session_start", { page: location.pathname, arm: studyArm() });
    track("page_view", { page: location.pathname });
    // Baseline measures, once, shortly after arrival.
    setTimeout(() => {
      if (typeof offerInstruments === "function") offerInstruments("baseline");
    }, 1500);
  } else {
    showConsentGate();
  }
}

// Consent gate. Blocking by design: no research data is captured before this
// is answered, and declining still allows full use of the artefact.
function showConsentGate() {
  if (document.getElementById("consent-overlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "quiz-overlay open";
  overlay.id = "consent-overlay";
  overlay.innerHTML = `
    <div class="quiz-modal consent-modal" role="dialog" aria-modal="true"
         aria-labelledby="consent-title">
      <h3 id="consent-title" class="consent-title">Taking part in the research</h3>
      <div class="consent-body">
        <p>FinPerson doubles as a research study on how people make financial
        decisions. You're being asked whether to take part — this works the
        same whether you arrived by invite or joined yourself.</p>
        <p><strong>If you agree, we record:</strong> the choices you make in the
        practice sandbox, how you move through the app, and your answers to any
        questionnaires. Everything is linked to your study code only — never to
        your name, email, or real financial accounts.</p>
        <p><strong>You can stop at any time</strong>, and withdrawing deletes
        everything recorded about you. You can still use the app fully whether
        or not you take part.</p>
        <p class="consent-meta">Information sheet version ${esc(String(typeof CONSENT_VERSION !== "undefined" ? CONSENT_VERSION : "1.0"))}.
        Contact details for the research team and ethics committee are on your
        information sheet.</p>
      </div>
      <div class="consent-actions">
        <button class="btn btn-primary" id="consent-yes" type="button">I agree to take part</button>
        <button class="btn btn-secondary" id="consent-no" type="button">Use the app without taking part</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  document.getElementById("consent-yes").focus();

  document.getElementById("consent-yes").addEventListener("click", async () => {
    await giveConsent();
    closeConsentGate();
  });
  document.getElementById("consent-no").addEventListener("click", () => {
    // Declining clears the code so nothing is captured and they are not asked again.
    try { localStorage.removeItem(STUDY_CODE_KEY); } catch (e) {}
    studyCode = null; studyConsented = false; studyFeatures = null;
    closeConsentGate();
  });
}

function closeConsentGate() {
  const o = document.getElementById("consent-overlay");
  if (o) o.remove();
  document.body.style.overflow = "";
}

// --- Completion screen -------------------------------------------------
// Shown once, after a consented participant finishes the task (see the
// dashboard.js hook after their first sandbox round) — the piece that was
// missing: without this, nothing ever told a participant they were done or
// gave them something to paste back into Prolific. No-ops entirely if the
// researcher hasn't set STUDY_COMPLETION_CODE for this batch, rather than
// showing a broken "your code is: (blank)" screen.
const STUDY_COMPLETION_SHOWN_KEY = "finperson_study_completion_shown";

async function showStudyCompletion() {
  if (!studyCode || !studyConsented) return;
  try {
    if (localStorage.getItem(STUDY_COMPLETION_SHOWN_KEY) === studyCode) return;
  } catch (e) {}

  let code;
  try {
    const res = await fetch(`${typeof API_BASE_URL !== "undefined" ? API_BASE_URL : ""}/api/study/status`, {
      credentials: "include",
      headers: { "X-Study-Code": studyCode },
    });
    if (!res.ok) return;
    code = (await res.json()).completion_code;
  } catch (e) {
    return;
  }
  if (!code) return; // no batch code configured — nothing to show

  try { localStorage.setItem(STUDY_COMPLETION_SHOWN_KEY, studyCode); } catch (e) {}
  if (typeof track === "function") track("instrument_completed", { key: "task_completion" });

  const overlay = document.createElement("div");
  overlay.className = "quiz-overlay open";
  overlay.id = "study-completion-overlay";
  overlay.innerHTML = `
    <div class="quiz-modal consent-modal" role="dialog" aria-modal="true" aria-labelledby="study-completion-title">
      <h3 id="study-completion-title" class="consent-title">You're done — thank you</h3>
      <div class="consent-body">
        <p>That's the whole task. Enter this code wherever you were sent here from to record your completion:</p>
        <p class="study-completion-code" id="study-completion-code">${esc(code)}</p>
        <p class="consent-meta">You can keep using the app, but nothing further is needed for the study.</p>
      </div>
      <div class="consent-actions">
        <button class="btn btn-primary" id="study-completion-copy" type="button">Copy code</button>
        <button class="btn btn-secondary" id="study-completion-close" type="button">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  document.getElementById("study-completion-copy").focus();

  document.getElementById("study-completion-copy").addEventListener("click", async e => {
    try {
      await navigator.clipboard.writeText(code);
      e.target.textContent = "Copied";
    } catch (err) {
      // Clipboard permission can be denied; the code is already shown as
      // selectable text, so this is a convenience, not the only way to get it.
    }
  });
  document.getElementById("study-completion-close").addEventListener("click", () => {
    overlay.remove();
    document.body.style.overflow = "";
  });
}

// --- Participant panel -----------------------------------------------------
// Persistent, unobtrusive access to study status, instruments and withdrawal.
function renderStudyBadge() {
  if (!studyCode || document.getElementById("study-badge")) return;
  const badge = document.createElement("button");
  badge.id = "study-badge";
  badge.className = "study-badge";
  badge.type = "button";
  badge.setAttribute("aria-haspopup", "dialog");
  badge.innerHTML = `<span aria-hidden="true">◆</span><span>Study</span>`;
  document.body.appendChild(badge);
  badge.addEventListener("click", openStudyPanel);
}

function openStudyPanel() {
  let overlay = document.getElementById("study-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "quiz-overlay";
    overlay.id = "study-overlay";
    document.body.appendChild(overlay);
    overlay.addEventListener("click", e => { if (e.target === overlay) closeStudyPanel(); });
  }

  const pending = (typeof pendingInstruments === "function")
    ? pendingInstruments("baseline") : [];

  overlay.innerHTML = `
    <div class="quiz-modal study-panel" role="dialog" aria-modal="true" aria-labelledby="sp-title">
      <div class="quiz-modal-head">
        <span id="sp-title">Your participation</span>
        <button class="quiz-close" id="sp-close" aria-label="Close">&times;</button>
      </div>
      <p class="sp-code">Study code <strong>${esc(studyCode)}</strong></p>
      <p class="sp-body">
        ${studyConsented
          ? "You're taking part. Your decisions and answers are recorded against this code only — never your name or real accounts."
          : "You haven't agreed to take part. Nothing is being recorded."}
      </p>

      ${pending.length ? `
        <div class="sp-section">
          <h4>Questionnaire waiting</h4>
          <p class="sp-body">There's a short set of questions to answer.</p>
          <button class="btn btn-primary" id="sp-instrument" type="button">Start it</button>
        </div>` : ""}

      <div class="sp-section sp-danger">
        <h4>Withdrawing</h4>
        <p class="sp-body">
          You can stop at any time. Withdrawing permanently deletes everything
          recorded about you — decisions, answers, everything. You can keep using
          the app afterwards.
        </p>
        <button class="btn btn-secondary sp-withdraw" id="sp-withdraw" type="button">
          Withdraw and delete my data
        </button>
      </div>
    </div>`;

  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  document.getElementById("sp-close").focus();
  document.getElementById("sp-close").addEventListener("click", closeStudyPanel);

  document.getElementById("sp-instrument")?.addEventListener("click", () => {
    closeStudyPanel();
    if (typeof offerInstruments === "function") offerInstruments("baseline");
  });

  document.getElementById("sp-withdraw").addEventListener("click", confirmWithdraw);
}

function confirmWithdraw() {
  const panel = document.querySelector(".study-panel");
  if (!panel) return;
  panel.innerHTML = `
    <div class="quiz-modal-head"><span>Are you sure?</span></div>
    <p class="sp-body">
      This deletes every record linked to your study code and cannot be undone.
      You'll still be able to use the app normally.
    </p>
    <div class="consent-actions">
      <button class="btn btn-secondary sp-withdraw" id="sp-confirm" type="button">Yes, delete my data</button>
      <button class="btn btn-primary" id="sp-cancel" type="button">Keep taking part</button>
    </div>`;
  document.getElementById("sp-cancel").addEventListener("click", openStudyPanel);
  document.getElementById("sp-confirm").addEventListener("click", async () => {
    await withdrawStudy();
    // Behavioural traces must go too, not just the server-side record.
    if (typeof clearHomeostasisSnapshot === "function") clearHomeostasisSnapshot();
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith("finperson_inst_"))
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    document.getElementById("study-badge")?.remove();
    panel.innerHTML = `
      <div class="quiz-modal-head"><span>Withdrawn</span></div>
      <p class="sp-body">Everything recorded about you has been deleted. Thank you
      for the time you did give.</p>
      <button class="btn btn-primary" id="sp-done" type="button">Close</button>`;
    document.getElementById("sp-done").addEventListener("click", closeStudyPanel);
  });
}

function closeStudyPanel() {
  const o = document.getElementById("study-overlay");
  if (o) o.classList.remove("open");
  document.body.style.overflow = "";
}

initStudy();
