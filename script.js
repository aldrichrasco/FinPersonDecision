// Landing page: situation entry + page chrome.
// The persona deck is gone from the front door — archetype is inferred from
// what someone tells us and how they behave, not demanded on arrival.

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

// Adds a background once scrolled past the hero so the sticky header stays legible.
function initStickyHeader() {
  const header = document.querySelector(".topbar");
  if (!header) return;
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
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

renderSituations();
initQuiz();
initStickyHeader();

document.querySelectorAll(".situations li, .step, .principle, .sandbox-card, .section-title, .lede, .hero-reassure")
  .forEach(el => el.classList.add("reveal"));
stagger(".situations li");
stagger(".step", 90);
initReveal();
