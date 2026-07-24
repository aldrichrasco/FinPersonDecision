// Real Google sign-in via Google Identity Services (GIS) — this is the
// actual library Google ships for client-side auth, not a mock.
//
// SETUP REQUIRED: replace GOOGLE_CLIENT_ID below with your own OAuth
// client ID from https://console.cloud.google.com/apis/credentials
// (create an "OAuth client ID" of type "Web application" and add your
// domain to Authorized JavaScript origins).
//
// SECURITY NOTE: decoding the JWT below is for UI display only (name,
// email, avatar). Before trusting a signed-in user for anything
// privileged — reading their real financial data, writing to a
// database — send response.credential to your backend and verify it
// there: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
// A client can fake anything the client itself decodes.

const GOOGLE_CLIENT_ID = "REPLACE_WITH_YOUR_CLIENT_ID.apps.googleusercontent.com";
const AUTH_STORAGE_KEY = "finperson_user";

function parseJwt(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64).split("").map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
    );
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
}

async function handleCredentialResponse(response) {
  const decoded = parseJwt(response.credential);
  if (!decoded) return;

  // Try real server-side verification first (see server.py). Falls back
  // to the client-side decode for display if no backend is configured —
  // see the security note at the top of this file for why that fallback
  // is display-only, never trust-worthy for privileged actions.
  const verified = await verifyGoogleCredential(response.credential);
  const profile = verified || decoded;

  const user = { name: profile.name, email: profile.email, picture: profile.picture, verified: !!verified };
  try { localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user)); } catch (e) {}
  renderAuthUI(user);
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function signOut() {
  try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (e) {}
  if (typeof serverSignOut === "function") serverSignOut();
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }
  renderAuthUI(null);
}

function renderAuthUI(user) {
  const slot = document.getElementById("auth-slot");
  if (!slot) return;

  if (user) {
    const first = (user.name || user.email || "You").split(" ")[0];
    const avatar = user.picture
      ? `<img src="${esc(user.picture)}" alt="" class="auth-avatar" referrerpolicy="no-referrer" loading="lazy">`
      : `<span class="auth-avatar auth-avatar-fallback">${esc((first[0] || "?").toUpperCase())}</span>`;
    slot.innerHTML = `
      <div class="auth-menu-wrap">
        <button class="auth-pill" id="account-btn" aria-haspopup="true" aria-expanded="false" title="Account">
          ${avatar}<span>${esc(first)}</span>
        </button>
        <div class="auth-menu" id="account-menu" role="menu" hidden>
          <button class="auth-menu-item" id="export-btn" role="menuitem">Download my data</button>
          <button class="auth-menu-item auth-menu-danger" id="delete-btn" role="menuitem">Delete my account</button>
          <button class="auth-menu-item" id="signout-btn" role="menuitem">Sign out</button>
        </div>
      </div>
    `;
    const menu = document.getElementById("account-menu");
    const btn = document.getElementById("account-btn");
    btn.addEventListener("click", () => {
      const open = !menu.hidden;
      menu.hidden = open;
      btn.setAttribute("aria-expanded", String(!open));
    });
    document.addEventListener("click", e => {
      if (!slot.contains(e.target)) { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    });
    document.getElementById("signout-btn").addEventListener("click", signOut);
    document.getElementById("export-btn").addEventListener("click", exportMyData);
    document.getElementById("delete-btn").addEventListener("click", deleteMyAccount);
    return;
  }

  slot.innerHTML = `
    <div class="auth-signedout">
      <div id="g_signin_button"></div>
      <button class="btn btn-ghost auth-email-btn" id="email-auth-btn">Use email</button>
    </div>
  `;
  document.getElementById("email-auth-btn").addEventListener("click", openEmailAuth);
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.renderButton(document.getElementById("g_signin_button"), {
      theme: "outline",
      size: "medium",
      shape: "pill",
      text: "signin_with",
    });
  } else {
    document.getElementById("g_signin_button").outerHTML =
      `<button class="btn btn-ghost" disabled title="Google sign-in unavailable">Google sign-in unavailable</button>`;
  }
}

