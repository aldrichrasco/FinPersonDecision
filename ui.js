// Shared UI layer — navigation, toasts, keyboard shortcuts.
//
// Injected on every surface so wayfinding, feedback and keyboard control are
// identical everywhere. Previously the sandbox was a dead end: you could get
// in but not across to the coach or your progress without going home first.

// ---------------------------------------------------------------- navigation

const NAV_ITEMS = [
  { href: "dashboard.html", label: "Practise", icon: "◆", match: ["dashboard"] },
  { href: "chat.html", label: "Coach", icon: "◇", match: ["chat"] },
  { href: "progress.html", label: "Progress", icon: "◈", match: ["progress"] },
];

// Secondary pages live in the header menu, not the bottom pill — the pill
// stays reserved for the two things used every session. This is also where
// goals live now instead of only inside one persona's sandbox drawer.
const MENU_ITEMS = [
  { href: "learn.html", label: "Learn" },
  { href: "model.html", label: "Theory" },
  { href: "goals.html", label: "Goals" },
  { href: "achievements.html", label: "Achievements" },
  { href: "donate.html", label: "Donate" },
];

function currentPage() {
  const path = location.pathname.split("/").pop() || "index.html";
  return path.replace(".html", "");
}

// A separate top-of-page "Menu" button read as an awkward second nav system
// sitting next to the floating pill. Folding secondary pages into the pill
// itself (as a "More" item, same visual language as Practise/Coach/Progress)
// keeps a single, consistent piece of chrome instead of two.
function initNav() {
  // The landing page is a marketing surface, not part of the app shell.
  const page = currentPage();
  if (page === "index" || page === "" || page === "admin" || page === "research") return;
  if (document.getElementById("app-nav")) return;

  const nav = document.createElement("nav");
  nav.id = "app-nav";
  nav.className = "app-nav";
  nav.setAttribute("aria-label", "Main");
  nav.innerHTML = NAV_ITEMS.map(item => {
    const active = item.match.includes(page);
    return `<a href="${item.href}" class="app-nav-item${active ? " active" : ""}"
              ${active ? 'aria-current="page"' : ""}>
              <span class="nav-icon" aria-hidden="true">${item.icon}</span>
              <span class="nav-label">${item.label}</span>
            </a>`;
  }).join("") + `
    <div class="app-nav-more">
      <button class="app-nav-item app-nav-more-btn" id="app-nav-more-btn" type="button" aria-haspopup="true" aria-expanded="false">
        <span class="nav-icon" aria-hidden="true">◎</span>
        <span class="nav-label">More</span>
      </button>
      <div class="app-nav-more-panel" id="app-nav-more-panel" hidden>
        ${MENU_ITEMS.map(item => `<a href="${item.href}"${item.href.replace(".html", "") === page ? ' aria-current="page"' : ""}>${item.label}</a>`).join("")}
      </div>
    </div>`;
  document.body.appendChild(nav);
  document.body.classList.add("has-app-nav");

  const btn = document.getElementById("app-nav-more-btn");
  const panel = document.getElementById("app-nav-more-panel");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      btn.focus();
    }
  });
}

// index.html has no bottom pill (it's a marketing surface, not the app
// shell), so it keeps a small header dropdown as its only way to reach
// secondary pages.
function initHeaderMenu() {
  const page = currentPage();
  if (page !== "index" && page !== "") return;
  const slot = document.getElementById("auth-slot");
  if (!slot || document.getElementById("header-menu")) return;

  const wrap = document.createElement("div");
  wrap.id = "header-menu";
  wrap.className = "header-menu";
  wrap.innerHTML = `
    <button class="header-menu-btn" id="header-menu-btn" type="button" aria-haspopup="true" aria-expanded="false">
      Menu <span class="header-menu-caret" aria-hidden="true">▾</span>
    </button>
    <div class="header-menu-panel" id="header-menu-panel" hidden>
      ${MENU_ITEMS.map(item => `<a href="${item.href}">${item.label}</a>`).join("")}
    </div>`;
  slot.parentElement.insertBefore(wrap, slot);

  const btn = document.getElementById("header-menu-btn");
  const panel = document.getElementById("header-menu-panel");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !wrap.contains(e.target)) {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      btn.focus();
    }
  });
}

