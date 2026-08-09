// Decision sandbox. Persona baselines come from PERSONA_FINANCE (data.js).
// All deltas below are illustrative monthly-equivalent nudges, not a real
// budgeting model — swap in real transaction data when this connects to
// an account.

// Each choice carries a "flavor" — which temperament it represents —
// so the sandbox can react in the current persona's voice afterward
// (see reactionFor()) instead of just updating numbers silently.

// A few names recur across otherwise-unrelated scenarios (Priya, Jordan,
// Devon below) so the sandbox reads as a handful of people you actually
// know, not a new anonymous stranger on every card. Deliberately light —
// three names, touching five scenarios — since scenarios are drawn in
// random order and can't safely reference a specific prior event.
const SCENARIOS = [
  {
    text: "Your car needs a $1,200 repair to pass inspection.",
    timed: true,
    principle: "catch_up_later",
    surface: "obligation",
    context: "About 1 in 3 U.S. drivers say an unexpected repair bill would force them into debt — AAA survey.",
    choices: [
      { label: "Pay from savings", delta: { savings: -1200 }, flavor: "conservative", outcome: "The shop hands you the keys and a fresh inspection sticker — the buffer's thinner, but the car's fine." },
      { label: "Put it on a 0% intro card", delta: { debt: 1200 }, flavor: "impulsive", outcome: "The repair's done today; the bill just moves onto a card with a clock already running on it." },
      { label: "Delay it and hope for the best", delta: { expenses: 300 }, flavor: "uncertain", outcome: "You drive off without the sticker. The noise under the hood doesn't go away on its own." },
    ],
  },
  {
    text: "Your employer matches 401(k) contributions up to 6%.",
    principle: "catch_up_later",
    surface: "opportunity",
    choices: [
      { label: "Contribute the full 6%", delta: { investments: 1800, expenses: 300 }, flavor: "growth", outcome: "The match lands in full — money from your employer you'd otherwise have left on the table." },
      { label: "Contribute 3%, keep more cash flow", delta: { investments: 900, expenses: 150 }, flavor: "conservative", outcome: "Half the match comes through, and you keep more breathing room in the meantime." },
      { label: "Skip it for now", delta: {}, flavor: "uncertain", outcome: "The match goes unclaimed this month. It'll still be there next time you look." },
    ],
  },
  {
    text: "Priya invites you on a $2,000 trip next month.",
    principle: "credit_is_free",
    surface: "credit_card",
    choices: [
      { label: "Go, pay from savings", delta: { savings: -2000 }, flavor: "impulsive", outcome: "Priya's thrilled you're coming. The savings dip is real, but so is the trip." },
      { label: "Go, put it on a card", delta: { debt: 2000 }, flavor: "impulsive", outcome: "You're going — the cost just moves from your account to your statement, plus interest if it sits." },
      { label: "Decline, start a trip fund instead", delta: { savings: 200 }, flavor: "conservative", outcome: "Priya's a little disappointed, but the next invite won't catch you flat-footed." },
    ],
  },
  {
    text: "You get an unexpected $3,000 tax refund.",
    principle: "more_saved_is_better",
    surface: "windfall",
    choices: [
      { label: "Pay down debt", delta: { debt: -3000 }, flavor: "conservative", outcome: "The refund goes straight at the balance — less interest accruing from here." },
      { label: "Add to emergency savings", delta: { savings: 3000 }, flavor: "conservative", outcome: "The refund becomes cushion instead of income you'd have spent without noticing." },
      { label: "Invest it", delta: { investments: 3000 }, flavor: "growth", outcome: "The refund goes to work over a longer horizon instead of sitting in cash." },
      { label: "Donate part, save the rest", delta: { savings: 1500 }, flavor: "generous", outcome: "Half goes somewhere that matters to you, half stays as cushion." },
    ],
  },
  {
    text: "Rent is going up $150 a month at renewal.",
    principle: "waiting_is_safe",
    surface: "shortfall",
    context: "About 37% of U.S. adults couldn't cover a sudden $400 expense with cash alone — Federal Reserve, 2024.",
    choices: [
      { label: "Absorb it, cut elsewhere", delta: { expenses: 150, savings: -100 }, flavor: "conservative", outcome: "You find $100 elsewhere in the budget; the rest just comes out of savings this month." },
      { label: "Move to somewhere cheaper", delta: { expenses: -50, savings: -800 }, flavor: "growth", outcome: "The move costs upfront, but the new rent leaves more room going forward." },
      { label: "Take on freelance work to cover it", delta: { income: 200 }, flavor: "growth", outcome: "Extra hours cover the increase — at the cost of the hours themselves." },
    ],
  },
  {
    text: "You're offered a 0% APR balance transfer on existing card debt.",
    principle: "credit_is_free",
    surface: "credit_card",
    choices: [
      { label: "Transfer and commit to a payoff plan", delta: { debt: -500 }, flavor: "conservative", outcome: "The transfer buys you interest-free time — worth it only if the payoff plan actually happens." },
      { label: "Leave it as-is", delta: {}, flavor: "uncertain", outcome: "Nothing changes. The interest keeps doing what interest does." },
      { label: "Transfer, but keep spending on the old card too", delta: { debt: 800 }, flavor: "impulsive", outcome: "The old balance moves, and a new one starts growing right behind it." },
    ],
  },
  {
    text: "Priya swears the token everyone's buying is different from past crypto crashes — 'this one has real backing.'",
    principle: "this_time_different",
    surface: "opportunity",
    choices: [
      { label: "Put $800 in before it takes off", delta: { savings: -800, investments: 800 }, flavor: "impulsive", outcome: "Priya's excited. Whether the token is too is still a question nobody's actually answered." },
      { label: "Ask what specifically makes it different, in writing", delta: {}, flavor: "conservative", outcome: "Priya doesn't have a clean answer ready. That tells you something on its own." },
      { label: "Skip it — the pitch sounds familiar", delta: { savings: 100 }, flavor: "conservative", outcome: "Priya moves on to the next thing. Your $800 stays exactly where it was." },
    ],
  },
  {
    text: "Home prices in your area have tripled in five years. Everyone says this market doesn't correct like others do.",
    principle: "this_time_different",
    surface: "opportunity",
    choices: [
      { label: "Buy now before it goes higher", delta: { debt: 2000, savings: -8000 }, flavor: "impulsive", outcome: "You're in — a bigger mortgage, a bigger bet that the run continues." },
      { label: "Keep renting and saving toward a bigger down payment", delta: { savings: 400 }, flavor: "conservative", outcome: "You watch the market from the sidelines, buffer growing a little each month." },
      { label: "Wait for a dip that may never come", delta: {}, flavor: "uncertain", outcome: "You wait. The market doesn't check in with you either way." },
    ],
  },
  {
    text: "Devon's side hustle promises 20% monthly returns, and says the usual warning signs don't apply since it's run by someone you know.",
    principle: "this_time_different",
    surface: "opportunity",
    choices: [
      { label: "Put in a small amount to test it", delta: { savings: -500 }, flavor: "impulsive", outcome: "Devon's glad you're in. Small is relative when the math was never explained." },
      { label: "Ask to see verified payouts going back three months", delta: {}, flavor: "conservative", outcome: "Devon gets vague fast. The absence of an answer is an answer." },
      { label: "Decline — the math doesn't work at any scale", delta: {}, flavor: "conservative", outcome: "Devon shrugs it off. Your money stays put, no test required." },
    ],
  },
  {
    text: "Jordan asks to borrow $500 for rent — the third time this year.",
    principle: "others_first",
    surface: "obligation",
    choices: [
      { label: "Lend it again, no questions", delta: { savings: -500 }, flavor: "generous", outcome: "Jordan's relieved. This makes three times this year, and the pattern's still just between you two." },
      { label: "Offer to help them build a budget instead of cash", delta: {}, flavor: "generous", outcome: "Jordan's not thrilled, but it's the first conversation about the actual problem, not just this month's version of it." },
      { label: "Say no this time and explain why", delta: {}, flavor: "conservative", outcome: "It's an uncomfortable call. Jordan hears the reason, even if they don't love it." },
    ],
  },
  {
    text: "Everyone at work is chipping in $50 for a coworker's fundraiser you don't feel strongly about.",
    principle: "others_first",
    surface: "obligation",
    choices: [
      { label: "Give the full $50 to fit in", delta: { savings: -50 }, flavor: "generous", outcome: "You're in with everyone else. The $50 doesn't ask why you gave it." },
      { label: "Give $10 and be upfront about it", delta: { savings: -10 }, flavor: "conservative", outcome: "Nobody blinks. Being clear about the number cost you nothing socially." },
      { label: "Decline — it's okay to sit this one out", delta: {}, flavor: "conservative", outcome: "It's a little awkward for a second, then the day moves on." },
    ],
  },
  {
    text: "Your parents mention they're a bit short this month.",
    principle: "others_first",
    surface: "family_loan",
    choices: [
      { label: "Send $300 without being asked directly", delta: { savings: -300 }, flavor: "generous", outcome: "It arrives before they had to ask twice. Whether that was needed, you don't fully know yet." },
      { label: "Ask what specifically needs covering first", delta: { savings: -150 }, flavor: "generous", outcome: "The conversation is a bit more direct than usual — and $150 covers exactly what's short." },
      { label: "Offer a non-cash form of help instead", delta: {}, flavor: "conservative", outcome: "It's not what they expected, but it's help that doesn't touch your account." },
    ],
  },
  {
    text: "You realize you haven't opened your credit card statement in two months.",
    principle: "id_notice",
    surface: "obligation",
    choices: [
      { label: "Open it right now, whatever's in there", delta: {}, flavor: "conservative", outcome: "Nothing on the statement was actually worse than the two months of not knowing." },
      { label: "Skim the total, skip the details", delta: {}, flavor: "uncertain", outcome: "You've got a number now, at least. The line items stay a mystery." },
      { label: "Keep avoiding it a bit longer", delta: { expenses: 60 }, flavor: "uncertain", outcome: "The statement waits. So does whatever's quietly accumulating on it." },
    ],
  },
  {
    text: "A subscription you forgot about just renewed for $89.",
    principle: "id_notice",
    surface: "subscription",
    choices: [
      { label: "Cancel it and check your account for others like it", delta: { savings: 89 }, flavor: "conservative", outcome: "One's gone, and you find a second one nobody remembers signing up for." },
      { label: "Let it slide, it's not that much", delta: { expenses: 89 }, flavor: "uncertain", outcome: "$89 this month. Not much, until it's not much twelve more times." },
      { label: "Cancel it, but don't check for more", delta: { savings: 89 }, flavor: "uncertain", outcome: "That one's handled. Whatever else is quietly renewing stays quietly renewing." },
    ],
  },
  {
    text: "Your card issuer offers a 'pay in 4' installment option at checkout for a $600 purchase.",
    timed: true,
    principle: "credit_is_free",
    surface: "bnpl",
    context: "Roughly half of U.S. credit cardholders carry a balance from month to month — Bankrate, 2024.",
    choices: [
      { label: "Use it — it's the same total, just split up", delta: { debt: 600 }, flavor: "impulsive", outcome: "Four smaller charges land on your card instead of one bigger one today." },
      { label: "Pay the full $600 upfront instead", delta: { savings: -600 }, flavor: "conservative", outcome: "It's done in one shot — no future payments to keep track of." },
      { label: "Wait a week and see if you still want it", delta: {}, flavor: "conservative", outcome: "A week later, you'll know if this was the purchase or just the moment." },
    ],
  },
  {
    text: "Your insurance auto-renewed the same plan as last year, now $40 a month more.",
    principle: "waiting_is_safe",
    surface: "subscription",
    choices: [
      { label: "Let it ride — comparing plans is a hassle", delta: { expenses: 40 }, flavor: "uncertain", outcome: "Same coverage, $40 more a month, no time spent finding out if that's the going rate." },
      { label: "Spend 20 minutes comparing two other plans", delta: {}, flavor: "conservative", outcome: "Twenty minutes tells you whether $40 more is normal or just what happens when nobody checks." },
      { label: "Switch to the cheaper option without comparing details", delta: { expenses: -40 }, flavor: "impulsive", outcome: "The bill drops $40 — you're trusting that the coverage didn't drop with it." },
    ],
  },
];

