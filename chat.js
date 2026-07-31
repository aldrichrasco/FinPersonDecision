// Coaching chat client. Resolves the persona from ?persona=slug (or the
// saved one), streams the conversation to /api/chat/<slug>, and degrades
// gracefully when the coach backend isn't configured.

const params = new URLSearchParams(location.search);
let chatPersona = params.get("persona") || getSavedPersona();
if (!chatPersona || !PERSONAS.find(p => p.slug === chatPersona)) {
  chatPersona = "steady_saver";
}

const personaMeta = PERSONAS.find(p => p.slug === chatPersona);
const history = []; // {role, content}

function setPersonaHead() {
  document.getElementById("chat-persona-icon").textContent = monogram(personaMeta.name);
  document.getElementById("chat-persona-icon").parentElement.parentElement.classList.add(`grp-${personaMeta.group}`);
  document.getElementById("chat-persona-name").textContent = personaMeta.name;
  document.getElementById("chat-persona-trait").textContent = personaMeta.trait;
  document.title = `FinPerson — ${personaMeta.name}`;
}

function addMessage(role, content, opts = {}) {
  const win = document.getElementById("chat-window");
  const row = document.createElement("div");
  row.className = `chat-msg chat-msg-${role}${opts.pending ? " chat-msg-pending" : ""}`;
  if (role === "assistant") {
    row.innerHTML = `<span class="chat-msg-icon">${esc(monogram(personaMeta.name))}</span><div class="chat-bubble">${esc(content)}</div>`;
  } else {
    row.innerHTML = `<div class="chat-bubble">${esc(content)}</div>`;
  }
  win.appendChild(row);
  win.scrollTop = win.scrollHeight;
  return row;
}

function greeting() {
  const snap = typeof getHomeostasisSnapshot === "function" ? getHomeostasisSnapshot() : null;
  const base = `Hi, I'm your ${personaMeta.name} coach.`;
  const tail = " (I'm an educational coach, not a financial advisor.)";

  if (snap && snap.persona === chatPersona && snap.totalDecisions > 0) {
    const zoneLine = snap.zone === "homeostasis"
      ? "You're holding inside the viable zone — worth understanding what's keeping you there."
      : snap.zone === "breakdown"
        ? "I can see your provisioning has thinned out lately. Let's look at it without drama."
        : "I can see you're running above the zone — plenty set aside, maybe at the cost of living now.";
    return `${base} I've been following your practice runs. ${zoneLine} Ask me anything.${tail}`;
  }
  return `${base} Ask me anything about how you handle money — I'll keep it practical and judgment-free.${tail}`;
}

async function sendMessage(text) {
  if (typeof track === "function") track("coach_message_sent", { chars: text.length, persona: chatPersona });
  hideStarters();
  addMessage("user", text);
  history.push({ role: "user", content: text });

  const pending = addMessage("assistant", "…", { pending: true });

  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/${chatPersona}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ messages: history, context: coachContext() }),
    });
    const data = await res.json();
    pending.remove();
    if (!res.ok) {
      addMessage("assistant", coachError(data.error));
      return;
    }
    if (typeof track === "function") {
      track("coach_reply_received", { persona: chatPersona, safeguarding: !!data.safeguarding });
    }
    if (data.reply) {
      addMessage("assistant", data.reply);
      history.push({ role: "assistant", content: data.reply });
    }
    // Safeguarding is rendered after the reply and is never suppressed,
    // even when the model itself failed to respond.
    if (data.safeguarding) renderSafeguarding(data.safeguarding);
  } catch (e) {
    pending.remove();
    addMessage("assistant",
      navigator.onLine === false
        ? "You're offline right now, so I can't reply. Your progress is saved — try again when you're back."
        : coachError());
  }
}

