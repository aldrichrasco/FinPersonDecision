// "Who you're like" + money compatibility — the fun, shareable layer of the
// report, distinct from the archetype-gap/calibration sections which are
// meant to be taken seriously. Deliberately fictional characters, not real
// people: matching a real, named public figure to traits like "impulsive"
// or "anxious avoider" reads as a claim about how that actual person
// handles money, which isn't something we can back up or that's fair to
// assert about someone real. Well-known fictional characters get the same
// recognition value with none of that problem — same reasoning classroom
// and archetype-portraits.js already apply to the eleven archetypes
// themselves not being real people.
const ARCHETYPE_CHARACTERS = {
  steady_saver: {
    characters: [
      { name: "Marge Simpson", why: "keeps the household running on a careful, unglamorous budget while everyone around her improvises" },
      { name: "Ron Swanson", why: "distrusts debt, prizes self-reliance, and would rather have less and owe nothing" },
    ],
  },
  cautious_guardian: {
    characters: [
      { name: "Molly Weasley", why: "fiercely protective and always preparing for whatever could go wrong next" },
      { name: "Marlin", why: "(Finding Nemo) — overprotective to a fault, but every instinct comes from real care" },
    ],
  },
  conscious_spender: {
    characters: [
      { name: "Leslie Knope", why: "spends her effort and money where it lines up with what she actually believes in" },
      { name: "Atticus Finch", why: "modest and deliberate — spends according to principle, not appearance" },
    ],
  },
  ambitious_builder: {
    characters: [
      { name: "Hermione Granger", why: "invests in herself relentlessly, years ahead of when it visibly pays off" },
      { name: "Elle Woods", why: "builds toward a long arc that looks unlikely right up until it isn't" },
    ],
  },
  strategic_risk_taker: {
    characters: [
      { name: "Danny Ocean", why: "takes big swings, but only ones planned down to the last detail" },
      { name: "Tyrion Lannister", why: "reads the odds before acting — the risk is real, but it's never blind" },
    ],
  },
  overconfident_navigator: {
    characters: [
      { name: "Michael Scott", why: "supreme confidence that isn't always backed by what the numbers actually say" },
      { name: "Buzz Lightyear", why: "genuinely believes in his own read of the situation, reality be damned" },
    ],
  },
  status_seeker: {
    characters: [
      { name: "Jay Gatsby", why: "spends to construct an image, and the image is the point" },
      { name: "Regina George", why: "spending as a way of maintaining exactly where she stands" },
    ],
  },
  impulsive_spender: {
    characters: [
      { name: "Buddy the Elf", why: "pure joy-driven impulse — the plan is whatever feels right this second" },
      { name: "Rachel Green", why: "(early seasons) — the famous shoe habit before the budgeting lessons kicked in" },
    ],
  },
  anxious_avoider: {
    characters: [
      { name: "Piglet", why: "means well, worries constantly, and would rather not look too closely" },
      { name: "Charlie Brown", why: "carries a small stack of financial dread everywhere without ever quite confronting it" },
    ],
  },
  passive_drifter: {
    characters: [
      { name: "The Dude", why: "(The Big Lebowski) — the defining portrait of no plan and going with whatever happens" },
      { name: "Forrest Gump", why: "(early on) — things mostly happen to him rather than being decided" },
    ],
  },
  purposeful_giver: {
    characters: [
      { name: "Robin Hood", why: "gives first, as a defining trait, and figures out the budget around it" },
      { name: "Uncle Ben", why: "leads with responsibility to others before anything else" },
    ],
  },
};

// Money-compatibility — genuinely useful, not just decorative: which
// archetype tends to balance this one out day-to-day, and which tends to
// create friction over the same decisions, with the actual mechanism why.
const ARCHETYPE_COMPATIBILITY = {
  steady_saver: {
    complements: { slug: "ambitious_builder", why: "your caution balances their appetite for upside — together you don't miss growth or blow through the buffer." },
    friction: { slug: "impulsive_spender", why: "every unplanned purchase reads as a threat to the plan you've both agreed to." },
  },
  cautious_guardian: {
    complements: { slug: "strategic_risk_taker", why: "they take the calculated swings you'd never initiate; you keep the downside actually covered." },
    friction: { slug: "overconfident_navigator", why: "their gut-call confidence is exactly what your risk-checking instincts exist to catch." },
  },
  conscious_spender: {
    complements: { slug: "purposeful_giver", why: "you both spend on purpose — you'll rarely disagree about whether something was 'worth it'." },
    friction: { slug: "status_seeker", why: "their spending is about how it looks; yours is about what it's for — that's a real values gap, not just a budget one." },
  },
  ambitious_builder: {
    complements: { slug: "steady_saver", why: "their floor is your ceiling's safety net — growth without someone minding the base." },
    friction: { slug: "passive_drifter", why: "you're optimizing five years out while they're not optimizing anything, which reads as indifference." },
  },
  strategic_risk_taker: {
    complements: { slug: "cautious_guardian", why: "someone actually tracking the downside is what makes your calculated bets stay calculated." },
    friction: { slug: "anxious_avoider", why: "your comfort with risk reads as recklessness to someone who'd rather not look at the number at all." },
  },
  overconfident_navigator: {
    complements: { slug: "cautious_guardian", why: "you need someone willing to say 'check the numbers first' and actually mean it." },
    friction: { slug: "strategic_risk_taker", why: "you both take risks, but only one of you is actually running the numbers first — that gap shows up eventually." },
  },
  status_seeker: {
    complements: { slug: "conscious_spender", why: "their values-first spending is a useful counterweight to spending for how it looks." },
    friction: { slug: "steady_saver", why: "what feels like a reasonable purchase to one of you looks like a threat to the plan to the other." },
  },
  impulsive_spender: {
    complements: { slug: "steady_saver", why: "their structure is the exact thing that turns your spontaneity into something sustainable." },
    friction: { slug: "cautious_guardian", why: "every unplanned purchase feels, to them, like a small emergency." },
  },
  anxious_avoider: {
    complements: { slug: "conscious_spender", why: "someone who looks closely without panic makes the numbers feel safe to look at, not scary." },
    friction: { slug: "strategic_risk_taker", why: "their appetite for risk is the exact thing your avoidance is trying to protect you from." },
  },
  passive_drifter: {
    complements: { slug: "ambitious_builder", why: "borrowed direction is still direction — their planning fills a real gap for you." },
    friction: { slug: "anxious_avoider", why: "neither of you is actually watching the numbers, so nothing catches a problem before it's already one." },
  },
  purposeful_giver: {
    complements: { slug: "conscious_spender", why: "both of you spend on purpose — the purposes just point in slightly different directions, which is easy to reconcile." },
    friction: { slug: "status_seeker", why: "giving to others and spending to be seen doing well are pulling the same money toward different goals." },
  },
};
