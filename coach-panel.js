// Inline decision coach.
//
// The standalone coach page sits apart from the moment of choice, which is
// where coaching is least useful — the financial education literature finds
// interventions delivered near the decision outperform those delivered apart
// from it. This puts the coach beside the open scenario.
//
// It is deliberately pull, not push: the coach does not interrupt. It offers,
// and the person opens it if they want it.

let coachPanelOpen = false;
let coachThread = [];        // conversation scoped to the current run
let coachBusy = false;

function coachAvailable() {
  return typeof featureEnabled !== "function" || featureEnabled("coach");
}

function initCoachPanel() {
  if (!coachAvailable()) return;
  const panel = document.getElementById("coach-panel");
  if (!panel) return;

  document.getElementById("coach-toggle")?.addEventListener("click", toggleCoachPanel);
  document.getElementById("coach-close")?.addEventListener("click", () => setCoachPanel(false));

  document.getElementById("coach-form")?.addEventListener("submit", e => {
    e.preventDefault();
    const input = document.getElementById("coach-input");
    const text = input.value.trim();
    if (!text || coachBusy) return;
    input.value = "";
    askCoach(text);
  });

  // Quick prompts. Phrased as deliberation, never as "which should I pick".
  document.querySelectorAll(".coach-quick").forEach(btn => {
    btn.addEventListener("click", () => { if (!coachBusy) askCoach(btn.dataset.prompt); });
  });
}

function toggleCoachPanel() { setCoachPanel(!coachPanelOpen); }

function setCoachPanel(open) {
  const panel = document.getElementById("coach-panel");
  const toggle = document.getElementById("coach-toggle");
  if (!panel) return;
  coachPanelOpen = open;
  panel.hidden = !open;
  toggle?.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("coach-open", open);
  if (open) {
    if (typeof track === "function") track("drawer_opened", { drawer: "coach" });
    if (!coachThread.length) seedCoachPanel();
    document.getElementById("coach-input")?.focus();
  } else if (typeof track === "function") {
    track("drawer_closed", { drawer: "coach" });
  }
}

// The coach opens on what it can actually see, not a greeting.
//
// It was saying "I'm here if this one's tricky" while sitting on a log of
// every decision the person had made and every prediction they had missed.
// A coach that ignores its own evidence is replaceable by any chatbot; one
// that opens with "earlier you predicted you'd wait, and you didn't" is not.
function seedCoachPanel() {
  const opener = predictionAwareOpener();
  if (opener) { addCoachLine("assistant", opener); return; }
  const meta = typeof currentPersonaMeta === "function" ? currentPersonaMeta() : null;
  addCoachLine("assistant",
    meta ? `I'm here if this one's tricky. I won't tell you what to pick — but I can help you work out what you're weighing.`
         : `I'm here if you want to think one through.`);
}

// Built from the decision log rather than generated, so it can never claim
// something that did not happen. Returns null when there is nothing specific
// to say, and the generic greeting stands in.
function predictionAwareOpener() {
  if (typeof getMriDecisions !== "function") return null;
  const log = getMriDecisions().filter(d => d.predicted !== null && d.predicted !== undefined);
  if (log.length < 3) return null;

  const missed = log.filter(d => !d.matched);
  if (!missed.length) {
    return `Something worth noting: across ${log.length} decisions you have called your own choice every time. That is rarer than it sounds. Want to talk this one through before you break the streak?`;
  }

  // A miss under time pressure is the most useful thing to raise, because it
  // is the condition most likely to be about to repeat.
  const timedMiss = missed.slice().reverse().find(d => d.timed);
  const last = missed[missed.length - 1];
  const pick = timedMiss || last;

  if (timedMiss && typeof currentScenario !== "undefined" && currentScenario && currentScenario.timed) {
    return `Before you decide — last time a decision had a clock on it, you predicted one thing and did another. This one has a clock too. What is different about it?`;
  }
  return `Earlier you predicted you would "${pick.choice.replace(/^(Bought|Skipped) /, "")}" and then went the other way. ${missed.length} of your ${log.length} decisions have gone like that. Want to work out what moves you?`;
}

function addCoachLine(role, text, opts = {}) {
  const body = document.getElementById("coach-body");
  if (!body) return null;
  const el = document.createElement("div");
  el.className = `coach-line coach-${role}${opts.pending ? " coach-pending" : ""}`;
  el.textContent = text;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
  return el;
}

