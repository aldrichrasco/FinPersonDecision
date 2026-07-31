// Small illustrated bust portraits for the archetype cards, replacing the
// single Unicode glyph that used to sit in the colored badge circle. One
// consistent skin tone across all eleven (real diversity isn't something
// auto-generated art should attempt), hair/outfit carrying the archetype's
// group color, and enough hairstyle + expression variation that archetypes
// sharing a group color (e.g. the four "growth" archetypes) still read as
// distinct people, not the same face repeated.
//
// Built to the "Archetype Portrait Style Lock" spec: flat silhouette, one
// darker cel-shading tone per figure (no gradients), and one small held
// object/gesture per archetype drawn straight from that persona's trait
// line in data.js, so the eleven read as a matched set rather than
// interchangeable colored blobs.
const PORTRAIT_SKIN = "#E8C4A0";
const PORTRAIT_LINE = "#3A2415";
const PORTRAIT_OBJECT = "#F3E7D3"; // one consistent light fill for every held object, so it reads against any accent

const PORTRAIT_ACCENT = {
  conservative: "#1B6B45",
  growth: "#6B4A1F",
  impulsive: "#93402C",
  uncertain: "#4A3D63",
  generous: "#4E5157",
};

// Darkens a hex color by a flat multiplier — the one extra tone each
// silhouette gets for cel-shading, per the style lock's "no gradients"
// rule (a single darker value of the same hue, not a blend).
function portraitShade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (c) => Math.max(0, Math.min(255, Math.round(c)));
  const r = clamp(((n >> 16) & 255) * factor);
  const g = clamp(((n >> 8) & 255) * factor);
  const b = clamp((n & 255) * factor);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function portraitFace(expr) {
  const parts = {
    content: `<path d="M40 50 L46 50" stroke="${PORTRAIT_LINE}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M54 50 L60 50" stroke="${PORTRAIT_LINE}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M41 63 Q50 69 59 63" stroke="${PORTRAIT_LINE}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,
    watchful: `<path d="M39 48 Q43 45 47 48" stroke="${PORTRAIT_LINE}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <path d="M53 48 Q57 45 61 48" stroke="${PORTRAIT_LINE}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <path d="M42 63 Q50 67 58 63" stroke="${PORTRAIT_LINE}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,
    thoughtful: `<path d="M39 48 L46 50" stroke="${PORTRAIT_LINE}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M54 50 Q58 46 62 47" stroke="${PORTRAIT_LINE}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <path d="M43 64 Q50 66 56 62" stroke="${PORTRAIT_LINE}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,
    confident: `<path d="M38 46 Q43 42 48 46" stroke="${PORTRAIT_LINE}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M52 46 Q57 42 62 46" stroke="${PORTRAIT_LINE}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M39 62 Q50 71 61 62" stroke="${PORTRAIT_LINE}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`,
    smirk: `<path d="M39 47 Q44 44 49 47" stroke="${PORTRAIT_LINE}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <path d="M53 49 L60 47" stroke="${PORTRAIT_LINE}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M41 64 Q50 65 58 60" stroke="${PORTRAIT_LINE}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,
    smug: `<path d="M38 46 Q43 41 49 45" stroke="${PORTRAIT_LINE}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M51 45 Q57 41 62 46" stroke="${PORTRAIT_LINE}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M40 61 Q50 68 62 59" stroke="${PORTRAIT_LINE}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`,
    flashy: `<path d="M38 45 Q43 41 48 45" stroke="${PORTRAIT_LINE}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M52 45 Q57 41 62 45" stroke="${PORTRAIT_LINE}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M38 61 Q50 72 62 61" stroke="${PORTRAIT_LINE}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`,
    excited: `<path d="M37 45 Q43 40 49 45" stroke="${PORTRAIT_LINE}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M51 45 Q57 40 63 45" stroke="${PORTRAIT_LINE}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <ellipse cx="50" cy="65" rx="10" ry="7" fill="${PORTRAIT_LINE}"/>`,
    gentle: `<path d="M40 49 Q43 47 47 49" stroke="${PORTRAIT_LINE}" stroke-width="2.1" stroke-linecap="round" fill="none"/>
      <path d="M53 49 Q57 47 60 49" stroke="${PORTRAIT_LINE}" stroke-width="2.1" stroke-linecap="round" fill="none"/>
      <path d="M43 64 L57 64" stroke="${PORTRAIT_LINE}" stroke-width="2.2" stroke-linecap="round"/>`,
    neutral: `<path d="M40 49 L46 50" stroke="${PORTRAIT_LINE}" stroke-width="2.1" stroke-linecap="round"/>
      <path d="M54 50 L60 48" stroke="${PORTRAIT_LINE}" stroke-width="2.1" stroke-linecap="round"/>
      <path d="M43 63 L57 63" stroke="${PORTRAIT_LINE}" stroke-width="2.2" stroke-linecap="round"/>`,
    warm: `<path d="M39 48 Q43 45 48 48" stroke="${PORTRAIT_LINE}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <path d="M52 48 Q57 45 61 48" stroke="${PORTRAIT_LINE}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <path d="M40 61 Q50 70 60 61" stroke="${PORTRAIT_LINE}" stroke-width="2.5" stroke-linecap="round" fill="none"/>`,
  };
  return `<circle cx="41" cy="56" r="2.6" fill="${PORTRAIT_LINE}"/><circle cx="59" cy="56" r="2.6" fill="${PORTRAIT_LINE}"/>${parts[expr] || parts.content}`;
}