// `zone` marks which homeostatic state a scenario is most useful in:
//   "recovery" — pressure worth facing when BELOW the zone (rebuilding)
//   "living"   — pressure worth facing when ABOVE the zone (deploying resources)
//   undefined  — general, useful anywhere
//
// Scenarios are weighted, never hard-filtered, so the sandbox stays varied.

// Recovery pressure — surfaced when a learner is in breakdown. These probe
// whether they can take a repair route rather than deepen the hole.
const RECOVERY_SCENARIOS = [
  {
    text: "A creditor offers to settle your balance for 70% if you clear it within 30 days.",
    timed: true,
    principle: "catch_up_later",
    surface: "obligation",
    zone: "recovery",
    choices: [
      { label: "Take the settlement, clear the debt", delta: { debt: -2500, savings: -1200 }, flavor: "conservative", outcome: "The balance is gone in one move, and so is a chunk of the buffer that paid for it." },
      { label: "Ask for a longer payment plan instead", delta: { debt: -400 }, flavor: "conservative", outcome: "It's slower, but it doesn't empty the account to get there." },
      { label: "Ignore it, deal with it later", delta: { debt: 600 }, flavor: "uncertain", outcome: "The offer lapses. The balance doesn't." },
    ],
  },
  {
    text: "Your employer is offering extra shifts for the next two months.",
    principle: "waiting_is_safe",
    surface: "opportunity",
    zone: "recovery",
    choices: [
      { label: "Take them and direct the extra to debt", delta: { income: 400, debt: -800 }, flavor: "growth", outcome: "More hours, less debt — the trade is direct and it shows up fast." },
      { label: "Take a few, keep some breathing room", delta: { income: 200 }, flavor: "conservative", outcome: "A little extra income, and enough left in the tank to keep going." },
      { label: "Pass — you're stretched enough", delta: {}, flavor: "uncertain", outcome: "You stay at your current pace. The extra income stays on the table." },
    ],
  },
  {
    text: "You could sell equipment you rarely use for about $900.",
    principle: "waiting_is_safe",
    surface: "opportunity",
    zone: "recovery",
    choices: [
      { label: "Sell it, rebuild your buffer", delta: { savings: 900 }, flavor: "conservative", outcome: "It's gone from the closet and into the account where it can actually do something." },
      { label: "Sell it, clear a card", delta: { debt: -900 }, flavor: "conservative", outcome: "The sale goes straight at a balance instead of sitting as cash." },
      { label: "Keep it — you might need it someday", delta: {}, flavor: "uncertain", outcome: "It stays in the closet, worth exactly what it was before: nothing, until it's sold." },
    ],
  },
];

// Living pressure — surfaced when a learner is in distortion. These probe
// whether they can actually deploy resources rather than defer life
// indefinitely. Here, spending is often the capable move.
const LIVING_SCENARIOS = [
  {
    text: "Priya's wedding abroad would cost about $1,500. You can comfortably afford it.",
    principle: "more_saved_is_better",
    surface: "opportunity",
    zone: "living",
    choices: [
      { label: "Go — this is what the money is for", delta: { savings: -1500 }, flavor: "conservative", outcome: "You're there for it. The buffer absorbs the cost the way it was built to." },
      { label: "Go, but keep it lean", delta: { savings: -800 }, flavor: "conservative", outcome: "You make the wedding on a tighter budget — still there, just watching the spend." },
      { label: "Skip it and keep saving", delta: { savings: 200 }, flavor: "uncertain", outcome: "The buffer keeps growing. Priya understands, but you weren't there." },
    ],
  },
  {
    text: "You've postponed a health check for two years. It would cost $400 out of pocket.",
    principle: "more_saved_is_better",
    surface: "obligation",
    context: "About 41% of U.S. adults carry some form of medical or dental debt — KFF, 2024.",
    zone: "living",
    choices: [
      { label: "Book it now", delta: { savings: -400 }, flavor: "conservative", outcome: "Two years of not knowing ends with one appointment." },
      { label: "Book it, but wait for the new year", delta: { savings: -400, expenses: 40 }, flavor: "uncertain", outcome: "It's on the calendar, just not yet — the waiting continues a little longer, on purpose this time." },
      { label: "Put it off again", delta: { expenses: 120 }, flavor: "uncertain", outcome: "The appointment stays unbooked. So does the answer to whatever you've been wondering about." },
    ],
  },
  {
    text: "Your laptop is eight years old and slows your work daily. A replacement is $1,300.",
    principle: "more_saved_is_better",
    surface: "obligation",
    zone: "living",
    choices: [
      { label: "Replace it — it pays for itself", delta: { savings: -1300, income: 150 }, flavor: "growth", outcome: "The new machine is faster than the excuse for keeping the old one." },
      { label: "Buy a refurbished one", delta: { savings: -600, income: 80 }, flavor: "conservative", outcome: "Most of the speed, less of the cost — a middle option that actually exists." },
      { label: "Keep struggling with it", delta: { expenses: 60 }, flavor: "uncertain", outcome: "The laptop keeps slowing you down, a little at a time, in ways that don't show up on a statement." },
    ],
  },
];
const THEMED_SCENARIOS = {
  growth: {
    text: "A stock you've been watching just dropped 15% on no real news.",
    timed: true,
    principle: "this_time_different",
    surface: "opportunity",
    choices: [
      { label: "Buy more while it's down", delta: { investments: 1500, savings: -1500 }, flavor: "growth", outcome: "You're betting the drop is noise. Sometimes it is." },
      { label: "Hold what you have and wait", delta: {}, flavor: "conservative", outcome: "Nothing moves. That's the position you chose." },
      { label: "Sell before it drops further", delta: { investments: -1000, savings: 1000 }, flavor: "uncertain", outcome: "You're out, at a loss, betting the drop is signal instead." },
    ],
  },
  impulsive: {
    text: "A flash sale on something you don't need ends in 10 minutes.",
    timed: true,
    principle: "credit_is_free",
    surface: "bnpl",
    choices: [
      { label: "Buy it now, worry later", delta: { debt: 400 }, flavor: "impulsive", outcome: "It's yours in one click. The worry part is still ahead of you." },
      { label: "Close the tab", delta: {}, flavor: "conservative", outcome: "The countdown times out without you. Nothing about your day changes." },
      { label: "Add it to a wishlist for next month", delta: { savings: 50 }, flavor: "growth", outcome: "It's saved for later — if you still want it later, it'll still be there." },
    ],
  },
  uncertain: {
    text: "Your bank flags unusual activity on your account.",
    principle: "id_notice",
    surface: "obligation",
    choices: [
      { label: "Check it right now", delta: {}, flavor: "conservative", outcome: "Two minutes in the app tells you exactly what's going on. Usually that's the whole fix." },
      { label: "Deal with it later this week", delta: { expenses: 40 }, flavor: "uncertain", outcome: "The alert sits unread. Whatever it is has a few more days to become a bigger problem or nothing at all." },
      { label: "Ask a friend what they'd do first", delta: {}, flavor: "uncertain", outcome: "Your friend says check it. You still haven't." },
    ],
  },
  generous: {
    text: "A local fundraiser you believe in asks for a $100 donation.",
    principle: "others_first",
    surface: "obligation",
    choices: [
      { label: "Give the full $100", delta: { savings: -100 }, flavor: "generous", outcome: "It goes to something you actually believe in — the full amount, no half measures." },
      { label: "Give what fits your budget this month", delta: { savings: -30 }, flavor: "conservative", outcome: "You give something real without stretching past what the month can hold." },
      { label: "Skip it this time", delta: {}, flavor: "uncertain", outcome: "You sit this one out. The cause doesn't disappear, and neither does your reason for waiting." },
    ],
  },
  conservative: {
    text: "Open enrollment: a high-deductible plan with lower premiums, or a PPO with more coverage.",
    timed: true,
    principle: "id_notice",
    surface: "subscription",
    choices: [
      { label: "High-deductible plan, invest the difference", delta: { investments: 600, expenses: -100 }, flavor: "growth", outcome: "Lower premiums now, a bigger bill only if you actually need care this year." },
      { label: "PPO, pay more for certainty", delta: { expenses: 100 }, flavor: "conservative", outcome: "You pay more every month for not having to think about it if something happens." },
      { label: "Auto-renew whatever you had last year", delta: {}, flavor: "uncertain", outcome: "Same plan, same price change as everyone else who didn't look either." },
    ],
  },
};

// Short, persona-voiced reactions to whether a choice matched or
// diverged from the active persona's own temperament.
const REACTIONS = {
  match: [
    "That's exactly the kind of call a {persona} makes.",
    "Right on brand for a {persona} — consistent with how you think about money.",
    "That tracks with the {persona} mindset.",
  ],
  mismatch: [
    "That's a bit out of character for a {persona} — worth noticing why.",
    "Not the usual {persona} move. No judgment, just flagging it.",
    "A {persona} would normally lean the other way here.",
  ],
};

function reactionFor(choiceFlavor, personaGroup, personaName) {
  if (!choiceFlavor) return null;
  const pool = choiceFlavor === personaGroup ? REACTIONS.match : REACTIONS.mismatch;
  const template = pool[Math.floor(Math.random() * pool.length)];
  return template.replace("{persona}", personaName);
}

const DIFFICULTY_MULTIPLIER = { easy: 0.6, medium: 1, hard: 1.6 };

let state = null;          // current financial state
let currentPersona = null;
let difficulty = "medium";
let currentScenario = null;
let decisionCount = 0;
let decisionResolving = false;
let netWorthTrack = [];
const financeCache = {}; // slug -> fetched baseline, so restart doesn't refetch
// Homeostatic trajectories (PIPE model): each is an array of 0-100 scores.
let observedTrack = [];    // green — actual behaviour
let archetypeTrack = [];   // blue dashed — archetype-expected
let recalibratedTrack = [];// purple — nudged back toward the zone
let triggers = [];         // {index, kind, note} PIPE trigger markers
let decisionLog = [];      // plain records the observations layer reads
let zoneHistory = [];      // zone per decision, for pattern reads
// Groups this run's telemetry rows so a trajectory can be reconstructed
// per session during analysis, without identifying the person.
const sessionId = (() => {
  try {
    return (crypto.randomUUID && crypto.randomUUID()) ||
      String(Date.now()) + Math.random().toString(36).slice(2, 10);
  } catch (e) {
    return String(Date.now()) + Math.random().toString(36).slice(2, 10);
  }
})();