// A distinct, calm panel — deliberately not styled as a chat bubble, so it
// reads as the app speaking plainly rather than the persona continuing.
function renderSafeguarding(sg) {
  // Category only — never the text that triggered it.
  if (typeof track === "function") track("safeguarding_shown", { severity: sg.severity });
  const win = document.getElementById("chat-window");
  const panel = document.createElement("aside");
  panel.className = `safeguard safeguard-${esc(sg.severity)}`;
  panel.setAttribute("role", "note");
  const links = (sg.resources || []).map(r => `
    <li>
      ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a>`
              : `<span>${esc(r.name)}</span>`}
      ${r.phone ? `<span class="sg-phone">${esc(r.phone)}</span>` : ""}
      ${r.note ? `<span class="sg-note">${esc(r.note)}</span>` : ""}
    </li>`).join("");
  panel.innerHTML = `
    <p class="sg-headline">${esc(sg.headline)}</p>
    <p class="sg-body">${esc(sg.body)}</p>
    ${links ? `<ul class="sg-list">${links}</ul>` : ""}
  `;
  win.appendChild(panel);
  win.scrollTop = win.scrollHeight;
  const live = document.getElementById("chat-live");
  if (live) live.textContent = `${sg.headline} ${sg.body}`;
}

function loadLearnProgressForContext() {
  try { return JSON.parse(localStorage.getItem("finperson_learn_progress")); } catch (e) { return null; }
}
function loadGoalsForContext() {
  if (typeof loadGoals === "function") return loadGoals();
  try {
    const raw = JSON.parse(localStorage.getItem("finperson_goal_diary"));
    return Array.isArray(raw) ? raw : [];
  } catch (e) { return []; }
}

// Everything the coach is allowed to see, gathered client-side and sent with
// every message. Sandbox/quiz data is only included when it belongs to the
// coach being spoken to — sending another archetype's context would make the
// coach say wrong things. Goals aren't persona-specific — they're the user's
// own, same list regardless of which coach they're talking to — and neither
// is learning progress, which applies across the whole profile.
function coachContext() {
  if (contextDisabled) return null;
  const ctx = {};

  const snap = typeof getHomeostasisSnapshot === "function" ? getHomeostasisSnapshot() : null;
  if (snap && snap.persona === chatPersona) {
    Object.assign(ctx, {
      wellbeing: snap.wellbeing,
      zone: snap.zone,
      gap: snap.gap,
      totalDecisions: snap.totalDecisions,
      inZoneCount: snap.inZoneCount,
      triggerCount: snap.triggerCount,
      lastTrigger: snap.lastTrigger,
      characteristicDrift: snap.characteristicDrift,
      calibration: typeof calibrationSummary === "function" ? calibrationSummary() : null,
    });
  }

  const profile = typeof getProfile === "function" ? getProfile() : null;
  if (profile && profile.archetype === chatPersona && typeof AXIS_KEYS !== "undefined") {
    const axisEntries = AXIS_KEYS.map(k => ({ label: AXES[k].label, value: profile.profile[k] ?? 50 }));
    const strongest = axisEntries.reduce((a, b) => (b.value > a.value ? b : a));
    const weakest = axisEntries.reduce((a, b) => (b.value < a.value ? b : a));
    ctx.quizCapability = profile.capability;
    ctx.topStrengthAxis = strongest.value >= 66 ? strongest.label : null;
    ctx.topGrowthAxis = weakest.value <= 33 ? weakest.label : null;
  }

  const learn = loadLearnProgressForContext();
  if (learn && Array.isArray(learn.completed)) {
    ctx.learningCompletedCount = learn.completed.length;
    ctx.learningStreak = learn.streak || 0;
  }

  const goals = loadGoalsForContext();
  if (goals.length) {
    ctx.goals = goals.slice(0, 5).map(g => ({ title: g.title, done: !!g.done }));
  }

  return Object.keys(ctx).length ? ctx : null;
}

// People should know what the coach can see about them, and be able to switch
// it off. Silent context-passing would be a trust problem, not a feature.
let contextDisabled = false;

function renderContextBanner() {
  const bar = document.getElementById("chat-context");
  if (!bar) return;
  const snap = typeof getHomeostasisSnapshot === "function" ? getHomeostasisSnapshot() : null;
  const hasSandbox = snap && snap.persona === chatPersona;
  const profile = typeof getProfile === "function" ? getProfile() : null;
  const hasQuiz = profile && profile.archetype === chatPersona;
  const learn = loadLearnProgressForContext();
  const hasLearning = learn && Array.isArray(learn.completed) && learn.completed.length > 0;
  const goals = loadGoalsForContext();
  const hasGoals = goals.length > 0;
  const usable = hasSandbox || hasQuiz || hasLearning || hasGoals;

  if (!usable) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;

  const parts = [];
  if (hasSandbox) {
    const zoneWord = snap.zone === "homeostasis" ? "in the homeostasis zone"
      : snap.zone === "breakdown" ? "below the breakdown threshold"
      : "above the distortion threshold";
    parts.push(`${esc(String(snap.totalDecisions ?? 0))} practice decisions (${esc(zoneWord)})`);
  }
  if (hasQuiz) parts.push("your quiz profile");
  if (hasLearning) parts.push(`${esc(String(learn.completed.length))} learning module(s)${learn.streak ? `, ${esc(String(learn.streak))}-day streak` : ""}`);
  if (hasGoals) parts.push(`${esc(String(goals.length))} goal(s)`);

  bar.innerHTML = contextDisabled
    ? `<span class="ctx-icon" aria-hidden="true">○</span>
       <span class="ctx-text">Your coach can't see your sandbox progress, quiz profile, learning, or goals.</span>
       <button class="ctx-toggle" id="ctx-toggle" type="button">Share it</button>`
    : `<span class="ctx-icon" aria-hidden="true">●</span>
       <span class="ctx-text">Your coach can see: <strong>${parts.join(", ")}</strong>.</span>
       <button class="ctx-toggle" id="ctx-toggle" type="button">Don't share</button>`;

  document.getElementById("ctx-toggle").addEventListener("click", () => {
    contextDisabled = !contextDisabled;
    renderContextBanner();
    const live = document.getElementById("chat-live");
    if (live) {
      live.textContent = contextDisabled
        ? "Sandbox context is no longer shared with your coach."
        : "Sandbox context is now shared with your coach.";
    }
  });
}

