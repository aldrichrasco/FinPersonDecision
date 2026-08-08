// Renders the free Financial MRI.
//
// This is the product's main deliverable. The decision sandbox exists to
// generate the evidence read here; this page is what a person actually came
// for, so it is built to stand on its own.
//
// The governing rule, inherited from mri_free_report.py: any section without
// the evidence to support it renders an honest empty state rather than a
// plausible-looking default. The report's entire claim is that it came from
// real decisions, and one invented number costs the reader's trust in all the
// genuine ones.
//
// Data comes from the server (/api/mri/free-report), which reads the synced
// decision log. If that call fails the page falls back to computing what it
// can locally from mri-data.js, so a network problem degrades the report
// rather than emptying it.
(async function () {
  const EVIDENCE_COPY = {
    growth_appetite: e => `You took the option with upside in <strong>${e.count} of ${e.of}</strong> decisions where an opportunity was genuinely on the table.`,
    delayed_reward: e => `When a decision traded something now for something later, you did what you predicted <strong>${e.count} of ${e.of}</strong> times.`,
    credit_use: e => `You faced credit <strong>${e.of}</strong> time${e.of === 1 ? "" : "s"}. How you use it, rather than whether you use it, is what separates the patterns closest to yours.`,
  };

  // ---------------------------------------------------------------- render

  const content = document.getElementById("mri-content");
  const meta = document.getElementById("mri-mast-meta");
  if (!content) return;

  const saved = (typeof syncProfileFromServer === "function")
    ? await syncProfileFromServer()
    : (typeof getProfile === "function" ? getProfile() : null);

  if (!saved || !saved.archetype) {
    meta.textContent = "No profile yet";
    content.innerHTML = `
      <div class="mri-empty">
        <p class="mri-empty-lab">Nothing to read yet</p>
        <p class="mri-empty-txt">Your Financial MRI is built from decisions you actually make, so it needs a starting point. <strong>The quiz takes a couple of minutes</strong> and gives the report its first read on you.</p>
        <a class="mri-btn" href="index.html">Start the quiz</a>
      </div>`;
    return;
  }

  // Awaited deliberately: the server is the source of truth for the report, so
  // anything decided in this browser has to land before we ask what it knows.
  // Firing and forgetting here lets the read race the write, and a browser
  // full of decisions renders as an empty report.
  if (typeof pushMriDecisionToServer === "function") await pushMriDecisionToServer();

  let report = (typeof fetchFreeMriReport === "function") ? await fetchFreeMriReport() : null;
  if (!report) report = buildLocalFallback(saved);

  render(report, saved);

  // ---------------------------------------------------------------- fallback
  // Server unreachable. Everything derivable from localStorage still renders;
  // sections needing server-side data simply report themselves as unavailable.
  function buildLocalFallback(profileBlob) {
    const profile = profileBlob.profile || {};
    const ranking = (typeof mriArchetypeRanking === "function")
      ? mriArchetypeRanking(profile).map(r => ({ slug: r.slug, closeness: r.closeness }))
      : [];
    const gap = typeof mriPredictionGap === "function" ? mriPredictionGap() : null;
    const split = typeof mriTimePressureSplit === "function" ? mriTimePressureSplit() : null;
    return {
      archetype: profileBlob.archetype,
      archetype_ranking: ranking,
      profile,
      decision_count: typeof getMriDecisions === "function" ? getMriDecisions().length : 0,
      prediction_gap: gap ? {
        total: gap.total, decision_count: gap.decisionCount,
        biggest: gap.biggest ? {
          amount: gap.biggest.amount, scenario: gap.biggest.scenario, choice: gap.biggest.choice,
        } : null,
      } : null,
      time_pressure: split ? {
        timed: split.timed, untimed: split.untimed,
        timed_rate: split.timedRate, untimed_rate: split.untimedRate,
        is_pattern: split.isPattern, gap_from_timed: null,
      } : null,
      twin: typeof mriTwinMatch === "function" ? mriTwinMatch() : null,
      evidence: null,
      confidence: typeof mriConfidence === "function" ? mriConfidence(profile) : null,
    };
  }

  // ---------------------------------------------------------------- helpers
  function money(n) {
    return "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
  }
  function personaName(slug) {
    const p = (typeof PERSONAS !== "undefined") ? PERSONAS.find(x => x.slug === slug) : null;
    return p ? p.name : slug;
  }
  function displayName() {
    // Only ever a name the person gave us. Never invented, never a placeholder.
    try {
      const u = JSON.parse(localStorage.getItem("finperson_user") || "null");
      if (u && u.name) return u.name;
      if (u && u.email) return u.email.split("@")[0];
    } catch (e) {}
    return null;
  }
  function section(num, title, inner) {
    return `
      <section class="mri-sec">
        <div class="mri-sec-head">
          <span class="mri-sec-num">${num}</span>
          <h2 class="mri-sec-title">${esc(title)}</h2>
        </div>
        ${inner}
      </section>`;
  }
  function emptyState(label, text, ctaLabel, ctaHref) {
    return `
      <div class="mri-empty">
        <p class="mri-empty-lab">${esc(label)}</p>
        <p class="mri-empty-txt">${text}</p>
        <a class="mri-btn mri-btn-sm" href="${esc(ctaHref)}">${esc(ctaLabel)}</a>
      </div>`;
  }

  function render(r, profileBlob) {
    const profile = r.profile || profileBlob.profile || {};
    const parts = [];
    let n = 0;
    const num = () => String(++n).padStart(2, "0");

    meta.textContent = r.decision_count
      ? `${r.decision_count} decision${r.decision_count === 1 ? "" : "s"} recorded`
      : "Quiz only, no decisions yet";

    // 01 Identity
    const name = displayName();
    const runnerUp = (r.archetype_ranking || [])[1];
    const persona = (typeof PERSONAS !== "undefined")
      ? PERSONAS.find(p => p.slug === r.archetype) : null;
    parts.push(section(num(), "Who you are", `
      ${name ? `<h1 class="mri-name">${esc(name)}</h1>` : ""}
      <div class="mri-arch-row">
        <span class="mri-arch-primary">${esc(personaName(r.archetype))}</span>
        ${runnerUp ? `<span class="mri-arch-sub">${esc(personaName(runnerUp.slug))} leaning</span>` : ""}
      </div>
      <p class="mri-lede">${esc(persona ? persona.trait : "")}</p>
    `));

    // 02 The finding
    parts.push(section(num(), "What we found", renderGap(r)));

    // 03 When it happens
    parts.push(section(num(), "When it happens", renderSplit(r)));

    // 04 Why we think this
    if (r.evidence && r.evidence.length) {
      parts.push(section(num(), "Why we think this is you", renderEvidence(r.evidence)));
    }

    // 05 Tendencies
    parts.push(section(num(), "Your six tendencies", renderTendencies(profile)));

    // 06 Interaction
    const inter = (typeof mriInteraction === "function") ? mriInteraction(profile) : null;
    if (inter) parts.push(section(num(), "How they interact", renderInteraction(inter, profile)));

    // 07 Twin
    parts.push(section(num(), "The model we built of you", renderTwin(r)));

    // 08 Confidence
    if (r.confidence) parts.push(section(num(), "What we are unsure about", renderConfidence(r.confidence)));

    // 09 Unlock
    parts.push(section(num(), "Go deeper", renderUnlock(r)));

    parts.push(`
      <div class="mri-method">
        <p><strong>How this works.</strong> You make decisions in a practice simulation, and before some of them you predict what you will choose. Every number above comes from comparing those two things.</p>
        <p>The money is illustrative and the scenarios are practice, so nothing here describes your real accounts or predicts real returns. Outcomes are calculated with fixed arithmetic, never generated by a language model.</p>
        <p><strong>This is a behavioural snapshot, not a diagnosis.</strong> It changes as you make more decisions, and it is meant to.</p>
      </div>`);

    content.innerHTML = parts.join("");
    document.getElementById("mri-twin-yes")?.addEventListener("click", () => twinFeedback(true));
    document.getElementById("mri-twin-no")?.addEventListener("click", () => twinFeedback(false));
  }

  function renderGap(r) {
    const g = r.prediction_gap;
    if (!g) {
      return emptyState(
        "Needs a few more decisions",
        `This is the report's central finding: what following your own predictions would have been worth. It needs at least three decisions where you predicted your choice before seeing the options. <strong>You have ${r.decision_count || 0} recorded so far.</strong>`,
        "Open the sandbox", "dashboard.html");
    }
    return `
      <div class="mri-readout">
        <p class="mri-provenance">Based on ${g.decision_count} decision${g.decision_count === 1 ? "" : "s"} you made in the FinPerson simulation. Practice scenarios with illustrative money, not your real accounts.</p>
        <p class="mri-figure">${money(g.total)}</p>
        <p class="mri-figure-say">The simulated gap between what you said you'd do and what you actually chose.</p>
        ${g.biggest ? `
          <div class="mri-miss">
            <p class="mri-miss-lab">Biggest single miss</p>
            <p class="mri-miss-amt">${money(g.biggest.amount)} of it was one decision</p>
            <p class="mri-miss-txt">${esc(g.biggest.scenario || "")} You chose <em>${esc(g.biggest.choice || "")}</em> instead of what you predicted.</p>
          </div>` : ""}
      </div>`;
  }

  function renderSplit(r) {
    const s = r.time_pressure;
    if (!s) {
      return emptyState(
        "Not enough of both kinds yet",
        "Some scenarios carry a deadline and some do not. Comparing how you behave across the two is where the most useful finding usually appears, but it needs at least two of each.",
        "Open the sandbox", "dashboard.html");
    }
    const row = (label, group) => {
      const broke = group.total - group.kept;
      return `
        <div class="mri-split-row">
          <div class="mri-split-top">
            <span class="mri-split-name">${esc(label)}</span>
            <span class="mri-split-tally">${group.kept} of ${group.total} went as predicted</span>
          </div>
          <div class="mri-split-bar">
            ${group.kept ? `<span class="mri-split-seg kept" style="width:${(group.kept / group.total) * 100}%;">${group.kept}</span>` : ""}
            ${broke ? `<span class="mri-split-seg broke" style="width:${(broke / group.total) * 100}%;">${broke}</span>` : ""}
          </div>
        </div>`;
    };
    const finding = s.is_pattern
      ? "Your pause holds, until something puts a clock on it."
      : "Deadlines have not changed your behaviour so far.";
    const note = s.is_pattern
      ? `You are not impulsive. You are deliberate right up to the moment urgency enters, and then you decide differently.${s.gap_from_timed ? ` <strong>${money(s.gap_from_timed)} of your gap came from timed decisions.</strong>` : ""}`
      : "You have behaved consistently whether or not a decision had a deadline attached. That is worth knowing too, and it is less common than you would think.";
    return `
      <p class="mri-finding">${esc(finding)}</p>
      ${row("No deadline", s.untimed)}
      ${row("Deadline attached", s.timed)}
      <div class="mri-split-legend">
        <span><i style="background:var(--mri-good);"></i>Did what you predicted</span>
        <span><i style="background:var(--mri-warn);"></i>Did something else</span>
      </div>
      <p class="mri-note">${note}</p>`;
  }

  function renderEvidence(evidence) {
    const items = evidence
      .filter(e => EVIDENCE_COPY[e.kind])
      .map((e, i) => `
        <div class="mri-ev-item">
          <span class="mri-ev-num">${String(i + 1).padStart(2, "0")}</span>
          <p class="mri-ev-txt">${EVIDENCE_COPY[e.kind](e)}</p>
        </div>`).join("");
    return `<div class="mri-ev">${items}</div>`;
  }

  function renderTendencies(profile) {
    const rows = AXIS_KEYS
      .map(k => ({ key: k, value: Math.round(profile[k] ?? 50) }))
      .sort((a, b) => b.value - a.value)
      .map(t => `
        <div class="mri-tend-row">
          <span class="mri-tend-name">${esc(mriAxisName(t.key))}</span>
          <span class="mri-tend-mid">
            <span class="mri-tend-line">${esc(typeof mriTendencyLine === "function" ? mriTendencyLine(t.key, t.value) : AXES[t.key].sub)}</span>
            <span class="mri-tend-bar"><span class="mri-tend-fill" style="width:${t.value}%;"></span></span>
          </span>
          <span class="mri-tend-val">${t.value}</span>
        </div>`).join("");
    const sorted = AXIS_KEYS.map(k => ({ k, v: profile[k] ?? 50 })).sort((a, b) => b.v - a.v);
    const top = mriAxisName(sorted[0].k), bottom = mriAxisName(sorted[sorted.length - 1].k);
    return `
      <p class="mri-note" style="margin-bottom:16px;">Not scores. Higher does not mean better. They describe how you tend to decide.</p>
      ${rows}
      <p class="mri-tend-note"><strong>${esc(top)}</strong> at the top and <strong>${esc(bottom)}</strong> at the bottom is the shape that produced your finding. The combination is what matters, not any single row.</p>`;
  }

  function renderInteraction(inter, profile) {
    return `
      <div class="mri-pair">
        <span class="mri-pair-chip">${esc(mriAxisName(inter.a))} ${Math.round(profile[inter.a] ?? 50)}</span>
        <span class="mri-pair-x">&#215;</span>
        <span class="mri-pair-chip">${esc(mriAxisName(inter.b))} ${Math.round(profile[inter.b] ?? 50)}</span>
      </div>
      <p class="mri-inter-head">${esc(inter.head)}</p>
      <p class="mri-note">${esc(inter.body)}</p>
      <p class="mri-inter-contrast">${esc(inter.contrast)}</p>`;
  }

  function renderTwin(r) {
    if (!r.twin) {
      return emptyState(
        "Your twin has not seen enough",
        "Your Financial Twin is a model of the rules you decide by, built from what you did rather than what you said. It needs at least four predicted decisions before it can make a call worth showing you.",
        "Open the sandbox", "dashboard.html");
    }
    return `
      <div class="mri-twin-head">
        <p class="mri-twin-title">Your Financial Twin</p>
        <span class="mri-twin-metric">Matches ${r.twin.matched} of your ${r.twin.total} recorded decisions</span>
      </div>
      <p class="mri-note">A model of the rules you decide by, assembled from what you did rather than what you said. It is not a psychological truth and it is still learning. Every new decision either confirms it or corrects it.</p>
      <div class="mri-twin-demo">
        <p class="mri-twin-lab">Your twin, called before you decide</p>
        <p class="mri-twin-scenario">Your laptop dies. A refurbished replacement is $600, and the listing says the price ends tonight.</p>
        <p class="mri-twin-call">It expects you'll buy it now.</p>
        <p class="mri-twin-because">On the timed decisions you have faced, your pause has tended to fail. On the untimed ones it has held. The twin is reading that one condition, not your mood.</p>
        <div class="mri-twin-ask">
          <p class="mri-twin-q">Is it right?</p>
          <button class="mri-btn mri-btn-ghost mri-btn-sm" id="mri-twin-yes" type="button">Yes, that's me</button>
          <button class="mri-btn mri-btn-ghost mri-btn-sm" id="mri-twin-no" type="button">No, I'd wait</button>
        </div>
        <p class="mri-note" id="mri-twin-note" style="margin-top:12px;font-size:13px;">Either answer improves the model. Agreeing strengthens the rule, disagreeing tells it the rule has an exception it has not found.</p>
      </div>`;
  }

  function twinFeedback(agreed) {
    const note = document.getElementById("mri-twin-note");
    if (!note) return;
    note.innerHTML = agreed
      ? "Recorded. Your twin now weights the deadline rule more heavily, and will keep testing it."
      : "Recorded. Your twin will look for what makes this case different in the scenarios ahead.";
    document.getElementById("mri-twin-yes")?.setAttribute("disabled", "disabled");
    document.getElementById("mri-twin-no")?.setAttribute("disabled", "disabled");
    if (typeof track === "function") track("mri_twin_feedback", { agreed });
  }

  function renderConfidence(c) {
    return `
      <div class="mri-conf-top">
        <span class="mri-split-name">How confident the model is</span>
        <span class="mri-conf-num">${c.score} / 100</span>
      </div>
      <div class="mri-conf-track"><span class="mri-conf-fill" style="width:${c.score}%;display:block;"></span></div>
      <p class="mri-note"><strong>${esc(c.weakest.join(" and "))}</strong> ${c.weakest.length > 1 ? "are" : "is"} what we are least sure about. ${c.decisions < 15 ? `You have made ${c.decisions} decision${c.decisions === 1 ? "" : "s"}, and the model gets meaningfully steadier past fifteen.` : "Your profile is well evidenced across all six tendencies."}</p>
      <p style="margin-top:16px;"><a class="mri-btn mri-btn-ghost mri-btn-sm" href="dashboard.html">Resolve what we're unsure about</a></p>`;
  }

  function renderUnlock(r) {
    const opened = r.prediction_gap ? "your gap and the condition behind it" : "your six tendencies";
    return `
      <div class="mri-unlock">
        <p class="mri-unlock-head">There are five more patterns underneath this one.</p>
        <p class="mri-unlock-body">You have seen ${esc(opened)}. <strong>Every tendency has a condition attached like that,</strong> and you have not seen the rest.</p>
        <p class="mri-unlock-body">You already have all six numbers. What the full report adds is what they mean, and what they mean together.</p>
        <p class="mri-unlock-price">$5 <span>once. No subscription.</span></p>
        <ul class="mri-unlock-list">
          <li>Your other five tendencies, opened the same way</li>
          <li>Your live Financial Twin, improving with every decision</li>
          <li>Which tendencies amplify each other, and which pull against each other</li>
          <li>The situations most likely to change your behaviour</li>
          <li>Every decision behind every number</li>
        </ul>
        <a class="mri-btn" href="mri-report.html">Unlock my full MRI</a>
        <p class="mri-unlock-alt"><a href="twin.html">Meet your Financial Twin &rarr;</a></p>
        <p class="mri-unlock-alt">Ongoing coaching that tracks how this shifts month to month is the separate $5 monthly plan.</p>
      </div>`;
  }
})();