// Whether the round recap's full narrative (see showRoundRecap) unlocks —
// same $5/mo gate as chat/Pro/MRI. Fetched once, non-blocking: the sandbox
// itself never waits on this, and a round completed before it resolves
// just sees the free teaser rather than the recap failing to show.
let subscriptionActive = false;
(async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/billing/status`, { credentials: "include" });
    const data = await res.json();
    subscriptionActive = data.status === "active" || data.status === "trialing";
  } catch (e) {}
})();

function currentPersonaMeta() {
  return PERSONAS.find(p => p.slug === currentPersona) || null;
}

// Scenario selection responds to homeostatic state, so pressure is felt where
// the learner actually is (the Immersion tenet). Weighted rather than filtered:
// a learner in breakdown mostly meets recovery pressure but still sees the full
// range, so the sandbox never becomes predictable.
let lastScenarioText = null;

// Generated scenarios are prefetched one ahead and consumed synchronously, so
// model latency never sits between a decision and the next scenario. If the
// buffer is empty we simply use the authored pool.
let generatedBuffer = [];
let generatingNow = false;

async function prefetchScenario(zone) {
  if (generatingNow || generatedBuffer.length >= 2) return;
  if (typeof featureEnabled === "function" && !featureEnabled("adaptive_scenarios")) return;
  generatingNow = true;
  try {
    const res = await fetch(`${API_BASE_URL}/api/scenario/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ zone, persona: currentPersona }),
    });
    if (res.status === 200) {
      const s = await res.json();
      if (s && s.text && Array.isArray(s.choices)) generatedBuffer.push(s);
    }
  } catch (e) {
    // Silent: the authored pool is always available.
  } finally {
    generatingNow = false;
  }
}

function pickScenario() {
  // ABLATION (study arm): with adaptive selection disabled, scenarios are
  // drawn uniformly. Same content, same volume, no zone or archetype
  // conditioning — isolating adaptation from mere exposure.
  if (typeof featureEnabled === "function" && !featureEnabled("adaptive_scenarios")) {
    const flat = SCENARIOS.concat(RECOVERY_SCENARIOS, LIVING_SCENARIOS);
    const previousTexts = new Set([lastScenarioText, currentScenario?.text].filter(Boolean));
    const fresh = flat.filter(x => !previousTexts.has(x.text));
    const pool = fresh.length ? fresh : flat;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    lastScenarioText = pick.text;
    return pick;
  }

  const meta = currentPersonaMeta();
  const zone = observedTrack.length
    ? zoneStatus(observedTrack[observedTrack.length - 1])
    : "homeostasis";

  // Was their most recent move in this archetype's characteristic direction?
  const drifting = observedTrack.length >= 2 && meta
    ? (characteristicDrift(currentPersona,
        observedTrack[observedTrack.length - 2],
        observedTrack[observedTrack.length - 1]) || {}).characteristic
    : false;

  const pool = [];
  const add = (scenarios, weight) => {
    scenarios.forEach(s => { for (let i = 0; i < weight; i++) pool.push(s); });
  };

  add(SCENARIOS, 2); // general pressure is always available

  if (zone === "breakdown") {
    add(RECOVERY_SCENARIOS, 5);   // can they take a repair route?
    add(LIVING_SCENARIOS, 0);
  } else if (zone === "distortion") {
    add(LIVING_SCENARIOS, 5);     // can they actually deploy resources?
    add(RECOVERY_SCENARIOS, 0);
  } else {
    add(RECOVERY_SCENARIOS, 1);   // in zone: keep the full range in view
    add(LIVING_SCENARIOS, 1);
  }

  // Archetype-themed pressure, amplified when they're drifting their own way.
  if (meta && THEMED_SCENARIOS[meta.group]) {
    add([THEMED_SCENARIOS[meta.group]], drifting ? 6 : 3);
  }

  // Use a generated scenario roughly a third of the time, when one is ready.
  if (generatedBuffer.length && Math.random() < 0.34) {
    const gen = generatedBuffer.shift();
    if (gen.text !== lastScenarioText) {
      lastScenarioText = gen.text;
      prefetchScenario(zone);
      return gen;
    }
  }
  prefetchScenario(zone);

  // Avoid repeating the scenario they just answered or the one still on screen.
  const previousTexts = new Set([lastScenarioText, currentScenario?.text].filter(Boolean));
  const fresh = pool.filter(s => !previousTexts.has(s.text));
  const candidates = fresh.length ? fresh : pool;
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  lastScenarioText = chosen.text;
  return chosen;
}

function fmt(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function renderPersonaChips() {
  const row = document.getElementById("persona-chips");
  row.innerHTML = PERSONAS.map(p => `
    <div class="persona-chip-wrap" data-tooltip>
      <button class="chip" data-slug="${esc(p.slug)}" aria-pressed="false" aria-describedby="persona-tip-${esc(p.slug)}">${esc(p.name)}</button>
      <div class="persona-chip-tooltip" id="persona-tip-${esc(p.slug)}">
        <canvas class="persona-radar" data-radar-slug="${esc(p.slug)}" width="140" height="140"></canvas>
        <p class="persona-chip-trait">${esc(p.trait)}</p>
      </div>
    </div>`
  ).join("");
  row.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => selectPersona(chip.dataset.slug));
  });
  // Drawn once up front — eleven small canvases is cheap, and this avoids
  // re-drawing on every hover.
  if (typeof drawRadarChart === "function") {
    row.querySelectorAll("[data-radar-slug]").forEach(canvas => {
      const profile = ARCHETYPE_PROFILES[canvas.dataset.radarSlug];
      if (profile) drawRadarChart(canvas, profile, {}, { showLabels: false });
    });
  }
}

async function selectPersona(slug, { fromCache = false, seedState = null } = {}) {
  currentPersona = slug;
  savePersona(slug);
  document.querySelectorAll("#persona-chips .chip").forEach(c => {
    const active = c.dataset.slug === slug;
    c.classList.toggle("active", active);
    c.setAttribute("aria-pressed", String(active));
  });

  if (seedState) {
    state = { ...seedState };
    financeCache[slug] = { ...seedState };
  } else if (fromCache && financeCache[slug]) {
    state = { ...financeCache[slug] };
  } else {
    document.getElementById("wellbeing-note").textContent = "Loading your numbers…";
    state = await fetchPersonaFinance(slug);
    financeCache[slug] = { ...state };
  }
  decisionCount = 0;
  // Seed homeostatic trajectories from the starting state.
  const startScore = stabilityScore(state);
  const archProfile = (typeof ARCHETYPE_PROFILES !== "undefined" && ARCHETYPE_PROFILES[slug]) || null;
  const archScore = archProfile ? archetypeExpectedScore(archProfile, slug) : HOMEOSTASIS.mid;
  observedTrack = [startScore];
  archetypeTrack = [archScore];
  recalibratedTrack = [startScore];
  netWorthTrack = [netWorth(state)];
  triggers = [];
  decisionLog = [];
  zoneHistory = [zoneStatus(startScore)];
  resetObjectiveBaseline();
  renderObjectiveBar();
  updateHomeostasisPanel();
  document.getElementById("wellbeing-note").textContent = "Starting numbers loaded — try a scenario below.";
  document.getElementById("change-log").innerHTML = '<li class="log-empty">No decisions yet.</li>';
  const logTitle = document.getElementById("change-log-title");
  if (logTitle) logTitle.textContent = "Change log";
  resetStatStrip();
  updateMetrics();
  drawChart();
  drawNetWorthChart();
  renderDashSetupSummary();
  closeSettingsModal();
  rollScenario();
}

// Persona (11 chips) and difficulty used to sit inline, permanently, above
// every scenario — the densest, most-always-visible part of the page for
// something changed rarely. Both now live in one modal (#settings-overlay),
// reached through a single button, so the default page is just the
// scenario; this renders the one-line summary that replaces them.
// Renamed from Easy/Medium/Hard. The old labels described a number being
// multiplied, which is mechanically what happens but is not what the choice
// is FOR: the point is how much pressure a decision carries, not how large
// the arithmetic is. Same underlying multiplier, honest framing.
const DIFFICULTY_DISPLAY = { easy: "Explore", medium: "Test", hard: "Stress Test" };
const MODE_NOTE = {
  easy: "Consequences stay light, so patterns can surface without much cost.",
  medium: "Standard weight. Trade-offs land as written.",
  hard: "Trade-offs sharpen, so conflicts between your goals become unavoidable.",
};
function renderDashSetupSummary() {
  const text = document.getElementById("dash-setup-summary-text");
  const btn = document.getElementById("dash-settings-btn");
  if (!text || !btn) return;
  if (!currentPersona) {
    text.textContent = "Pick a persona to start";
    btn.textContent = "Choose";
    return;
  }
  const p = PERSONAS.find(p => p.slug === currentPersona);
  text.innerHTML = `Coaching style: <strong>${esc(p ? p.name : currentPersona)}</strong> &middot; ${esc(DIFFICULTY_DISPLAY[difficulty] || difficulty)} mode`;
  btn.textContent = "Change";
}

function openSettingsModal() {
  const overlay = document.getElementById("settings-overlay");
  if (!overlay) return;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  settingsOpenerEl = document.activeElement;
  document.addEventListener("keydown", onSettingsKeydown);
  (document.querySelector("#persona-chips .chip.active") || document.querySelector("#persona-chips .chip"))?.focus();
}

function closeSettingsModal() {
  const overlay = document.getElementById("settings-overlay");
  if (!overlay || !overlay.classList.contains("open")) return;
  overlay.classList.remove("open");
  document.body.style.overflow = "";
  document.removeEventListener("keydown", onSettingsKeydown);
  if (settingsOpenerEl) settingsOpenerEl.focus();
}

let settingsOpenerEl = null;
function onSettingsKeydown(e) {
  if (e.key === "Escape") { closeSettingsModal(); return; }
  if (e.key !== "Tab") return;
  const modal = document.querySelector("#settings-overlay .quiz-modal");
  if (!modal) return;
  const focusable = modal.querySelectorAll("button, a[href]");
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
}

async function restartPersona() {
  if (currentPersona) await selectPersona(currentPersona, { fromCache: true });
}

function renderPredictionBanner() {
  const existing = document.getElementById("quiz-prediction-banner");
  if (existing) existing.remove();

  const prediction = typeof getQuizPrediction === "function" ? getQuizPrediction() : null;
  if (!prediction) return;

  const persona = PERSONAS.find(p => p.slug === prediction.slug);
  if (!persona) return;

  const host = document.querySelector(".dash-setup");
  if (!host) return;

  const banner = document.createElement("div");
  banner.id = "quiz-prediction-banner";
  banner.className = "prediction-banner";
  banner.innerHTML = `
    <div>
      <p class="prediction-title">Tentative quiz match</p>
      <p class="prediction-body">${esc(persona.name)} — ${esc(persona.trait)}</p>
    </div>
    <div class="prediction-actions">
      <button class="btn btn-ghost prediction-use" type="button">Use this persona</button>
      <a class="btn btn-secondary" href="${esc(personaUrl(persona.slug))}">Talk it through</a>
    </div>
  `;
  host.insertAdjacentElement("afterend", banner);
  banner.querySelector(".prediction-use")?.addEventListener("click", () => selectPersona(persona.slug));
}

function renderDifficultyChips() {
  document.querySelectorAll("#difficulty-chips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      difficulty = chip.dataset.difficulty;
      document.querySelectorAll("#difficulty-chips .chip").forEach(c => {
        const active = c === chip;
        c.classList.toggle("active", active);
        c.setAttribute("aria-pressed", String(active));
      });
      renderDashSetupSummary();
      const note = document.getElementById("mode-note");
      if (note) note.textContent = MODE_NOTE[difficulty] || "";
    });
  });
}

function initSettingsModal() {
  document.getElementById("dash-settings-btn")?.addEventListener("click", openSettingsModal);
  document.getElementById("settings-close")?.addEventListener("click", closeSettingsModal);
  document.getElementById("settings-overlay")?.addEventListener("click", e => {
    if (e.target.id === "settings-overlay") closeSettingsModal();
  });
}