// Starter prompts. A blank input asks the person to invent a question about a
// subject they may find stressful; a few concrete openers remove that barrier.
function starterPrompts() {
  const snap = typeof getHomeostasisSnapshot === "function" ? getHomeostasisSnapshot() : null;
  const practised = snap && snap.persona === chatPersona && snap.totalDecisions > 0;

  if (practised && snap.zone === "breakdown") {
    return ["Why do I keep ending up short?",
            "How do I rebuild a buffer from nothing?",
            "What should I deal with first?"];
  }
  if (practised && snap.zone === "distortion") {
    return ["Why does spending anything feel wrong?",
            "How much is enough to have saved?",
            "What am I actually saving for?"];
  }
  if (practised) {
    return ["What patterns are you seeing in my choices?",
            "Where am I most likely to slip up?",
            "What should I practise next?"];
  }
  return ["Why do I keep overspending?",
          "How do I start saving when money's tight?",
          "Is it better to clear debt or build savings first?"];
}

function renderStarters() {
  const host = document.getElementById("chat-starters");
  if (!host) return;
  const prompts = starterPrompts();
  host.innerHTML = `
    <p class="starters-label">Not sure where to start?</p>
    <div class="starters-row">
      ${prompts.map(p => `<button class="starter-chip" type="button">${esc(p)}</button>`).join("")}
    </div>`;
  host.hidden = false;
  host.querySelectorAll(".starter-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      hideStarters();
      sendMessage(btn.textContent);
    });
  });
}

function hideStarters() {
  const host = document.getElementById("chat-starters");
  if (host) host.hidden = true;
}

function coachError(serverMsg) {
  if (serverMsg === "the coach is unavailable right now") {
    return "I can't respond right now — the coaching service isn't switched on yet. In the meantime, try the sandbox to practice decisions.";
  }
  return "Something went wrong reaching the coach. Please try again in a moment.";
}

