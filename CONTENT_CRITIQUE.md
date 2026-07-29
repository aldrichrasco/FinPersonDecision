# FinPerson: A Critique of Content Depth and Theoretical Grounding

*An audit of where the app's educational content is strong, where it was thin, and what's still missing — written after a pass that added citations to the money-belief models, strengthened the three least-cited behavioral axes, and bridged the Learn and Theory pages.*

## Summary verdict

FinPerson's structural design is unusually disciplined for a solo project: eleven archetypes map cleanly onto five color-coded groups, six behavioral axes drive everything from the sandbox to the radar chart to the Learn page, and the Calibration tab's four-stage model (C0–C3) gives the whole product a coherent theory of what "improvement" even means. The scaffolding system that names money beliefs live during decisions, then deliberately *withdraws* that naming as a user's calibration improves, is genuinely sophisticated instructional design — more thought-out than most funded fintech apps manage.

The content sitting on top of that structure was uneven. Some of it (the Calibration tab, after earlier work) is cited like a literature review. Most of it — the sandbox's seven money beliefs, three of the six behavioral axes, and every Learn lesson — carried no scholarly grounding at all, just confident assertions. That's the core finding this paper documents, and the fixes below address the largest instances of it.

## What was thin, and what changed

**The seven money beliefs (`idm.js` `DECISION_MODELS`) had zero citations.** These are arguably the most load-bearing content in the app — every sandbox scenario probes one of them — and each was a one-sentence stance plus a one-sentence counter, with nothing behind either. Added a real citation to each:

| Belief | Citation added |
|---|---|
| I can catch up later | O'Donoghue & Rabin (1999) — present-biased preferences |
| Credit is free if I clear it | Prelec & Loewenstein (1998) — decoupling of cost and pain of paying |
| More saved is always better | Kivetz & Keinan (2006) — "hyperopia," regretting excessive self-denial |
| I'd notice if things got bad | Karlsson, Loewenstein & Seppi (2009) — the ostrich effect |
| This time is different | Reinhart & Rogoff (2009) |
| Others' needs come before my base | Andreoni (1990) — warm-glow giving |
| Not deciding is the safe option | Samuelson & Zeckhauser (1988) — status quo bias |

**Three of the six axes were citation-thin relative to the other three.** `risk_disposition` cited only Pinjisakikool (2018) — a comparatively niche paper for as central a construct as risk attitude. `financial_self_efficacy`'s blurb *named* Bandura without citing him. `prosocial_orientation` had one citation. Added Kahneman & Tversky (1979) to risk, Bandura (1977) to self-efficacy, and Andreoni (1990) to prosocial orientation — bringing all six axes to two citations each.

**The Learn page and the Theory page never referenced each other**, despite covering the same six axes. Learn taught the concept in plain language with links to Khan Academy and YouTube; Theory cited the actual research. A reader could go deep on either page and never learn the other existed. Added a one-line "the theory page cites the same underlying research for this axis" citation to the end of every Learn axis card, using the exact same citations now in `AXIS_RESEARCH`.

**`prosocial_orientation` had one resource link on Learn versus two to three for every other axis.** Added a second (Wikipedia's *Effective altruism* article) to bring it to parity.

## What's still missing (not fixed in this pass)

**`research.html` is a stub for the ~99% of users who aren't admins.** The non-admin view is a single sentence: "Research view is restricted." For signed-in admins it becomes a real, data-dense dashboard — but even there, it's numbers and labels with almost no explanatory prose.

**PIPE (Persuasion, Immersion, Personalisation, Evolution) is the app's own named theoretical engine and is essentially undocumented.** The research page's subtitle calls itself "an instrumented view of the PIPE regulator," and each tenet gets exactly one clause, no citation, no elaboration — anywhere in the app. Compare this to the C-level model or the six axes, both of which get full pages. If PIPE is meant to be a real conceptual pillar, it currently reads as a name-drop.

**`chat.html` has a literal dead-end stub**: `"Coaching not available in this deployment"` fires whenever no backend/API is configured, which is presumably the default state for most visitors trying the feature.

**The money-belief citations added in this pass are still one line each.** Compare to the Calibration tab, which pairs each citation with a full explanatory paragraph. The beliefs would benefit from the same treatment — a sentence or two on *why* the cited research applies, not just the citation itself.

**Learn lessons are uniformly two per axis regardless of how much the underlying concept can actually support.** "Diversification" and "building a five-minute check-in habit" get the identical two-lesson treatment despite very different depth ceilings. This wasn't touched in this pass and is the next clearest opportunity if more Learn content is wanted.

## Prioritized next steps, if continuing this thread

1. **Give the money beliefs the Calibration tab's treatment**: a real explanatory paragraph per belief, not just a citation tag.
2. **Write something for non-admin `research.html` visitors.** Even a plain-language summary of what the research program tracks and why would beat a one-sentence access wall.
3. **Either build out PIPE properly (its own section, real citations, tied concretely to features) or retire the term** if it's not meant to carry theoretical weight — right now it's the one named framework in the app with nothing behind it.
4. **Expand Learn lessons unevenly, on purpose** — give the axes/concepts with more genuine depth (risk, self-efficacy) a third lesson before adding volume everywhere uniformly.