// Every choice already carries a flavor (conservative/growth/impulsive/
// uncertain/generous — the same five groups PERSONAS use) and a delta
// object. Both were already being tracked for telemetry; surfacing them
// on the button itself turns "plain text options" into something closer
// to a real decision card, using data that already exists rather than
// inventing new content per scenario.
const FLAVOR_ICON = {
  conservative: "🛡", growth: "📈", impulsive: "⚡", uncertain: "❓", generous: "❤",
};
function flavorIcon(flavor) {
  return FLAVOR_ICON[flavor] || "•";
}

const DELTA_LABEL = {
  savings: "savings", debt: "debt", investments: "investments",
  income: "income", expenses: "expenses",
};
function formatDeltaTag(delta) {
  const entries = Object.entries(delta || {}).filter(([, v]) => v !== 0);
  if (!entries.length) return "No immediate change";
  return entries
    .map(([key, val]) => `${val > 0 ? "+" : "−"}${fmt(Math.abs(val))} ${DELTA_LABEL[key] || key}`)
    .join(" · ");
}

// Detects whether a scenario's text names one of the sandbox's recurring
// characters (see archetype-portraits.js's characterPortraitSvg), so the
// card can show a small portrait rather than leaving the storytelling
// purely textual. A plain substring check, not a scenario-authored field —
// the name already has to appear in the sentence for the story to make
// sense, so it doubles as the detector.
const SCENARIO_CHARACTER_NAMES = ["Priya", "Devon", "Jordan"];
function scenarioCharacter(text) {
  return SCENARIO_CHARACTER_NAMES.find(name => text.includes(name)) || null;
}


// --- real time pressure ------------------------------------------------------
// Scenarios tagged `timed` previously only DESCRIBED urgency ("ends in 10
// minutes") while the interface applied none. That is a validity problem, not
// just a missed experience: the deadline finding in the Financial MRI is
// measured on those scenarios, so if nothing actually pressures the person the
// measurement is of a condition the product never created.
//
// The countdown is generous on purpose. It is long enough to read and decide
// properly, short enough that dithering is visible to you, and running out
// does not choose for you: it marks the decision as made under expiry and
// leaves the choice yours. Taking the decision away would measure compliance
// with a timer rather than behaviour under pressure.
const SCENARIO_TIMER_SECONDS = 20;
let scenarioTimerHandle = null;
let scenarioTimerExpired = false;

function clearScenarioTimer() {
  if (scenarioTimerHandle) clearInterval(scenarioTimerHandle);
  scenarioTimerHandle = null;
}

function startScenarioTimer() {
  clearScenarioTimer();
  scenarioTimerExpired = false;
  const host = document.getElementById("scenario-timer");
  if (!host) return;
  // Motion sensitivity: the bar is the pressure, so with reduced motion the
  // countdown still runs but is announced in text rather than animated.
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let left = SCENARIO_TIMER_SECONDS;
  const fill = document.getElementById("scenario-timer-fill");
  const label = document.getElementById("scenario-timer-label");
  const paint = () => {
    if (label) label.textContent = scenarioTimerExpired ? "Offer expired" : `${left}s left`;
    if (fill && !reduce) fill.style.width = `${(left / SCENARIO_TIMER_SECONDS) * 100}%`;
    host.classList.toggle("is-urgent", left <= 6 && !scenarioTimerExpired);
    host.classList.toggle("is-expired", scenarioTimerExpired);
  };
  paint();
  scenarioTimerHandle = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      left = 0;
      scenarioTimerExpired = true;
      clearScenarioTimer();
    }
    paint();
  }, 1000);
}

function rollScenario() {
  decisionResolving = false;
  const card = document.getElementById("scenario-card");
  if (!currentPersona) {
    card.innerHTML = `
      <p class="scenario-empty-title">Choose a persona to start</p>
      <p class="scenario-empty-body">Scenarios and numbers are tailored to whichever coach you choose — tap "Choose" above.</p>
    `;
    return;
  }
  currentScenario = pickScenario();

  // Begin the experiential cycle. DLO decides whether this decision warrants
  // the full prediction/surprise/reflection loop; titration decides how much
  // the learner can absorb right now.
  if (typeof startCycle === "function") {
    const snap = typeof getHomeostasisSnapshot === "function" ? getHomeostasisSnapshot() : null;
    const prof = typeof getProfile === "function" ? getProfile() : null;
    startCycle(currentScenario, {
      state,
      zone: observedTrack.length ? zoneStatus(observedTrack[observedTrack.length - 1]) : "homeostasis",
      selfEfficacy: prof && prof.profile ? prof.profile.financial_self_efficacy : 50,
      distressSignal: false,
    });
  }

  if (typeof track === "function") {
    track("scenario_shown", {
      scenario: currentScenario.text.slice(0, 120),
      zone: currentScenario.zone || "general",
    });
  }
  const character = scenarioCharacter(currentScenario.text);
  const scene = (typeof sceneLabel === "function" && typeof ROUND_LENGTH !== "undefined")
    ? sceneLabel(decisionCount, ROUND_LENGTH) : "";
  card.innerHTML = `
    ${scene ? `<p class="scene-label">${esc(scene)}</p>` : ""}
    <div class="scenario-head">
      <p class="scenario-eyebrow">Scenario</p>
      ${character ? `
        <div class="scenario-character">
          <span class="scenario-character-portrait">${characterPortraitSvg(character.toLowerCase())}</span>
          <span class="scenario-character-name">${esc(character)}</span>
        </div>` : ""}
    </div>
    <p class="scenario-text">${esc(currentScenario.text)}</p>
    ${currentScenario.context ? `<p class="scenario-context"><span class="scenario-context-label">Real-world context</span>${esc(currentScenario.context)}</p>` : ""}
    <div class="scenario-choices">
      ${currentScenario.choices.map((c, i) => `
        <button class="choice-btn" data-i="${i}" data-flavor="${esc(c.flavor || "")}">
          <kbd class="choice-key" aria-hidden="true">${i + 1}</kbd>
          <span class="choice-icon" aria-hidden="true">${flavorIcon(c.flavor)}</span>
          <span class="choice-body">
            <span class="choice-text">${esc(c.label)}</span>
            <span class="choice-tag">${esc(formatDeltaTag(c.delta))}</span>
          </span>
        </button>`).join("")}
    </div>
    <button class="btn btn-secondary reroll-btn" id="reroll-btn">Roll new scenario</button>
  `;
  card.querySelectorAll(".choice-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      card.querySelectorAll(".choice-btn").forEach(b => { b.disabled = true; });
      btn.classList.add("choice-pressed");
      if (typeof animateChoiceCommit === "function") animateChoiceCommit(btn);
      applyChoice(currentScenario.choices[+btn.dataset.i], +btn.dataset.i);
    });
  });
  document.getElementById("reroll-btn").addEventListener("click", rollScenario);
  const timerEl = document.getElementById("scenario-timer");
  if (timerEl) timerEl.hidden = !currentScenario.timed;
  if (currentScenario.timed) startScenarioTimer(); else clearScenarioTimer();
  if (typeof animateScenarioEntrance === "function") animateScenarioEntrance();
  renderFirstRun();
  renderPredictionProbe();
}