// The quiz/archetype match and the practice sandbox are the free "Financial
// MRI" — live AI coaching is the paid tier (see subscription_active() in
// server.py, same gate as /api/turtle/session). Checked once up front
// rather than letting someone type a message and hit a 402, matching the
// pro-turtle-page.js pattern of gating the whole page before rendering it.
async function renderChatPaywall() {
  const main = document.getElementById("main");
  main.innerHTML = `
    <div class="chat-persona-head">
      <a href="index.html" class="chat-back">&larr; All coaches</a>
      <div class="chat-persona-id">
        <span class="persona-icon grp-${esc(personaMeta.group)}">${esc(monogram(personaMeta.name))}</span>
        <div>
          <p class="chat-persona-name">${esc(personaMeta.name)}</p>
          <p class="chat-persona-trait">${esc(personaMeta.trait)}</p>
        </div>
      </div>
    </div>
    <div class="chat-paywall">
      <span class="donate-featured-badge">Coaching</span>
      <h2 class="chat-paywall-h2">Talk it through with your ${esc(personaMeta.name)} coach</h2>
      <p class="chat-paywall-body">The quiz, your archetype match, and the practice sandbox are free — that's the whole point of the Financial MRI. Live back-and-forth coaching from a persona-voiced AI that actually reads your sandbox history and goals is the paid part.</p>
      <ul class="donate-featured-perks">
        <li>Unlimited conversations, any persona</li>
        <li>Reads your real sandbox history, not a blank slate</li>
        <li>Cancel anytime, no lock-in</li>
      </ul>
      <button class="btn btn-primary" id="chat-subscribe-btn" type="button">Become a supporter</button>
      <p class="chat-paywall-status" id="chat-paywall-status"></p>
      <p class="chat-paywall-alt">Not ready yet? <a href="dashboard.html?persona=${encodeURIComponent(chatPersona)}">Keep practicing in the free sandbox &rarr;</a></p>
    </div>
  `;
  const btn = document.getElementById("chat-subscribe-btn");
  const status = document.getElementById("chat-paywall-status");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    status.textContent = "Starting checkout…";
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/create-checkout-session`, { method: "POST", credentials: "include" });
      if (res.status === 401) {
        status.textContent = "Sign in first, then come back to subscribe.";
        btn.disabled = false;
        return;
      }
      if (res.status === 503) {
        status.textContent = "Subscriptions aren't set up yet on this deployment.";
        btn.disabled = false;
        return;
      }
      if (!res.ok) throw new Error("checkout failed");
      const data = await res.json();
      window.location.href = data.url;
    } catch (e) {
      status.textContent = "Something went wrong — try again in a moment.";
      btn.disabled = false;
    }
  });
}

async function init() {
  let subscriptionActive = false;
  try {
    const res = await fetch(`${API_BASE_URL}/api/billing/status`, { credentials: "include" });
    const data = await res.json();
    subscriptionActive = data.status === "active" || data.status === "trialing";
  } catch (e) {}
  if (!subscriptionActive) {
    await renderChatPaywall();
    return;
  }

  setPersonaHead();
  renderContextBanner();

  // If no backend/coach is configured, tell the user honestly rather than
  // letting every message fail silently.
  let enabled = true;
  try {
    const info = await fetch(`${API_BASE_URL}/api/chat-info`, { credentials: "include" });
    if (info.ok) enabled = (await info.json()).enabled;
  } catch (e) {
    enabled = false;
  }

  addMessage("assistant", greeting());
  if (enabled) renderStarters();
  if (!enabled) {
    addMessage("assistant", "Heads up: live coaching isn't configured in this deployment yet, so I can't chat back right now. The quiz and sandbox work fully — this just needs an API key set on the server.");
    document.getElementById("chat-input").disabled = true;
    document.getElementById("chat-send").disabled = true;
    document.getElementById("chat-input").placeholder = "Coaching not available in this deployment";
  }

  document.getElementById("chat-form").addEventListener("submit", e => {
    e.preventDefault();
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    sendMessage(text);
  });
}

init();
