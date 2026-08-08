// The Behavioural Fingerprint.
//
// The problem this solves: two people can both be Ambitious Builder and be
// nothing alike. A label alone is the thing that makes personality products
// feel generic, because the reader knows thousands of others got the same
// word. Everything here exists to answer "but what makes MINE different?"
//
// Three ideas, each built by joining systems that already exist rather than
// inventing new data:
//
//   Conditional traits   a tendency (from the six axes) joined to the
//                        condition that changes it (from the twin's rules).
//                        Trait -> Condition -> Behaviour. A score says what
//                        you are on average; a condition says when the
//                        average stops holding, which is the useful part.
//
//   Deviation           where you sit relative to a typical holder of your
//                        archetype. Computed against the same target profile
//                        the archetype match itself uses, so it cannot drift
//                        out of agreement with the label.
//
//   Evidence strength    every claim carries how much sits behind it. A
//                        product that says "limited evidence" where that is
//                        true earns the right to be believed elsewhere.

// ------------------------------------------------------------------ evidence
// Deliberately three coarse bands rather than a percentage. A precise-looking
// number on four observations invites questions about confidence intervals it
// cannot answer, and implies a resolution the data does not have.
const EVIDENCE_BANDS = [
  { id: "strong", label: "Strong", min: 6 },
  { id: "emerging", label: "Emerging", min: 3 },
  { id: "limited", label: "Limited", min: 0 },
];

function evidenceStrength(observationCount) {
  return EVIDENCE_BANDS.find(b => observationCount >= b.min) || EVIDENCE_BANDS[2];
}

// ---------------------------------------------------------- conditional traits
// The join that makes this work: an axis supplies the trait, a twin rule keyed
// to that same axis supplies the condition. Only rules the twin has actually
// confirmed qualify, so a condition is never asserted from a hunch.
const TRAIT_BASE = {
  impulse_regulation: {
    high: "Usually deliberate", mid: "Deliberate more often than not", low: "Quick to act",
    strength: "You can hold off when holding off is the better move.",
    risk: "Deliberation can slide into never deciding at all.",
    use: "Put your slow decisions where the stakes are highest, and let the small ones go fast.",
  },
  risk_disposition: {
    high: "Comfortable with uncertainty", mid: "Selective about risk", low: "Protective of what you have",
    strength: "You can stay in an uncertain position long enough for it to pay.",
    risk: "Comfort with uncertainty can shade into underestimating how much a loss would actually cost you.",
    use: "Take your risks where a bad outcome is survivable, and be deliberately boring everywhere else.",
  },
  temporal_orientation: {
    high: "Long-horizon", mid: "Plans in seasons", low: "Focused on the near term",
    strength: "You can trade something now for something later without it feeling like a loss.",
    risk: "Patience can keep you in a poor situation far longer than it deserves.",
    use: "Apply the patience to things that compound, and set review dates on anything that could quietly drift.",
  },
  financial_attentiveness: {
    high: "Close attention to detail", mid: "Checks in periodically", low: "Prefers not to look",
    strength: "Things do not surprise you, because you have already seen them coming.",
    risk: "Attention spent on detail is attention not spent on the decision that matters.",
    use: "Point the attention at recurring commitments, where small unnoticed things compound hardest.",
  },
  financial_self_efficacy: {
    high: "Backs your own judgement", mid: "Confident with reservations", low: "Uneasy deciding alone",
    strength: "You will act rather than freeze, which is worth more than it sounds.",
    risk: "Confidence can quietly outrun how closely you actually checked.",
    use: "Keep the decisiveness, and attach one check to it that has to happen before you commit.",
  },
  prosocial_orientation: {
    high: "Others come first", mid: "Generous within limits", low: "Decides for yourself first",
    strength: "Money does work for you that is not financial, and that is a real return.",
    risk: "Limits that flex for the people closest to you can stop being limits.",
    use: "Decide the number before the conversation, not during it.",
  },
};