function applyChoice(choice, chosenIndex) {
  if (decisionResolving || !state || !currentScenario) return;
  decisionResolving = true;
  const decidedAfterExpiry = scenarioTimerExpired;
  clearScenarioTimer();
  if (typeof markRoadmapLevelComplete === "function") markRoadmapLevelComplete("decision-scenario");
  if (typeof markTrainingRep === "function") markTrainingRep("decision-scenario");
  const previousState = { ...state };
  const mult = DIFFICULTY_MULTIPLIER[difficulty];
  const applied = {};
  Object.entries(choice.delta).forEach(([key, val]) => {
    const scaled = Math.round(val * mult);
    state[key] = Math.max(0, state[key] + scaled);
    if (scaled !== 0) applied[key] = scaled;
  });
  decisionCount++;

  const meta = currentPersonaMeta();
  const reaction = meta ? reactionFor(choice.flavor, meta.group, meta.name) : null;
  // Authored scenarios carry a scene-specific outcome line; scenarios from
  // the adaptive generator (prefetchScenario) don't, so fall back to the
  // mechanical delta explanation rather than showing nothing.
  const why = choice.outcome || explainChoice(applied);

  // --- Homeostatic tracking (PIPE) ---
  const prevScore = observedTrack[observedTrack.length - 1];
  const score = stabilityScore(state);
  observedTrack.push(score);
  netWorthTrack.push(netWorth(state));

  const archProfile = (typeof ARCHETYPE_PROFILES !== "undefined" && meta && ARCHETYPE_PROFILES[currentPersona]) || null;
  const archScore = archProfile ? archetypeExpectedScore(archProfile, currentPersona) : HOMEOSTASIS.mid;
  archetypeTrack.push(archScore);
  recalibratedTrack.push(recalibrate(score));

  const trigger = detectTrigger(prevScore, score);
  if (trigger) triggers.push({ index: observedTrack.length - 1, ...trigger });

  // Is the learner drifting the way THIS archetype characteristically drifts?
  const driftEnabled = typeof featureEnabled !== "function" || featureEnabled("characteristic_drift");
  const drift = (meta && driftEnabled) ? characteristicDrift(currentPersona, prevScore, score) : null;

  const gap = meta ? personArchetypeGap(score, archScore) : 0;
  updateHomeostasisPanel(trigger);

  // Resolve this before logging it. The telemetry payload below includes the
  // cycle result, so it must exist before `track` reads it.
  let cycleResult = null;
  const activeCycle = typeof currentCycle === "function" ? currentCycle() : null;
  if (activeCycle && typeof resolveCycle === "function") {
    cycleResult = resolveCycle(chosenIndex, { decisionIndex: decisionCount });
  }

  // Persist the prediction-versus-choice comparison for the Financial MRI.
  // This was previously computed and then discarded into telemetry only, so
  // the report had no way to read back its own central finding. The
  // counterfactual needs what the PREDICTED choice would have done, which is
  // knowable only here, while the scenario's other options are still in hand.
  if (typeof recordMriDecision === "function") {
    const predictedIndex = cycleResult ? cycleResult.predicted : null;
    recordMriDecision({
      scenario: currentScenario.text,
      choice: choice.label,
      predicted: predictedIndex,
      actual: chosenIndex,
      matched: cycleResult ? cycleResult.correct === true : false,
      timed: currentScenario.timed === true,
      expired: decidedAfterExpiry === true,
      surface: currentScenario.surface || null,
      principle: currentScenario.principle || null,
      netWorthDelta: netWorth(state) - netWorth(previousState),
      predictedNetWorthDelta: (predictedIndex !== null && currentScenario.choices[predictedIndex])
        ? netWorthDeltaFor(currentScenario.choices[predictedIndex], previousState, mult)
        : null,
    });
    if (typeof pushMriDecisionToServer === "function") pushMriDecisionToServer();
  }

  if (typeof track === "function") {
    track("decision_made", {
      persona: currentPersona,
      decision_index: observedTrack.length - 1,
      choice: choice.label,
      scenario: currentScenario.text.slice(0, 120),
      scenario_zone: currentScenario.zone || "general",
      wellbeing: score,
      zone: zoneStatus(score),
      gap,
      trigger: trigger ? trigger.kind : null,
      characteristic_drift: drift ? drift.characteristic : null,
      difficulty,
      // Calibration payload
      principle: currentScenario.principle || null,
      surface: currentScenario.surface || null,
      dlo_band: cycleResult ? cycleResult.dlo.band : null,
      dlo_score: cycleResult ? Number(cycleResult.dlo.score.toFixed(3)) : null,
      titration: cycleResult ? cycleResult.budget.level : null,
      predicted: cycleResult ? cycleResult.predicted : null,
      prediction_correct: cycleResult ? cycleResult.correct : null,
      confidence: cycleResult ? cycleResult.confidence : null,
      deliberation_ms: cycleResult ? cycleResult.deliberationMs : null,
    });
  }

  decisionLog.push({
    choice: choice.label,
    delta: applied,
    flavor: choice.flavor,
    scenarioZone: currentScenario.zone || "general",
    zone: zoneStatus(score),
    principle: currentScenario.principle || null,
    outcome: choice.outcome || null,
  });
  zoneHistory.push(zoneStatus(score));

  dismissFirstRun();

  const observationsOn = typeof featureEnabled !== "function" || featureEnabled("observations");
  const rawObservation = observationsOn ? observeDecision(decisionLog) : null;

  // Support is faded per principle. Early on the system names the pattern;
  // later it asks; eventually it says nothing and leaves room for the learner
  // to notice unaided. That withdrawal is the mechanism, not a side effect.
  const principleKey = currentScenario.principle || null;
  const scaffold = (observationsOn && typeof scaffoldedResponse === "function")
    ? scaffoldedResponse(principleKey, {
        observation: rawObservation,
        drift,
        personaName: meta ? meta.name : null,
      })
    : { level: "name", mode: "told", text: rawObservation, invitesResponse: false };

  const observation = scaffold.text;

  if (typeof recordScaffold === "function") {
    // Decision quality proxy: did wellbeing move toward the viable zone?
    const q = (typeof HOMEOSTASIS !== "undefined")
      ? 1 - Math.min(1, Math.abs(score - HOMEOSTASIS.mid) / 50) : null;
    recordScaffold(principleKey, scaffold.level, q);
  }
  logChange(choice.label, applied, reaction, why, observation,
            scaffold.invitesResponse ? scaffold.prompt : null, principleKey);

  if (typeof track === "function") {
    track("titration_applied", {
      principle: principleKey,
      scaffold_level: scaffold.level,
      scaffold_mode: scaffold.mode,
    });
  }
  renderPatternPanel();
  renderRoundBar();
  renderObjectiveBar();
  updateDrawerHint();
  if (cycleResult) maybeRunPostProbes(cycleResult);

  // Surface the observation immediately — the drawer may be closed, and this
  // is the feedback that makes a decision feel answered.
  if (observation) toast(observation, { tone: "neutral", duration: 5200 });

  const rp = roundProgress(decisionCount);
  if (rp.complete) {
    if (typeof track === "function") track("round_completed", { round: rp.round - 1, decisions: decisionCount });
    // A study participant's first completed round is the task's finish
    // line — checked here (not inside showRoundRecap/closeRecap) so the
    // ordinary, non-study round recap is completely untouched.
    pendingStudyCompletion = decisionCount === ROUND_LENGTH;
    showRoundRecap(buildRoundRecap(decisionLog, zoneHistory, rp.round - 1));
    if (typeof featureEnabled !== "function" || featureEnabled("personalisation")) {
      applyInferredArchetype(inferArchetype());
    }
  }

  logScenarioChoice({
    persona: currentPersona,
    difficulty,
    scenario: currentScenario.text,
    choice: choice.label,
    delta: applied,
    homeostasis: {
      session_id: sessionId,
      decision_index: observedTrack.length - 1,
      wellbeing: score,
      zone: zoneStatus(score),
      archetype_expected: archScore,
      gap,
      trigger_kind: trigger ? trigger.kind : null,
      characteristic_drift: drift ? drift.characteristic : null,
      primary_axis: (typeof SURFACE_AXIS !== "undefined") ? (SURFACE_AXIS[currentScenario.surface] || null) : null,
    },
  });
  saveSandboxState({
    persona: currentPersona,
    difficulty,
    state,
    decisionCount,
    // Full PIPE trajectories, so Evolution survives a reload and a new device.
    observedTrack,
    archetypeTrack,
    recalibratedTrack,
    triggers,
    netWorthTrack,
    decisionLog: decisionLog.slice(-5),
  });

  // Compact snapshot the coaching chat reads, so the coach can respond to
  // where this person actually is rather than talking in generalities.
  saveHomeostasisSnapshot({
    persona: currentPersona,
    wellbeing: score,
    zone: zoneStatus(score),
    gap,
    decisionCount,
    triggerCount: triggers.length,
    lastTrigger: triggers.length ? triggers[triggers.length - 1].kind : null,
    characteristicDrift: drift ? drift.characteristic : false,
    inZoneCount: observedTrack.filter(v => zoneStatus(v) === "homeostasis").length,
    totalDecisions: observedTrack.length,
  });
  // A brief "weighing that up" beat before the numbers move — the choice
  // buttons already went disabled/pressed on click, so this isn't dead air,
  // it's a short anticipation pause before the stat strip and outcome
  // reveal, rather than everything snapping instantly.
  const stripEl = document.getElementById("stat-strip");
  if (stripEl) stripEl.classList.add("is-weighing");
  const reveal = () => {
    if (stripEl) stripEl.classList.remove("is-weighing");
    updateMetrics();
    drawChart();
    drawNetWorthChart();
    renderDecisionOutcome(choice, applied, previousState, score, why);
    // Only show the trigger note if there's no observation toast already
    // up — toast() clears whatever's currently showing before rendering
    // new content, so firing both would cut the (richer, more
    // personalized) observation toast short after less than half a
    // second instead of its full duration.
    if (trigger && !observation) toast(trigger.note, { tone: "watch", duration: 5000 });
  };
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    reveal();
  } else {
    setTimeout(reveal, 480);
  }
}

function renderDecisionOutcome(choice, applied, previousState, score, why) {
  const card = document.getElementById("scenario-card");
  if (!card) return;

  const impacts = Object.entries(applied).map(([key, value]) => ({
    label: { income: "Monthly income", expenses: "Monthly expenses", savings: "Savings buffer", investments: "Investments", debt: "Debt balance" }[key] || key,
    value,
    next: state[key],
  }));
  const position = score >= 65 ? "More stable" : score >= 40 ? "Under pressure" : "Fragile";
  const direction = score - stabilityScore(previousState);

  card.innerHTML = `
    <div class="decision-result-head">
      <div>
        <p class="scenario-eyebrow">Decision applied</p>
        <p class="decision-result-choice">${esc(choice.label)}</p>
      </div>
      <span class="position-badge position-${position === "More stable" ? "good" : position === "Under pressure" ? "watch" : "bad"}">${position}</span>
    </div>
    <p class="decision-result-summary">${esc(why)}</p>
    <div class="impact-list" aria-label="How this choice changed your numbers">
      ${impacts.length ? impacts.map(impact => `
        <div class="impact-row">
          <span>${esc(impact.label)}</span>
          <strong class="impact-${impact.value > 0 ? "up" : "down"}">${impact.value > 0 ? "+" : ""}${fmt(impact.value)}</strong>
          <small>now ${fmt(impact.next)}</small>
        </div>`).join("") : `<p class="impact-empty">No immediate financial change. Keeping the status quo is still a decision.</p>`}
    </div>
    <div class="decision-result-footer">
      <span class="score-shift ${direction >= 0 ? "score-up" : "score-down"}">${direction >= 0 ? "+" : ""}${Math.round(direction)} stability</span>
      <button class="btn btn-primary next-scenario-btn" id="next-scenario-btn" type="button">Next decision</button>
    </div>
  `;
  document.getElementById("next-scenario-btn")?.addEventListener("click", rollScenario);
}

// Legibility (PIPE precondition): translate raw deltas into a plain-language
// "why" so the learner can read the causal link, not just watch a number move.
function explainChoice(applied) {
  const bits = [];
  if (applied.savings && applied.savings < 0) bits.push("drew down your savings buffer");
  if (applied.savings && applied.savings > 0) bits.push("added to your savings cushion");
  if (applied.debt && applied.debt > 0) bits.push("took on new debt that will accrue interest");
  if (applied.debt && applied.debt < 0) bits.push("reduced debt, freeing future income");
  if (applied.investments && applied.investments > 0) bits.push("moved money into longer-term growth");
  if (applied.investments && applied.investments < 0) bits.push("pulled money out of investments");
  if (applied.income && applied.income > 0) bits.push("raised your monthly income");
  if (applied.expenses && applied.expenses > 0) bits.push("increased your ongoing expenses");
  if (applied.expenses && applied.expenses < 0) bits.push("trimmed your ongoing expenses");
  if (!bits.length) return "No immediate change to your numbers — sometimes the status quo is the choice.";
  return "This " + bits.join(", and ") + ".";
}

function logChange(label, applied, reaction, why, observation, scaffoldPrompt, scaffoldPrincipleKey) {
  const log = document.getElementById("change-log");
  if (log.querySelector(".log-empty")) log.innerHTML = "";
  const parts = Object.entries(applied).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${fmt(v)}`);
  const li = document.createElement("li");
  li.className = "new";
  li.innerHTML = `
    <div class="log-row">
      <span class="log-choice">${esc(label)}</span>
      <span class="log-delta">${parts.join(", ") || "no change"}</span>
    </div>
    ${why ? `<p class="log-why">${esc(why)}</p>` : ""}
    ${observation ? `<p class="log-observation">${esc(observation)}</p>` : ""}
    ${scaffoldPrompt ? `<div class="scaffold-ask">
        <p>${esc(scaffoldPrompt)}</p>
        <button class="scaffold-respond" type="button" data-principle="${esc(scaffoldPrincipleKey || "")}">Say what you noticed</button>
      </div>` : ""}
    ${reaction ? `<p class="log-reaction">${esc(reaction)}</p>` : ""}
  `;
  li.querySelector(".scaffold-respond")?.addEventListener("click", e => {
    openScaffoldResponse(e.target.dataset.principle, li);
  });
  log.prepend(li);
  const title = document.getElementById("change-log-title");
  if (title) title.textContent = `What you've done · ${decisionCount} decision${decisionCount === 1 ? "" : "s"}`;
}

// Homeostasis panel: current zone status + person-archetype gap summary.
// The person sees a qualitative read of their behaviour. The scores, zones and
// gaps that produced it stay in the engine and the research view.
// First-run orientation. One sentence, dismissed permanently on first decision.
// Deliberately not a multi-step tour — people came to try it, not read it.
function renderFirstRun() {
  const card = document.getElementById("scenario-card");
  if (!card || decisionCount > 0) return;
  try { if (localStorage.getItem("finperson_seen_intro")) return; } catch (e) {}
  const note = document.createElement("p");
  note.className = "first-run-note";
  note.innerHTML = `Pick whichever option you'd actually choose — there's no right answer, and none of this is real money.`;
  card.prepend(note);
}

function dismissFirstRun() {
  try { localStorage.setItem("finperson_seen_intro", "1"); } catch (e) {}
  document.querySelector(".first-run-note")?.remove();
}

