// Landing page: situation entry + page chrome.
// The persona deck is gone from the front door — archetype is inferred from
// what someone tells us and how they behave, not demanded on arrival.

// The hero's background axis-name strip drifts faster the faster you
// scroll (and reverses when you scroll back up), rather than being a
// flat static backdrop. Reads scroll delta per frame instead of an
// animation timeline, so its speed genuinely tracks scroll velocity.
function initVelocityStrip() {
  const strip = document.querySelector(".hero-velocity-strip");
  if (!strip) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let offset = 0;
  let lastScrollY = window.scrollY;
  let ticking = false;

  function apply() {
    const delta = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    offset -= delta * 1.4;
    strip.style.transform = `translateX(${offset}px)`;
    ticking = false;
  }
  window.addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(apply); ticking = true; }
  }, { passive: true });
}

function renderSituations() {
  const list = document.getElementById("situations");
  if (!list) return;
  list.innerHTML = SITUATIONS.map(s => `
    <li>
      <a class="situation" href="dashboard.html?situation=${esc(s.id)}" data-id="${esc(s.id)}">
        <span class="situation-label">${esc(s.label)}</span>
        <span class="situation-sub">${esc(s.sub)}</span>
      </a>
    </li>`).join("");

  list.querySelectorAll(".situation").forEach(a => {
    a.addEventListener("click", () => {
      saveSituation(a.dataset.id);
      if (typeof track === "function") track("situation_selected", { situation: a.dataset.id });
    });
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
initVelocityStrip();
initQuiz();

document.querySelectorAll(".situations li, .step, .principle, .sandbox-card, .section-title, .lede, .hero-reassure")
  .forEach(el => el.classList.add("reveal"));
stagger(".situations li");
stagger(".step", 90);
initReveal();
