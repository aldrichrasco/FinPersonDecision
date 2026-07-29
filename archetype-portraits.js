// Small illustrated bust portraits for the archetype cards, replacing the
// single Unicode glyph that used to sit in the colored badge circle. One
// consistent skin tone across all eleven (real diversity isn't something
// auto-generated art should attempt), hair/outfit carrying the archetype's
// group color, and enough hairstyle + expression variation that archetypes
// sharing a group color (e.g. the four "growth" archetypes) still read as
// distinct people, not the same face repeated.
const PORTRAIT_SKIN = "#E8C4A0";
const PORTRAIT_LINE = "#3A2415";

const PORTRAIT_ACCENT = {
  conservative: "#1B6B45",
  growth: "#6B4A1F",
  impulsive: "#93402C",
  uncertain: "#4A3D63",
  generous: "#4E5157",
};

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

function archetypePortraitSvg(slug, group) {
  const spec = ARCHETYPE_PORTRAIT_SPEC[slug] || { hair: "neat", expr: "content" };
  const color = PORTRAIT_ACCENT[group] || PORTRAIT_ACCENT.conservative;
  const hair = portraitHair(spec.hair, color);
  return `<svg viewBox="0 0 100 100" role="img" aria-hidden="true" focusable="false">
    <rect x="10" y="78" width="80" height="30" rx="18" fill="${color}"/>
    ${hair.behind}
    <circle cx="50" cy="58" r="25" fill="${PORTRAIT_SKIN}"/>
    ${hair.front}
    ${portraitFace(spec.expr)}
  </svg>`;
}
