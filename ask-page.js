// Free RAG companion UI. Talks to POST /api/ask, which is retrieval-only —
// no LLM call, so this page costs nothing per query and works even with no
// model provider key configured. It therefore shows RETRIEVED PASSAGES,
// never a generated answer, and says so plainly when nothing matched.
//
// Persona (from the quiz, if taken) only changes a one-line framing above
// the results — never which passages come back. That's PRD F5's "tone, not
// facts", and the server enforces the same separation.
(function () {
  const form = document.getElementById("ask-form");
  const input = document.getElementById("ask-input");
  const btn = document.getElementById("ask-btn");
  const results = document.getElementById("ask-results");

  // Opaque, client-generated, per-tab. Groups follow-up questions for the
  // calibration study without identifying anyone — no account, no PII.
  function sessionId() {
    try {
      let id = sessionStorage.getItem("finperson_ask_session");
      if (!id) {
        id = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem("finperson_ask_session", id);
      }
      return id;
    } catch (e) {
      return null;
    }
  }

  // Framing only — deliberately says nothing factual, so it can never
  // contradict or colour the passages underneath it.
  const PERSONA_FRAMING = {
    anxious_avoider: "Here's what the library says — no pressure to act on any of it.",
    impulsive_spender: "Here's what the library says, before deciding anything.",
    cautious_guardian: "Here's what the library says, sources named so you can check it yourself.",
    overconfident_navigator: "Here's what the library says — including the parts that push back.",
  };

  function savedPersona() {
    try {
      return typeof getSavedPersona === "function" ? getSavedPersona() : null;
    } catch (e) {
      return null;
    }
  }

  function renderSources(data) {
    const persona = data.persona;
    const framing = (persona && PERSONA_FRAMING[persona]) || "Here's what the library says.";

    const safeguardBlock = data.safeguarding ? `
      <div class="learn-disclaimer" style="border-color:var(--brick);margin-bottom:16px;">
        ${esc(data.safeguarding)}
      </div>` : "";

    if (!data.grounded) {
      results.innerHTML = safeguardBlock + `
        <section class="scenario-card">
          <p class="scenario-eyebrow">No close match</p>
          <p class="scenario-text" style="font-size:15px;">
            Nothing in the library covers that closely enough to show you honestly — so it isn't going to guess.
          </p>
          <p style="font-size:13.5px;color:var(--slate);margin:0;">
            This library is about money <em>behaviour</em> — biases, habits, and the psychology behind financial
            decisions. Try rephrasing, or browse <a class="linkish" href="learn.html">Learn</a> and
            <a class="linkish" href="model.html">the theory</a> directly.
          </p>
        </section>`;
      return;
    }

    results.innerHTML = safeguardBlock + `
      <p style="font-size:13.5px;color:var(--slate);margin:0 0 12px;">${esc(framing)}</p>
      ${data.sources.map(s => `
        <section class="scenario-card" style="margin-bottom:12px;">
          <p class="scenario-eyebrow">${esc(s.title || "Untitled")} &middot; ${esc(s.source || "unknown source")}</p>
          <p style="font-size:14.5px;line-height:1.65;margin:0;">${esc(s.text || "")}</p>
        </section>`).join("")}
      <p style="font-size:12.5px;color:var(--slate);margin:6px 0 0;">
        Passages shown as written, from this app's own curated notes. Want it talked through instead?
        <a class="linkish" href="pricing.html">The coach does that</a>.
      </p>`;
  }

  async function ask(question) {
    btn.disabled = true;
    results.innerHTML = `<p class="scenario-empty-body">Searching…</p>`;
    try {
      const res = await fetch(`${API_BASE_URL}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, persona: savedPersona(), session_id: sessionId() }),
      });
      if (res.status === 503) {
        results.innerHTML = `<p class="scenario-empty-body">Search isn't available on this deployment yet.</p>`;
        return;
      }
      if (!res.ok) throw new Error("ask failed");
      renderSources(await res.json());
      if (typeof markRoadmapLevelComplete === "function") markRoadmapLevelComplete("ask");
    } catch (e) {
      results.innerHTML = `<p class="scenario-empty-body">Couldn't search right now — try again in a moment.</p>`;
    } finally {
      btn.disabled = false;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) ask(q);
  });

  document.querySelectorAll("#ask-examples .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.q;
      ask(chip.dataset.q);
    });
  });
})();