// --- Behavioural archetype inference -------------------------------------
// The entry situation supplies a working hypothesis. Observed behaviour
// revises it. This is what makes Personalisation continuous rather than a
// one-time classification — and it is the only route to archetypes defined
// by low self-insight (Overconfident Navigator, Status Seeker), which nobody
// self-selects.
//
// Runs at the end of each round, so a single unusual decision cannot flip it.
function inferArchetype() {
  if (decisionLog.length < ROUND_LENGTH) return null;
  const log = decisionLog;
  const n = log.length;
  const rate = pred => log.filter(pred).length / n;

  const credit = rate(d => (d.delta.debt || 0) > 0);
  const inaction = rate(d => Object.keys(d.delta || {}).length === 0);
  const declinedLife = rate(d => d.scenarioZone === "living" && (d.delta.savings || 0) >= 0);
  const risky = rate(d => (d.delta.investments || 0) > 0 && (d.delta.savings || 0) < 0);
  const gave = rate(d => d.flavor === "generous");
  const avoided = rate(d => Object.keys(d.delta || {}).length === 0 || (d.delta.expenses || 0) > 0);
  const built = rate(d => (d.delta.savings || 0) > 0 || (d.delta.debt || 0) < 0);

  // Ordered by specificity — the most distinctive signature wins.
  // Status Seeker and Overconfident Navigator appear ONLY here.
  // Note: impulsive spending requires credit use WITHOUT risk-taking. Credit
  // combined with risk is over-reach (overconfident), not impulse — different
  // patterns needing different coaching.
  if (credit >= 0.5 && built <= 0.2 && risky <= 0.2) return "impulsive_spender";
  if (gave >= 0.35) return "purposeful_giver";
  if (inaction >= 0.5) return "passive_drifter";
  if (avoided >= 0.6 && built <= 0.25) return "anxious_avoider";
  if (risky >= 0.4 && credit >= 0.25) return "overconfident_navigator";
  if (credit >= 0.35 && declinedLife <= 0.1) return "status_seeker";
  if (risky >= 0.35) return "strategic_risk_taker";
  if (declinedLife >= 0.5 && built >= 0.4) return "cautious_guardian";
  if (built >= 0.6) return "steady_saver";
  return null;
}

// Applies a revised archetype without disturbing the run: the coach voice and
// characteristic-gap reference change, the financial state does not.
function applyInferredArchetype(slug) {
  if (typeof track === "function") track("archetype_inferred", { inferred: slug, current: currentPersona });
  if (!slug || slug === currentPersona) return;
  const prev = currentPersonaMeta();
  if (typeof track === "function") track("archetype_reassigned", { from: currentPersona, to: slug });
  currentPersona = slug;
  savePersona(slug);
  const meta = currentPersonaMeta();
  if (!meta) return;

  document.querySelectorAll("#persona-chips .chip").forEach(c => {
    const active = c.dataset.slug === slug;
    c.classList.toggle("active", active);
    c.setAttribute("aria-pressed", String(active));
  });

  // Told plainly, and framed as revisable — never as a verdict delivered.
  toast(`Your coach has shifted to ${meta.name}, based on how you've been deciding.`, {
    tone: "neutral",
    duration: 6000,
    action: { label: "Why?", onClick: () => explainInference(prev, meta) },
  });
}

function explainInference(prev, next) {
  const g = (typeof ARCHETYPE_GAPS !== "undefined" && ARCHETYPE_GAPS[next.slug]) || null;
  toast(
    g ? `Your choices look less like ${prev ? prev.name : "the starting fit"} and more like ${next.name}. Watch for: ${g.gap.toLowerCase()}.`
      : `Your recent choices fit ${next.name} more closely.`,
    { tone: "neutral", duration: 8000 }
  );
}

// Response slot for the ASK level. Naming the pattern here is prompted
// recognition (C1); naming it unprompted elsewhere would be C2.
function openScaffoldResponse(principleKey, li) {
  const host = li.querySelector(".scaffold-ask");
  if (!host) return;
  host.innerHTML = `
    <textarea class="probe-text scaffold-text" rows="2"
              placeholder="What did you notice?"></textarea>
    <div class="probe-actions">
      <button class="btn btn-primary scaffold-save" type="button">Save</button>
      <button class="probe-skip scaffold-skip" type="button">Skip</button>
    </div>`;
  const ta = host.querySelector(".scaffold-text");
  ta.focus();
  host.querySelector(".scaffold-save").addEventListener("click", () => {
    const text = ta.value.trim();
    if (text) {
      const named = typeof principleNamed === "function" && principleNamed(text, principleKey);
      if (typeof track === "function") {
        track("reflection_written", {
          principle: principleKey, text: text.slice(0, 600),
          named_principle: named, c_level: named ? "C1" : "C0", source: "scaffold_ask",
        });
      }
      if (principleKey && typeof updateIDM === "function") {
        updateIDM(principleKey, { correct: null, cLevel: named ? "C1" : "C0",
                                  surface: null, decisionIndex: decisionCount });
      }
      host.innerHTML = `<p class="scaffold-saved">Noted.</p>`;
    } else {
      host.remove();
    }
  });
  host.querySelector(".scaffold-skip").addEventListener("click", () => host.remove());
}

// The run's focus, if the chosen situation has one. Baseline is captured
// when the numbers are seeded (see selectPersona) so the delta is always
// "since this run started", not since some earlier session.
let objectiveBaseline = null;

function currentObjective() {
  if (typeof getSavedSituation !== "function" || typeof getSituationObjective !== "function") return null;
  const id = getSavedSituation();
  return id ? getSituationObjective(id) : null;
}

function resetObjectiveBaseline() {
  const obj = currentObjective();
  objectiveBaseline = obj && state ? (state[obj.metric] ?? null) : null;
}

// Reports the movement and nothing else — deliberately no "you did it" or
// "you failed". The objective frames the run; it does not grade it.
function renderObjectiveBar() {
  const bar = document.getElementById("objective-bar");
  if (!bar) return;
  const obj = currentObjective();
  if (!obj || !state || objectiveBaseline === null) { bar.hidden = true; return; }

  bar.hidden = false;
  document.getElementById("objective-label").textContent = obj.label;

  const now = state[obj.metric] ?? 0;
  const change = now - objectiveBaseline;
  const metricName = (typeof OBJECTIVE_METRIC_LABEL !== "undefined" && OBJECTIVE_METRIC_LABEL[obj.metric]) || obj.metric;
  document.getElementById("objective-metric").textContent = `${metricName}: ${fmt(objectiveBaseline)} → ${fmt(now)}`;

  const deltaEl = document.getElementById("objective-delta");
  if (!change) {
    deltaEl.textContent = decisionCount ? "no change yet" : "";
    deltaEl.className = "objective-delta";
    return;
  }
  const movingToward = obj.direction === "down" ? change < 0 : change > 0;
  deltaEl.textContent = `${change > 0 ? "+" : "−"}${fmt(Math.abs(change)).replace("$", "$")}`;
  deltaEl.className = `objective-delta ${movingToward ? "is-toward" : "is-away"}`;
}

function renderRoundBar() {
  const bar = document.getElementById("round-bar");
  if (!bar) return;
  if (decisionCount === 0) { bar.hidden = true; return; }
  bar.hidden = false;
  const rp = roundProgress(decisionCount);
  const shown = rp.complete ? rp.total : rp.done;
  document.getElementById("round-label").textContent = `Round ${rp.complete ? rp.round - 1 : rp.round}`;
  document.getElementById("round-count").textContent = `${shown} of ${rp.total}`;
  const path = document.getElementById("round-path");
  if (path) {
    path.innerHTML = Array.from({ length: rp.total }, (_, i) => {
      const done = i < shown;
      const current = i === shown && !rp.complete;
      return `<span class="round-node${done ? " is-done" : ""}${current ? " is-current" : ""}"></span>`;
    }).join("");
  }
}

// Keeps the collapsed drawer informative so closing it costs nothing.
function updateDrawerHint() {
  const hint = document.getElementById("drawer-hint");
  if (!hint || !state) return;
  hint.textContent = `${fmt(state.savings)} saved · ${fmt(state.debt)} owed`;
}

// The round's authored outcome lines, read back as one paragraph (see
// buildRoundNarrative in session.js), is the one piece of the recap that's
// genuinely new writing rather than a stats readout — so it's the paid
// part, same $5/mo gate as chat/Pro/MRI. Free users get an opening-line
// teaser, not nothing, so the value is felt before the ask.
function recapNarrativeHtml(narrative) {
  if (!narrative) return "";
  if (subscriptionActive) {
    return `
      <div class="recap-narrative">
        <span class="recap-takeaway-label">Your story, written out</span>
        <p class="recap-narrative-text">${esc(narrative)}</p>
      </div>`;
  }
  const teaser = narrative.split(" ").slice(0, 14).join(" ");
  return `
    <div class="recap-narrative recap-narrative-locked">
      <span class="recap-takeaway-label">Your story, written out</span>
      <p class="recap-narrative-text recap-narrative-fade">${esc(teaser)}&hellip;</p>
      <div class="recap-narrative-unlock">
        <p class="recap-narrative-unlock-copy">This round, told as what actually happened.</p>
        <button class="btn btn-primary" id="recap-narrative-unlock-btn" type="button">Unlock — $5/mo</button>
        <p class="recap-narrative-unlock-status" id="recap-narrative-status"></p>
      </div>
    </div>`;
}

async function startRecapCheckout() {
  const btn = document.getElementById("recap-narrative-unlock-btn");
  const status = document.getElementById("recap-narrative-status");
  if (!btn || !status) return;
  btn.disabled = true;
  status.textContent = "Starting checkout…";
  try {
    const res = await fetch(`${API_BASE_URL}/api/billing/create-checkout-session`, { method: "POST", credentials: "include" });
    if (res.status === 401) {
      status.textContent = "Sign in first, then come back to subscribe.";
      btn.disabled = false;
      return;
    }
    if (res.status === 503) {
      status.textContent = "Subscriptions aren't set up yet on this deployment.";
      btn.disabled = false;
      return;
    }
    if (!res.ok) throw new Error("checkout failed");
    const data = await res.json();
    window.location.href = data.url;
  } catch (e) {
    status.textContent = "Something went wrong — try again in a moment.";
    btn.disabled = false;
  }
}

function showRoundRecap(recap) {
  let overlay = document.getElementById("recap-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "quiz-overlay";
    overlay.id = "recap-overlay";
    document.body.appendChild(overlay);
    overlay.addEventListener("click", e => { if (e.target === overlay) closeRecap(); });
  }
  overlay.innerHTML = `
    <div class="quiz-modal recap-modal tone-${esc(recap.tone)}" role="dialog"
         aria-modal="true" aria-labelledby="recap-title">
      <p class="recap-eyebrow">Round ${recap.roundNumber} complete</p>
      <h3 id="recap-title" class="recap-headline">${esc(recap.headline)}</h3>
      <p class="recap-facts">${esc(recap.factLine)}</p>
      ${recapNarrativeHtml(recap.narrative)}
      <div class="recap-takeaway">
        <span class="recap-takeaway-label">Worth carrying forward</span>
        <p>${esc(recap.takeaway)}</p>
      </div>
      ${recap.beliefsTouched && recap.beliefsTouched.length ? `
      <div class="recap-beliefs">
        <span class="recap-takeaway-label">Money beliefs this round touched on</span>
        <ul class="recap-beliefs-list">${recap.beliefsTouched.map(b => `<li>${esc(b.label)}</li>`).join("")}</ul>
        <a class="linkish" href="model.html#calibration" style="font-size:12.5px;">See what these mean &rarr;</a>
      </div>` : ""}
      <div class="recap-actions">
        <button class="btn btn-primary" id="recap-continue" type="button">Keep going</button>
        <a class="btn btn-secondary" href="chat.html">Talk it through</a>
      </div>
      <button class="recap-dismiss" id="recap-close" type="button">Close</button>
    </div>`;
  document.getElementById("recap-narrative-unlock-btn")?.addEventListener("click", startRecapCheckout);
  recapOpener = document.activeElement;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  const cont = document.getElementById("recap-continue");
  cont.focus();
  cont.addEventListener("click", closeRecap);
  document.getElementById("recap-close").addEventListener("click", closeRecap);
  document.addEventListener("keydown", recapKeys);
}

