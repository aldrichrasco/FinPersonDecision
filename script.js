// Landing page: situation entry + page chrome.
// The persona deck is gone from the front door — archetype is inferred from
// what someone tells us and how they behave, not demanded on arrival.

// The hero's background axis-name strip drifts faster the faster you
// scroll (and reverses when you scroll back up), rather than being a
// flat static backdrop. Reads scroll delta per frame instead of an
// animation timeline, so its speed genuinely tracks scroll velocity.
// Each peek column drifts at its own speed as the section crosses the
// viewport — computed from the section's position relative to viewport
// center each scroll tick, not a fixed timeline, so it stays correct
// regardless of where the section ends up on the page.
function initCompareSlider() {
  const wrap = document.getElementById("compare-wrap");
  const paneA = document.getElementById("compare-pane-a");
  const handle = document.getElementById("compare-handle");
  if (!wrap || !paneA || !handle) return;

  function setPct(pct) {
    const clamped = Math.max(4, Math.min(96, pct));
    paneA.style.clipPath = `inset(0 ${100 - clamped}% 0 0)`;
    handle.style.left = `${clamped}%`;
  }
  function pctFromEvent(clientX) {
    const r = wrap.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * 100;
  }
  let dragging = false;
  wrap.addEventListener("pointerdown", e => { dragging = true; setPct(pctFromEvent(e.clientX)); wrap.setPointerCapture(e.pointerId); });
  wrap.addEventListener("pointermove", e => { if (dragging) setPct(pctFromEvent(e.clientX)); });
  wrap.addEventListener("pointerup", () => { dragging = false; });
  wrap.addEventListener("pointerleave", () => { dragging = false; });
}

function initPeekParallax() {
  const section = document.querySelector(".peek-section");
  const cols = document.querySelectorAll(".peek-col");
  if (!section || !cols.length) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let ticking = false;
  function apply() {
    const r = section.getBoundingClientRect();
    const centerOffset = (r.top + r.height / 2) - window.innerHeight / 2;
    cols.forEach(col => {
      const speed = parseFloat(col.dataset.speed) || 0;
      col.style.transform = `translateY(${centerOffset * speed}px)`;
    });
    ticking = false;
  }
  window.addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(apply); ticking = true; }
  }, { passive: true });
  apply();
}

function initPeekRadar() {
  const canvas = document.getElementById("peek-radar-canvas");
  if (!canvas || typeof drawRadarChart !== "function") return;
  const sample = { impulse_regulation: 72, risk_disposition: 65, temporal_orientation: 80,
    financial_attentiveness: 55, financial_self_efficacy: 70, prosocial_orientation: 60 };
  drawRadarChart(canvas, sample, {}, { showLabels: false });
}

// Scrambles from random glyphs into the real text once, the first time
// the element scrolls into view — a small, legible flourish (not the
// generic marquee/particle kind) specifically for the privacy/no-advice
// line, so it earns a beat of attention instead of reading as filler.
function initPrivacyScramble() {
  const el = document.getElementById("privacy-scramble");
  if (!el) return;
  const finalText = el.dataset.text || el.textContent;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const GLYPHS = "!<>-_\\/[]{}=+*^?#%$&";
  function scramble() {
    const duration = 700;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const revealCount = Math.floor(t * finalText.length);
      let out = "";
      for (let i = 0; i < finalText.length; i++) {
        out += (i < revealCount || finalText[i] === " ") ? finalText[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      el.textContent = out;
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = finalText;
    }
    requestAnimationFrame(tick);
  }

  if (!("IntersectionObserver" in window)) { scramble(); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { scramble(); io.unobserve(el); }
    });
  }, { threshold: 0.6 });
  io.observe(el);
}

// All 11 situations rendered flat ran to two full screens before the
// primary CTA — a first-time visitor had to scroll past ~8 cards just to
// find the "or start free" path. Showing a smaller first screen and
// tucking the rest behind "More situations" cuts what a new visitor has to
// evaluate up front, without deleting any of them — same principle as the
// nav trim (13 -> 4 items, everything still reachable).
//
// The six shown chosen for the widest spread of DISTINCT coach voices
// (cautious_guardian, impulsive_spender, anxious_avoider, steady_saver,
// ambitious_builder), ending on the lowest-commitment option ("Just having
// a look") as a deliberate escape hatch — always give an "I'm not sure yet"
// choice rather than forcing a pick. The other five (all valid, just
// covering rarer or overlapping entry points) are one click away, not gone.
const DEFAULT_SITUATION_IDS = ["debt", "overspending", "avoidance", "saving", "growing", "exploring"];

