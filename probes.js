// Probe UI for the experiential cycle.
//
// Three moments: prediction (forethought), surprise (disequilibrium), and
// reflection (accommodation). All are skippable — a forced probe produces
// compliance data rather than reflection data, and fatigue artefacts are worse
// than missing cells.

// --- 1. Prediction ----------------------------------------------------------
// Asked BEFORE the choice. Committing to a prediction is what makes the
// subsequent outcome capable of contradicting anything.
function renderPredictionProbe() {
  const cycle = typeof currentCycle === "function" ? currentCycle() : null;
  const host = document.getElementById("scenario-card");
  // Deliberately NOT gated on cycle.full any more.
  //
  // The DLO gate meant prediction only ran on high-learning-opportunity
  // scenarios, so the prediction-versus-choice comparison existed for a
  // minority of decisions. That comparison is the product's central finding,
  // not a research extra: the Financial MRI's headline gap, the time-pressure
  // split and the Twin's rules are all computed from it, and each one was
  // reading a fraction of the evidence it could have had.
  //
  // The titration gate below stays. probes.predict is false only when the
  // learner has no capacity to spare (distress, or a budget level of "none"),
  // and probing someone in that state produces compliance data rather than a
  // prediction. cycle.full is still recorded on the cycle for analysis; it is
  // simply no longer allowed to decide whether the question gets asked.
  if (!cycle || !host || !cycle.probes.predict) return;

  const wrap = document.createElement("div");
  wrap.className = "probe probe-predict";
  wrap.id = "probe-predict";
  wrap.innerHTML = `
    <p class="probe-q">Before you choose — which do you think you'll actually pick?</p>
    <p class="probe-sub">Not what you should. What you will.</p>
    <div class="probe-options" id="predict-options">
      ${cycle.scenario.choices.map((c, i) =>
        `<button class="probe-opt" type="button" data-i="${i}">${esc(c.label)}</button>`).join("")}
    </div>
    <div class="probe-confidence" id="predict-confidence" hidden>
      <p class="probe-q">How sure are you?</p>
      <div class="conf-row">
        ${[["Not at all", 0.2], ["Fairly", 0.5], ["Very", 0.8], ["Certain", 0.95]]
          .map(([l, v]) => `<button class="conf-btn" type="button" data-v="${v}">${l}</button>`).join("")}
      </div>
    </div>
    <div class="probe-why" id="predict-why" hidden>
      <label class="probe-q" for="predict-why-text">Why that one?</label>
      <p class="probe-sub">This is where anticipatory recognition is captured: naming
         the pattern <em>before</em> acting, not after.</p>
      <textarea id="predict-why-text" class="probe-text" rows="2"
                placeholder="Optional — a few words is plenty."></textarea>
      <div class="probe-actions">
        <button class="btn btn-primary" id="predict-commit" type="button">Lock it in</button>
      </div>
    </div>
    <button class="probe-skip" type="button" id="predict-skip">Skip this</button>
  `;
  host.insertBefore(wrap, host.querySelector(".scenario-choices"));

  let chosen = null;
  wrap.querySelectorAll(".probe-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      chosen = +btn.dataset.i;
      wrap.querySelectorAll(".probe-opt").forEach(b => b.classList.toggle("selected", b === btn));
      if (cycle.probes.confidence) {
        document.getElementById("predict-confidence").hidden = false;
      } else {
        openWhyStep(chosen, null);
      }
    });
  });
  wrap.querySelectorAll(".conf-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      wrap.querySelectorAll(".conf-btn").forEach(b => b.classList.toggle("selected", b === btn));
      openWhyStep(chosen, parseFloat(btn.dataset.v));
    });
  });
  document.getElementById("predict-skip").addEventListener("click", () => {
    wrap.remove();
    if (typeof track === "function") track("scenario_shown", { probe_skipped: "prediction" });
  });
}

// Reasoning step. Optional, but it is the only route to C3, so it is offered
// whenever the learner has capacity for it.
function openWhyStep(index, confidence) {
  const cycle = typeof currentCycle === "function" ? currentCycle() : null;
  const why = document.getElementById("predict-why");
  if (!why || !cycle || !cycle.probes.reflect) {
    commitPrediction(index, confidence, "");
    return;
  }
  why.hidden = false;
  document.getElementById("predict-why-text").focus();
  document.getElementById("predict-commit").addEventListener("click", () => {
    const text = (document.getElementById("predict-why-text")?.value || "").trim();
    commitPrediction(index, confidence, text);
  }, { once: true });
}

function commitPrediction(index, confidence, reasoning) {
  const cycle = typeof currentCycle === "function" ? currentCycle() : null;
  const principle = cycle && cycle.scenario ? cycle.scenario.principle : null;
  // Naming the pattern in the prediction is anticipatory recognition — C3.
  const namedAhead = !!(reasoning && principleNamed(reasoning, principle));

  if (typeof recordPrediction === "function") {
    recordPrediction(index, confidence, namedAhead);
  }
  if (typeof track === "function") {
    track("prediction_made", {
      predicted: index, confidence, principle,
      reasoning: reasoning ? reasoning.slice(0, 400) : null,
      named_ahead: namedAhead,
      c_level: namedAhead ? "C3" : null,
    });
  }
  const wrap = document.getElementById("probe-predict");
  if (wrap) {
    wrap.innerHTML = `<p class="probe-locked">${namedAhead
      ? "You called the pattern before acting. Now make the actual call."
      : "Prediction locked in. Now make the actual call."}</p>`;
    setTimeout(() => wrap.remove(), 2200);
  }
}