function traitBand(value) {
  return value >= 66 ? "high" : value <= 40 ? "low" : "mid";
}

// A conditional trait: what you usually do, and the condition under which that
// stops being true. Returns the trait with `condition: null` when the twin has
// no confirmed rule for that axis, because "no condition found yet" is honest
// and "no condition exists" would not be.
function conditionalTrait(axisKey, value, twin) {
  const base = TRAIT_BASE[axisKey];
  if (!base) return null;
  // Several rules can share an axis, and for impulse they are near-opposites
  // ("you decide fast under a deadline" against "with no clock you hold").
  // Taking the first match would surface whichever happened to be ordered
  // earlier, so the best-evidenced rule wins instead.
  const candidates = (twin && twin.confirmed) ? twin.confirmed.filter(r => r.axis === axisKey) : [];
  const rule = candidates.length
    ? candidates.slice().sort((a, b) => (b.total - a.total) || (b.rate - a.rate))[0]
    : null;
  return {
    axis: axisKey,
    value,
    trait: base[traitBand(value)],
    strength: base.strength,
    risk: base.risk,
    use: base.use,
    condition: rule ? rule.statement : null,
    conditionEvidence: rule ? evidenceStrength(rule.total) : null,
    conditionCounts: rule ? { support: rule.support, total: rule.total } : null,
  };
}

