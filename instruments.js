// Instrument delivery.
//
// Administers questionnaires at study timepoints and posts responses to
// /api/study/responses.
//
// ITEMS ARE NOT INCLUDED. Validated scales (Lown's FSES, financial behaviour
// scales, discounting measures) are typically copyright-protected. This module
// delivers whatever items you supply in INSTRUMENTS below; obtain a licence and
// paste the items in. The backend stores only item identifiers and values, so
// licensed content never enters the repository.
//
// The placeholder instrument below is our own six-axis measure, which we can
// include because it is the study's own synthesis.

const INSTRUMENTS = {
  // The artefact's own measure — safe to include.
  fbm6: {
    title: "How you handle money",
    intro: "There are no right answers. Pick whatever's closest to true for you.",
    scale: [
      { v: "1", label: "Not at all like me" },
      { v: "2", label: "A little" },
      { v: "3", label: "Somewhat" },
      { v: "4", label: "Quite a lot" },
      { v: "5", label: "Very much like me" },
    ],
    items: [
      { id: "ir_1", text: "I think carefully before I spend on something unplanned." },
      { id: "ir_2", text: "I often buy things and regret it afterwards.", reverse: true },
      { id: "rd_1", text: "I'm comfortable taking financial risks for a better return." },
      { id: "rd_2", text: "I'd rather protect what I have than try to grow it.", reverse: true },
      { id: "to_1", text: "I plan my money years ahead, not weeks." },
      { id: "to_2", text: "I mostly think about money in the short term.", reverse: true },
      { id: "fa_1", text: "I keep a close eye on where my money is going." },
      { id: "fa_2", text: "I avoid looking at my accounts when I can.", reverse: true },
      { id: "fs_1", text: "I feel in control of my financial situation." },
      { id: "fs_2", text: "Money makes me anxious.", reverse: true },
      { id: "po_1", text: "I factor other people's needs into my financial decisions." },
      { id: "po_2", text: "I give to others even when my own finances are tight." },
    ],
  },

  // ---------------------------------------------------------------------
  // LICENSED INSTRUMENTS — paste items here once you have permission.
  // Structure only; empty by design so nothing unlicensed ships.
  // ---------------------------------------------------------------------
  fses: {
    title: "Financial self-efficacy",
    intro: "",
    licensed: true,
    scale: [
      { v: "1", label: "Exactly true" }, { v: "2", label: "Moderately true" },
      { v: "3", label: "Hardly true" }, { v: "4", label: "Not at all true" },
    ],
    items: [], // <- Lown (2011) items go here once licensed
  },
  fbs: {
    title: "Financial behaviour",
    intro: "",
    licensed: true,
    scale: [
      { v: "1", label: "Never" }, { v: "2", label: "Seldom" }, { v: "3", label: "Sometimes" },
      { v: "4", label: "Often" }, { v: "5", label: "Always" },
    ],
    items: [], // <- validated financial behaviour scale items
  },
};

let instrumentState = null;

function instrumentAvailable(key) {
  const inst = INSTRUMENTS[key];
  return !!(inst && inst.items && inst.items.length);
}

// Which instruments are ready to administer at a given timepoint.
function pendingInstruments(timepoint) {
  return Object.keys(INSTRUMENTS).filter(k => {
    if (!instrumentAvailable(k)) return false;
    try {
      return !localStorage.getItem(`finperson_inst_${k}_${timepoint}`);
    } catch (e) {
      return true;
    }
  });
}

function openInstrument(key, timepoint) {
  const inst = INSTRUMENTS[key];
  if (!inst || !instrumentAvailable(key)) return false;

  instrumentState = { key, timepoint, index: 0, responses: {}, inst };
  if (typeof track === "function") track("instrument_started", { instrument: key, timepoint });

  let overlay = document.getElementById("instrument-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "quiz-overlay";
    overlay.id = "instrument-overlay";
    document.body.appendChild(overlay);
  }
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  renderInstrumentItem();
  return true;
}

