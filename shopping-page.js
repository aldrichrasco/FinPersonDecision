// The basket exercise.
//
// Runs in three beats, and the order matters:
//
//   1 predict  you say what you expect to buy, before seeing any prices
//   2 spend    you actually build the basket against a fixed budget
//   3 read     the gap between the two is shown back to you
//
// The prediction step is the whole reason this exercise earns its place. A
// shopping list on its own says what you bought; a shopping list next to what
// you said you'd buy says something about you. It is the same
// predict-then-act structure the sandbox uses, which is why both write into
// one decision log.
(function () {
  const content = document.getElementById("shop-content");
  const meta = document.getElementById("shop-meta");
  if (!content) return;

  let stage = "intro";
  let predicted = [];
  let selected = [];

  render();

  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }

  function render() {
    if (stage === "intro") return renderIntro();
    if (stage === "predict") return renderPredict();
    if (stage === "spend") return renderSpend();
    return renderResult();
  }

  // ------------------------------------------------------------------ intro
  function renderIntro() {
    meta.textContent = `${money(SHOP_BUDGET)} to spend`;
    content.innerHTML = `
      <section class="mri-sec">
        <h1 class="mri-name" style="font-size:clamp(26px,4.5vw,36px);">You have ${money(SHOP_BUDGET)} and eight things you could spend it on.</h1>
        <p class="mri-lede">They add up to more than you have, so something gets dropped. What gets dropped is the interesting part.</p>
        <p class="mri-note" style="margin:20px 0;">First you will say what you expect to buy. Then you will actually build the basket. <strong>The difference between those two is what this exercise is for.</strong></p>
        <button class="mri-btn" id="shop-start" type="button">Start</button>
      </section>`;
    document.getElementById("shop-start").addEventListener("click", () => { stage = "predict"; render(); });
  }

  // ---------------------------------------------------------------- predict
  function renderPredict() {
    meta.textContent = "Step 1 of 2";
    content.innerHTML = `
      <section class="mri-sec">
        <div class="mri-sec-head">
          <span class="mri-sec-num">01</span>
          <h2 class="mri-sec-title">Before you look properly</h2>
        </div>
        <p class="mri-note" style="margin-bottom:18px;">Which of these do you expect you will end up buying? Go on instinct. You are not committing to anything yet.</p>
        <div id="shop-predict-list">${SHOP_ITEMS.map(itemRow("predict")).join("")}</div>
        <p style="margin-top:22px;"><button class="mri-btn" id="shop-to-spend" type="button">That's my guess</button></p>
      </section>`;
    bindToggles("predict");
    document.getElementById("shop-to-spend").addEventListener("click", () => { stage = "spend"; render(); });
  }

  // ------------------------------------------------------------------ spend
  function renderSpend() {
    content.innerHTML = `
      <section class="mri-sec">
        <div class="mri-sec-head">
          <span class="mri-sec-num">02</span>
          <h2 class="mri-sec-title">Now actually spend it</h2>
        </div>
        <p class="mri-note" style="margin-bottom:18px;">Prices are real now, and the budget is fixed. You cannot have everything.</p>
        <div id="shop-spend-list">${SHOP_ITEMS.map(itemRow("spend")).join("")}</div>
        <p style="margin-top:22px;">
          <button class="mri-btn" id="shop-finish" type="button">Done</button>
        </p>
      </section>`;
    bindToggles("spend");
    updateBudget();
    document.getElementById("shop-finish").addEventListener("click", finish);
  }

  function itemRow(mode) {
    return function (item) {
      const list = mode === "predict" ? predicted : selected;
      const on = list.includes(item.id);
      return `
        <button class="mri-ev-item" data-item="${esc(item.id)}" type="button"
          style="width:100%;text-align:left;background:${on ? "var(--mri-accent-wash)" : "transparent"};
                 border:1px solid ${on ? "var(--mri-accent)" : "var(--mri-rule-soft)"};
                 border-radius:3px;margin-bottom:8px;padding:14px 16px;cursor:pointer;
                 grid-template-columns:1fr auto;align-items:center;gap:14px;">
          <span>
            <span style="display:block;font-weight:600;font-size:15px;margin-bottom:3px;">${esc(item.name)}</span>
            <span style="display:block;font-size:12.5px;color:var(--mri-ink-3);line-height:1.45;">${esc(item.note)}</span>
            ${item.pressure ? `<span style="display:inline-block;margin-top:6px;font-family:var(--mri-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--mri-warn);">Time limited</span>` : ""}
          </span>
          <span style="font-family:var(--mri-mono);font-size:15px;font-variant-numeric:tabular-nums;flex-shrink:0;">
            ${mode === "spend" ? money(item.price) : (on ? "yes" : "&mdash;")}
          </span>
        </button>`;
    };
  }

  function bindToggles(mode) {
    const list = mode === "predict" ? predicted : selected;
    document.querySelectorAll("[data-item]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.item;
        const i = list.indexOf(id);
        if (i >= 0) list.splice(i, 1); else list.push(id);
        // Re-render the list only, so scroll position survives a toggle.
        const host = document.getElementById(mode === "predict" ? "shop-predict-list" : "shop-spend-list");
        host.innerHTML = SHOP_ITEMS.map(itemRow(mode)).join("");
        bindToggles(mode);
        if (mode === "spend") updateBudget();
      });
    });
  }

  function updateBudget() {
    const spend = SHOP_ITEMS.filter(i => selected.includes(i.id)).reduce((s, i) => s + i.price, 0);
    const left = SHOP_BUDGET - spend;
    meta.innerHTML = `${money(left)} left of ${money(SHOP_BUDGET)}`;
    meta.style.color = left < 0 ? "var(--mri-warn)" : "";
    const btn = document.getElementById("shop-finish");
    // Overspending is blocked rather than penalised: the exercise is about
    // what you drop under a real constraint, and a budget you can ignore is
    // not a constraint.
    if (btn) {
      btn.disabled = left < 0;
      btn.textContent = left < 0 ? `${money(-left)} over budget` : "Done";
      btn.style.opacity = left < 0 ? ".5" : "";
    }
  }

  // ----------------------------------------------------------------- finish
  function finish() {
    const decisions = basketToDecisions(selected, predicted);
    // Written into the same log the sandbox uses, so the MRI and the Twin
    // read this exercise without needing to know it exists.
    if (typeof recordMriDecision === "function") decisions.forEach(recordMriDecision);
    if (typeof pushMriDecisionToServer === "function") pushMriDecisionToServer();
    if (typeof markRoadmapLevelComplete === "function") markRoadmapLevelComplete("basket");
    if (typeof track === "function") {
      track("shopping_completed", {
        spent: decisions.filter(d => d.actual === 0).length,
        mismatches: decisions.filter(d => !d.matched).length,
      });
    }
    stage = "result";
    render();
  }

  function renderResult() {
    const read = readBasket(selected);
    const changedMind = SHOP_ITEMS.filter(i =>
      predicted.includes(i.id) !== selected.includes(i.id));
    meta.textContent = `${money(read.spend)} spent`;

    content.innerHTML = `
      <section class="mri-sec">
        <div class="mri-sec-head">
          <span class="mri-sec-num">03</span>
          <h2 class="mri-sec-title">What you did</h2>
        </div>
        <div class="mri-readout">
          <p class="mri-figure">${changedMind.length}</p>
          <p class="mri-figure-say">${changedMind.length === 1
            ? "item went differently from how you predicted."
            : "items went differently from how you predicted."}</p>
          ${changedMind.length ? `
            <div class="mri-ev" style="margin-top:6px;">
              ${changedMind.map(i => `
                <div class="mri-ev-item">
                  <span class="mri-ev-num">${selected.includes(i.id) ? "+" : "&minus;"}</span>
                  <p class="mri-ev-txt">
                    <strong>${esc(i.name)}</strong>${selected.includes(i.id)
                      ? " you did not expect to buy, and bought."
                      : " you expected to buy, and did not."}
                    ${i.pressure ? ' <span style="color:var(--mri-warn);">It had a deadline on it.</span>' : ""}
                  </p>
                </div>`).join("")}
            </div>` : `<p class="mri-note">You bought exactly what you said you would. That is rarer than it sounds.</p>`}
        </div>
      </section>

      ${read.reads.length ? `
      <section class="mri-sec">
        <div class="mri-sec-head">
          <span class="mri-sec-num">04</span>
          <h2 class="mri-sec-title">What the basket shows</h2>
        </div>
        <div class="mri-ev">
          ${read.reads.map((r, i) => `
            <div class="mri-ev-item">
              <span class="mri-ev-num">${String(i + 1).padStart(2, "0")}</span>
              <p class="mri-ev-txt">${esc(r)}</p>
            </div>`).join("")}
        </div>
        <p class="mri-note" style="margin-top:16px;font-size:13px;color:var(--mri-ink-3);">
          These are observations, not marks. There is no correct basket, and scoring one would turn a look at your behaviour into a test of it.
        </p>
      </section>` : ""}

      <section class="mri-sec">
        <p class="mri-note" style="margin-bottom:16px;">These ${SHOP_ITEMS.length} decisions have been added to your Financial MRI, alongside anything you did in the sandbox.</p>
        <a class="mri-btn" href="report.html">See your Financial MRI</a>
        <a class="mri-btn mri-btn-ghost" href="twin.html" style="margin-left:8px;">Meet your Twin</a>
      </section>`;
  }
})();