// The scenario currently on screen, so the coach can speak to this decision.
function openScenarioContext() {
  if (typeof currentScenario === "undefined" || !currentScenario) return null;
  return {
    text: currentScenario.text,
    options: (currentScenario.choices || []).map(c => c.label),
  };
}

function sandboxCoachContext() {
  const snap = typeof getHomeostasisSnapshot === "function" ? getHomeostasisSnapshot() : null;
  if (!snap || snap.persona !== currentPersona) return null;
  const recentDecisions = typeof decisionLog !== "undefined" ? decisionLog.slice(-5).map(decision => ({
    choice: decision.choice,
    changes: Object.entries(decision.delta || {}).map(([key, value]) => `${key} ${value > 0 ? "+" : ""}${value}`).join(", ") || "no immediate financial change",
    zone: decision.zone,
  })) : [];
  return {
    wellbeing: snap.wellbeing, zone: snap.zone, gap: snap.gap,
    totalDecisions: snap.totalDecisions, inZoneCount: snap.inZoneCount,
    triggerCount: snap.triggerCount, lastTrigger: snap.lastTrigger,
    characteristicDrift: snap.characteristicDrift,
    // Calibration state, so the coach can adjust how much it says.
    calibration: typeof calibrationSummary === "function" ? calibrationSummary() : null,
    recentDecisions,
  };
}

async function askCoach(text) {
  if (coachBusy) return;
  coachBusy = true;
  addCoachLine("user", text);
  coachThread.push({ role: "user", content: text });
  const pending = addCoachLine("assistant", "…", { pending: true });
  if (typeof track === "function") track("coach_message_sent", { inline: true, persona: currentPersona });

  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/${currentPersona}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        messages: coachThread,
        context: sandboxCoachContext(),
        scenario: openScenarioContext(),
      }),
    });
    const data = await res.json();
    pending?.remove();
    if (!res.ok) {
      if (data.paywall) {
        addCoachPaywallLine();
      } else {
        addCoachLine("assistant", data.error === "the coach is unavailable right now"
          ? "The coach isn't switched on in this deployment."
          : "Couldn't reach the coach just then.");
      }
      return;
    }
    if (data.reply) {
      addCoachLine("assistant", data.reply);
      coachThread.push({ role: "assistant", content: data.reply });
    }
    // Safeguarding must surface here exactly as it does on the coach page.
    if (data.safeguarding) renderInlineSafeguarding(data.safeguarding);
    if (typeof track === "function") track("coach_reply_received", { inline: true });
  } catch (e) {
    pending?.remove();
    addCoachLine("assistant", navigator.onLine === false
      ? "You're offline, so I can't reply right now."
      : "Something went wrong reaching the coach.");
  } finally {
    coachBusy = false;
  }
}

// Live coaching is the paid tier (see subscription_active() in server.py);
// the quiz and this sandbox stay free. Distinct from a generic connection
// error — this is a real, well-defined state, not something to soften into
// "couldn't reach the coach."
function addCoachPaywallLine() {
  const body = document.getElementById("coach-body");
  if (!body) return;
  const el = document.createElement("div");
  el.className = "coach-line coach-assistant";
  el.innerHTML = `Live coaching needs an active subscription — the quiz and this sandbox stay free. <a href="chat.html?persona=${encodeURIComponent(currentPersona)}">Subscribe on the full coach page &rarr;</a>`;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
}

function renderInlineSafeguarding(sg) {
  const body = document.getElementById("coach-body");
  if (!body) return;
  const el = document.createElement("aside");
  el.className = `safeguard safeguard-${sg.severity}`;
  el.setAttribute("role", "note");
  const links = (sg.resources || []).map(r => `
    <li>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a>`
                : `<span>${esc(r.name)}</span>`}
      ${r.note ? `<span class="sg-note">${esc(r.note)}</span>` : ""}</li>`).join("");
  el.innerHTML = `<p class="sg-headline">${esc(sg.headline)}</p>
                  <p class="sg-body">${esc(sg.body)}</p>
                  ${links ? `<ul class="sg-list">${links}</ul>` : ""}`;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
  if (typeof track === "function") track("safeguarding_shown", { severity: sg.severity, inline: true });
}
