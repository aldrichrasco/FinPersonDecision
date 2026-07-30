// Portraits for the seven investor archetypes — reuses the exact same
// abstract hair/face primitives as archetype-portraits.js (portraitHair,
// portraitFace, PORTRAIT_SKIN/PORTRAIT_LINE), loaded first on any page that
// includes this file. Deliberately abstract/non-representational, same as
// the eleven personal-finance archetypes: this is not an attempt at a
// likeness of a real person, just a colored, illustrated bust distinct
// enough to tell the seven apart — the name label is the real identifier.
const INVESTOR_PORTRAIT_ACCENT = {
  buffett: "#1B6B45",
  dalio: "#4A3D63",
  turtles: "#6B4A1F",
  burry: "#93402C",
  lynch: "#1B6B45",
  soros: "#4A3D63",
  bogle: "#4E5157",
};

const INVESTOR_PORTRAIT_SPEC = {
  buffett: { hair: "side-part", expr: "content" },
  dalio: { hair: "neat", expr: "thoughtful" },
  turtles: { hair: "spiky", expr: "neutral" },
  burry: { hair: "bangs-low", expr: "watchful" },
  lynch: { hair: "swoop", expr: "warm" },
  soros: { hair: "uneven", expr: "smug" },
  bogle: { hair: "bangs-soft", expr: "gentle" },
};

function investorPortraitSvg(slug) {
  const spec = INVESTOR_PORTRAIT_SPEC[slug] || { hair: "neat", expr: "content" };
  const color = INVESTOR_PORTRAIT_ACCENT[slug] || "#1B6B45";
  const hair = portraitHair(spec.hair, color);
  return `<svg viewBox="0 0 100 100" role="img" aria-hidden="true" focusable="false">
    <rect x="10" y="78" width="80" height="30" rx="18" fill="${color}"/>
    ${hair.behind}
    <circle cx="50" cy="58" r="25" fill="${PORTRAIT_SKIN}"/>
    ${hair.front}
    ${portraitFace(spec.expr)}
  </svg>`;
}
