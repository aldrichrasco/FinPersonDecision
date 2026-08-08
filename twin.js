// The Financial Twin: a model of the rules a person decides by.
//
// The design commitment that makes this different from a personality score is
// that the twin is made of EXPLICIT RULES, not numbers. A rule can be read,
// argued with, tested against new evidence, and thrown out. A score cannot.
// Everything below follows from that.
//
// Each rule carries:
//   statement  what the twin currently believes, in the person's language
//   detect     a pure function over the decision log returning for/against counts
//   status     proposed -> confirmed | contested -> retired, derived from evidence
//   refines    the rule this one replaces, so the model has a visible history
//
// A rule is never asserted from a single observation, and counter-evidence
// demotes it rather than being ignored. When the twin is wrong that is the
// most valuable moment in the product, because it means an exception exists
// that the model has not found yet.

const TWIN_MIN_EVIDENCE = 3;        // below this a rule stays a hypothesis
const TWIN_CONFIRM_RATE = 0.7;      // support share needed to confirm
const TWIN_CONTEST_RATE = 0.45;     // below this a confirmed rule is contested

// ---------------------------------------------------------------- helpers
function _twinPredicted(decisions) {
  return decisions.filter(d => d.predicted !== null && d.predicted !== undefined);
}
function _twinRate(support, against) {
  const total = support + against;
  return total ? support / total : 0;
}

// ---------------------------------------------------------------- the rules
// Detectors return {support, against, note}. `support` means the rule held,
// `against` means it was violated. Both are counted: a rule that only ever
// counts its own confirmations is not a model, it is a horoscope.
const TWIN_RULES = [
  {
    id: "deadline_breaks_pause",
    axis: "impulse_regulation",
    statement: "You decide fast when something has a deadline attached.",
    refined: "You act quickly under pressure.",
    detect(decisions) {
      const timed = _twinPredicted(decisions).filter(d => d.timed);
      return {
        support: timed.filter(d => !d.matched).length,
        against: timed.filter(d => d.matched).length,
        note: "Measured on scenarios that stated a deadline or expiring offer.",
      };
    },
  },
  {
    id: "calm_holds",
    axis: "impulse_regulation",
    statement: "With no clock running, you do what you said you would.",
    detect(decisions) {
      const untimed = _twinPredicted(decisions).filter(d => !d.timed);
      return {
        support: untimed.filter(d => d.matched).length,
        against: untimed.filter(d => !d.matched).length,
        note: "Measured on scenarios with no time pressure.",
      };
    },
  },
  {
    id: "credit_for_growth",
    axis: "risk_disposition",
    statement: "You borrow to fund things that could grow, not things you consume.",
    detect(decisions) {
      const credit = decisions.filter(d =>
        (d.netWorthDelta ?? d.net_worth_delta ?? 0) < 0 &&
        ["credit_card", "bnpl"].includes(d.surface));
      const growth = decisions.filter(d => d.surface === "opportunity");
      return {
        support: growth.length,
        against: credit.length,
        note: "Compares borrowing on opportunities against borrowing at checkout.",
      };
    },
  },
  {
    id: "future_over_present",
    axis: "temporal_orientation",
    statement: "Offered less now for more later, you take the later.",
    detect(decisions) {
      const trades = decisions.filter(d =>
        ["catch_up_later", "more_saved_is_better"].includes(d.principle));
      return {
        support: trades.filter(d => (d.netWorthDelta ?? d.net_worth_delta ?? 0) >= 0).length,
        against: trades.filter(d => (d.netWorthDelta ?? d.net_worth_delta ?? 0) < 0).length,
        note: "Measured on decisions trading something now against something later.",
      };
    },
  },
  {
    id: "avoids_looking",
    axis: "financial_attentiveness",
    statement: "When a decision is really about paying attention, you defer it.",
    detect(decisions) {
      const attention = decisions.filter(d =>
        d.principle === "id_notice" || d.surface === "subscription");
      return {
        support: attention.filter(d => (d.netWorthDelta ?? d.net_worth_delta ?? 0) < 0).length,
        against: attention.filter(d => (d.netWorthDelta ?? d.net_worth_delta ?? 0) >= 0).length,
        note: "Measured on statements, renewals and things easy to leave unopened.",
      };
    },
  },
  {
    id: "gives_when_asked",
    axis: "prosocial_orientation",
    statement: "When someone asks directly, you say yes before you have decided.",
    detect(decisions) {
      const asks = decisions.filter(d =>
        ["family_loan", "obligation"].includes(d.surface));
      return {
        support: asks.filter(d => (d.netWorthDelta ?? d.net_worth_delta ?? 0) < 0).length,
        against: asks.filter(d => (d.netWorthDelta ?? d.net_worth_delta ?? 0) >= 0).length,
        note: "Measured on decisions where another person made the request.",
      };
    },
  },
  {
    id: "steady_after_a_loss",
    axis: "financial_self_efficacy",
    statement: "A bad outcome does not change how you decide next.",
    detect(decisions) {
      // Sequence-dependent: what happened AFTER a decision that lost money.
      let support = 0, against = 0;
      for (let i = 1; i < decisions.length; i++) {
        const prevLost = (decisions[i - 1].netWorthDelta ?? decisions[i - 1].net_worth_delta ?? 0) < 0;
        if (!prevLost) continue;
        const d = decisions[i];
        if (d.predicted === null || d.predicted === undefined) continue;
        if (d.matched) support++; else against++;
      }
      return { support, against, note: "Compares the decision immediately after a loss." };
    },
  },
];