// --- Email / password auth ------------------------------------------
async function submitEmailAuth(mode, email, password, name) {
  if (!API_BASE_URL && location.protocol === "file:") {
    return { error: "Email sign-in needs the backend running (open via the server, not the file)." };
  }
  const path = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Something went wrong." };
    return { user: data };
  } catch (e) {
    return { error: "Couldn't reach the server." };
  }
}

async function exportMyData() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/me/export`, { credentials: "include" });
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "finperson-my-data.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("Couldn't export your data right now.");
  }
}

async function deleteMyAccount() {
  if (!confirm("Delete your account and all saved data? This can't be undone.")) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/me/delete`, { method: "POST", credentials: "include" });
    if (!res.ok) throw new Error();
    // Deleting the account must also clear behavioural traces held locally,
    // or a "deleted" user still has a profile on the device.
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      if (typeof clearHomeostasisSnapshot === "function") clearHomeostasisSnapshot();
      ["finperson_profile","finperson_capability_history","finperson_idm",
       "finperson_scaffold_ledger","finperson_persona","finperson_situation"]
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    renderAuthUI(null);
    alert("Your account and data have been deleted.");
  } catch (e) {
    alert("Couldn't delete your account right now.");
  }
}

function initAuth() {
  renderAuthUI(getStoredUser());
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
    });
  }
}

// Opens a small sign-in / sign-up form in the shared modal overlay.
function openEmailAuth() {
  let overlay = document.getElementById("email-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "quiz-overlay";
    overlay.id = "email-overlay";
    overlay.innerHTML = `
      <div class="quiz-modal" role="dialog" aria-modal="true" aria-labelledby="email-title">
        <div class="quiz-modal-head">
          <span id="email-title">Sign in</span>
          <button class="quiz-close" id="email-close" aria-label="Close">&times;</button>
        </div>
        <div class="email-tabs">
          <button class="email-tab active" data-mode="login">Sign in</button>
          <button class="email-tab" data-mode="signup">Create account</button>
        </div>
        <div id="email-form"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", e => { if (e.target === overlay) closeEmailAuth(); });
    overlay.querySelector("#email-close").addEventListener("click", closeEmailAuth);
    overlay.querySelectorAll(".email-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        overlay.querySelectorAll(".email-tab").forEach(t => t.classList.toggle("active", t === tab));
        renderEmailForm(tab.dataset.mode);
      });
    });
  }
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  renderEmailForm("login");
}

function closeEmailAuth() {
  const overlay = document.getElementById("email-overlay");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";
}

function renderEmailForm(mode) {
  const wrap = document.getElementById("email-form");
  document.getElementById("email-title").textContent = mode === "signup" ? "Create account" : "Sign in";
  wrap.innerHTML = `
    ${mode === "signup" ? `<input class="email-input" id="ea-name" type="text" placeholder="Name" autocomplete="name">` : ""}
    <input class="email-input" id="ea-email" type="email" placeholder="Email" autocomplete="email">
    <input class="email-input" id="ea-pass" type="password" placeholder="Password (8+ characters)" autocomplete="${mode === "signup" ? "new-password" : "current-password"}">
    <p class="email-error" id="ea-error" hidden></p>
    <button class="btn btn-primary email-submit" id="ea-submit">${mode === "signup" ? "Create account" : "Sign in"}</button>
  `;
  const submit = document.getElementById("ea-submit");
  submit.addEventListener("click", async () => {
    const email = document.getElementById("ea-email").value.trim();
    const password = document.getElementById("ea-pass").value;
    const name = mode === "signup" ? (document.getElementById("ea-name").value.trim()) : "";
    const errEl = document.getElementById("ea-error");
    errEl.hidden = true;
    submit.disabled = true;
    submit.textContent = "…";
    const { user, error } = await submitEmailAuth(mode, email, password, name);
    if (error) {
      errEl.textContent = error;
      errEl.hidden = false;
      submit.disabled = false;
      submit.textContent = mode === "signup" ? "Create account" : "Sign in";
      return;
    }
    try { localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user)); } catch (e) {}
    closeEmailAuth();
    renderAuthUI(user);
  });
  document.getElementById("ea-email").focus();
}

window.addEventListener("load", initAuth);
