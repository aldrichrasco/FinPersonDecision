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


  // -------------------------------------------------------------- difference
  // Answers the question a label alone always provokes: "but what makes MINE
  // different?" Measured against the archetype's own target profile, so the
  // comparison can never contradict the label it is explaining.
  function renderDifference(fp, r) {
    const name = personaName(r.archetype);
    const dev = fp.deviation;
    let body;
    if (!dev) {
      body = `<p class="mri-note">Not enough of your profile is filled in to compare you against a typical ${esc(name)}.</p>`;
    } else if (dev.typical) {
      body = `<p class="mri-note">You sit close to a typical <strong>${esc(name)}</strong> on every tendency. That is itself unusual: most people diverge somewhere, and having no outlier means the archetype describes you unusually well.</p>`;
    } else {
      const t = dev.top;
      const dir = t.delta > 0 ? "higher" : "lower";
      body = `
        <p class="mri-note" style="margin-bottom:14px;">Most people matched to <strong>${esc(name)}</strong> sit around <strong>${t.expected}</strong> on ${esc(mriAxisName(t.axis))}.</p>
        <p class="mri-finding" style="font-size:clamp(18px,3vw,23px);margin-bottom:14px;">You are at ${t.value}, which is ${Math.abs(t.delta)} points ${dir}.</p>
        <p class="mri-note">${esc(differenceCopy(t.axis, t.delta))}</p>`;
    }
    return `
      ${body}
      ${fp.distinctness && fp.distinctness.between ? `
        <p class="mri-note" style="margin-top:16px;font-size:13px;color:var(--mri-ink-3);">
          Your profile sits almost equally close to two archetypes, so the label is a convenience more than a boundary.
        </p>` : ""}`;
  }

  const DIFFERENCE_COPY = {
    temporal_orientation: d => d > 0
      ? "You wait longer than the archetype does. That is what lets you hold positions others would abandon, and also what can keep you in one too long."
      : "You work on a shorter horizon than the archetype does, so advice written for that label will tend to assume a patience you have not got.",
    risk_disposition: d => d > 0
      ? "You carry more uncertainty than the archetype expects, which widens what is available to you and widens what can go wrong."
      : "You take less risk than the archetype implies, so the label probably overstates how much volatility you actually want.",
    impulse_regulation: d => d > 0
      ? "You pause more than the archetype does. The label suggests someone quicker off the mark than you actually are."
      : "You move faster than the archetype does, which is where most of the difference between you and the label will show up.",
    financial_attentiveness: d => d > 0
      ? "You track detail more closely than the archetype does, which is a quiet advantage the label does not mention."
      : "You watch the detail less than the archetype assumes, so the things that catch you out will be the ones that accumulate unnoticed.",
    financial_self_efficacy: d => d > 0
      ? "You back yourself harder than the archetype does. That gets you moving, and it is also the tendency most worth checking."
      : "You are less sure of your own judgement than the archetype suggests, which usually means you are more careful than the label gives you credit for.",
    prosocial_orientation: d => d > 0
      ? "Other people weigh on your decisions more than the archetype accounts for, which changes where your money actually goes."
      : "You decide more independently than the archetype implies, so advice about balancing others against yourself will land differently.",
  };
  function differenceCopy(axis, delta) {
    const fn = DIFFERENCE_COPY[axis];
    return fn ? fn(delta) : "";
  }


  function hasAxesEarly(profile) {
    return AXIS_KEYS.some(k => typeof profile[k] === "number");
  }

  // The quiz can establish who you are; only decisions can establish what you
  // do. The split is roughly 70/30 and the weights below say so explicitly,
  // so the number is traceable rather than asserted.
  const COMPLETENESS_PARTS = [
    { id: "axes",       weight: 30, label: "Your six tendencies",                 needs: "the assessment" },
    { id: "archetype",  weight: 20, label: "Your archetype and what makes yours different", needs: "the assessment" },
    { id: "interaction",weight: 20, label: "How your tendencies interact",        needs: "the assessment" },
    { id: "gap",        weight: 15, label: "The gap between what you say and do", needs: "decisions" },
    { id: "condition",  weight: 10, label: "The conditions that change your behaviour", needs: "decisions" },
    { id: "twin",       weight:  5, label: "A twin that can predict you",         needs: "decisions" },
  ];

  function renderCompleteness(r, hasAxes) {
    const have = {
      axes: hasAxes,
      archetype: !!r.archetype,
      interaction: hasAxes,
      gap: !!r.prediction_gap,
      condition: !!r.time_pressure,
      twin: !!r.twin,
    };
    const pct = COMPLETENESS_PARTS.reduce((s, p) => s + (have[p.id] ? p.weight : 0), 0);
    const missing = COMPLETENESS_PARTS.filter(p => !have[p.id]);

    return `
      <div class="mri-complete">
        <div class="mri-complete-top">
          <span class="mri-split-name">Your Financial MRI</span>
          <span class="mri-complete-num">${pct}%</span>
        </div>
        <div class="mri-complete-track">
          <span class="mri-complete-have" style="width:${pct}%;"></span>
          <span class="mri-complete-gap" style="width:${100 - pct}%;"></span>
        </div>
        <ul class="mri-complete-list">
          ${COMPLETENESS_PARTS.map(p => `
            <li class="${have[p.id] ? "has" : "missing"}">${esc(p.label)}${have[p.id] ? "" : ` &mdash; needs ${esc(p.needs)}`}</li>`).join("")}
        </ul>
        ${missing.length ? `
          <p class="mri-note" style="margin-top:16px;font-size:13.5px;">
            ${missing.every(m => m.needs === "decisions")
              ? "<strong>Questions cannot fill the rest.</strong> What is missing is what you actually do when a decision is in front of you, which only the sandbox can show."
              : "Finish the assessment to complete the first part, then the sandbox fills the rest."}
          </p>
          <p style="margin-top:14px;">
            ${missing.some(m => m.needs === "decisions")
              ? '<a class="mri-btn mri-btn-sm" href="dashboard.html">Fill the gap in the sandbox</a>'
              : '<a class="mri-btn mri-btn-sm" href="quiz.html">Take the assessment</a>'}
          </p>` : `<p class="mri-note" style="margin-top:16px;">Every section has the evidence it needs. More decisions still sharpen it.</p>`}
      </div>`;
  }

  // ---------------------------------------------------------------- render

  const content = document.getElementById("mri-content");
  const meta = document.getElementById("mri-mast-meta");
  if (!content) return;

  const saved = (typeof syncProfileFromServer === "function")
    ? await syncProfileFromServer()
    : (typeof getProfile === "function" ? getProfile() : null);

  // The sandbox is reachable without ever taking the quiz, so decisions can
  // exist with no profile behind them. Those decisions are still evidence and
  // still produce the report's central findings, so only a person with
  // NEITHER gets turned away. Gating on the profile alone hid a working report
  // from anyone who went straight to the sandbox.
  const localDecisions = (typeof getMriDecisions === "function") ? getMriDecisions() : [];
  if ((!saved || !saved.archetype) && !localDecisions.length) {
    meta.textContent = "Nothing recorded yet";
    content.innerHTML = `
      <div class="mri-empty">
        <p class="mri-empty-lab">Nothing to read yet</p>
        <p class="mri-empty-txt">Your Financial MRI is built from decisions you actually make, so it needs something to read. <strong>Either start with the quiz or go straight to the sandbox</strong>, both give the report something to work with.</p>
        <a class="mri-btn mri-btn-sm" href="index.html">Start the quiz</a>
        <a class="mri-btn mri-btn-ghost mri-btn-sm" href="dashboard.html" style="margin-left:8px;">Go to the sandbox</a>
      </div>`;
    return;
  }

  // Awaited deliberately: the server is the source of truth for the report, so
  // anything decided in this browser has to land before we ask what it knows.
  // Firing and forgetting here lets the read race the write, and a browser
  // full of decisions renders as an empty report.
  if (typeof pushMriDecisionToServer === "function") await pushMriDecisionToServer();

  let report = (typeof fetchFreeMriReport === "function") ? await fetchFreeMriReport() : null;
  if (!report) report = buildLocalFallback(saved || { profile: {}, archetype: null });

  render(report, saved || { profile: {}, archetype: null });

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

    // Built up front: the fingerprint is the report's focus, so it has to
    // exist before the opening section rather than midway through.
    const hasAxes = hasAxesEarly(profile);
    const twin = (typeof buildTwin === "function")
      ? twinApplyCorrections(buildTwin(r.decisions || (typeof getMriDecisions === "function" ? getMriDecisions() : [])))
      : null;
    const fp = (hasAxes && typeof buildFingerprint === "function")
      ? buildFingerprint(profile, r.archetype, twin) : null;

    // 01 Identity
    const name = displayName();
    const runnerUp = (r.archetype_ranking || [])[1];
    const persona = (typeof PERSONAS !== "undefined")
      ? PERSONAS.find(p => p.slug === r.archetype) : null;
    // An archetype only exists once a quiz or assessment has run. Someone who
    // went straight to the sandbox gets the same section framed around what
    // their decisions show, rather than an empty label.
    parts.push(section(num(), "Your financial fingerprint", r.archetype ? `
      <div class="fp-hero">
        <div class="fp-mark">${fp ? fingerprintMarkSvg(profile, { size: 190 }) : ""}</div>
        <div class="fp-id">
          ${name ? `<h1 class="mri-name" style="font-size:clamp(24px,4vw,32px);">${esc(name)}</h1>` : ""}
          ${fp ? `<p class="fp-code">${esc(fp.code)}</p>` : ""}
          <div class="mri-arch-row">
            <span class="mri-arch-primary">${esc(personaName(r.archetype))}</span>
            ${runnerUp ? `<span class="mri-arch-sub">${esc(personaName(runnerUp.slug))} leaning</span>` : ""}
          </div>
          <p class="mri-lede" style="font-size:15px;">${esc(persona ? persona.trait : "")}</p>
        </div>
      </div>
      <p class="mri-note" style="margin-top:20px;font-size:13px;color:var(--mri-ink-3);">
        Six arcs, one per tendency, each drawn to the length of its score. The archetype is the
        label thousands of people share. <strong>This mark is the part that is only yours.</strong>
      </p>
    ` : `
      ${name ? `<h1 class="mri-name">${esc(name)}</h1>` : ""}
      <p class="mri-lede">You have not been matched to an archetype yet, so this report is built purely from what you did. That is the more reliable half anyway.</p>
      <p style="margin-top:14px;"><a class="mri-btn mri-btn-ghost mri-btn-sm" href="index.html">Add the quiz for the other half</a></p>
    `));

    // 02 Completeness. Stated up front rather than discovered by hitting
    // empty sections: knowing the report is 70% built is honest, and it is a
    // better reason to continue than an unexplained gap.
    parts.push(section(num(), "How complete this is", renderCompleteness(r, hasAxesEarly(profile))));

    // 03 The finding
    parts.push(section(num(), "What we found", renderGap(r)));

    // 03 When it happens
    parts.push(section(num(), "When it happens", renderSplit(r)));

    // 04 Why we think this
    if (r.evidence && r.evidence.length) {
      parts.push(section(num(), "Why we think this is you", renderEvidence(r.evidence)));
    }

    // 05 Tendencies. Needs the six axes, which only the quiz or the full
    // assessment can produce, so it is skipped rather than shown at a
    // meaningless flat 50 across the board.
    if (fp) parts.push(section(num(), "What makes yours different", renderDifference(fp, r)));
    if (hasAxes) parts.push(section(num(), "Your six tendencies", renderTendencies(profile, fp)));

    // 06 Interaction
    const inter = (hasAxes && typeof mriInteraction === "function") ? mriInteraction(profile) : null;
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
    // Three distinct readings, because "not a confirmed pattern" is not the
    // same as "no difference". Asserting consistency when the two rates are
    // visibly apart overclaims in the opposite direction, which is the same
    // error as claiming a pattern too early.
    const drift = s.untimed_rate - s.timed_rate;
    let finding, note;
    if (s.is_pattern) {
      finding = "Your pause holds, until something puts a clock on it.";
      note = `You are not impulsive. You are deliberate right up to the moment urgency enters, and then you decide differently.${s.gap_from_timed ? ` <strong>${money(s.gap_from_timed)} of your gap came from timed decisions.</strong>` : ""}`;
    } else if (drift >= 0.1) {
      finding = "Deadlines may be doing something, but not enough to call it.";
      note = `You did what you predicted more often without a deadline than with one, but the difference is not yet big enough to separate from chance. <strong>A few more timed decisions would settle it either way.</strong>`;
    } else if (drift <= -0.1) {
      finding = "You do better under a deadline, not worse.";
      note = "That is the reverse of the usual pattern. Pressure appears to focus you rather than derail you, which is worth knowing about yourself.";
    } else {
      finding = "Deadlines have not changed your behaviour.";
      note = "Your prediction accuracy is close to identical with and without time pressure. That steadiness is less common than you would think.";
    }
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

  // Tendencies as CONDITIONAL traits where the twin has found a condition.
  // A score says what you do on average; a condition says when the average
  // stops holding, which is the part a reader has not heard before. Traits
  // with a condition lead, and the rest stay as plain rows rather than being
  // given a condition that has not been earned.
  function renderTendencies(profile, fp) {
    if (!fp) {
      const rows = AXIS_KEYS
        .map(k => ({ key: k, value: Math.round(profile[k] ?? 50) }))
        .sort((a, b) => b.value - a.value)
        .map(plainRow).join("");
      return `<p class="mri-note" style="margin-bottom:16px;">Not scores. Higher does not mean better.</p>${rows}`;
    }

    const conditioned = fp.conditional.map(conditionalCard).join("");
    const plain = fp.traits.filter(t => !t.condition)
      .sort((a, b) => b.value - a.value).map(t => plainRow({ key: t.axis, value: t.value })).join("");

    return `
      <p class="mri-note" style="margin-bottom:18px;">Not scores. Higher does not mean better. Where your twin has found the condition that changes a tendency, it is shown with it.</p>
      ${conditioned}
      ${plain ? `
        <p class="mri-split-name" style="margin:26px 0 12px;">No condition found yet</p>
        <p class="mri-note" style="font-size:13px;margin-bottom:14px;color:var(--mri-ink-3);">These tendencies have a level but no discovered trigger. More decisions is what finds one.</p>
        ${plain}` : ""}`;
  }

  function plainRow(t) {
    return `
      <div class="mri-tend-row">
        <span class="mri-tend-name">${esc(mriAxisName(t.key))}</span>
        <span class="mri-tend-mid">
          <span class="mri-tend-line">${esc(typeof mriTendencyLine === "function" ? mriTendencyLine(t.key, t.value) : "")}</span>
          <span class="mri-tend-bar"><span class="mri-tend-fill" style="width:${t.value}%;"></span></span>
        </span>
        <span class="mri-tend-val">${t.value}</span>
      </div>`;
  }

  // Trait -> Condition -> Behaviour, plus Strength / Risk / Use. "Use" is the
  // leg that makes the framing actionable: naming a strength without saying
  // where to point it leaves the reader with a compliment, not a move.
  function conditionalCard(t) {
    const ev = t.conditionEvidence;
    const evColor = { strong: "var(--mri-good)", emerging: "var(--mri-accent)", limited: "var(--mri-ink-3)" }[ev.id];
    return `
      <div style="border:1px solid var(--mri-rule);border-left:3px solid var(--mri-accent);border-radius:3px;padding:20px 22px;margin-bottom:14px;background:var(--mri-surface);">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
          <span class="mri-tend-name">${esc(mriAxisName(t.axis))}</span>
          <span style="font-family:var(--mri-mono);font-size:11px;color:${evColor};">Evidence: ${esc(ev.label)} &middot; ${t.conditionCounts.support} of ${t.conditionCounts.total}</span>
        </div>
        <p style="font-family:var(--mri-serif);font-size:19px;margin:0 0 4px;">${esc(t.trait)}</p>
        <div class="mri-tend-bar" style="margin-bottom:16px;"><span class="mri-tend-fill" style="width:${t.value}%;display:block;"></span></div>

        <p class="mri-twin-lab" style="margin-bottom:6px;">Until</p>
        <p style="font-family:var(--mri-serif);font-size:16px;line-height:1.45;margin:0 0 18px;">${esc(t.condition)}</p>

        <div style="display:grid;grid-template-columns:1fr;gap:12px;padding-top:14px;border-top:1px solid var(--mri-rule-soft);">
          <div>
            <p class="mri-axis-lab" style="font-family:var(--mri-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--mri-good);margin:0 0 4px;">Strength</p>
            <p class="mri-ev-txt" style="margin:0;">${esc(t.strength)}</p>
          </div>
          <div>
            <p style="font-family:var(--mri-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--mri-warn);margin:0 0 4px;">Risk</p>
            <p class="mri-ev-txt" style="margin:0;">${esc(t.risk)}</p>
          </div>
          <div>
            <p style="font-family:var(--mri-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--mri-accent);margin:0 0 4px;">Use it</p>
            <p class="mri-ev-txt" style="margin:0;">${esc(t.use)}</p>
          </div>
        </div>
      </div>`;
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