// ---------------------------------------------------------------- evaluation
function twinEvaluateRule(rule, decisions) {
  const ev = rule.detect(decisions) || { support: 0, against: 0 };
  const total = ev.support + ev.against;
  const rate = _twinRate(ev.support, ev.against);

  let status = "proposed";
  if (total >= TWIN_MIN_EVIDENCE) {
    if (rate >= TWIN_CONFIRM_RATE) status = "confirmed";
    else if (rate < TWIN_CONTEST_RATE) status = "contested";
  }
  return {
    id: rule.id,
    axis: rule.axis,
    statement: rule.statement,
    refined: rule.refined || null,
    support: ev.support,
    against: ev.against,
    total,
    rate,
    status,
    note: ev.note || "",
  };
}

// The twin as a whole. Rules are sorted so the strongest belief leads and
// contested ones stay visible rather than being quietly dropped, because a
// model that hides its own weak points is not inspectable.
function buildTwin(decisions) {
  decisions = decisions || [];
  const evaluated = TWIN_RULES
    .map(r => twinEvaluateRule(r, decisions))
    .filter(r => r.total > 0);

  const order = { confirmed: 0, contested: 1, proposed: 2 };
  evaluated.sort((a, b) => (order[a.status] - order[b.status]) || (b.total - a.total));

  const predicted = _twinPredicted(decisions);
  return {
    rules: evaluated,
    confirmed: evaluated.filter(r => r.status === "confirmed"),
    contested: evaluated.filter(r => r.status === "contested"),
    proposed: evaluated.filter(r => r.status === "proposed"),
    match: predicted.length
      ? { matched: predicted.filter(d => d.matched).length, total: predicted.length }
      : null,
    decisionCount: decisions.length,
    // Maturity drives what the avatar renders and what the twin is allowed to
    // claim. Deliberately conservative: a twin with two rules should not look
    // or sound like one with eight.
    maturity: twinMaturity(evaluated, decisions.length),
  };
}

function twinMaturity(rules, decisionCount) {
  const confirmed = rules.filter(r => r.status === "confirmed").length;
  if (decisionCount < 4) return { level: 0, label: "Forming" };
  if (confirmed < 1) return { level: 1, label: "Guessing" };
  if (confirmed < 3) return { level: 2, label: "Learning" };
  if (confirmed < 5) return { level: 3, label: "Reading you" };
  return { level: 4, label: "Knows your tells" };
}

// ---------------------------------------------------------------- prediction
// The twin predicts by finding the confirmed rule whose conditions the
// scenario meets. It says so when no rule applies rather than guessing, since
// a model that always has an answer is not a model.
function twinPredict(twin, scenario) {
  if (!twin || !twin.confirmed.length) return null;
  const conditions = [
    { id: "deadline_breaks_pause", applies: s => s.timed === true,
      call: "expects you'll decide quickly, without the pause you'd normally take" },
    { id: "calm_holds", applies: s => s.timed !== true,
      call: "expects you'll do what you predict, because nothing is rushing you" },
    { id: "avoids_looking", applies: s => s.principle === "id_notice" || s.surface === "subscription",
      call: "expects you'll leave this one for later" },
    { id: "gives_when_asked", applies: s => ["family_loan", "obligation"].includes(s.surface),
      call: "expects you'll say yes before you've finished deciding" },
    { id: "future_over_present", applies: s => ["catch_up_later", "more_saved_is_better"].includes(s.principle),
      call: "expects you'll take the slower, larger option" },
  ];
  for (const c of conditions) {
    const rule = twin.confirmed.find(r => r.id === c.id);
    if (rule && c.applies(scenario || {})) {
      return { rule, call: c.call, basis: `${rule.support} of ${rule.total} decisions` };
    }
  }
  return null;
}

// ---------------------------------------------------------------- corrections
// When the person says the twin is wrong, that is evidence, and it is the most
// informative kind. Stored separately from decisions so the model can show
// which of its beliefs are under challenge and by how much.
const TWIN_CORRECTIONS_KEY = "finperson_twin_corrections";

function getTwinCorrections() {
  try {
    const raw = localStorage.getItem(TWIN_CORRECTIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}

function recordTwinCorrection(ruleId, agreed, reason) {
  try {
    const log = getTwinCorrections();
    log.push({ at: Date.now(), ruleId, agreed: agreed === true, reason: reason || null });
    localStorage.setItem(TWIN_CORRECTIONS_KEY, JSON.stringify(log.slice(-100)));
  } catch (e) {}
}

// Why a person says the twin got it wrong. These are the exceptions worth
// looking for, and each one points at a different follow-up.
const TWIN_DISAGREE_REASONS = [
  { id: "amount", label: "The amount was too small to matter" },
  { id: "need", label: "I actually needed it" },
  { id: "unrealistic", label: "The scenario didn't feel realistic" },
  { id: "changed", label: "I've changed since then" },
];

// Applies corrections as a penalty to a rule's standing. A rule the person has
// repeatedly rejected gets demoted even when the behavioural evidence still
// supports it, because their stated exception is data the log cannot see.
function twinApplyCorrections(twin) {
  const corrections = getTwinCorrections();
  if (!corrections.length) return twin;
  twin.rules.forEach(rule => {
    const rejected = corrections.filter(c => c.ruleId === rule.id && !c.agreed).length;
    const affirmed = corrections.filter(c => c.ruleId === rule.id && c.agreed).length;
    rule.rejected = rejected;
    rule.affirmed = affirmed;
    if (rejected >= 2 && rule.status === "confirmed") rule.status = "contested";
  });
  twin.confirmed = twin.rules.filter(r => r.status === "confirmed");
  twin.contested = twin.rules.filter(r => r.status === "contested");
  return twin;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    TWIN_RULES, buildTwin, twinEvaluateRule, twinPredict, twinMaturity,
    TWIN_DISAGREE_REASONS, TWIN_MIN_EVIDENCE, TWIN_CONFIRM_RATE, TWIN_CONTEST_RATE,
  };
}