let recapOpener = null;
let pendingStudyCompletion = false;

function recapKeys(e) {
  if (e.key === "Escape") { closeRecap(); return; }
  if (e.key !== "Tab") return;
  const modal = document.querySelector(".recap-modal");
  if (!modal) return;
  const focusable = modal.querySelectorAll("button, a[href]");
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
}

function closeRecap() {
  const o = document.getElementById("recap-overlay");
  if (o) o.classList.remove("open");
  document.body.style.overflow = "";
  document.removeEventListener("keydown", recapKeys);
  // Return focus where it was, falling back to the next decision.
  if (recapOpener && document.contains(recapOpener)) recapOpener.focus();
  else document.querySelector(".choice-btn")?.focus();

  if (pendingStudyCompletion) {
    pendingStudyCompletion = false;
    if (typeof showStudyCompletion === "function") showStudyCompletion();
  }
}

// Fires once per page load, the first time decisionLog crosses
// observePattern's own "enough to say something real" threshold (3 — see
// observations.js). Not derived from read.tone: "neutral" is ALSO the tone
// of a genuine post-3-decisions read ("Mixed so far"), not just the
// pre-3-decisions placeholder, so tone can't tell early from real apart.
let patternDrawerAutoOpened = false;

function renderPatternPanel() {
  const panel = document.getElementById("pattern-panel");
  if (!panel) return;
  if (typeof featureEnabled === "function" && !featureEnabled("observations")) {
    panel.hidden = true;
    return;
  }
  const read = observePattern(decisionLog, zoneHistory);
  if (!read) { panel.hidden = true; return; }
  panel.hidden = false;
  panel.className = `pattern-panel tone-${read.tone}`;
  panel.innerHTML = `
    <p class="pattern-headline">${esc(read.headline)}</p>
    <p class="pattern-body">${esc(read.body)}</p>
  `;

  // This panel lives inside the collapsed "full breakdown" drawer, so a
  // first-time visitor has no reason to ever open it — meaning the single
  // most differentiating thing this product does (naming a real behavioral
  // pattern, not just moving numbers) was easy to miss entirely. Open the
  // drawer for them, once, exactly when that first real read appears.
  if (decisionLog.length >= 3 && !patternDrawerAutoOpened) {
    patternDrawerAutoOpened = true;
    const drawer = document.getElementById("detail-drawer");
    if (drawer && !drawer.open) {
      drawer.open = true;
      panel.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof toast === "function") {
        toast("Your coach just noticed something — see below.", { tone: "good", duration: 3200 });
      }
    }
  }
}

// Kept as an alias so existing call sites stay valid.
function updateHomeostasisPanel() { renderPatternPanel(); }

function statusFor(value, good, watch) {
  // value already oriented so higher = better
  if (value >= good) return "good";
  if (value >= watch) return "watch";
  return "bad";
}

// Animates a metric's displayed number from its previous value to the
// new one, and briefly outlines the card so the change is noticeable
// without needing to re-read every number after each decision.
function animateMetric(id, newValue) {
  const el = document.getElementById(id);
  const from = parseCurrency(el.textContent);
  const card = el.closest(".metric-card");
  const start = performance.now();
  const delta = Math.abs(newValue - from);
  // Longer for bigger swings (capped) so a multi-thousand-dollar jump
  // doesn't blur past in the same 400ms as a $50 one — a fixed short
  // duration meant a large change ticked through dozens of unrelated
  // intermediate values too fast to read as anything but noise.
  const duration = Math.min(900, Math.max(400, delta / 8));
  // Round intermediate values to a coarser grain than the final number,
  // so what's on screen mid-count looks like plausible round amounts
  // instead of jittery exact-dollar digits changing every frame.
  const grain = delta > 2000 ? 50 : delta > 200 ? 10 : 1;
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const raw = from + (newValue - from) * eased;
    el.textContent = fmt(t < 1 ? Math.round(raw / grain) * grain : newValue);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  if (card && from !== newValue) {
    card.classList.add("pulse");
    setTimeout(() => card.classList.remove("pulse"), 500);
  }
}

