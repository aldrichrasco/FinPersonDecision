// Investor Archetype Model — FinPerson Pro.
//
// Deliberately separate from fbm.js's six-axis personal-finance model. This
// is a different question ("what's your investing style?" vs. "how do you
// relate to money day to day?") for a different audience, so it gets its
// own axes and its own seven archetypes: real, well-documented investors,
// not synthetic personas. Each target profile below is an illustrative
// simplification of a real public investing philosophy, sourced from that
// investor's own writing where possible — not a claim about how they'd
// actually score on a validated instrument, same caveat classroom.html's
// GAME_INTROS give the simulated archetype opponents there.
//
// EASILY EDITABLE: same shape as fbm.js — rename an axis or its poles in
// INVESTOR_AXES; adjust a target profile in INVESTOR_PROFILES.

const INVESTOR_AXES = {
  time_horizon:     { label: "Time Horizon",     short: "Horizon",   sub: "How long a position is meant to be held",        low: "Tactical",      high: "Buy-and-hold" },
  decision_process: { label: "Decision Process",  short: "Process",   sub: "Judgment call, or a rule applied the same way",  low: "Discretionary", high: "Systematic" },
  conviction:       { label: "Conviction",        short: "Conviction",sub: "How much rides on any one position",             low: "Diversified",   high: "Concentrated" },
  market_stance:    { label: "Market Stance",     short: "Stance",    sub: "Ride the crowd, or bet against it",              low: "Trend-following", high: "Contrarian" },
  analysis_lens:    { label: "Analysis Lens",     short: "Lens",      sub: "What the research actually looks at",            low: "Bottom-up",     high: "Top-down" },
  risk_posture:     { label: "Risk Posture",      short: "Risk",      sub: "What a position is sized to protect vs. chase",  low: "Preservation",  high: "Aggressive" },
};

const INVESTOR_AXIS_KEYS = Object.keys(INVESTOR_AXES);

const INVESTOR_PROFILES = {
  buffett: {
    time_horizon: 90, decision_process: 15, conviction: 80, market_stance: 70, analysis_lens: 15, risk_posture: 40,
    name: "Warren Buffett", era: "Berkshire Hathaway, 1965–present",
    blurb: "Reads businesses, not price charts — buys wonderful companies at fair prices and holds them for decades, staying inside a self-defined 'circle of competence' rather than chasing what he doesn't understand.",
    citation: "Berkshire Hathaway shareholder letters, particularly on the 'circle of competence' and 'Rule No. 1: never lose money.'",
  },
  dalio: {
    time_horizon: 85, decision_process: 85, conviction: 15, market_stance: 50, analysis_lens: 90, risk_posture: 30,
    name: "Ray Dalio", era: "Bridgewater Associates, founded 1975",
    blurb: "Turns macro judgment into written, repeatable rules — the 'All Weather' portfolio spreads risk across asset classes engineered to survive any economic season, not just the one currently in fashion.",
    citation: "Dalio, \"Principles\" (2017), and Bridgewater's published research on the All Weather asset-allocation approach.",
  },
  turtles: {
    time_horizon: 20, decision_process: 95, conviction: 20, market_stance: 10, analysis_lens: 85, risk_posture: 65,
    name: "The Turtles", era: "Richard Dennis & William Eckhardt's trading experiment, 1983–1988",
    blurb: "Proved discipline can be taught: complete novices, given a fixed set of breakout rules and told to follow them without exception, traded futures markets profitably for years — the whole point was removing gut instinct from the loop.",
    citation: "Curtis Faith, \"Way of the Turtle\" (2007) — a former Turtle's account of the rules and results.",
  },
  burry: {
    time_horizon: 70, decision_process: 10, conviction: 90, market_stance: 95, analysis_lens: 20, risk_posture: 80,
    name: "Michael Burry", era: "Scion Capital, founded 2000",
    blurb: "Digs into original source documents most investors skip, builds a small number of huge positions on what he finds, and holds them through years of being visibly, publicly wrong before being proven right.",
    citation: "Scion Capital investor letters (his own primary account, distinct from the popularized retelling in Michael Lewis's \"The Big Short\").",
  },
  lynch: {
    time_horizon: 65, decision_process: 25, conviction: 30, market_stance: 50, analysis_lens: 15, risk_posture: 50,
    name: "Peter Lynch", era: "Fidelity Magellan Fund, 1977–1990",
    blurb: "Ran one of the widest portfolios of any famous investor — hundreds of holdings at once — on the premise that ordinary observation ('invest in what you know') surfaces good businesses before Wall Street notices them.",
    citation: "Lynch, \"One Up On Wall Street\" (1989).",
  },
  soros: {
    time_horizon: 15, decision_process: 10, conviction: 90, market_stance: 85, analysis_lens: 95, risk_posture: 90,
    name: "George Soros", era: "Quantum Fund, founded 1973",
    blurb: "Bets that markets misprice reality when enough people believe the same story at once — sizes a handful of macro positions large enough to matter, then moves fast once the story stops matching the world.",
    citation: "Soros, \"The Alchemy of Finance\" (1987), on reflexivity theory.",
  },
  bogle: {
    time_horizon: 95, decision_process: 90, conviction: 5, market_stance: 30, analysis_lens: 60, risk_posture: 25,
    name: "John Bogle", era: "Founded Vanguard, 1975",
    blurb: "Argued that almost nobody can reliably beat the market after costs, so the rational move is to buy all of it as cheaply as possible and hold it forever — a deliberately unglamorous, zero-discretion answer to every other archetype here.",
    citation: "Bogle's writing on indexing and Vanguard's founding thesis, e.g. \"Common Sense on Mutual Funds\" (1999).",
  },
};

const INVESTOR_SLUGS = Object.keys(INVESTOR_PROFILES);

function clampInvestor01to100(n) {
  return Math.max(0, Math.min(100, n));
}

function neutralInvestorProfile() {
  const p = {};
  INVESTOR_AXIS_KEYS.forEach(k => (p[k] = 50));
  return p;
}

function distanceToInvestor(profile, slug) {
  const target = INVESTOR_PROFILES[slug];
  if (!target) return null;
  let sum = 0;
  for (const k of INVESTOR_AXIS_KEYS) {
    const d = (profile[k] ?? 50) - target[k];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function matchInvestorArchetype(profile) {
  let best = null;
  let bestDist = Infinity;
  for (const slug of INVESTOR_SLUGS) {
    const dist = distanceToInvestor(profile, slug);
    if (dist < bestDist) {
      bestDist = dist;
      best = slug;
    }
  }
  return best;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    INVESTOR_AXES, INVESTOR_AXIS_KEYS, INVESTOR_PROFILES, INVESTOR_SLUGS,
    clampInvestor01to100, neutralInvestorProfile, distanceToInvestor, matchInvestorArchetype,
  };
}
