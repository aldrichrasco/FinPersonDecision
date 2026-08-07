// Static roadmap definition: 5 tiers, ~4-5 levels each, every level a
// real exercise already built elsewhere in the app (no new content
// authored just to fill a level). Tiers unlock in sequence; levels
// within an unlocked tier are all open at once (no forced order) — see
// roadmap.js for the gating logic itself.
//
// "Completing" a level means doing its exercise once (see roadmap.js's
// markRoadmapLevelComplete) — no score threshold, matching the rest of
// the app's stance of not judging a single decision as right or wrong.
const ROADMAP_TIERS = [
  {
    id: "foundations",
    name: "Foundations",
    blurb: "Find out where you stand and get comfortable with the tools.",
    levels: [
      { id: "quiz", name: "Find your archetype", blurb: "Take the 30-second quiz.", href: "index.html", xp: 10 },
      { id: "learn-topic", name: "Read a Learn lesson", blurb: "Any topic — pick what looks most relevant.", href: "learn.html", xp: 10 },
      // Kept in this (always-unlocked) first tier on purpose: classroom.html
      // is reachable ONLY from here now that the nav is trimmed, so a level
      // in a locked tier would make it unreachable for every new user. It
      // earns the spot anyway — the game feeds risk_disposition and
      // prosocial_orientation via nudgeAxis(), which is literally this
      // tier's "find out where you stand".
      { id: "trust-game", name: "Play the Trust Game", blurb: "The classic behavioural-economics game on trust and reciprocity.", href: "classroom.html", xp: 10 },
      { id: "ask", name: "Ask a question", blurb: "Search the research library — real passages, sources named, free.", href: "ask.html", xp: 10 },
      { id: "growth", name: "Try Compound Growth", blurb: "See how sensitive a projection is to the rate you assume.", href: "calculators.html#calc=growth", xp: 10 },
      { id: "rule72", name: "Try Rule of 72", blurb: "A mental-math shortcut, checked against the real answer.", href: "calculators.html#calc=rule72", xp: 10 },
    ],
  },
  {
    id: "debt-emergency",
    name: "Debt & Emergency Fund",
    blurb: "The unglamorous first steps that everything else depends on.",
    levels: [
      { id: "emergency", name: "Emergency Fund", blurb: "Check your real coverage in months, not just dollars.", href: "calculators.html#calc=emergency", xp: 10 },
      { id: "minpayment", name: "Minimum Payment Trap", blurb: "See how long minimums-only actually takes.", href: "calculators.html#calc=minpayment", xp: 10 },
      { id: "debt", name: "Debt Payoff", blurb: "Avalanche vs. snowball on your own numbers.", href: "calculators.html#calc=debt", xp: 10 },
      { id: "payday", name: "Payday Loan Rollover", blurb: "Watch fees pile up while the principal never moves.", href: "calculators.html#calc=payday", xp: 10 },
      { id: "good-habits", name: "Read a good habit", blurb: "Ten habits, each linked to a tool here.", href: "habits.html", xp: 10 },
    ],
  },
  {
    id: "investing-basics",
    name: "Investing Basics",
    blurb: "What compounding actually buys you, and what quietly costs you.",
    levels: [
      { id: "fees", name: "Fee Drag", blurb: "What a 1% expense ratio really costs over decades.", href: "calculators.html#calc=fees", xp: 10 },
      { id: "goal", name: "Savings Goal", blurb: "Solve for time, or solve for the contribution you'd need.", href: "calculators.html#calc=goal", xp: 10 },
      { id: "latte", name: "Latte Factor", blurb: "One small habit, invested instead, over 20 years.", href: "calculators.html#calc=latte", xp: 10 },
      { id: "retirement-systems", name: "Retirement Systems", blurb: "How 401(k), Superannuation, and others actually compare.", href: "retirement.html", xp: 10 },
    ],
  },
  {
    id: "behavioral-traps",
    name: "Behavioral Traps",
    blurb: "The moments that test whether the numbers actually change what you do.",
    levels: [
      { id: "crypto-impulse", name: "Crypto Impulse Check", blurb: "A real historical price move, decide before you know the outcome.", href: "crypto-impulse.html", xp: 10 },
      { id: "deferred", name: "Deferred-Interest Trap", blurb: "The retroactive-interest gotcha, on real numbers.", href: "calculators.html#calc=deferred", xp: 10 },
      { id: "bnpl", name: "BNPL Stacking", blurb: "What several small \"pay in 4\" plans add up to.", href: "calculators.html#calc=bnpl", xp: 10 },
      { id: "autotitle", name: "Auto Title Loan", blurb: "The same rollover trap, secured by your car.", href: "calculators.html#calc=autotitle", xp: 10 },
    ],
  },
  {
    id: "putting-it-together",
    name: "Putting It Together",
    blurb: "Where the tools meet an actual conversation and a real decision.",
    levels: [
      { id: "decision-scenario", name: "Practice a decision", blurb: "One scenario in the sandbox — no real money, no real consequences.", href: "dashboard.html", xp: 10 },
      { id: "coach-chat", name: "Talk to the coach", blurb: "Ask it something real — it can look up your own saved profile.", href: "chat.html", xp: 10 },
      { id: "full-crypto-session", name: "Complete a full chained run", blurb: "Walk every real event for a coin, see the equity curve at the end.", href: "crypto-impulse.html", xp: 20 },
      { id: "progress-review", name: "Review your progress", blurb: "See how your saved profile and history are tracking.", href: "progress.html", xp: 10 },
      // Deliberately the last level: the theory reads far better once
      // someone has actually felt the exercises it explains. Also gives
      // model.html a definite home now that the nav is only four items —
      // it was reachable from the homepage but wasn't on the path.
      { id: "theory", name: "Read the theory", blurb: "The Homeostasis Model and the six axes the whole app runs on.", href: "model.html", xp: 10 },
    ],
  },
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ROADMAP_TIERS };
}