// Adds a background to the sticky top header once scrolled, so page content
// doesn't visibly pass through it. Previously only wired up on index.html and
// dashboard.html — every other page's header stayed permanently transparent.
// Auto-invoked below alongside initNav() so no future page can miss it.
function initStickyHeader() {
  const header = document.querySelector(".topbar");
  if (!header) return;
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

// ---------------------------------------------------------------- toasts

let toastTimer = null;

function toast(message, opts = {}) {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    host.className = "toast-host";
    // Assertive only for errors; routine confirmations shouldn't interrupt.
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `toast toast-${opts.tone || "neutral"}`;
  el.innerHTML = `
    <span class="toast-msg">${esc(message)}</span>
    ${opts.action ? `<button class="toast-action" type="button">${esc(opts.action.label)}</button>` : ""}
  `;
  host.innerHTML = "";
  host.appendChild(el);

  if (opts.action) {
    el.querySelector(".toast-action").addEventListener("click", () => {
      opts.action.onClick();
      dismissToast();
    });
  }

  requestAnimationFrame(() => el.classList.add("in"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(dismissToast, opts.duration || 4200);
}

function dismissToast() {
  const host = document.getElementById("toast-host");
  if (!host) return;
  const el = host.querySelector(".toast");
  if (!el) return;
  el.classList.remove("in");
  setTimeout(() => { if (host.contains(el)) host.removeChild(el); }, 260);
}

// ---------------------------------------------------------------- shortcuts

// Registered as {key, label, handler, scope}. Scope lets a page opt out.
const shortcuts = [];

function registerShortcut(key, label, handler) {
  shortcuts.push({ key, label, handler });
}

function initShortcuts() {
  document.addEventListener("keydown", e => {
    // Never hijack keys while someone is typing or a dialog is open.
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector(".quiz-overlay.open")) return;

    if (e.key === "?") {
      e.preventDefault();
      showShortcutHelp();
      return;
    }
    const hit = shortcuts.find(s => s.key === e.key);
    if (hit) {
      e.preventDefault();
      hit.handler();
    }
  });
}

function showShortcutHelp() {
  if (!shortcuts.length) return;
  let overlay = document.getElementById("shortcut-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "quiz-overlay";
    overlay.id = "shortcut-overlay";
    overlay.innerHTML = `
      <div class="quiz-modal shortcut-modal" role="dialog" aria-modal="true" aria-labelledby="sc-title">
        <div class="quiz-modal-head">
          <span id="sc-title">Keyboard shortcuts</span>
          <button class="quiz-close" id="sc-close" aria-label="Close">&times;</button>
        </div>
        <dl class="shortcut-list" id="sc-list"></dl>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#sc-close").addEventListener("click", hideShortcutHelp);
    overlay.addEventListener("click", e => { if (e.target === overlay) hideShortcutHelp(); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && overlay.classList.contains("open")) hideShortcutHelp();
    });
  }
  document.getElementById("sc-list").innerHTML =
    shortcuts.map(s => `<div class="sc-row"><dt><kbd>${esc(s.key)}</kbd></dt><dd>${esc(s.label)}</dd></div>`).join("") +
    `<div class="sc-row"><dt><kbd>?</kbd></dt><dd>Show this list</dd></div>`;
  overlay.classList.add("open");
  document.getElementById("sc-close").focus();
}

function hideShortcutHelp() {
  const o = document.getElementById("shortcut-overlay");
  if (o) o.classList.remove("open");
}

// ---------------------------------------------------------------- boot

// ---------------------------------------------------------------- offline

// A silent failure looks like a broken app. Say what's happening instead.
function initOfflineWatch() {
  const banner = document.createElement("div");
  banner.className = "offline-banner";
  banner.id = "offline-banner";
  banner.setAttribute("role", "status");
  banner.textContent = "You're offline. Your progress is saved and will sync when you reconnect.";
  banner.hidden = true;
  document.body.appendChild(banner);

  const sync = () => {
    const off = navigator.onLine === false;
    banner.hidden = !off;
    document.body.classList.toggle("is-offline", off);
  };
  window.addEventListener("online", () => {
    sync();
    if (typeof toast === "function") toast("Back online.", { tone: "good", duration: 2600 });
  });
  window.addEventListener("offline", sync);
  sync();
}

initNav();
initHeaderMenu();
initStickyHeader();
initShortcuts();
initOfflineWatch();