function renderSituations() {
  const list = document.getElementById("situations");
  if (!list) return;

  const shown = SITUATIONS.filter(s => DEFAULT_SITUATION_IDS.includes(s.id));
  const rest = SITUATIONS.filter(s => !DEFAULT_SITUATION_IDS.includes(s.id));

  const cardHtml = s => `
    <li>
      <a class="situation" href="dashboard.html?situation=${esc(s.id)}" data-id="${esc(s.id)}">
        <span class="situation-label">${esc(s.label)}</span>
        <span class="situation-sub">${esc(s.sub)}</span>
      </a>
    </li>`;

  list.innerHTML = shown.map(cardHtml).join("") + (rest.length ? `
    <li class="situations-more-toggle">
      <button type="button" class="situation situation-more" id="situations-more-btn">
        <span class="situation-label">More situations</span>
        <span class="situation-sub">${rest.length} other starting points</span>
      </button>
    </li>` : "");

  const bindClicks = () => {
    list.querySelectorAll(".situation[data-id]").forEach(a => {
      a.addEventListener("click", () => {
        saveSituation(a.dataset.id);
        if (typeof track === "function") track("situation_selected", { situation: a.dataset.id });
      });
    });
  };
  bindClicks();

  const moreBtn = document.getElementById("situations-more-btn");
  moreBtn?.addEventListener("click", () => {
    moreBtn.closest("li").remove();
    list.insertAdjacentHTML("beforeend", rest.map(cardHtml).join(""));
    bindClicks();
    if (typeof track === "function") track("situations_expanded", {});
  });
}

// Scroll reveal. The class is added by JS so that anyone without JS — or with
// an older browser — gets fully visible content rather than a blank page.
function initReveal() {
  if (!("IntersectionObserver" in window)) return;
  const targets = document.querySelectorAll(".reveal");
  if (!targets.length) return;

  document.documentElement.classList.add("js-reveal");

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      io.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });

  targets.forEach(el => io.observe(el));

  // Safety net: if anything is still hidden shortly after load, show it.
  // A missed reveal must never leave content permanently invisible.
  setTimeout(() => {
    document.querySelectorAll(".reveal:not(.visible)").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) el.classList.add("visible");
    });
  }, 1200);
}

// Staggers children so a group arrives as a sequence, not a block.
function stagger(selector, step = 55) {
  document.querySelectorAll(selector).forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i * step, 420)}ms`;
  });
}

// The front door looked identical to a first-time visitor and someone on
// their tenth visit — no acknowledgment of a quiz already taken, no streak,
// no obvious "pick up where you left off." That's a real reason a returning
// person bounces: the page gives them no thread back into their own
// progress, so it reads as a demo to click through once, not a place to
// return to. Additive only — first-time visitors (no saved profile) see
// nothing here and get the original hero unchanged.
function renderReturningBanner() {
  const banner = document.getElementById("returning-banner");
  if (!banner) return;
  const profile = (typeof getProfile === "function") ? getProfile() : null;
  if (!profile) return;

  let learnProgress = null;
  try { learnProgress = JSON.parse(localStorage.getItem("finperson_learn_progress")); } catch (e) {}
  const streak = (learnProgress && typeof learnProgress.streak === "number") ? learnProgress.streak : 0;

  const persona = (typeof PERSONAS !== "undefined") ? PERSONAS.find(p => p.slug === profile.archetype) : null;
  const name = persona ? persona.name : "your profile";

  const daysAgo = profile.at ? Math.max(0, Math.round((Date.now() - profile.at) / 86400000)) : null;
  const whenText = daysAgo === null ? "" : daysAgo === 0 ? "earlier today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`;

  banner.innerHTML = `
    <div class="returning-banner-text">
      <span class="returning-banner-kicker">Welcome back</span>
      <p>You're matched to <strong>${esc(name)}</strong>${whenText ? `, last checked in ${whenText}` : ""}.${streak > 0 ? ` <span class="returning-banner-streak">🔥 ${streak}-day streak</span>` : ""}</p>
    </div>
    <div class="returning-banner-actions">
      <a class="btn btn-secondary" href="dashboard.html">Continue in the sandbox</a>
      <a class="linkish" href="progress.html">See your progress &rarr;</a>
    </div>`;
  banner.hidden = false;
}

renderSituations();
renderReturningBanner();
initPeekParallax();
initPeekRadar();
initCompareSlider();
initPrivacyScramble();
initQuiz();

document.querySelectorAll(".situations li, .step, .principle, .sandbox-card, .section-title, .lede, .hero-reassure")
  .forEach(el => el.classList.add("reveal"));
stagger(".situations li");
stagger(".step", 90);
initReveal();