// ------------------------------------------------------------------ deviation
// What separates this person from a typical holder of the same archetype.
// Measured against the archetype's own target profile, which is the same
// reference the match itself uses, so the two can never disagree.
function archetypeDeviation(profile, archetypeSlug) {
  if (typeof ARCHETYPE_PROFILES === "undefined") return null;
  const target = ARCHETYPE_PROFILES[archetypeSlug];
  if (!target || !profile) return null;

  const deltas = AXIS_KEYS
    .map(k => ({ axis: k, value: profile[k] ?? 50, expected: target[k], delta: (profile[k] ?? 50) - target[k] }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const top = deltas[0];
  // Below this the person simply is a typical holder of the archetype, and
  // manufacturing a difference would be inventing one.
  if (!top || Math.abs(top.delta) < 12) return { typical: true, deltas };
  return { typical: false, top, deltas };
}

// ---------------------------------------------------------------- fingerprint
// A compact identifier: archetype initials plus each axis to the nearest ten.
// Short enough to remember and share, and precise enough that two people with
// the same archetype almost never collide.
const FINGERPRINT_ORDER = [
  ["temporal_orientation", "T"], ["risk_disposition", "R"],
  ["financial_self_efficacy", "C"], ["impulse_regulation", "I"],
  ["financial_attentiveness", "A"], ["prosocial_orientation", "G"],
];

function fingerprintCode(profile, archetypeSlug) {
  if (!profile) return null;
  const initials = (archetypeSlug || "")
    .split("_").map(w => (w[0] || "").toUpperCase()).join("").slice(0, 2) || "FP";
  const parts = FINGERPRINT_ORDER
    .map(([k, letter]) => `${letter}${Math.round((profile[k] ?? 50) / 10) * 10}`)
    .join("/");
  return `${initials} · ${parts}`;
}

// How rare this configuration is against the archetype set. Not a claim about
// the population, which we do not have: it says how far this person sits from
// every defined archetype, which is a statement about the model, not the world.
function fingerprintDistinctness(profile) {
  if (typeof ARCHETYPE_PROFILES === "undefined" || !profile) return null;
  const distances = Object.keys(ARCHETYPE_PROFILES)
    .map(slug => distanceToArchetype(profile, slug))
    .filter(d => d !== null)
    .sort((a, b) => a - b);
  if (distances.length < 2) return null;
  // A profile sitting almost equally close to two archetypes is genuinely
  // between them, which is more interesting than a clean match.
  const between = (distances[1] - distances[0]) < 12;
  return { nearest: Math.round(distances[0]), between };
}

// ------------------------------------------------------------------ assembly
function buildFingerprint(profile, archetypeSlug, twin) {
  if (!profile) return null;
  const traits = AXIS_KEYS
    .map(k => conditionalTrait(k, Math.round(profile[k] ?? 50), twin))
    .filter(Boolean)
    .sort((a, b) => {
      // Traits with a discovered condition lead: a condition is the part the
      // reader has not heard before, and the part a score cannot express.
      if (!!b.condition !== !!a.condition) return b.condition ? 1 : -1;
      return Math.abs(b.value - 50) - Math.abs(a.value - 50);
    });

  return {
    code: fingerprintCode(profile, archetypeSlug),
    distinctness: fingerprintDistinctness(profile),
    deviation: archetypeDeviation(profile, archetypeSlug),
    traits,
    conditional: traits.filter(t => t.condition),
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    TRAIT_BASE, EVIDENCE_BANDS, evidenceStrength, conditionalTrait,
    archetypeDeviation, fingerprintCode, buildFingerprint, traitBand,
  };
}

// ---------------------------------------------------------- the visual mark
// The fingerprint as an actual object rather than a string of numbers.
//
// Deliberately not a radar chart: radars were cut from this report because
// their axis order is arbitrary, which makes the resulting shape meaningless.
// This encodes the same six values as concentric arcs, where arc LENGTH is
// the score and the ring it sits on is fixed per tendency. Two people with
// the same archetype produce visibly different marks, which is the entire
// point, and the same person always produces the same one.
const FP_RING_ORDER = [
  "temporal_orientation", "risk_disposition", "financial_self_efficacy",
  "impulse_regulation", "financial_attentiveness", "prosocial_orientation",
];

function fingerprintMarkSvg(profile, opts) {
  const o = opts || {};
  const size = o.size || 200;
  const cx = 100, cy = 100;
  const inner = 26;
  const step = 11;
  const gap = 3.2;

  const arcs = FP_RING_ORDER.map((key, i) => {
    const value = Math.max(0, Math.min(100, profile[key] ?? 50));
    const r = inner + i * step;
    // Each ring starts at a fixed offset so the mark has rotational
    // structure rather than every arc beginning at twelve o'clock.
    const start = -90 + i * 34;
    // Floor of 6 degrees keeps a near-zero tendency visible as a tick: an
    // invisible arc would read as missing data rather than as a low score.
    const sweep = Math.max(6, (value / 100) * 320);
    return { key, r, start, sweep, value };
  });

  const arcPath = (r, startDeg, sweepDeg) => {
    const rad = d => (d * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad(startDeg));
    const y1 = cy + r * Math.sin(rad(startDeg));
    const end = startDeg + sweepDeg;
    const x2 = cx + r * Math.cos(rad(end));
    const y2 = cy + r * Math.sin(rad(end));
    const large = sweepDeg > 180 ? 1 : 0;
    return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
  };

  const tracks = arcs.map(a =>
    `<circle cx="${cx}" cy="${cy}" r="${a.r}" fill="none" stroke="currentColor" stroke-opacity="0.13" stroke-width="${step - gap}"/>`
  ).join("");

  const marks = arcs.map((a, i) =>
    `<path d="${arcPath(a.r, a.start, a.sweep)}" fill="none" stroke="currentColor"
       stroke-opacity="${(0.42 + i * 0.09).toFixed(2)}"
       stroke-width="${step - gap}" stroke-linecap="round"/>`
  ).join("");

  return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" role="img"
    aria-label="Your behavioural fingerprint, six tendencies drawn as arc lengths" focusable="false">
    ${tracks}${marks}
    <circle cx="${cx}" cy="${cy}" r="${inner - 9}" fill="currentColor" fill-opacity="0.9"/>
  </svg>`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports.fingerprintMarkSvg = fingerprintMarkSvg;
  module.exports.FP_RING_ORDER = FP_RING_ORDER;
}