// hair, as a filled shape sitting behind the head circle (drawn first, then
// the head circle is drawn on top so only a rim of hair shows) plus an
// optional small extra flourish drawn after the head for shape/volume.
function portraitHair(style, color) {
  const variants = {
    neat: { behind: `<circle cx="50" cy="46" r="29" fill="${color}"/>`, front: "" },
    swoop: {
      behind: `<circle cx="50" cy="46" r="29" fill="${color}"/>`,
      front: `<path d="M40 30 Q50 18 62 27 Q56 26 50 31 Q44 27 40 30 Z" fill="${color}"/>`,
    },
    spiky: {
      behind: `<circle cx="50" cy="47" r="28" fill="${color}"/>`,
      front: `<path d="M32 34 L28 22 L38 30 Z" fill="${color}"/><path d="M50 26 L47 12 L57 24 Z" fill="${color}"/><path d="M68 34 L74 22 L64 30 Z" fill="${color}"/>`,
    },
    "side-part": {
      behind: `<circle cx="49" cy="46" r="29" fill="${color}"/>`,
      front: `<path d="M42 22 L46 34" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`,
    },
    "bangs-low": {
      behind: `<circle cx="50" cy="50" r="30" fill="${color}"/>`,
      front: "",
    },
    big: {
      behind: `<circle cx="50" cy="44" r="33" fill="${color}"/>`,
      front: `<path d="M20 44 Q17 30 30 24" stroke="${color}" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M80 44 Q83 30 70 24" stroke="${color}" stroke-width="7" stroke-linecap="round" fill="none"/>`,
    },
    uneven: {
      behind: `<circle cx="47" cy="45" r="30" fill="${color}"/>`,
      front: `<path d="M70 32 Q78 38 74 50" stroke="${color}" stroke-width="6" stroke-linecap="round" fill="none"/>`,
    },
    "bangs-soft": {
      behind: `<circle cx="50" cy="48" r="30" fill="${color}"/>`,
      front: `<path d="M34 40 Q50 32 66 40" stroke="${color}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
    },
  };
  return variants[style] || variants.neat;
}

// One small held object or gesture per archetype, drawn straight from that
// persona's trait line in data.js (PERSONAS) so each reads as that specific
// behaviour rather than an arbitrary decoration. Sits below the chin (head
// circle bottom edge is always y=83) so it never collides with the face.
function portraitSymbol(slug) {
  const F = PORTRAIT_OBJECT, L = PORTRAIT_LINE;
  const symbols = {
    // "Consistent, low-risk saving" — a small stack of coins.
    steady_saver: `
      <ellipse cx="50" cy="96" rx="9" ry="3" fill="${F}" stroke="${L}" stroke-width="1.4"/>
      <ellipse cx="50" cy="92" rx="9" ry="3" fill="${F}" stroke="${L}" stroke-width="1.4"/>
      <ellipse cx="50" cy="88" rx="9" ry="3" fill="${F}" stroke="${L}" stroke-width="1.4"/>`,
    // "Protects against every downside" — a held shield.
    cautious_guardian: `
      <path d="M50 84 L59 87 L59 94 Q50 99 41 94 L41 87 Z" fill="${F}" stroke="${L}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M50 87 L50 96" stroke="${L}" stroke-width="1.2"/>`,
    // "Spends deliberately, on values" — a price tag, considered not grabbed.
    conscious_spender: `
      <path d="M42 85 L54 85 L60 90.5 L54 96 L42 96 Z" fill="${F}" stroke="${L}" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="47" cy="88.5" r="1.6" fill="${L}"/>`,
    // "Invests for long-term growth" — ascending bars.
    ambitious_builder: `
      <rect x="39" y="92" width="5" height="6" fill="${F}" stroke="${L}" stroke-width="1.3"/>
      <rect x="47" y="88" width="5" height="10" fill="${F}" stroke="${L}" stroke-width="1.3"/>
      <rect x="55" y="84" width="5" height="14" fill="${F}" stroke="${L}" stroke-width="1.3"/>`,
    // "Calculated bets, not gambles" — a pair of dice, held rather than tossed.
    strategic_risk_taker: `
      <rect x="38" y="85" width="11" height="11" rx="2.4" fill="${F}" stroke="${L}" stroke-width="1.5"/>
      <circle cx="41.5" cy="88.5" r="1" fill="${L}"/><circle cx="46" cy="93" r="1" fill="${L}"/><circle cx="41.5" cy="93" r="1" fill="${L}"/>
      <rect x="51" y="89" width="10" height="10" rx="2.2" fill="${F}" stroke="${L}" stroke-width="1.5"/>
      <circle cx="56" cy="94" r="1" fill="${L}"/>`,
    // "Trusts gut over the numbers" — a compass, read by feel not by the needle.
    overconfident_navigator: `
      <circle cx="50" cy="92" r="8" fill="${F}" stroke="${L}" stroke-width="1.6"/>
      <path d="M50 86 L52.5 92 L50 98 L47.5 92 Z" fill="${L}"/>`,
    // "Spends to signal success" — a bow-tied gift.
    status_seeker: `
      <path d="M41 87 L59 87 L57 99 L43 99 Z" fill="${F}" stroke="${L}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M45 87 Q50 80 55 87" fill="none" stroke="${L}" stroke-width="1.6"/>
      <circle cx="50" cy="86" r="2.1" fill="${L}"/>`,
    // "Buys first, thinks after" — a bag mid-swing, with a little urgency.
    impulsive_spender: `
      <path d="M43 88 L57 88 L59 100 L41 100 Z" fill="${F}" stroke="${L}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M46 88 Q50 82 54 88" fill="none" stroke="${L}" stroke-width="1.5"/>
      <path d="M34 84 L37 87 M66 84 L63 87 M50 78 L50 82" stroke="${L}" stroke-width="1.4" stroke-linecap="round"/>`,
    // "Avoids looking at the numbers" — an envelope, still sealed.
    anxious_avoider: `
      <rect x="40" y="86" width="20" height="13" rx="1.5" fill="${F}" stroke="${L}" stroke-width="1.5"/>
      <path d="M40 87 L50 95 L60 87" fill="none" stroke="${L}" stroke-width="1.4"/>`,
    // "No plan, goes with the flow" — a leaf drifting rather than steered.
    passive_drifter: `
      <path d="M40 96 Q46 82 60 88 Q54 100 40 96 Z" fill="${F}" stroke="${L}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M42 95 Q50 90 58 89" fill="none" stroke="${L}" stroke-width="1.1"/>`,
    // "Gives first, budgets around it" — a heart, offered outward.
    purposeful_giver: `
      <path d="M50 99 C40 92 40 85 46 83 C49 82 50 84 50 85 C50 84 51 82 54 83 C60 85 60 92 50 99 Z" fill="${F}" stroke="${L}" stroke-width="1.5" stroke-linejoin="round"/>`,
  };
  return symbols[slug] || "";
}

const ARCHETYPE_PORTRAIT_SPEC = {
  steady_saver: { hair: "neat", expr: "content" },
  cautious_guardian: { hair: "side-part", expr: "watchful" },
  conscious_spender: { hair: "swoop", expr: "thoughtful" },
  ambitious_builder: { hair: "swoop", expr: "confident" },
  strategic_risk_taker: { hair: "spiky", expr: "smirk" },
  overconfident_navigator: { hair: "side-part", expr: "smug" },
  status_seeker: { hair: "big", expr: "flashy" },
  impulsive_spender: { hair: "spiky", expr: "excited" },
  anxious_avoider: { hair: "bangs-low", expr: "gentle" },
  passive_drifter: { hair: "uneven", expr: "neutral" },
  purposeful_giver: { hair: "bangs-soft", expr: "warm" },
};

// Unique per call (not per archetype) so two portraits of the same
// archetype on one page — e.g. two persona chips — don't collide on
// <clipPath> ids and silently clip each other's shading.
let portraitInstanceCounter = 0;

function archetypePortraitSvg(slug, group) {
  const spec = ARCHETYPE_PORTRAIT_SPEC[slug] || { hair: "neat", expr: "content" };
  const color = PORTRAIT_ACCENT[group] || PORTRAIT_ACCENT.conservative;
  const shadow = portraitShade(color, 0.68);
  const hair = portraitHair(spec.hair, color);
  const uid = `portrait${portraitInstanceCounter++}`;
  const bodyPath = "M10 100 Q10 79 27 73 Q50 65 73 73 Q90 79 90 100 Z";
  return `<svg viewBox="0 0 100 100" role="img" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id="${uid}-body"><path d="${bodyPath}"/></clipPath>
      <clipPath id="${uid}-hair"><circle cx="50" cy="47" r="31"/></clipPath>
    </defs>
    <path d="${bodyPath}" fill="${color}"/>
    <path d="M52 68 Q73 73 90 79 L90 100 L58 100 Z" fill="${shadow}" clip-path="url(#${uid}-body)"/>
    ${hair.behind}
    <path d="M62 18 L98 18 L98 82 L62 82 Z" fill="${shadow}" clip-path="url(#${uid}-hair)"/>
    <circle cx="50" cy="58" r="25" fill="${PORTRAIT_SKIN}"/>
    ${hair.front}
    ${portraitFace(spec.expr)}
    <g transform="translate(0,-2)">${portraitSymbol(slug)}</g>
  </svg>`;
}
