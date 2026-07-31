// ============================================================================
// LEARN — financial education content, keyed to the six FBM axes.
//
// LEGAL/SAFETY DESIGN (read before editing):
//   - This file is 100% static, curated content. No LLM call ever touches it.
//   - Copy is general education about a PROFILE CATEGORY (like a personality-
//     test result), never advice about the user's actual accounts, balances,
//     or specific products. Do not add dollar amounts, named securities,
//     named providers, or anything that reads as "you should do X with your
//     money" rather than "here's how this pattern generally works".
//   - Every lesson links to an external educational body, not this app's own
//     opinion. The DISCLAIMER below must be rendered on every page/lesson
//     that shows this content, not just once.
//   - The exact disclaimer wording is a placeholder — get a compliance/legal
//     read before real (non-test) users see this, same caveat this repo
//     already carries for the safeguarding phone numbers in safeguarding.py.
// ============================================================================

const LEARN_DISCLAIMER =
  "General financial education, not personalized advice. Nothing here " +
  "knows your real accounts, income, or obligations — consult a licensed " +
  "professional for decisions specific to your situation.";

// One entry per FBM axis (see fbm.js AXES). `strength_blurb` shows when the
// axis reads as a strength (>=66); `growth_blurb` shows when it reads as a
// growth area (<=33). Lessons and resources are the same either way — a
// strength today is a growth area for someone else, so the content is
// shared, only the framing text differs.
const LEARN_CONTENT = {
  impulse_regulation: {
    strength_blurb: "You tend to pause before spending — a habit that compounds well over time.",
    growth_blurb: "Spending decisions can move fast when something catches your eye. That's common, and there are concrete ways to build in a pause.",
    balanced_blurb: "You don't always pause before spending, but you don't always rush either — it depends more on the specific decision than on a fixed habit either way.",
    lessons: [
      { title: "Why a pause works", minutes: 3, body: "A short, deliberate delay between wanting something and buying it — sometimes called a 'cooling-off' window — is one of the most studied tools for reducing regretted purchases. It works because the emotional pull behind an impulse buy fades measurably within a day or two, while a genuine need doesn't." },
      { title: "Making the pause automatic", minutes: 4, body: "Rather than relying on willpower in the moment, many people build the pause into their environment: a saved cart instead of an instant checkout, a shared account that needs a second look, or simply naming the rule ('anything over X waits 24 hours') in advance so there's no decision to make when tempted." },
    ],
    resources: [
      { name: "Khan Academy — Personal Finance", url: "https://www.khanacademy.org/college-careers-more/personal-finance", note: "Free, self-paced course covering budgeting and spending habits." },
      { name: "MoneyHelper — Managing your money", url: "https://www.moneyhelper.org.uk/en/everyday-money", note: "UK government-backed, plain-language guidance, applicable principles regardless of country." },
      { name: "Wikipedia — Impulse purchase", url: "https://en.wikipedia.org/wiki/Impulse_purchase", note: "Overview of the psychology behind unplanned purchases and what triggers them." },
    ],
    videos: [
      { name: "Two Cents (PBS) — How Social Media Keeps You Poor!", url: "https://www.youtube.com/watch?v=avj9aHiU13g", note: "9 min. How social platforms nudge impulse spending, and what to do about it." },
    ],
    research: "The theory page cites the same underlying research for this axis: Mischel & Ebbesen (1970); Thaler (1985).",
  },
  risk_disposition: {
    strength_blurb: "You're comfortable taking calculated financial risks when the upside is clear.",
    growth_blurb: "Uncertainty around money can feel uncomfortable — understanding your own risk comfort is the first step to working with it rather than against it.",
    balanced_blurb: "You're neither especially risk-averse nor especially risk-seeking — your comfort with uncertainty tends to shift with the specific decision rather than sitting at one fixed setting.",
    lessons: [
      { title: "Risk tolerance vs. risk capacity", minutes: 4, body: "These are two different things that are easy to mix up. Risk tolerance is how uncertainty feels to you emotionally. Risk capacity is what your actual financial situation can withstand without real harm. A useful exercise is to think through both separately before any decision involving uncertainty." },
      { title: "Diversification, in plain terms", minutes: 5, body: "The general principle — not spreading money so thin it does nothing, but not concentrating it so much that one bad outcome is catastrophic — shows up across every area of personal finance, from savings to larger decisions. It's a pattern worth recognizing, not a specific instruction to act on." },
      { title: "Why losses hurt more than gains help", minutes: 4, body: "Losing $100 feels worse than gaining $100 feels good — reliably, and by a wide margin. That asymmetry (loss aversion) is a huge part of why risk feels so lopsided: it's not that people are bad at math, it's that a loss and an equivalent gain are processed on different emotional scales entirely." },
    ],
    resources: [
      { name: "Khan Academy — Investment & risk", url: "https://www.khanacademy.org/economics-finance-domain/core-finance/investment-vehicles-tutorial", note: "Explains risk/return trade-offs conceptually, no specific products." },
      { name: "CFPB — Consumer Financial Protection Bureau", url: "https://www.consumerfinance.gov/consumer-tools/", note: "US government resource hub on financial decision-making basics." },
      { name: "SmartAsset — Risk Capacity vs. Risk Tolerance", url: "https://smartasset.com/investing/risk-capacity-vs-risk-tolerance", note: "How your emotional comfort with risk differs from what your finances can actually withstand." },
      { name: "Wikipedia — Loss aversion", url: "https://en.wikipedia.org/wiki/Loss_aversion", note: "The asymmetry between how losses and equivalent gains feel, and why it shapes risk-taking." },
    ],
    videos: [
      { name: "Two Cents (PBS) — How Risky Is The Stock Market?", url: "https://www.youtube.com/watch?v=249Gc7FDWRI", note: "Plain-language look at investment risk and diversification." },
    ],
    research: "The theory page cites the same underlying research for this axis: Kahneman & Tversky (1979); Pinjisakikool (2018).",
  },
  temporal_orientation: {
    strength_blurb: "You plan with the future clearly in view — a strong foundation for long-term goals.",
    growth_blurb: "It's easy for today's priorities to crowd out plans for later. Building a longer view is a skill, not a fixed trait.",
    balanced_blurb: "You weigh today and the future fairly evenly — neither one consistently wins out over the other.",
    lessons: [
      { title: "Present bias, named", minutes: 3, body: "Humans are wired to weight immediate outcomes more heavily than distant ones — economists call this present bias. Recognizing it by name makes it easier to notice in the moment, rather than experiencing it as a personal failing." },
      { title: "Making the future concrete", minutes: 4, body: "Vague future goals ('save for later') are easy to deprioritize. Specific, named goals with a rough timeline ('three months of expenses set aside by next spring') give the future version of a goal something concrete to compete with today's priorities." },
    ],
    resources: [
      { name: "Khan Academy — Saving & budgeting", url: "https://www.khanacademy.org/college-careers-more/personal-finance/pf-saving-and-budgeting", note: "Covers goal-setting and time horizons in budgeting." },
      { name: "Wikipedia — Present bias", url: "https://en.wikipedia.org/wiki/Present_bias", note: "The behavioral-economics concept behind why 'later' keeps losing to 'now'." },
      { name: "Wikipedia — Hyperbolic discounting", url: "https://en.wikipedia.org/wiki/Hyperbolic_discounting", note: "Why a reward loses value faster the sooner it's compared to right now, rather than steadily over time." },
    ],
    videos: [
      { name: "Two Cents (PBS) — The Cost of Procrastinating On Saving For Retirement", url: "https://www.youtube.com/watch?v=UptMbN5eidc", note: "Why delaying future-focused saving costs more than it looks like." },
      { name: "How Your Brain Sabotages Your Savings (Without You Even Realizing)", url: "https://www.youtube.com/watch?v=-M1D75iCY9U", note: "A closer look at the cognitive biases working against future-focused saving." },
    ],
    research: "The theory page cites the same underlying research for this axis: Strathman et al. (1994).",
  },
  financial_attentiveness: {
    strength_blurb: "You keep a close eye on your money — that visibility makes almost everything else easier.",
    growth_blurb: "Looking closely at money can feel uncomfortable, so it's common to avoid it. Small, low-stakes check-ins tend to work better than a single overwhelming review.",
    balanced_blurb: "You check in on your money sometimes and avoid it other times — somewhere between close tracking and looking away, depending on the moment.",
    lessons: [
      { title: "Why avoidance backfires", minutes: 3, body: "Financial avoidance is well-documented: not looking feels protective in the short term but tends to let small problems grow unnoticed. The discomfort of checking is usually much smaller than the discomfort people anticipate." },
      { title: "A five-minute check-in", minutes: 5, body: "Rather than a full review, many people start with a very small recurring habit — a fixed day, a few minutes, just glancing at balances and anything due soon. Consistency matters far more than depth, especially at the start." },
    ],
    resources: [
      { name: "MoneyHelper — Everyday money", url: "https://www.moneyhelper.org.uk/en/everyday-money", note: "Plain-language guidance on building money-checking habits." },
      { name: "Khan Academy — Personal Finance", url: "https://www.khanacademy.org/college-careers-more/personal-finance", note: "Free course with sections on tracking spending." },
      { name: "Wikipedia — Ostrich effect", url: "https://en.wikipedia.org/wiki/Ostrich_effect", note: "The bias behind avoiding your own bank balance or portfolio when things feel uncertain." },
    ],
    videos: [
      { name: "Two Cents (PBS) — 3 Steps to a Bulletproof Budget", url: "https://www.youtube.com/watch?v=2yWDKDm-ZD8", note: "A next-level budgeting check-in habit, explained simply." },
      { name: "Beware The Ostrich Effect When It Comes To Money", url: "https://www.youtube.com/watch?v=ENI-TlmsOww", note: "Why avoiding a look at your numbers tends to make things worse, not better." },
    ],
    research: "The theory page cites the same underlying research for this axis: Sicherman, Loewenstein, Seppi & Utkus (2016).",
  },
  financial_self_efficacy: {
    strength_blurb: "You generally feel in control of your financial decisions — that confidence is a real asset.",
    growth_blurb: "Feeling anxious or unsure about money decisions is extremely common, and confidence here is built through small wins, not innate talent.",
    balanced_blurb: "Your confidence with money decisions varies by situation — solid in some, shakier in others, rather than consistently one or the other.",
    lessons: [
      { title: "Self-efficacy is learned, not fixed", minutes: 3, body: "Financial confidence (sometimes called financial self-efficacy) reliably grows with small, successful experiences — not with reading more, and not with income. Each small decision handled well tends to build the next." },
      { title: "Starting smaller than feels necessary", minutes: 4, body: "A common trap is trying to fix everything at once, which usually stalls. Picking one small, contained decision to get right first — and noticing that it went fine — tends to build more lasting confidence than a big overhaul." },
      { title: "Where confidence actually comes from", minutes: 4, body: "The psychologist who coined 'self-efficacy' identified four real sources of it, in order of strength: doing the thing yourself and succeeding, watching someone similar to you do it, being told by someone credible that you can, and how calm (versus anxious) your body feels going in. Reading about money touches none of these directly — which is why it builds less confidence than one small handled decision does." },
    ],
    resources: [
      { name: "Khan Academy — Personal Finance", url: "https://www.khanacademy.org/college-careers-more/personal-finance", note: "Structured, bite-sized lessons — good starting point for building familiarity." },
      { name: "CFPB — Consumer Financial Protection Bureau", url: "https://www.consumerfinance.gov/consumer-tools/", note: "Plain-language explainers on common financial decisions." },
      { name: "Wikipedia — Self-efficacy", url: "https://en.wikipedia.org/wiki/Self-efficacy", note: "Bandura's original framework and its four sources, applied here to money specifically." },
    ],
    videos: [
      { name: "Two Cents (PBS) — Do You Have a Money Disorder?", url: "https://www.youtube.com/watch?v=TYGSWpkloZk", note: "How money anxiety affects decision-making, and how confidence is rebuilt." },
      { name: "Tiny Habits to Build Your Financial Confidence", url: "https://www.youtube.com/watch?v=oyT0AX0Yx-Y", note: "Small, repeatable habits that build financial confidence over time." },
    ],
    research: "The theory page cites the same underlying research for this axis: Bandura (1977); Lown (2011).",
  },
  prosocial_orientation: {
    strength_blurb: "You put real weight on others' needs in your financial decisions — a value worth protecting deliberately.",
    growth_blurb: "Money decisions can feel entirely self-directed. There's no right amount to give or share, but it's worth being intentional about it either way.",
    balanced_blurb: "You weigh your own needs and others' fairly evenly — neither one consistently comes first.",
    lessons: [
      { title: "Intentional vs. reactive giving", minutes: 3, body: "Giving or helping others financially tends to feel most sustainable when it's planned rather than reactive — a rough amount decided in advance, rather than decided in the moment under social pressure. Neither more nor less giving is inherently 'better'; the research point is about intentionality." },
      { title: "Protecting your own floor", minutes: 4, body: "A useful general principle: deciding on a personal minimum — a line that stays protected regardless of others' requests — tends to make generosity more sustainable over time, rather than less generous overall." },
    ],
    resources: [
      { name: "MoneyHelper — Everyday money", url: "https://www.moneyhelper.org.uk/en/everyday-money", note: "General guidance on balancing your own needs with helping others." },
      { name: "Wikipedia — Effective altruism", url: "https://en.wikipedia.org/wiki/Effective_altruism", note: "A framework for thinking systematically about how and how much to give." },
    ],
    videos: [
      { name: "Two Cents (PBS) — The Smart Person's Guide to Giving", url: "https://www.youtube.com/watch?v=FGMl5nBEXls", note: "Making charitable giving more intentional and effective." },
      { name: "Is Giving Part of Your Budget?", url: "https://www.youtube.com/watch?v=KL0gCA73vBI", note: "Why treating giving as a planned line item beats deciding in the moment." },
    ],
    research: "The theory page cites the same underlying research for this axis: Dunn, Aknin & Norton (2008); Andreoni (1990).",
  },
};

const LEARN_AXIS_ORDER = Object.keys(LEARN_CONTENT);

function learnStatusForAxis(key, value) {
  if (value >= 66) return "strength";
  if (value <= 33) return "growth";
  return "balanced";
}