// --- 2 & 3. Surprise and reflection ----------------------------------------
// Fire after the outcome. Surprise is observable evidence that a model failed;
// the free text is the qualitative corpus.
function maybeRunPostProbes(result) {
  const cycle = { probes: (typeof permittedProbes === "function" && result.budget)
    ? permittedProbes(result.budget) : { surprise: true, reflect: true } };
  if (!result || result.predicted === null) return;   // nothing was committed
  if (!cycle.probes.surprise) return;
  // Let the outcome and the twin's opened call land before asking. Surprise is
  // supporting context for the reveal, not a substitute for it, and a modal
  // that covers the thing it is asking about gets answered against the wrong
  // information. Waits for the reveal to finish animating in.
  const reveal = document.querySelector(".twin-reveal");
  setTimeout(() => showSurpriseProbe(result), reveal ? 1400 : 0);
}

function showSurpriseProbe(result) {
  let overlay = document.getElementById("probe-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "quiz-overlay";
    overlay.id = "probe-overlay";
    document.body.appendChild(overlay);
  }

  const matched = result.correct;
  overlay.innerHTML = `
    <div class="quiz-modal probe-modal" role="dialog" aria-modal="true" aria-labelledby="probe-title">
      <p class="probe-eyebrow">${matched ? "You called it" : "Not what you predicted"}</p>
      <h3 class="probe-title" id="probe-title">How surprised are you by how that went?</h3>
      <div class="surprise-scale" role="group" aria-label="Surprise, 1 to 7">
        ${[1,2,3,4,5,6,7].map(n =>
          `<button class="surprise-btn" type="button" data-v="${n}"
             aria-label="${n} of 7">${n}</button>`).join("")}
      </div>
      <div class="surprise-anchors"><span>Not at all</span><span>Completely</span></div>
      <div id="probe-followup" hidden>
        <label class="probe-q" for="reflect-text">What made it go that way?</label>
        <textarea id="reflect-text" class="probe-text" rows="3"
                  placeholder="A sentence is plenty. Or skip."></textarea>
        <div class="probe-actions">
          <button class="btn btn-primary" id="reflect-save" type="button">Done</button>
          <button class="probe-skip" id="reflect-skip" type="button">Skip</button>
        </div>
      </div>
      <button class="probe-skip probe-skip-block" id="surprise-skip" type="button">Skip</button>
    </div>`;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  let surprise = null;
  overlay.querySelectorAll(".surprise-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      surprise = +btn.dataset.v;
      overlay.querySelectorAll(".surprise-btn").forEach(b => b.classList.toggle("selected", b === btn));
      const sig = typeof disequilibriumSignal === "function"
        ? disequilibriumSignal(result.confidence, surprise) : null;
      if (typeof track === "function") {
        track("round_completed", {
          probe: "surprise", value: surprise,
          principle: result.principle, surface: result.surface,
          confidently_wrong: sig ? sig.confidentlyWrong : null,
          disequilibrium: sig ? sig.band : null,
        });
      }
      // Only pursue reflection where the model actually failed. Asking "why?"
      // after an unsurprising outcome produces filler.
      if (surprise >= 4) {
        document.getElementById("probe-followup").hidden = false;
        document.getElementById("surprise-skip").hidden = true;
        document.getElementById("reflect-text").focus();
      } else {
        closeProbe();
      }
    });
  });

  const save = () => {
    const text = (document.getElementById("reflect-text")?.value || "").trim();
    if (text && typeof track === "function") {
      // Free text is the qualitative corpus. Classified for C-level: naming the
      // principle unprompted here is C2.
      const named = principleNamed(text, result.principle);
      track("round_completed", {
        probe: "reflection", chars: text.length, text: text.slice(0, 600),
        principle: result.principle, named_principle: named,
        c_level: named ? "C2" : "C1",
      });
      if (result.principle && typeof updateIDM === "function") {
        updateIDM(result.principle, {
          correct: result.correct, confidence: result.confidence,
          surprise, cLevel: named ? "C2" : "C1",
          surface: result.surface, decisionIndex: null,
        });
      }
    }
    closeProbe();
  };
  document.getElementById("reflect-save")?.addEventListener("click", save);
  document.getElementById("reflect-skip")?.addEventListener("click", closeProbe);
  document.getElementById("surprise-skip")?.addEventListener("click", closeProbe);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeProbe(); });
}

// Lightweight keyword match for whether the learner named the principle
// unprompted. Deliberately crude — it flags candidates for human coding rather
// than claiming to classify reflection depth automatically.
function principleNamed(text, principleKey) {
  if (!text || !principleKey || typeof DECISION_MODELS === "undefined") return false;
  const model = DECISION_MODELS[principleKey];
  if (!model) return false;
  const t = text.toLowerCase();
  const cues = {
    catch_up_later: ["catch up", "later", "put off", "delay", "postpone", "kept adding"],
    credit_is_free: ["credit", "card", "borrow", "interest", "pay it back", "free"],
    more_saved_is_better: ["saving too", "hoard", "never spend", "enough saved", "not living"],
    id_notice: ["didn't notice", "wasn't watching", "crept", "wasn't looking"],
    this_time_different: ["thought this time", "assumed", "different", "overconfident"],
    others_first: ["others", "helping", "giving", "myself last"],
    waiting_is_safe: ["waiting", "did nothing", "inaction", "put it off", "safe option"],
  }[principleKey] || [];
  return cues.some(c => t.includes(c));
}

function closeProbe() {
  const o = document.getElementById("probe-overlay");
  if (o) o.classList.remove("open");
  document.body.style.overflow = "";
  document.querySelector(".choice-btn")?.focus();
}