function renderInstrumentItem() {
  const st = instrumentState;
  if (!st) return;
  const overlay = document.getElementById("instrument-overlay");
  const total = st.inst.items.length;

  if (st.index >= total) return finishInstrument();

  const item = st.inst.items[st.index];
  overlay.innerHTML = `
    <div class="quiz-modal instrument-modal" role="dialog" aria-modal="true"
         aria-labelledby="inst-title">
      <div class="inst-progress">
        <span>${st.index + 1} of ${total}</span>
        <div class="inst-track"><div class="inst-fill" style="width:${((st.index) / total) * 100}%"></div></div>
      </div>
      ${st.index === 0 && st.inst.intro
        ? `<p class="inst-intro">${esc(st.inst.intro)}</p>` : ""}
      <h3 class="inst-item" id="inst-title">${esc(item.text)}</h3>
      <div class="inst-scale" role="radiogroup" aria-labelledby="inst-title">
        ${st.inst.scale.map(s => `
          <button class="inst-opt" type="button" role="radio" aria-checked="false"
                  data-v="${esc(s.v)}">${esc(s.label)}</button>`).join("")}
      </div>
      <div class="inst-actions">
        ${st.index > 0 ? `<button class="probe-skip" id="inst-back" type="button">Back</button>` : ""}
        <button class="probe-skip" id="inst-quit" type="button">Finish later</button>
      </div>
    </div>`;

  overlay.querySelectorAll(".inst-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      st.responses[item.id] = btn.dataset.v;
      btn.setAttribute("aria-checked", "true");
      st.index += 1;
      renderInstrumentItem();
    });
  });
  document.getElementById("inst-back")?.addEventListener("click", () => {
    st.index = Math.max(0, st.index - 1);
    renderInstrumentItem();
  });
  document.getElementById("inst-quit")?.addEventListener("click", () => {
    // Partial responses are still saved — an abandoned questionnaire is data.
    submitInstrument(true);
  });
  overlay.querySelector(".inst-opt")?.focus();
}

async function submitInstrument(partial) {
  const st = instrumentState;
  if (!st) return;
  try {
    await fetch(`${typeof API_BASE_URL !== "undefined" ? API_BASE_URL : ""}/api/study/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        instrument: st.key, timepoint: st.timepoint, responses: st.responses,
      }),
    });
  } catch (e) { /* responses are also kept locally below */ }

  try {
    localStorage.setItem(`finperson_inst_${st.key}_${st.timepoint}`,
      JSON.stringify({ at: Date.now(), partial: !!partial, n: Object.keys(st.responses).length }));
  } catch (e) {}

  if (typeof track === "function") {
    track("instrument_completed", {
      instrument: st.key, timepoint: st.timepoint,
      answered: Object.keys(st.responses).length,
      total: st.inst.items.length, partial: !!partial,
    });
  }
  closeInstrument();
}

function finishInstrument() {
  const overlay = document.getElementById("instrument-overlay");
  overlay.innerHTML = `
    <div class="quiz-modal instrument-modal" role="dialog" aria-modal="true">
      <h3 class="inst-item">That's everything — thank you.</h3>
      <p class="inst-intro">Your answers have been recorded against your study code.</p>
      <button class="btn btn-primary" id="inst-done" type="button">Continue</button>
    </div>`;
  document.getElementById("inst-done").addEventListener("click", () => submitInstrument(false));
}

function closeInstrument() {
  const o = document.getElementById("instrument-overlay");
  if (o) o.classList.remove("open");
  document.body.style.overflow = "";
  instrumentState = null;
}

// Offers any pending instrument for a timepoint. Called after enrolment
// (baseline) and at study milestones.
function offerInstruments(timepoint) {
  if (typeof studyConsented === "undefined" || !studyConsented) return false;
  const pending = pendingInstruments(timepoint);
  if (!pending.length) return false;
  return openInstrument(pending[0], timepoint);
}
