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

function currentPage() {
  const path = location.pathname.split("/").pop() || "index.html";
  return path.replace(".html", "");
}

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
  }).join("");
  document.body.appendChild(nav);
  document.body.classList.add("has-app-nav");
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
initShortcuts();
initOfflineWatch();
