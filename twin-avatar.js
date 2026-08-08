// The Financial Twin's face.
//
// The avatar is not decoration and it is not a mascot. It renders the twin's
// actual state, so looking at it tells you something true:
//
//   maturity  drives how resolved the figure is. A twin with no confirmed
//             rules is drawn unfinished, in dashes, because it genuinely does
//             not know you yet. Certainty has to be earned visually too.
//   rules     each confirmed rule lights one node on the ring. The ring is a
//             readout of how much of you the model has actually mapped.
//   contested rules render as broken segments, so a twin under challenge
//             looks under challenge.
//
// Cosmetic options are separated from all of this deliberately. Appearance
// makes no claim about the person, so it is safe to sell. Anything that would
// change what the twin KNOWS is not offered at any price: a model of yourself
// whose accuracy can be bought is worthless as a model.

const TWIN_PALETTES = {
  // The default ships to everyone. The rest are cosmetic only.
  instrument: { core: "#0F766E", ring: "#0F766E", glow: "#E3F0EE", ink: "#0B0F14" },
  graphite:   { core: "#3D4650", ring: "#6B7681", glow: "#E7E9EC", ink: "#0B0F14" },
  ember:      { core: "#B45309", ring: "#C2410C", glow: "#FBF0E4", ink: "#0B0F14" },
  indigo:     { core: "#4338CA", ring: "#6366F1", glow: "#E8E7FB", ink: "#0B0F14" },
  moss:       { core: "#15803D", ring: "#16A34A", glow: "#E3F0E7", ink: "#0B0F14" },
};

const TWIN_COSMETICS_KEY = "finperson_twin_cosmetics";

function getTwinCosmetics() {
  try {
    const raw = localStorage.getItem(TWIN_COSMETICS_KEY);
    const c = raw ? JSON.parse(raw) : {};
    return { palette: c.palette || "instrument", owned: c.owned || ["instrument"] };
  } catch (e) {
    return { palette: "instrument", owned: ["instrument"] };
  }
}

function setTwinPalette(name) {
  if (!TWIN_PALETTES[name]) return;
  const c = getTwinCosmetics();
  if (!c.owned.includes(name)) return;   // ownership is checked, not assumed
  try {
    localStorage.setItem(TWIN_COSMETICS_KEY, JSON.stringify({ ...c, palette: name }));
  } catch (e) {}
}

// Renders the twin. `twin` is buildTwin()'s output; passing null draws the
// unformed state rather than failing, so the avatar is safe to place anywhere.
function twinAvatarSvg(twin, opts) {
  const o = opts || {};
  const size = o.size || 140;
  const cos = getTwinCosmetics();
  const p = TWIN_PALETTES[cos.palette] || TWIN_PALETTES.instrument;

  const level = twin && twin.maturity ? twin.maturity.level : 0;
  const rules = (twin && twin.rules) || [];
  const NODES = 7;

  // Node ring: one slot per rule the twin could hold. Filled slots are
  // confirmed beliefs, hollow rings are contested, faint dots are unmapped.
  const cx = 50, cy = 50, r = 38;
  let nodes = "";
  for (let i = 0; i < NODES; i++) {
    const angle = (i / NODES) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const rule = rules[i];
    if (rule && rule.status === "confirmed") {
      nodes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="${p.core}"/>`;
    } else if (rule && rule.status === "contested") {
      nodes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="none" stroke="${p.ring}" stroke-width="1.4" stroke-dasharray="2 2"/>`;
    } else if (rule) {
      nodes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" fill="${p.ring}" fill-opacity="0.45"/>`;
    } else {
      nodes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.6" fill="${p.ring}" fill-opacity="0.18"/>`;
    }
  }

  // The figure resolves as the twin learns: dashed and open at level 0,
  // solid and closed by level 4. This is the honest part of the drawing.
  const dash = level === 0 ? '4 4' : level === 1 ? '7 3' : level === 2 ? '12 3' : 'none';
  const strokeW = 1.6 + level * 0.22;
  const coreOpacity = 0.10 + level * 0.10;

  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img"
    aria-label="Financial Twin, ${twin && twin.maturity ? twin.maturity.label : "forming"}"
    focusable="false">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${p.ring}"
            stroke-opacity="0.28" stroke-width="1"/>
    ${nodes}
    <circle cx="${cx}" cy="${cy}" r="25" fill="${p.glow}" fill-opacity="${coreOpacity.toFixed(2)}"/>
    <circle cx="${cx}" cy="${cy}" r="25" fill="none" stroke="${p.core}"
            stroke-width="${strokeW.toFixed(2)}"
            ${dash !== 'none' ? `stroke-dasharray="${dash}"` : ""}/>
    <circle cx="${cx - 7}" cy="${cy - 4}" r="2.6" fill="${p.core}"/>
    <circle cx="${cx + 7}" cy="${cy - 4}" r="2.6" fill="${p.core}"/>
    ${twinMouth(level, p, cx, cy)}
  </svg>`;
}

// Expression tracks certainty, not mood. A twin that has not worked you out
// yet should not look confident about you.
function twinMouth(level, p, cx, cy) {
  const w = 2.2;
  if (level <= 1) {
    // Unresolved: a short, uncommitted mark.
    return `<path d="M${cx - 5} ${cy + 8} L${cx + 5} ${cy + 8}" stroke="${p.core}"
             stroke-width="${w}" stroke-linecap="round" stroke-dasharray="3 3"/>`;
  }
  if (level === 2) {
    return `<path d="M${cx - 6} ${cy + 8} L${cx + 6} ${cy + 8}" stroke="${p.core}"
             stroke-width="${w}" stroke-linecap="round"/>`;
  }
  // Settled: a slight, knowing curve. Never a broad smile; this is an
  // instrument reporting on you, not a character pleased with itself.
  return `<path d="M${cx - 7} ${cy + 7} Q${cx} ${cy + 11} ${cx + 7} ${cy + 7}"
           fill="none" stroke="${p.core}" stroke-width="${w}" stroke-linecap="round"/>`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TWIN_PALETTES, twinAvatarSvg, getTwinCosmetics, setTwinPalette };
}
