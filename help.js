// Persistent "get real help" affordance.
//
// Deliberately independent of the coach, the model, and the sandbox: someone
// in difficulty should never have to converse with an AI to find a helpline.
// Injected on every page so it is always one click away.

(function () {
  if (document.getElementById("help-fab")) return;

  const fab = document.createElement("button");
  fab.id = "help-fab";
  fab.type = "button";
  fab.className = "help-fab";
  fab.setAttribute("aria-haspopup", "dialog");
  fab.innerHTML = `<span aria-hidden="true">♥</span><span>Need real help?</span>`;
  document.body.appendChild(fab);

  const overlay = document.createElement("div");
  overlay.className = "quiz-overlay";
  overlay.id = "help-overlay";
  overlay.innerHTML = `
    <div class="quiz-modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div class="quiz-modal-head">
        <span id="help-title">Getting real support</span>
        <button class="quiz-close" id="help-close" aria-label="Close">&times;</button>
      </div>
      <p class="help-intro">
        FinPerson is a practice tool. If you're dealing with something real —
        debt you can't manage, pressure from someone else, gambling, or you're
        struggling to cope — these people can actually help. They're free and
        confidential.
      </p>
      <div id="help-body"><p class="log-empty">Loading…</p></div>
      <p class="help-emergency">
        If you're in immediate danger, contact your local emergency number.
      </p>
    </div>`;
  document.body.appendChild(overlay);

  let opener = null;

  function render(groups) {
    const order = [
      ["crisis", "If you're struggling to cope"],
      ["urgent", "Coercion, gambling, or hardship"],
      ["support", "Money and debt advice"],
    ];
    const html = order.map(([key, label]) => {
      const list = groups[key] || [];
      if (!list.length) return "";
      const items = list.map(r => `
        <li>
          ${r.url ? `<a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.name}</a>`
                  : `<span>${r.name}</span>`}
          ${r.phone ? `<span class="sg-phone">${r.phone}</span>` : ""}
          ${r.note ? `<span class="sg-note">${r.note}</span>` : ""}
        </li>`).join("");
      return `<div class="help-group"><h4>${label}</h4><ul class="sg-list">${items}</ul></div>`;
    }).join("");
    document.getElementById("help-body").innerHTML =
      html || `<p class="log-empty">Support directory unavailable. Please search for
               local financial support services in your country.</p>`;
  }

  async function load() {
    try {
      const base = typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "";
      const res = await fetch(`${base}/api/help-resources`);
      if (!res.ok) throw new Error();
      render(await res.json());
    } catch (e) {
      // The whole point is that this cannot fail closed.
      render({ crisis: [{ name: "Find a Helpline", url: "https://findahelpline.com",
                          note: "Free, confidential crisis lines in over 130 countries." }] });
    }
  }

  function open() {
    opener = document.activeElement;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    document.getElementById("help-close").focus();
    document.addEventListener("keydown", onKey);
    load();
  }
  function close() {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
    if (opener) opener.focus();
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  fab.addEventListener("click", open);
  document.getElementById("help-close").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
})();
