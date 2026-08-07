// Situations — the front door.
//
// "Pick 1 of 11 archetypes and a difficulty" is a control panel. People don't
// arrive knowing their behavioural type; they arrive with a situation. So we
// ask what they're dealing with, and infer the rest.
//
// A situation seeds three things quietly:
//   · a starting financial state that makes the situation real
//   · which coach voice fits best (revisable — never announced as a verdict)
//   · which scenarios are most relevant
//
// The archetype is a working hypothesis the engine refines from behaviour.
// It is deliberately not shown as a label on arrival.
//
// NOTE ON COVERAGE. Situations cover the archetypes a person can plausibly
// recognise in themselves. Two cannot be listed here at all — Overconfident
// Navigator and Status Seeker — because each is *defined* by limited insight
// into itself. Nobody selects "I ignore warnings" or "I spend for status".
// These are reachable only through behavioural inference (see inferArchetype
// in dashboard.js), which is the theoretically correct route: an archetype
// characterised by low self-awareness cannot be arrived at by self-report.

const SITUATIONS = [
  {
    id: "debt",
    label: "I'm worried about debt",
    sub: "It's building up and I'm not sure how to get on top of it",
    coach: "cautious_guardian",
    scenarioBias: "recovery",
    state: { income: 4200, expenses: 3600, savings: 1200, investments: 500, debt: 14000 },
  },
  {
    id: "overspending",
    label: "I keep overspending",
    sub: "I mean well, then something catches my eye",
    coach: "impulsive_spender",
    scenarioBias: "general",
    state: { income: 4500, expenses: 4300, savings: 900, investments: 400, debt: 5200 },
  },
  {
    id: "avoidance",
    label: "I avoid looking at my money",
    sub: "I know roughly, and I'd rather not know exactly",
    coach: "anxious_avoider",
    scenarioBias: "general",
    state: { income: 4300, expenses: 3400, savings: 3800, investments: 600, debt: 4800 },
  },
  {
    id: "saving",
    label: "I want to save for something",
    sub: "A house, a trip, a cushion — something specific",
    coach: "steady_saver",
    scenarioBias: "general",
    state: { income: 4800, expenses: 3400, savings: 6000, investments: 2000, debt: 1500 },
  },
  {
    id: "growing",
    label: "I want to make my money work harder",
    sub: "I've got a base and I'm thinking about what's next",
    coach: "ambitious_builder",
    scenarioBias: "general",
    state: { income: 5600, expenses: 3600, savings: 11000, investments: 9000, debt: 3000 },
  },
  {
    id: "holding_back",
    label: "I save, but I never let myself enjoy it",
    sub: "There's money there. Spending any of it feels wrong",
    coach: "cautious_guardian",
    scenarioBias: "living",
    state: { income: 5000, expenses: 2400, savings: 42000, investments: 38000, debt: 0 },
  },
  {
    id: "stress",
    label: "Money stresses me out",
    sub: "Even when things are fine, it sits there",
    coach: "anxious_avoider",
    scenarioBias: "general",
    state: { income: 4400, expenses: 3500, savings: 4200, investments: 1500, debt: 3500 },
  },
  {
    id: "giving",
    label: "I give away more than I can afford",
    sub: "Helping people matters more to me than my own buffer",
    coach: "purposeful_giver",
    scenarioBias: "recovery",
    state: { income: 4600, expenses: 3900, savings: 1800, investments: 1200, debt: 3400 },
  },
  {
    id: "drifting",
    label: "I just drift along",
    sub: "No plan, no disasters, no direction either",
    coach: "passive_drifter",
    scenarioBias: "general",
    state: { income: 3900, expenses: 3300, savings: 2500, investments: 0, debt: 6000 },
  },
  {
    id: "risk",
    label: "I take big swings with money",
    sub: "I back my judgement and I'm comfortable with risk",
    coach: "strategic_risk_taker",
    scenarioBias: "general",
    state: { income: 5800, expenses: 3600, savings: 4000, investments: 26000, debt: 9000 },
  },
  {
    id: "exploring",
    label: "Just having a look",
    sub: "No particular problem, curious how this works",
    coach: "conscious_spender",
    scenarioBias: "general",
    state: { income: 4700, expenses: 3400, savings: 7000, investments: 4000, debt: 2500 },
  },
];

// A focus for the run, derived from the situation the person already
// picked — so the sandbox opens with "here's what you're working on"
// instead of an open-ended set of numbers with no stated aim.
//
// Deliberately partial. Only situations where ONE number genuinely
// captures the aim get an objective; "I avoid looking at my money",
// "money stresses me out", "I just drift along", "I take big swings" and
// "just having a look" are about awareness rather than a target, and
// inventing a metric for them would be a fake goal. Those simply show no
// objective banner.
//
// Note holding_back: its objective moves savings DOWN. That is not a bug —
// the Financial Homeostasis Model this app is built on is non-monotonic
// (over-saving is a real cost, not a virtue), and this is the one place
// that shows up as an explicit aim.
//
// This is a FOCUS, never a score. dashboard.js reports what the number
// actually did and says nothing about whether the person succeeded —
// same stance as the rest of the app on not grading a single decision.
const SITUATION_OBJECTIVES = {
  debt:          { label: "Escape the debt",              metric: "debt",        direction: "down" },
  overspending:  { label: "Keep more of what you earn",   metric: "savings",     direction: "up" },
  saving:        { label: "Build the buffer",             metric: "savings",     direction: "up" },
  growing:       { label: "Put more of it to work",       metric: "investments", direction: "up" },
  giving:        { label: "Rebuild your own buffer",      metric: "savings",     direction: "up" },
  holding_back:  { label: "Let yourself actually use some", metric: "savings",   direction: "down" },
};

const OBJECTIVE_METRIC_LABEL = {
  debt: "Debt",
  savings: "Savings",
  investments: "Investments",
};

function getSituationObjective(id) {
  return SITUATION_OBJECTIVES[id] || null;
}

const SITUATION_KEY = "finperson_situation";

function getSituation(id) {
  return SITUATIONS.find(s => s.id === id) || null;
}

function saveSituation(id) {
  try { localStorage.setItem(SITUATION_KEY, id); } catch (e) {}
}

function getSavedSituation() {
  const url = new URLSearchParams(window.location.search).get("situation");
  if (url && getSituation(url)) return url;
  try {
    const stored = localStorage.getItem(SITUATION_KEY);
    return stored && getSituation(stored) ? stored : null;
  } catch (e) {
    return null;
  }
}