function parseCurrency(text) {
  const n = Number(String(text).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function updateMetrics() {
  animateMetric("m-income", state.income);
  animateMetric("m-expenses", state.expenses);
  animateMetric("m-savings", state.savings);
  animateMetric("m-investments", state.investments);
  animateMetric("m-debt", state.debt);
  animateMetric("m-net-worth", netWorth(state));

  const emergencyMonths = state.expenses > 0 ? state.savings / state.expenses : 0;
  const monthlyDebtPayment = state.debt * 0.03;
  const dtiPct = state.income > 0 ? (monthlyDebtPayment / state.income) * 100 : 0;

  const emStatus = statusFor(emergencyMonths, 3, 1);
  const dtiStatus = statusFor(100 - dtiPct, 70, 64); // invert: lower dti = better

  setRatioPill("ratio-emergency", `${emergencyMonths.toFixed(1)} months`, Math.min(100, (emergencyMonths / 6) * 100), emStatus);
  setRatioPill("ratio-dti", `${dtiPct.toFixed(0)}%`, Math.min(100, dtiPct), dtiStatus);

  updateStatStrip(netWorth(state), emergencyMonths, emStatus, dtiPct, dtiStatus);
  renderZoneStatusLine();
}

// The always-visible "what did that choice just do" strip under the
// scenario card. Each tile shows its current value plus a delta against
// whatever it displayed before this call — reads directly off the DOM
// (same trick as animateMetric/parseCurrency) rather than tracking extra
// state. resetStatStrip() clears all three back to "—" first whenever a
// persona is (re)selected, so switching personas never shows a delta
// between one person's ending numbers and a different person's starting
// ones — a delta here always means "your last decision," never "you
// picked someone else."
function updateStatStrip(netWorthVal, emergencyMonths, emStatus, dtiPct, dtiStatus) {
  renderStatTile("stat-networth", netWorthVal, fmt(netWorthVal), d => `${fmt(Math.abs(d))}`, "neutral", 0.5);
  renderStatTile("stat-emergency", emergencyMonths, `${emergencyMonths.toFixed(1)} mo`, d => `${Math.abs(d).toFixed(1)} mo`, emStatus, 0.05);
  renderStatTile("stat-dti", dtiPct, `${dtiPct.toFixed(0)}%`, d => `${Math.abs(d).toFixed(0)}%`, dtiStatus, 0.5);
}

// minDelta matches each tile's display precision (whole dollars, 1
// decimal place, whole percent) — otherwise a real but sub-rounding
// change (e.g. 2.3% -> 2.1%, both shown as "2%") produced a confusing
// "▼ 0%" delta instead of no delta at all.
function renderStatTile(prefix, rawValue, displayText, formatDelta, status, minDelta) {
  const tile = document.getElementById(prefix);
  const valueEl = document.getElementById(`${prefix}-value`);
  const deltaEl = document.getElementById(`${prefix}-delta`);
  if (!tile || !valueEl || !deltaEl) return;

  const prevText = valueEl.textContent;
  const hadPrev = prevText !== "—";
  const prevValue = hadPrev ? parseCurrency(prevText) : rawValue;
  const diff = hadPrev ? rawValue - prevValue : 0;

  // Count to the new figure rather than snapping to it. A cost that appears
  // instantly reads as a number changing; one that moves reads as something
  // being spent, which is the entire point of showing it.
  if (hadPrev && Math.abs(diff) >= minDelta && typeof animateNumber === "function") {
    const formatFor = prefix === "stat-networth" ? (v => fmt(Math.round(v)))
      : prefix === "stat-emergency" ? (v => `${v.toFixed(1)} mo`)
      : (v => `${Math.round(v)}%`);
    animateNumber(valueEl, prevValue, rawValue, formatFor);
    if (typeof flashChanged === "function") flashChanged(prefix, diff);
  } else {
    valueEl.textContent = displayText;
  }
  tile.className = `stat-tile status-${status}`;

  if (!hadPrev || Math.abs(diff) < minDelta) {
    deltaEl.hidden = true;
  } else {
    const up = diff > 0;
    deltaEl.hidden = false;
    deltaEl.className = `stat-tile-delta ${up ? "stat-delta-up" : "stat-delta-down"}`;
    deltaEl.textContent = `${up ? "▲" : "▼"} ${formatDelta(diff)}`;
  }
  if (hadPrev && prevText !== displayText) {
    tile.classList.add("pulse");
    setTimeout(() => tile.classList.remove("pulse"), 500);
  }
}

function resetStatStrip() {
  ["stat-networth", "stat-emergency", "stat-dti"].forEach(prefix => {
    const valueEl = document.getElementById(`${prefix}-value`);
    const deltaEl = document.getElementById(`${prefix}-delta`);
    const tile = document.getElementById(prefix);
    if (valueEl) valueEl.textContent = "—";
    if (deltaEl) deltaEl.hidden = true;
    if (tile) tile.className = "stat-tile";
  });
}

// A plain-language read of where the chart's shaded band actually puts you
// right now — the band alone asks the person to interpret a shape; this
// just says it. Separate from renderPatternPanel(), which only speaks once
// a pattern across several decisions exists.
function renderZoneStatusLine() {
  const el = document.getElementById("zone-status-line");
  if (!el || !observedTrack.length) return;
  const zone = zoneStatus(observedTrack[observedTrack.length - 1]);
  const text = zone === "homeostasis" ? "Right now, you're in a comfortable range."
    : zone === "breakdown" ? "Right now, you're stretched thin — under-provisioned."
    : "Right now, you're over-protecting — provisioning at the cost of living.";
  el.textContent = text;
  el.hidden = false;
  el.className = `zone-status-line zone-${zone}`;
}

function setRatioPill(id, label, fillPct, status) {
  const pill = document.getElementById(id);
  pill.className = `ratio-pill status-${status}`;
  pill.querySelector(".ratio-value").textContent = label;
  pill.querySelector(".ratio-fill").style.width = `${Math.max(4, fillPct)}%`;
}

function netWorth(finance) {
  return (finance.savings || 0) + (finance.investments || 0) - (finance.debt || 0);
}

// What a choice WOULD have done to net worth, without applying it. Used for
// the Financial MRI's counterfactual: the difference between the option
// someone predicted they'd take and the one they actually took. Mirrors
// applyChoice's arithmetic exactly, clamping included, so the comparison is
// against the same numbers the sandbox would really have produced.
function netWorthDeltaFor(choiceObj, baseState, mult) {
  const projected = { ...baseState };
  Object.entries((choiceObj && choiceObj.delta) || {}).forEach(([key, val]) => {
    const scaled = Math.round(val * mult);
    projected[key] = Math.max(0, (projected[key] || 0) + scaled);
  });
  return netWorth(projected) - netWorth(baseState);
}

function drawNetWorthChart() {
  const canvas = document.getElementById("networth-chart");
  if (!canvas || !netWorthTrack.length) return;
  const width = canvas.clientWidth || 820, height = 150, dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr; canvas.height = height * dpr; canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
  const values = netWorthTrack, low = Math.min(...values), spread = Math.max(1, Math.max(...values) - low);
  const pad = { top: 20, right: 18, bottom: 26, left: 18 }, plotW = width - pad.left - pad.right, plotH = height - pad.top - pad.bottom;
  const xFor = i => pad.left + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW);
  const yFor = value => pad.top + plotH - ((value - low) / spread) * plotH;
  const css = getComputedStyle(document.body), teal = css.getPropertyValue("--teal").trim() || "#0B4A44", slate = css.getPropertyValue("--slate").trim() || "#5B5E66", line = css.getPropertyValue("--line").trim() || "rgba(18,25,46,.14)";
  ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(pad.left, height - pad.bottom + .5); ctx.lineTo(width - pad.right, height - pad.bottom + .5); ctx.stroke();
  ctx.strokeStyle = teal; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.beginPath(); values.forEach((value, i) => i ? ctx.lineTo(xFor(i), yFor(value)) : ctx.moveTo(xFor(i), yFor(value))); ctx.stroke();
  ctx.fillStyle = teal; ctx.beginPath(); ctx.arc(xFor(values.length - 1), yFor(values[values.length - 1]), 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = slate; ctx.font = "600 12px IBM Plex Mono, monospace"; ctx.fillText(`Start ${fmt(values[0])}`, pad.left, height - 7);
  const end = `Now ${fmt(values[values.length - 1])}`; ctx.fillText(end, Math.max(pad.left, width - pad.right - ctx.measureText(end).width), height - 7);
  canvas.setAttribute("aria-label", `Illustrative net worth moved from ${fmt(values[0])} to ${fmt(values[values.length - 1])} over ${Math.max(0, values.length - 1)} decisions.`);
}

function drawChart() {
  renderHomeostasisChart({
    observed: observedTrack,
    archetype: archetypeTrack,
    recalibrated: recalibratedTrack,
    triggers,
  });
}

// The numbers drawer used to render everything at once (metrics, chart,
// net worth, change log, goal diary) in one long stacked scroll. Splitting
// into tabs, same show/hide pattern as model-page.js's showTab().
const DRAWER_TABS = ["numbers", "chart", "history"];
function showDrawerTab(name) {
  DRAWER_TABS.forEach(t => {
    const panel = document.getElementById(`drawer-tab-${t}`);
    const btn = document.getElementById(`drawer-tabbtn-${t}`);
    if (panel) panel.hidden = t !== name;
    if (btn) btn.classList.toggle("active", t === name);
  });
  if (name === "chart") {
    // Canvas clientWidth reads as 0 while its tab panel is hidden, so the
    // chart was blank the first time someone switched to this tab — redraw
    // now that it's actually visible.
    drawChart();
    drawNetWorthChart();
  }
}
function initDrawerTabs() {
  DRAWER_TABS.forEach(t => {
    const btn = document.getElementById(`drawer-tabbtn-${t}`);
    if (btn) btn.addEventListener("click", () => showDrawerTab(t));
  });
}

// The same "living twin" companion shown on progress.html — surfaced here
// too since the sandbox, not the trends page, is where people actually
// spend their time. Lives in the History tab next to the change log: it's
// about trajectory across sessions, not today's decision.
async function renderDashboardCompanion() {
  const slot = document.getElementById("companion-slot");
  if (!slot || typeof computeCompanionState !== "function") return;
  const saved = typeof getProfile === "function" ? getProfile() : null;
  if (!saved || !saved.profile) {
    slot.innerHTML = `<p class="scenario-empty-body">Take the quiz to see your companion here.</p>`;
    return;
  }
  const history = typeof getCapabilityHistory === "function" ? getCapabilityHistory() : [];
  const primary = PERSONAS.find(p => p.slug === saved.archetype);

  function companionHtml(state) {
    const portrait = (primary && typeof archetypePortraitSvg === "function")
      ? archetypePortraitSvg(primary.slug, primary.group) : "";
    return `
      <p class="chart-title">Your companion</p>
      <div class="companion-card companion-glow-${esc(state.glow)}">
        <div class="companion-portrait-wrap"><div class="companion-portrait">${portrait}</div></div>
        <div class="companion-copy">
          <span class="companion-badge companion-badge-${esc(state.glow)}">${esc(state.badge)}</span>
          <p class="companion-headline">${esc(state.headline)}</p>
          <p class="companion-detail">${esc(state.detail)}</p>
        </div>
      </div>`;
  }

  slot.innerHTML = companionHtml(computeCompanionState({ history, currentArchetype: saved.archetype }));
  if (typeof fetchAxisConsistency === "function") {
    const byAxis = await fetchAxisConsistency();
    slot.innerHTML = companionHtml(computeCompanionState({
      history, axisConsistency: byAxis, currentArchetype: saved.archetype,
    }));
  }
}

// Cursor-follow highlight for the sandbox's ledger-grid background (see
// .sandbox-grid-bg in styles.css) — only listens while the pointer is
// actually over the page, and skips entirely on touch devices where
// there's no persistent hover to drive it.
function initGridGlow() {
  const el = document.getElementById("main");
  if (!el || !el.classList.contains("sandbox-grid-bg")) return;
  if (window.matchMedia && window.matchMedia("(pointer:coarse)").matches) return;
  el.addEventListener("mousemove", e => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--gx", `${e.clientX - r.left}px`);
    el.style.setProperty("--gy", `${e.clientY - r.top}px`);
  }, { passive: true });
}

// The drawer's content used to just snap into view the instant <details>
// opened — a brief fade+rise on the content itself gives the reveal a
// bridge instead of a flicker. Restarts the animation on every open by
// removing then re-adding the class (forcing reflow between the two).
function initDrawerReveal() {
  const drawer = document.getElementById("detail-drawer");
  const content = drawer && drawer.querySelector(".wellbeing");
  if (!drawer || !content) return;
  drawer.addEventListener("toggle", () => {
    if (!drawer.open) return;
    content.classList.remove("is-revealing");
    void content.offsetWidth;
    content.classList.add("is-revealing");
  });
}

renderPersonaChips();
renderPredictionBanner();
renderDifficultyChips();
initSettingsModal();
renderDashSetupSummary();
initHomeostasisChart();
initCoachPanel();
initDrawerTabs();
initGridGlow();
initDrawerReveal();
renderDashboardCompanion();
if (typeof syncIDMFromServer === "function") syncIDMFromServer();
if (typeof runAchievementCheck === "function") {
  runAchievementCheck((newly) => {
    if (newly.length && typeof toast === "function") {
      toast(`Unlocked: ${newly.map(a => a.title).join(", ")}`, { tone: "good", duration: 4500 });
    }
  });
}

// Keyboard control. Numbers pick a choice, R rolls a new scenario, D toggles
// the numbers drawer. Registered through the shared layer so "?" lists them.
function pickByIndex(i) {
  const btns = document.querySelectorAll(".choice-btn");
  if (btns[i]) {
    btns[i].classList.add("choice-pressed");
    setTimeout(() => btns[i].classList.remove("choice-pressed"), 160);
    btns[i].click();
  }
}
if (typeof registerShortcut === "function") {
  registerShortcut("1", "Choose the first option", () => pickByIndex(0));
  registerShortcut("2", "Choose the second option", () => pickByIndex(1));
  registerShortcut("3", "Choose the third option", () => pickByIndex(2));
  registerShortcut("4", "Choose the fourth option", () => pickByIndex(3));
  registerShortcut("r", "Roll a different scenario", () => document.getElementById("reroll-btn")?.click());
  registerShortcut("d", "Show or hide your numbers", () => {
    const dr = document.getElementById("detail-drawer");
    if (dr) dr.open = !dr.open;
  });
}

const restartBtn = document.getElementById("restart-btn");
if (restartBtn) restartBtn.addEventListener("click", restartPersona);

// Restores mid-session progress from a server-saved snapshot without
// re-fetching baselines or resetting the chart/log counters.
function resumeFromServer(saved) {
  currentPersona = saved.persona;
  difficulty = saved.difficulty || "medium";
  state = saved.state;
  decisionCount = saved.decisionCount || 0;
  financeCache[currentPersona] = financeCache[currentPersona] || { ...PERSONA_FINANCE[currentPersona] };
  savePersona(currentPersona);

  // Restore the PIPE trajectories. Saves made before trajectories were
  // persisted won't have them, so fall back to seeding from current state
  // rather than showing an empty chart.
  const archProfile = (typeof ARCHETYPE_PROFILES !== "undefined" && ARCHETYPE_PROFILES[currentPersona]) || null;
  const archScore = archProfile ? archetypeExpectedScore(archProfile, currentPersona) : HOMEOSTASIS.mid;
  const validTrack = t => Array.isArray(t) && t.length > 0 && t.every(v => typeof v === "number");

  if (validTrack(saved.observedTrack)) {
    observedTrack = saved.observedTrack;
    archetypeTrack = validTrack(saved.archetypeTrack)
      ? saved.archetypeTrack
      : observedTrack.map(() => archScore);
    recalibratedTrack = validTrack(saved.recalibratedTrack)
      ? saved.recalibratedTrack
      : observedTrack.map(v => recalibrate(v));
    triggers = Array.isArray(saved.triggers)
      ? saved.triggers.filter(t => t && typeof t.index === "number" && t.index < observedTrack.length)
      : [];
  } else {
    const startScore = stabilityScore(state);
    observedTrack = [startScore];
    archetypeTrack = [archScore];
    recalibratedTrack = [startScore];
    triggers = [];
  }
  netWorthTrack = validTrack(saved.netWorthTrack) ? saved.netWorthTrack : [netWorth(state)];
  decisionLog = Array.isArray(saved.decisionLog)
    ? saved.decisionLog.filter(entry => entry && typeof entry.choice === "string").slice(-5)
    : [];

  document.querySelectorAll("#persona-chips .chip").forEach(c => {
    const active = c.dataset.slug === currentPersona;
    c.classList.toggle("active", active);
    c.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("#difficulty-chips .chip").forEach(c => {
    const active = c.dataset.difficulty === difficulty;
    c.classList.toggle("active", active);
    c.setAttribute("aria-pressed", String(active));
  });
  document.getElementById("wellbeing-note").textContent =
    decisionCount > 0 ? `Welcome back — resumed after ${decisionCount} decision${decisionCount === 1 ? "" : "s"}.` : "Starting numbers loaded — try a scenario below.";
  updateMetrics();
  updateHomeostasisPanel();
  drawChart();
  drawNetWorthChart();
  renderDashSetupSummary();
  rollScenario();
}

(async function boot() {
  const serverState = await fetchSandboxState();
  if (serverState && serverState.persona && PERSONA_FINANCE[serverState.persona] && serverState.state) {
    resumeFromServer(serverState);
    return;
  }

  // A situation is the normal front door. It seeds the starting numbers and a
  // working coach voice, without ever announcing an archetype to the person.
  // An explicit ?persona= (from a quiz match with no matching situation) wins,
  // so a correctly-matched archetype is never silently replaced.
  const urlPersona = new URLSearchParams(location.search).get("persona");
  if (urlPersona && PERSONA_FINANCE[urlPersona]) {
    await selectPersona(urlPersona);
    return;
  }

  const situationId = typeof getSavedSituation === "function" ? getSavedSituation() : null;
  const situation = situationId ? getSituation(situationId) : null;
  if (situation) {
    saveSituation(situation.id);
    await selectPersona(situation.coach, { seedState: situation.state });
    return;
  }

  const saved = getSavedPersona();
  if (saved) {
    selectPersona(saved);
    return;
  }

  // No prior chip choice, but the quiz already told us who this person
  // matches closest — use that instead of making them pick cold out of
  // eleven options (still fully reversible via "Try someone else").
  const profile = typeof getProfile === "function" ? getProfile() : null;
  if (profile && profile.archetype && PERSONA_FINANCE[profile.archetype]) {
    await selectPersona(profile.archetype);
    return;
  }

  rollScenario();
})();
