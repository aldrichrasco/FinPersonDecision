# Financial Homeostasis: A Design Theory for Behaviourally Adaptive Financial Capability Systems

**Working draft — all citations require verification before submission. Evaluation section describes work not yet undertaken and is written as a proposal, not a report.**

---

## Abstract

Financial education interventions have consistently underdelivered. A prominent meta-analysis found that interventions explain approximately 0.1% of variance in downstream financial behaviour, with effects decaying rapidly (Fernandes, Lynch & Netemeyer, 2014). We argue this failure is architectural rather than pedagogical: dominant designs treat financial difficulty as a knowledge deficit, when the literature characterises it as dispositional, situational, and self-regulatory. This paper develops and instantiates a design theory for financial capability systems that treats financial wellbeing as a *regulated* variable rather than a maximised one.

We make three contributions. First, we articulate **PIPE**, a four-tenet design theory (Persuasion, Immersion, Personalisation, Evolution) specifying how a digital artefact can support financial capability development through repeated consequential decision-making rather than instruction. Second, we introduce **financial homeostasis** as a kernel construct: the proposition that financial wellbeing occupies a bounded viable zone with two failure boundaries — *breakdown* (under-provisioning) and *distortion* (over-provisioning at the cost of living) — and that a wellbeing measure must therefore be **non-monotonic**. This distinguishes the construct from wealth-maximisation framings and yields a falsifiable design implication: an artefact operationalising it must be capable of identifying over-accumulation as dysregulation. Third, we present **FinPerson**, a working instantiation comprising a six-axis behavioural model, eleven behavioural archetypes with specified characteristic failure modes, a consequential decision sandbox, an adaptive scenario engine, and a persona-consistent conversational coach.

A central architectural principle emerges from the instantiation: the theory belongs in the engine, not the interface. We describe a translation layer that converts internal model state (scores, zones, thresholds, gaps) into observable behavioural statements, and argue that this separation is a design requirement rather than a presentational preference. We report formative artificial evaluation demonstrating internal consistency of the instantiated model, and propose a naturalistic evaluation design. We conclude with an extended discussion of safeguarding obligations, which we argue are constitutive of — not adjacent to — design in this domain.

**Keywords:** design science research, financial capability, financial wellbeing, behavioural finance, persuasive systems, homeostasis, adaptive learning, serious games

---

## 1. Introduction

### 1.1 The persistence of a failed model

Financial education is a large and growing enterprise. Governments mandate it in school curricula, employers fund it as a wellbeing benefit, and financial institutions distribute it as a public good and a marketing instrument. The theory of change is intuitive: people make poor financial decisions because they lack information; supply the information and the decisions improve.

The evidence for this theory is weak. Fernandes, Lynch and Netemeyer's (2014) meta-analysis of 168 papers found that financial literacy interventions accounted for roughly 0.1% of variance in the financial behaviours they targeted, with effects attenuating sharply within months. Interventions delivered further from the moment of decision performed worse than those delivered close to it. The authors concluded that the dominant "financial literacy" framing is substantially misspecified, and proposed "just-in-time" education as a partial remedy.

We take a stronger position. The problem is not only *when* information is delivered but *what* is assumed to be missing. A substantial behavioural literature indicates that financial difficulty frequently arises not from ignorance but from present bias (Laibson, 1997), loss aversion (Kahneman & Tversky, 1979), low self-efficacy (Lown, 2011), avoidance under threat, and the cognitive burden imposed by scarcity itself (Mullainathan & Shafir, 2013). People who overspend generally know they overspend. People who avoid opening their banking app usually know approximately what it contains. The gap is between knowing and doing — a self-regulatory gap, not an informational one.

If the deficit is regulatory, then an artefact addressing it must itself be regulatory in structure. It must observe behaviour, detect deviation from a viable state, and intervene in a manner responsive to *this* person's characteristic pattern. This is a fundamentally different design problem from content delivery, and it is the problem this paper addresses.

### 1.2 What is missing from existing designs

Digital financial capability tools cluster into three families, each with a characteristic limitation.

**Budgeting and tracking applications** provide accurate retrospection. They tell users what happened. They are largely silent on why, and they assume that visibility is sufficient motivation — an assumption the avoidance literature directly contradicts. For a user whose dominant pattern is not looking, a tool whose core loop is looking is poorly matched to the failure it addresses.

**Gamified savings applications** apply persuasive mechanics — streaks, points, badges, social comparison — to encourage a single target behaviour, usually saving. These can be effective for that behaviour. They are typically monotonic in design: more saved is better, without limit. They also import a motivational register that may be inappropriate to the domain. Streak mechanics applied to a person in acute financial distress risk compounding shame with each broken streak.

**Financial literacy platforms** deliver structured curricula. They inherit the limitations documented by Fernandes et al. directly.

A fourth family — behavioural profiling and "money personality" quizzes — is widespread commercially and thin theoretically. These typically terminate in a label with no subsequent adaptation: the profile is an output, not an input to anything.

What no family provides is an artefact that (a) models the individual's behavioural disposition, (b) observes their actual decision behaviour over time, (c) detects deviation from a viable state *in the direction that person is characteristically prone to*, and (d) adapts the experience accordingly. That is the artefact this paper specifies.

### 1.3 Contributions

We claim three contributions, at different levels of abstraction.

At the level of **design theory**, we articulate PIPE: four tenets specifying how an artefact can develop financial capability through repeated consequential decision-making. We identify *legibility* — the user's ability to perceive the causal link between action and consequence — as a precondition on which the other tenets depend, and argue that its absence is a primary failure mode in existing designs.

At the level of **kernel theory**, we introduce financial homeostasis. We argue that financial wellbeing is a regulated variable with two failure boundaries, that this implies non-monotonicity in any adequate measure, and that this proposition is falsifiable and design-consequential.

At the level of **artefact**, we present FinPerson, a working instantiation. We report its architecture in sufficient detail for replication, and we highlight one architectural principle we regard as generalisable beyond this domain: the separation of a theory-bearing engine from a theory-free interface, mediated by an explicit translation layer.

We also treat safeguarding as a first-class design concern, and argue this is not optional in a domain where the user population includes people in genuine crisis.

### 1.4 Structure

Section 2 reviews the relevant literatures. Section 3 sets out the research method. Section 4 formulates the problem and derives design objectives. Section 5 develops the PIPE design theory. Section 6 develops financial homeostasis. Section 7 describes the instantiation. Section 8 reports formative evaluation and proposes a naturalistic design. Section 9 discusses contributions and implications. Section 10 states limitations. Section 11 concludes.

---

## 2. Theoretical Background

### 2.1 From financial literacy to financial capability to financial wellbeing

The field's central construct has shifted twice, and each shift is instructive.

**Financial literacy** — knowledge of financial concepts — dominated early work and remains the most measured construct. Its appeal is measurability: knowledge admits of testing. Its weakness is the knowledge-behaviour gap documented above.

**Financial capability** emerged in the mid-2000s as an explicitly behavioural alternative. The influential UK formulation (Kempson, Collard & Moore, 2005; Atkinson, McKay, Kempson & Collard, 2006) identified four behavioural domains: *managing money* day to day, *planning ahead*, *choosing products*, and *staying informed*. Critically, these are behaviours rather than knowledge states. A person can be capable without being able to define compound interest, and knowledgeable while being incapable.

**Financial wellbeing** represents a further shift toward subjective and outcome-oriented framing. The Consumer Financial Protection Bureau (2015) defined it across four elements: control over day-to-day finances, capacity to absorb a financial shock, being on track to meet goals, and having the financial freedom to make choices that allow enjoyment of life. Brüggen et al. (2017) offered a conceptualisation and research agenda, and Netemeyer et al. (2018) developed measures distinguishing current money management stress from expected future financial security.

We note a feature of the CFPB formulation that is central to our argument and, in our reading, under-exploited: the fourth element — *freedom to make choices that allow enjoyment of life* — is not monotonic in accumulated wealth. A person who accumulates aggressively while foreclosing all present enjoyment satisfies elements one, two and three while failing element four. This is a definitional acknowledgement that financial wellbeing can fail from *above*, not only from below. We develop this into a formal design construct in Section 6.

### 2.2 Behavioural foundations

Six behavioural constructs recur in explanations of financial difficulty and inform our behavioural model.

**Present bias and hyperbolic discounting** (Laibson, 1997; O'Donoghue & Rabin, 1999) describe systematic over-weighting of immediate outcomes. This is the mechanism underlying impulsive expenditure and under-saving, and it is dispositional: individuals differ stably in discount steepness.

**Loss aversion** (Kahneman & Tversky, 1979) describes asymmetric sensitivity to losses relative to gains. In financial behaviour it manifests both as excessive caution (refusing beneficial risk) and as loss-chasing.

**Financial self-efficacy** (Lown, 2011, extending Bandura, 1977) captures belief in one's capacity to manage financial situations. It predicts behaviour partly independently of knowledge, and low self-efficacy is associated with avoidance.

**Financial avoidance** describes the tendency to disengage from financial information under threat. It is behaviourally distinctive because the coping response actively prevents corrective action, producing a self-reinforcing cycle.

**Mental accounting** (Thaler, 1985) describes the partitioning of money into non-fungible categories, which can support self-regulation or produce inconsistency.

**Prosocial financial orientation** — the allocation of resources to others — is comparatively under-theorised in capability research but behaviourally significant. Dunn, Aknin and Norton (2008) documented wellbeing benefits of prosocial spending. In the capability context, sustained giving beyond one's own viable base is a distinct failure mode, one not captured by any of the constructs above.

### 2.3 Persuasive technology and serious games

Fogg's (2003) persuasive technology framework and Oinas-Kukkonen and Harjumaa's (2009) Persuasive Systems Design model provide vocabulary for designing systems that shape behaviour. The PSD model's categories — primary task support, dialogue support, system credibility, social support — inform our design but do not by themselves specify *what* to persuade toward, which is precisely the question a homeostatic framing answers.

Deterding et al. (2011) distinguish gamification (game elements in non-game contexts) from serious games (full games with non-entertainment purposes). Our artefact sits closer to simulation than to either: it presents consequential decisions in a low-stakes environment, without competitive or reward mechanics.

This is a deliberate choice with an ethical basis. Extrinsic reward mechanics carry documented risks of undermining intrinsic motivation (Deci, Koestner & Ryan, 1999). In a domain where a proportion of users are experiencing genuine financial distress, streak-and-badge mechanics also risk producing shame on failure. We therefore adopt the *consequential simulation* rather than the *gamified reward* pattern.

### 2.4 Adaptive systems and learner modelling

Intelligent tutoring systems (Anderson et al., 1995; VanLehn, 2011) established that maintaining an explicit learner model and adapting instruction to it improves outcomes over fixed sequences. The canonical architecture separates domain model, learner model, and pedagogical model.

Our design adopts this separation with a substitution: the learner model is *behavioural-dispositional* rather than knowledge-based. Where an ITS models what a student knows, our model represents how a person characteristically behaves under financial pressure. The pedagogical model correspondingly becomes a *regulatory* model — it selects pressure rather than instruction.

### 2.5 Homeostasis and cybernetic self-regulation

Homeostasis, formalised by Cannon (1932), describes physiological systems maintaining variables within viable ranges via negative feedback. The construct's defining feature — and its relevance here — is bounded viability: both hyperthermia and hypothermia are dysregulation.

Carver and Scheier (1982) extended control-theoretic reasoning to human self-regulation, modelling behaviour as discrepancy reduction between perceived and reference states. Powers' (1973) perceptual control theory offers a related formulation.

We are not the first to apply homeostatic metaphors to finance; the term appears loosely in practitioner writing. Our contribution is to specify it as a *design construct with formal properties* — specifically, to derive the non-monotonicity requirement and to demonstrate that a measure lacking that property contradicts the construct it claims to operationalise.

### 2.6 The gap

Synthesising: the capability literature specifies *what* behaviours matter but not how to develop them digitally. The behavioural literature explains *why* people fail but is largely diagnostic. Persuasive systems research specifies *how* to influence but is agnostic about the target state. Adaptive learning provides architecture but assumes knowledge-based learner models. Financial wellbeing research provides an outcome construct containing an unexploited non-monotonicity.

The gap is an integrative design theory specifying how a digital artefact can model financial disposition, observe behaviour, detect characteristic dysregulation, and adapt — with a target state that is bounded rather than maximised. That is what we develop.

---

## 3. Research Method

### 3.1 Design science research

We adopt design science research (Hevner et al., 2004; Peffers et al., 2007), appropriate where the contribution is a novel artefact addressing an unsolved class of problem. Following Gregor and Hevner's (2013) knowledge-contribution framework, this work sits in the **improvement** quadrant: a known problem (financial capability development) addressed by a new solution.

Following Peffers et al.'s (2007) six activities: problem identification and motivation; definition of objectives; design and development; demonstration; evaluation; communication. Our entry point is problem-centred.

### 3.2 Contribution type

Gregor and Hevner (2013) distinguish contribution levels: situated instantiation (Level 1), nascent design theory in the form of constructs, methods, models and principles (Level 2), and well-developed design theory (Level 3).

We claim **Level 2**. We contribute constructs (financial homeostasis, person-archetype gap, characteristic drift), a model (the six-axis behavioural model), design principles (the PIPE tenets, the theory-engine separation), and an instantiation demonstrating feasibility. We do not claim Level 3, which would require empirical validation across contexts — work not yet undertaken.

We structure the theory using Gregor and Jones's (2007) eight components, addressed across Sections 5–7: purpose and scope, constructs, principles of form and function, artefact mutability, testable propositions, justificatory knowledge, principles of implementation, and expository instantiation.

### 3.3 Evaluation strategy

Venable, Pries-Heje and Baskerville's (2016) FEDS framework distinguishes formative from summative evaluation and artificial from naturalistic settings.

This paper reports **formative, artificial** evaluation only: systematic testing of the instantiated model's internal consistency against its own theoretical commitments. This establishes that the artefact does what the theory specifies. It does **not** establish that the theory produces capability development in human users.

We regard this as a genuine limitation rather than a staged omission, and we state it plainly in Sections 8 and 10. Section 8.4 proposes a naturalistic evaluation design.

---

## 4. Problem Formulation and Design Objectives

### 4.1 Problem statement

Adults experiencing financial difficulty frequently possess adequate financial knowledge but exhibit persistent behavioural patterns that undermine their financial position. These patterns are individually variable, situationally triggered, and largely invisible to the person exhibiting them. Existing digital interventions predominantly supply information, thereby addressing a deficit that is often not the binding constraint.

### 4.2 Design objectives

From the problem statement and the reviewed literature we derive six objectives.

**DO1 — Model disposition, not knowledge.** The artefact must maintain a model of how the user characteristically behaves under financial pressure, not what they know.

**DO2 — Generate consequence, not instruction.** Learning must occur through decisions with perceptible consequences rather than through content delivery.

**DO3 — Make consequence legible.** The user must be able to perceive the causal link between decision and outcome. Consequence that is not understood is noise.

**DO4 — Target a viable range, not a maximum.** The artefact must recognise both under-provisioning and over-provisioning as failure states.

**DO5 — Detect characteristic deviation.** The artefact must distinguish deviation *in the direction this user is prone to* from deviation generally, since the former is diagnostic of habit.

**DO6 — Do no harm.** Given a user population including people in financial and psychological distress, the artefact must detect crisis signals and route to appropriate human support.

---

## 5. The PIPE Design Theory

### 5.1 Purpose and scope

PIPE specifies the design of digital artefacts intended to develop financial capability in adults through repeated, consequential, personalised decision-making. It is scoped to voluntary, non-clinical, educational contexts. It is not a theory of financial advice, therapy, or crisis intervention, though Section 7.7 addresses the interface with the latter.

### 5.2 Legibility as precondition

Before stating the tenets we identify a precondition on which all four depend.

**Legibility** is the property that a user can perceive and articulate the causal relationship between their decision and its consequence. A system in which numbers change without the user understanding *why* provides feedback in an information-theoretic sense but not in a learning sense.

We argue legibility is a *precondition* rather than a fifth tenet because its absence degrades each of the others. Persuasion without legibility becomes manipulation, since the user cannot evaluate the case being made. Immersion without legibility becomes spectacle. Personalisation without legibility is indistinguishable from arbitrariness. Evolution without legibility cannot occur, since the user cannot learn what to adjust.

This has a direct design implication: every consequential state change must be accompanied by a causal account in language the user can verify against their own action.

### 5.3 Persuasion

**Statement.** The artefact should guide meaning-making and choice framing, so that decisions are encountered as significant rather than arbitrary.

**Justification.** Drawn from persuasive systems design (Fogg, 2003; Oinas-Kukkonen & Harjumaa, 2009), with the target state supplied by the homeostatic construct rather than by an assumed maximand.

**Form and function.** Persuasion operates through framing, voice, and salience: how a decision is described, who describes it, and what is made prominent. In our instantiation it is carried principally by the conversational coach, whose persona-consistent voice provides an interpretive frame.

**Ethical constraint.** Persuasion in this domain is bounded by an obligation not to manufacture dependency. We return to this in Section 9.4.

### 5.4 Immersion

**Statement.** The artefact should make financial pressure experientially felt rather than described.

**Justification.** The knowledge-behaviour gap indicates that propositional understanding is insufficient. Simulation literature suggests experienced consequence produces more durable behavioural learning than described consequence.

**Form and function.** Immersion is produced by consequential simulation: decisions alter a persistent financial state, and subsequent scenarios are encountered from that altered state. Crucially, pressure must be *responsive* — a user in a depleted state should face different pressures from one in a comfortable state, or the simulation is merely a quiz with a running total.

### 5.5 Personalisation

**Statement.** The artefact should connect feedback to the individual's behavioural tendencies.

**Justification.** Adaptive learning research establishes that adaptation to a learner model outperforms fixed sequences. The behavioural literature establishes that financial failure modes are individually variable.

**Form and function.** Personalisation requires (a) an explicit behavioural model, (b) a mechanism relating individual state to that model, and (c) content selection and feedback generation conditioned on it. A profile that terminates in a label is not personalisation; it is classification.

**Design principle.** *The behavioural model must be an input to subsequent system behaviour, not merely an output presented to the user.* This distinguishes the approach from the commercial "money personality quiz" pattern.

**Design principle.** *The behavioural model must be revisable from observed behaviour.* An assignment fixed at onboarding is a classification, not a model. Where self-report and behaviour diverge, behaviour is the better evidence — and for archetypes characterised by low self-insight (Section 7.3), behaviour is the only available evidence.

### 5.6 Evolution

**Statement.** The artefact should support and detect adjustment over repeated decisions.

**Justification.** Capability is developmental. An artefact claiming to develop capability must be able to represent change, or the claim is unfalsifiable.

**Form and function.** Evolution requires longitudinal state: behavioural trajectories must persist across sessions and devices, and the system must maintain a representation of change. This has a strong implication — an artefact that resets on reload cannot instantiate Evolution regardless of its other properties.

**Design principle.** *Capability change must be measurable within the artefact, not merely asserted of it.*

### 5.7 Testable propositions

PIPE yields propositions amenable to empirical test:

**P1.** Artefacts providing causal accounts of state changes (legibility) will produce greater behavioural change than those providing state changes alone.

**P2.** Content selection conditioned on a behavioural model will produce greater engagement and behavioural change than randomly selected equivalent content.

**P3.** Feedback identifying deviation *in the user's characteristic direction* will be rated as more insightful, and produce greater behaviour change, than feedback identifying deviation generally.

**P4.** Users of a homeostatically-framed artefact will show reduced over-accumulation behaviours relative to users of a maximisation-framed artefact, without increased under-provisioning.

P4 is the strongest and most distinguishing test, since it predicts an effect that maximisation-framed designs cannot produce by construction.

---

## 6. Financial Homeostasis

### 6.1 The construct

**Financial homeostasis** is the state in which financial resources sustainably serve life. We characterise it as a *regulated* variable: one maintained within a bounded viable range by corrective feedback, rather than maximised without limit.

The viable range is bounded by two thresholds:

**The breakdown threshold (lower).** Below it, provisioning is insufficient: buffers are thin, debt service is unsustainable, and the person is fragile to ordinary shocks. Money fails to secure life.

**The distortion threshold (upper).** Above it, provisioning has become excessive relative to living: accumulation continues at the cost of present participation in life — hoarding, fear-based overprotection, indefinite deferral. Life is sacrificed to money.

### 6.2 The central claim: non-monotonicity

Our substantive theoretical claim is that these are not two ends of a single "more is better" scale but **two distinct failure modes of the same relationship**, and that consequently:

> Any adequate measure of financial wellbeing must be non-monotonic in accumulated resources: it must peak within the viable range and decline toward both boundaries.

This claim is consequential and falsifiable. It implies that a person accumulating aggressively while foreclosing present enjoyment is *not* maximally well by the measure, notwithstanding a superior net position. It also implies that for such a person, expenditure is a *corrective* action — a claim that a monotonic model cannot represent.

We ground the upper boundary in the CFPB's (2015) fourth element (freedom to make choices that allow enjoyment of life), in the prosocial spending literature (Dunn et al., 2008), and in clinical observation of hoarding and financial anxiety, where accumulation functions as an anxiety-management behaviour rather than a provisioning one.

We acknowledge that the upper boundary is more contestable than the lower, and that its position is likely to be culturally and individually variable to a greater degree. We regard this as a matter for empirical calibration rather than a defect in the construct.

### 6.3 Ratio grounding

Absolute monetary thresholds are meaningless across income levels. The boundaries are therefore defined in ratios:

- **Security ratio** — months of essential expenditure covered by liquid savings
- **Burden ratio** — debt service as a proportion of income
- **Future provisioning ratio** — long-term assets relative to income

Each ratio has a viable band with a lower bound (under-provisioning) and, for security and future provisioning, an upper bound beyond which accumulation indicates deferral rather than prudence. The burden ratio is one-sided: there is no over-provisioning failure mode for low debt.

This grounding makes the zone *personal*: what is homeostatic scales with income and cost of living.

### 6.4 Person-archetype gap

Given a behavioural model assigning each user an archetype with an expected behavioural position, the **person-archetype gap** is the signed difference between observed behaviour and archetype-expected behaviour.

The gap is diagnostically distinct from zone position. A user may be within the viable zone while diverging sharply from their archetype's expectation (indicating change), or dysregulated while behaving exactly as their archetype predicts (indicating an entrenched pattern). The two measures answer different questions: *how are you doing?* and *are you being yourself?*

### 6.5 Characteristic drift

Our second novel construct concerns the *direction* of deviation.

Each archetype has a **characteristic failure mode**: a specific direction in which it drifts out of the viable zone under pressure. A Cautious Guardian drifts upward, prudence hardening into fear-based overprotection. An Impulsive Spender drifts downward, immediate relief overriding consequence awareness. A Purposeful Giver drifts downward by a different route: generosity overriding self-preservation.

**Characteristic drift** is deviation *in the archetype's own direction*. We claim this is the diagnostically significant signal, for two reasons.

First, it distinguishes habit from circumstance. Anyone can be pushed out of the viable zone by an adverse event. Drifting out *in one's characteristic direction* indicates disposition expressing itself.

Second, it enables precise feedback. A generic warning ("your savings are low") is weaker than a pattern-naming one ("immediate relief is overriding consequence awareness again — that's the specific way this tends to go for you").

This yields a design requirement: the system must distinguish a user drifting toward their characteristic failure from a user *recovering* against it, and must not treat these symmetrically.

### 6.6 The regulatory response

When observed behaviour deviates past a threshold, a regulatory intervention is warranted. The intervention is triggered by *deviation*, not by absolute level — consistent with the control-theoretic framing (Carver & Scheier, 1982).

We distinguish three possible response modes: *visualisation* (represent the deviation), *nudge* (act on it), and *recalibration* (alter the environment). Our instantiation implements visualisation, and represents recalibration counterfactually — showing where a nudge would steer, without applying it. We regard the deliberate withholding of active nudging as appropriate for a first instantiation, since applying behavioural nudges to financially vulnerable users without evidence of efficacy raises ethical questions we are not yet positioned to answer.

---

## 7. Instantiation: FinPerson

### 7.1 Overview and architecture

FinPerson is a web application comprising a landing surface, a decision sandbox, a conversational coach, a progress surface, and administrative/research views. The implementation is deliberately dependency-light (vanilla JavaScript client, Python/Flask server, SQLite or PostgreSQL persistence) to maximise inspectability and replicability.

The architecture separates:

- **Engine** — behavioural model, homeostasis model, deviation detection, scenario selection
- **Translation layer** — converts engine state to observable behavioural statements
- **Interface** — carries no model vocabulary
- **Research view** — exposes the full instrument, access-controlled

### 7.2 The six-axis behavioural model

The learner model comprises six bipolar axes, each scored 0–100:

1. **Impulse Regulation** — impulsive ↔ deliberate
2. **Risk Disposition** — risk-averse ↔ risk-tolerant
3. **Temporal Orientation** — short-term ↔ long-term
4. **Financial Attentiveness** — avoidant ↔ attentive
5. **Financial Self-Efficacy** — anxious ↔ confident
6. **Prosocial Orientation** — self-directed ↔ other-directed

Each axis corresponds to a construct reviewed in Section 2.2. The model is a synthesis rather than an adoption of an existing validated instrument; we discuss the implications in Section 10.2.

A subset of four axes (excluding Risk Disposition and Prosocial Orientation, which we treat as orientations rather than capabilities) composes a **capability index**. We verified in implementation that this index is arithmetically insensitive to the two dispositional axes — a profile maximal on them and a profile minimal on them yield identical capability scores. This enforces the conceptual separation in code rather than merely asserting it in prose.

### 7.3 Archetypes and characteristic failure modes

Eleven archetypes are specified, each with: a target position on all six axes, a baseline behavioural description, an observed-behaviour description, a named characteristic gap, and a drift direction.

| Archetype | Drift | Characteristic gap |
|---|---|---|
| Conscious Spender | Breakdown | Boundaries weaken under temptation |
| Ambitious Builder | Distortion | Future orientation displaces present stability |
| Cautious Guardian | Distortion | Prudence hardens into fear-based overprotection |
| Impulsive Spender | Breakdown | Immediate relief overrides consequence awareness |
| Steady Saver | Distortion | Stability preference reduces adaptive responsiveness |
| Strategic Risk-Taker | Distortion | Managed risk shifts to overexposure |
| Purposeful Giver | Breakdown | Generosity overrides self-preservation |
| Anxious Avoider | Breakdown | Pressure triggers avoidance over correction |
| Overconfident Navigator | Distortion | Confidence blocks feedback sensitivity |
| Status Seeker | Breakdown | Validation-seeking overrides viability |
| Passive Drifter | Breakdown | Inaction becomes a route into breakdown |

Archetype assignment uses nearest-neighbour matching by Euclidean distance in the six-dimensional space. All eleven archetypes are the nearest match to their own target profile, establishing reachability in principle.

**Reachability in practice: an unanticipated finding.** Auditing the instantiation against this claim surfaced a discrepancy worth reporting. Reachability *in principle* does not entail reachability *in practice*. Our entry mechanism asks users what situation they are dealing with; when we enumerated which archetypes that mechanism could actually reach, six of eleven were unreachable, and a matched archetype with no corresponding situation was being silently replaced by a default.

Correcting this revealed a substantive design constraint rather than merely a defect. Situations can be added for archetypes a person can plausibly recognise in themselves. Two cannot: **Overconfident Navigator** and **Status Seeker**. Each is *constitutively* characterised by limited insight into itself. No user selects "I ignore warnings and dismiss consequence feedback" or "I spend to signal success"; the archetype's defining feature is precisely that this is not self-perceived.

We therefore state a design principle:

> **Archetypes defined by low self-insight cannot be reached by self-report and must be reachable by behavioural inference.**

This generalises beyond finance to any dispositional user model containing categories characterised by limited self-awareness — a common feature of behavioural typologies, and one that self-report instruments systematically under-detect.

Accordingly the artefact implements three assignment routes: **self-report** via situation selection (nine archetypes), **instrument** via the optional questionnaire (all eleven), and **behavioural inference** from observed decisions (nine, including the two that are otherwise unreachable). Inference runs at round boundaries rather than per decision, so that a single atypical choice cannot reassign a user, and a reassignment is disclosed with an explanation rather than applied silently.

### 7.4 The decision sandbox

The sandbox presents scenarios with three or four options, each carrying deltas to income, expenses, savings, investments, and debt. A persistent financial state accumulates these across decisions.

After each decision the system computes a wellbeing score from the ratio-grounded viability functions (Section 6.3), determines zone status, detects threshold crossings, computes the person-archetype gap, and evaluates characteristic drift.

**Implementation note on non-monotonicity.** During development, an early monotonic scoring function was found to identify deferring a necessary vehicle repair as the most capable available action, because it under-penalised recurring costs relative to a one-off savings drawdown. The corrected function encodes an asymmetry: drawing on a buffer for a genuine need is only mildly negative, whereas new debt and recurring expense increases are penalised heavily. This is reported because it illustrates a general risk: a scoring function can appear reasonable while encoding advice that a domain expert would reject, and only systematic testing against domain intuition surfaces it.

### 7.5 Adaptive scenario selection

Scenario selection is conditioned on zone status. Measured across 600 draws per state:

| State | Recovery scenarios | Living scenarios | General | Archetype-themed |
|---|---|---|---|---|
| Breakdown | 48% | 0% | 40% | 12% |
| Viable zone | 17% | 14% | 56% | 14% |
| Distortion | 0% | 49% | 41% | 11% |

*Recovery* scenarios present repair routes (settlement offers, additional income, asset liquidation). *Living* scenarios present opportunities to deploy resources (a significant social occasion, a deferred health check, replacement of equipment impeding work). Archetype-themed scenarios are amplified when the user's most recent decision constituted characteristic drift (18% versus 13%).

Selection is weighted rather than filtered, preserving variety, and consecutive repetition is suppressed.

The living-pressure category demonstrates the practical consequence of non-monotonicity. For a user in distortion, choosing to spend on a significant life event *improves* their wellbeing score, because it moves them toward the viable band. A monotonic model would score the same action as a loss.

### 7.6 The conversational coach

Each archetype has a corresponding coaching voice, implemented via a large language model behind a provider-agnostic interface. Every system prompt comprises three layers:

1. **Guardrails** — the coach is educational, never an advisor; must not recommend specific instruments or allocations; must not shame.
2. **Homeostasis briefing** — the model is instructed in the two-boundary construct and explicitly directed that more saving is not automatically better, never to congratulate drift into distortion, and never to shame breakdown.
3. **Live context** — current zone, decisions inside versus outside the viable zone, trigger count, person-archetype gap, and the user's archetype-specific characteristic failure mode.

The second layer is necessary because a general-purpose model's default disposition is to praise saving. Absent explicit instruction, the coach would contradict the theory the artefact instantiates.

Context transmission is disclosed to the user with a one-tap opt-out. We regard silent transmission of a behavioural profile into a conversation as a trust violation rather than a feature.

### 7.6a Coaching at the point of decision

The standalone coaching surface is architecturally distant from the moment of
choice — precisely where Fernandes et al. (2014) found delivery matters most.
The artefact therefore embeds the coach beside the open scenario, receiving the
scenario text, its options, and the user's current homeostatic state.

This raises the central safety question sharply: helping someone deliberate is
not the same as telling them what to choose, and the boundary is where
educational coaching becomes financial advice. A distinct prompt layer governs
this mode, permitting the coach to ask what is pulling the user toward an
option, name a recurring pattern, surface an unconsidered consequence, or
restate the trade-off — while explicitly prohibiting it from selecting or
ranking options, describing any option as best or mistaken, or implying a
correct answer exists. Asked directly what to do, it is instructed to say the
choice is theirs and then help them see what they are weighing.

The interaction is pull rather than push: the coach does not interrupt a
decision, it waits to be opened.

### 7.6b Generated scenarios

The authored scenario pool is finite and therefore exhaustible by a returning
user. The artefact can generate additional scenarios via the language model,
subject to four constraints.

Generated scenarios enter the same engine that computes wellbeing and drives
coaching, so **all output is strictly validated**: schema conformance, delta
keys restricted to the five state variables, magnitudes bounded to the authored
range, a minimum of two materially distinct options, and a content screen
rejecting brand names, specific financial products, and investment
recommendations. Anything failing validation is discarded rather than repaired,
since silent repair would introduce exactly the malformed state the validation
exists to prevent.

Generation **never blocks the decision loop**: scenarios are prefetched one
ahead and the endpoint returns no content rather than an error on failure, so
the client falls back to the authored pool invisibly.

Most consequentially for research, generation is **disabled by default for
enrolled participants**. A randomised trial requires stimulus control; if
participants within an arm encounter different scenarios, they have not received
the same intervention. This is a case where a product-desirable capability is
deliberately suppressed under study conditions, and we note it as a general
tension between generative personalisation and experimental control that
adaptive-systems research will increasingly face.

### 7.7 Safeguarding

Given a user population including people in genuine distress, the artefact implements crisis detection with three severity tiers: *crisis* (risk to life), *urgent* (coercion, gambling harm, destitution), and *support* (debt crisis warranting professional advice).

Four design commitments:

**High recall over high precision.** A false positive costs a dismissible offer of support; a false negative supplies a budgeting tip to a person in crisis. The costs are asymmetric, so patterns are deliberately broad.

**Never blocks the conversation.** Detection augments rather than interrupts. Being cut off mid-disclosure constitutes its own harm.

**Cannot fail closed.** If the language model is unavailable, a detected signal is still delivered. A separate, always-available support directory is reachable without any AI interaction.

**No verbatim retention.** Detection returns only category and severity.

During testing, three false negatives were identified in initial patterns — including "I don't want to live anymore," which the original crisis patterns failed to match. This is reported because it illustrates that safeguarding patterns require adversarial testing rather than intuitive construction.

### 7.8 The translation layer

The most architecturally significant element of the instantiation, and the one we regard as most generalisable.

The engine reasons in scores, zones, thresholds and gaps. The interface presents none of these. A translation layer converts internal state into statements about the user's own observable behaviour:

> **Engine:** wellbeing 38 · breakdown · gap −14 · characteristic drift
> **Interface:** "That's the third time you've reached for credit when something came up."

The governing rule: *if a statement contains a number meaningful only inside the model, it belongs in the research view*. Counts of the user's own actions are permissible, since these are facts the user can independently verify.

We arrived at this principle by recognising that an earlier iteration had allowed the instrument to become the interface — users were shown zone labels, gap magnitudes, and threshold language. This is a common failure in theory-driven design: the interface mirrors the theory rather than serving the user.

We note one point of departure from the strongest version of this principle. It might be argued that *all* model output should be hidden, with the theory expressed only through improved system behaviour. We reject the strongest form for this domain: capability development requires a mirror, and an artefact that silently nudges without showing its reasoning is both less effective for learning and, in a financial context, ethically inferior. Our position is that the *mechanism* should be hidden and the *observation* exposed.

### 7.9 Longitudinal persistence and telemetry

Behavioural trajectories persist server-side and follow authenticated users across devices. Each decision writes a telemetry record: decision index, wellbeing, zone, archetype-expected position, gap, trigger, characteristic drift flag, and a session identifier permitting trajectory reconstruction without identifying the person.

This exists because Evolution is otherwise unfalsifiable. An artefact that resets on reload cannot demonstrate capability change.

---

## 8. Evaluation

### 8.1 Evaluation strategy and its limits

Following FEDS (Venable et al., 2016), we report **formative, artificial** evaluation: systematic testing of whether the instantiated artefact behaves as the theory specifies.

We state plainly: **no evaluation with human participants has been conducted.** No claim is made regarding efficacy, usability, or capability development in real users. The evaluation below establishes internal consistency, not effect.

### 8.2 Artificial evaluation: internal consistency

**Non-monotonicity.** Three profiles were tested. A balanced profile scored centrally within the viable zone with high viability. A depleted profile scored near the lower extreme. An over-accumulating profile (twenty-plus months of expenses in liquid savings, substantial investments, minimal expenditure) scored near the *upper* extreme, classified as distortion, with viability comparable to the depleted profile. This confirms the defining property: two profiles with similarly low viability occupy opposite poles. A monotonic function would have ranked the over-accumulator highest.

**Capability/disposition separation.** Profiles maximal and minimal on the dispositional axes produced identical capability indices, confirming that dispositional variation cannot inflate a capability measure.

**Archetype reachability.** All eleven archetypes are the nearest match to their own target profile. Separately, all eleven were verified reachable through at least one assignment route (self-report, instrument, or behavioural inference), following correction of a defect in which six were unreachable via the primary entry path.

**Inference discrimination.** Five behavioural signatures were tested against expected classifications. An initial failure was corrected: credit reliance combined with risk-taking was being classified as impulsive spending, when the two patterns are distinct — spending on credit versus over-reaching on credit — and warrant different coaching.

**Characteristic drift discrimination.** The system correctly identified an Impulsive Spender moving toward breakdown as characteristic drift, and correctly declined to flag the same user *improving* against their disposition.

**Adaptive selection.** Scenario distributions shifted as specified across zone states (Section 7.5).

**Scoring validity against domain intuition.** The corrected capability function was tested against five scenarios with expert-consensus preferred actions (pay a necessary repair from savings rather than credit or deferral; direct a windfall to debt; increase income rather than absorb a rent rise; capture an employer match; decline a discretionary trip rather than borrow). All five matched.

**Safeguarding.** Fifteen phrasings across three severity tiers plus benign lookalikes were tested; all classified correctly following the correction of three initially-missed crisis phrasings.

### 8.3 What this does not establish

The above establishes that the artefact implements the theory faithfully. It establishes nothing about whether the theory is correct.

Specifically unevaluated: whether users find archetype assignments recognisable; whether behavioural observations are perceived as insightful or intrusive; whether the artefact produces measurable capability change; whether the six axes are empirically separable; whether the thresholds are appropriately positioned; whether the artefact is usable; whether it causes harm.

All numeric parameters — thresholds, ratio bands, archetype coordinates, scenario deltas, scoring weights — are theoretically motivated but empirically uncalibrated.

### 8.4 Instrumentation for evaluation

The artefact implements the infrastructure the design below requires, so that
the proposed studies can be executed without further engineering.

**Pseudonymous enrolment.** Participants are identified by a study code alone;
no name, email or account is required. Codes arrive by invitation URL, are
persisted locally, and are stripped from the address bar to prevent leakage
through sharing or referrer headers.

**Consent as a gate.** No research data is written before recorded consent.
Consent is versioned: a protocol amendment invalidates prior consent rather
than silently inheriting it, and capture stops until re-consent. Declining
leaves the artefact fully usable, so participation is not coerced by
functionality.

**Deterministic allocation.** Arm assignment is derived by hash from the study
code rather than generated at runtime. Allocation is therefore reproducible and
independently auditable from the code list alone, without database access, and
cannot drift if data are rebuilt. Codes are issued in advance and generated
randomly, making this equivalent to pre-randomisation. Observed allocation
across 600 simulated codes was 187/198/215.

**Genuine ablation.** Arm assignment gates mechanisms rather than presentation.
In the ablated arm, scenario selection reverts to uniform sampling from the
same pools, characteristic drift detection is disabled, behavioural re-inference
of archetype is suspended, and observational feedback is withheld. Surface,
content volume and time on task are held constant. This isolates the theorised
mechanisms from attention and engagement effects — without it, any effect could
be attributed to novelty.

**Event-level capture.** Interactions are captured as timestamped, session-linked
events against an allow-list of types; unrecognised types are discarded so the
event store cannot be used as arbitrary client-controlled storage. Capture is
batched and flushed on interval, page-hide, and unload via `sendBeacon`, since
the end of a session is where drop-off occurs and is precisely what naive
implementations lose.

**Instrument delivery.** Responses are stored as instrument identifier,
timepoint, item identifier and value. **Item content is deliberately not stored
in the artefact**, so licensed instruments can be administered without their
items entering the repository — a practical requirement given that most
validated scales are copyright-protected.

**Withdrawal.** Withdrawal performs a hard delete of all events, responses and
the participant record. It is not a retention flag.

**Export.** Four researcher-only CSV exports (participants, events, instrument
responses, decision-level telemetry), each joined to arm so analysis requires no
separate allocation file.

### 8.5 Proposed naturalistic evaluation

We propose a three-phase design.

**Phase 1 — Formative usability (n ≈ 8–12).** Think-aloud sessions covering entry, one complete round, and a coaching exchange. Primary questions: is the causal account legible; is the archetype recognisable; is the observational feedback experienced as insight or as surveillance.

**Phase 2 — Construct validation (n ≈ 300–500).** Administration of the six-axis instrument alongside established measures (Lown's Financial Self-Efficacy Scale; a validated financial behaviour scale; a temporal discounting measure) to assess convergent and discriminant validity, plus test-retest reliability at two to four weeks.

**Phase 3 — Efficacy (randomised, n ≈ 200+, 12 weeks).** Three arms: full artefact; ablated artefact with personalisation and characteristic-drift detection disabled; information-only control. Primary outcome: validated financial behaviour measure at twelve weeks. Secondary: financial self-efficacy, engagement, and — testing P4 specifically — over-accumulation behaviours in a stratified sub-sample of participants presenting above the distortion threshold at baseline.

The Phase 3 ablation is essential: without it, any effect could be attributed to attention or engagement rather than to the theorised mechanisms.

**Instrumentation status.** Phases 1–3 are executable against the current
artefact without further development. What remains is ethics approval,
participant recruitment, and selection and licensing of validated instruments.

**Ethical requirements.** All phases require ethics approval. Given the population, protocols must include distress screening, clear withdrawal procedures, and referral pathways. The safeguarding layer must be independently reviewed before any deployment to participants.

---

## 9. Discussion

### 9.1 Theoretical contribution

The principal theoretical contribution is the formalisation of financial homeostasis as a non-monotonic design construct. Its value lies less in the metaphor — which is not new — than in the derived requirement: an operationalisation must be *capable of identifying over-accumulation as dysregulation*. This is a sharp criterion. Most extant financial wellbeing measures fail it, and their failure is invisible until the criterion is stated.

The construct also reframes an under-served user population. Financial capability research and practice attend overwhelmingly to under-provisioning. The person who saves compulsively while foreclosing present life is not typically construed as having a financial capability problem. Under our framing they have a symmetric one.

The characteristic drift construct contributes a directional refinement to deviation detection. The claim that deviation in one's *characteristic* direction is more diagnostic than deviation generally is empirically testable (P3) and, if supported, applicable well beyond finance to any adaptive system maintaining a dispositional user model.

### 9.2 Methodological contribution

The theory-engine/plain-interface separation, mediated by an explicit translation layer, generalises to theory-driven design broadly. The failure it prevents — the interface becoming an instrument panel that mirrors the researcher's model — is common in design science instantiations and is rarely named as a distinct pathology.

We also note a methodological observation from the development process. Multiple substantive errors were surfaced only by systematic execution against domain intuition: the scoring function that recommended deferring necessary maintenance, the monotonic measure contradicting its own construct, the safeguarding patterns missing a canonical crisis phrasing, and the silent substitution of archetypes unreachable through the primary entry path. Each appeared reasonable on inspection.

The last of these was surfaced not by testing but by *auditing the artefact against the claims of this paper* — a step we recommend explicitly. Writing a design science paper creates a natural checkpoint at which stated contributions can be verified against the running system, and in our case it revealed both a defect and a genuine design principle (Section 7.3) that inspection alone had not produced. This suggests that artefact verification in design science warrants the same systematic treatment as empirical evaluation, and that reporting such corrections is more useful to readers than presenting a design as though it emerged correct.

### 9.3 Practical implications

For designers of financial wellbeing products, the immediate implication is that a monotonic target state is a design choice with consequences, not a neutral default. Products optimising accumulation may be actively unhelpful to a segment of their users.

For financial capability practitioners, the archetype-with-characteristic-failure-mode structure offers a vocabulary for pattern-naming that is more specific than generic budgeting advice and less pathologising than clinical language.

### 9.4 Ethical considerations

Three warrant explicit statement.

**Labelling.** Assigning a behavioural archetype to a person with low financial confidence is a consequential act. Our instantiation responds by treating the archetype as a revisable hypothesis rather than a verdict: it is not presented on arrival, it is hedged when presented, and it is inferred from behaviour rather than demanded as self-diagnosis. We regard this as necessary but not obviously sufficient.

**Engineered intimacy.** A tempting design target for personalised systems is the user's sense of being deeply understood. In a domain where users may be distressed and isolated, deliberately engineering that feeling raises concerns absent from lower-stakes recommendation contexts. We deliberately targeted *"this was useful and it knew my situation"* rather than *"it really gets me."*

**Persuasive asymmetry.** An artefact that models a user's dispositional weaknesses and adapts its persuasion accordingly holds a meaningful asymmetry of insight. The same machinery that enables helpful pattern-naming would enable exploitation if the target state were commercial rather than the user's own viability. We regard the transparency of the target state as an ethical requirement, not a feature.

---

## 10. Limitations

**10.1 No empirical evaluation.** The most serious limitation. No human participant has used the artefact. All claims regarding efficacy are prospective. The evaluation *infrastructure* is implemented and tested (Section 8.4); the evaluation itself is not conducted.

**10.2 Unvalidated instrument.** The six-axis model is a synthesis, not a validated instrument. Its axes have not been tested for separability, reliability, or convergent validity. We chose synthesis over adoption of an existing instrument (e.g. the Kempson et al. domains) on the grounds that design science permits synthesised constructs as contributions; this remains a defensible but unvalidated choice.

**10.3 Uncalibrated parameters.** Thresholds, ratio bands, archetype coordinates and scoring weights are theoretically motivated but empirically arbitrary. Different values would produce different classifications.

**10.4 Cultural specificity.** The construct assumes a context in which individuals control discretionary resources and where accumulation-versus-living is a meaningful tension. Its applicability where financial decisions are collective, or where provisioning is dominated by subsistence constraints, is untested. The upper boundary in particular is likely to be culturally variable.

**10.5 Simulated rather than real financial data.** Decisions operate on illustrative figures. Whether patterns observed in simulation transfer to real financial behaviour is exactly what a naturalistic evaluation must establish.

**10.6 Language model dependency.** The coaching layer depends on a third-party model whose behaviour may change. Guardrails constrain but do not guarantee output.

**10.7 Single-designer development.** The artefact was developed without design review or expert consultation. The archetype-to-axis mappings in particular reflect one interpretation.

---

## 11. Future Work and Conclusion

### 11.1 Future work

The immediate priority is the evaluation programme in Section 8.4, in sequence. Phase 1 in particular may invalidate design assumptions cheaply.

Beyond evaluation, four directions:

**Active regulation.** The current instantiation visualises deviation without intervening. Implementing and evaluating active nudging — and establishing whether it helps or merely annoys — is the natural extension, though it should follow rather than precede efficacy evidence.

**Real financial data.** Integration with account data would replace simulated states, at a substantial increase in both value and risk.

**Threshold personalisation.** Fixed thresholds are a simplification. Learning individual viable ranges from behaviour and stated preference is a natural refinement.

**Population-level analysis.** The telemetry design supports trajectory analysis across users, enabling questions about whether archetypes cluster empirically and whether characteristic drift is observable in aggregate.

### 11.2 Conclusion

Financial education has underdelivered for a diagnosable reason: it addresses a knowledge deficit where the binding constraint is usually regulatory. This paper has argued that an effective artefact must instead model disposition, generate legible consequence, detect deviation in the direction the individual is characteristically prone to, and target a bounded viable range rather than a maximum.

The central theoretical move is the reframing of financial wellbeing as a regulated variable with two failure boundaries, and the consequent requirement that any adequate measure be non-monotonic. This is a sharp and testable criterion that most existing measures fail. We have demonstrated its instantiation in a working artefact and shown that it produces design consequences a maximisation framing cannot — most concretely, that for some users at some times, spending is the corrective action.

We have been explicit that this contribution is an artefact and a nascent design theory, not a validated intervention. The theory may be wrong. The thresholds are certainly approximate. What we claim is that the framing is coherent, instantiable, and falsifiable, and that the criterion it yields is one the field should apply to its existing measures whether or not it adopts the rest.

---

## References

*All references require verification against original sources before submission. Details below are recalled and may contain errors in year, volume, or pagination.*

Anderson, J.R., Corbett, A.T., Koedinger, K.R. & Pelletier, R. (1995). Cognitive tutors: Lessons learned. *Journal of the Learning Sciences*, 4(2), 167–207.

Atkinson, A., McKay, S., Kempson, E. & Collard, S. (2006). *Levels of Financial Capability in the UK: Results of a Baseline Survey*. Financial Services Authority.

Bandura, A. (1977). Self-efficacy: Toward a unifying theory of behavioral change. *Psychological Review*, 84(2), 191–215.

Brüggen, E.C., Hogreve, J., Holmlund, M., Kabadayi, S. & Löfgren, M. (2017). Financial well-being: A conceptualization and research agenda. *Journal of Business Research*, 79, 228–237.

Cannon, W.B. (1932). *The Wisdom of the Body*. W.W. Norton.

Carver, C.S. & Scheier, M.F. (1982). Control theory: A useful conceptual framework for personality–social, clinical, and health psychology. *Psychological Bulletin*, 92(1), 111–135.

Consumer Financial Protection Bureau (2015). *Financial Well-Being: The Goal of Financial Education*. CFPB.

Deci, E.L., Koestner, R. & Ryan, R.M. (1999). A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. *Psychological Bulletin*, 125(6), 627–668.

Deterding, S., Dixon, D., Khaled, R. & Nacke, L. (2011). From game design elements to gamefulness: Defining "gamification". *Proceedings of MindTrek '11*, 9–15.

Dunn, E.W., Aknin, L.B. & Norton, M.I. (2008). Spending money on others promotes happiness. *Science*, 319(5870), 1687–1688.

Fernandes, D., Lynch, J.G. & Netemeyer, R.G. (2014). Financial literacy, financial education, and downstream financial behaviors. *Management Science*, 60(8), 1861–1883.

Fogg, B.J. (2003). *Persuasive Technology: Using Computers to Change What We Think and Do*. Morgan Kaufmann.

Gregor, S. & Hevner, A.R. (2013). Positioning and presenting design science research for maximum impact. *MIS Quarterly*, 37(2), 337–355.

Gregor, S. & Jones, D. (2007). The anatomy of a design theory. *Journal of the Association for Information Systems*, 8(5), 312–335.

Hevner, A.R., March, S.T., Park, J. & Ram, S. (2004). Design science in information systems research. *MIS Quarterly*, 28(1), 75–105.

Kahneman, D. & Tversky, A. (1979). Prospect theory: An analysis of decision under risk. *Econometrica*, 47(2), 263–291.

Kempson, E., Collard, S. & Moore, N. (2005). *Measuring Financial Capability: An Exploratory Study*. Financial Services Authority.

Laibson, D. (1997). Golden eggs and hyperbolic discounting. *Quarterly Journal of Economics*, 112(2), 443–478.

Lown, J.M. (2011). Development and validation of a financial self-efficacy scale. *Journal of Financial Counseling and Planning*, 22(2), 54–63.

Mullainathan, S. & Shafir, E. (2013). *Scarcity: Why Having Too Little Means So Much*. Times Books.

Netemeyer, R.G., Warmath, D., Fernandes, D. & Lynch, J.G. (2018). How am I doing? Perceived financial well-being, its potential antecedents, and its relation to overall well-being. *Journal of Consumer Research*, 45(1), 68–89.

O'Donoghue, T. & Rabin, M. (1999). Doing it now or later. *American Economic Review*, 89(1), 103–124.

Oinas-Kukkonen, H. & Harjumaa, M. (2009). Persuasive systems design: Key issues, process model, and system features. *Communications of the AIS*, 24(1), 485–500.

Peffers, K., Tuunanen, T., Rothenberger, M.A. & Chatterjee, S. (2007). A design science research methodology for information systems research. *Journal of Management Information Systems*, 24(3), 45–77.

Powers, W.T. (1973). *Behavior: The Control of Perception*. Aldine.

Thaler, R.H. (1985). Mental accounting and consumer choice. *Marketing Science*, 4(3), 199–214.

Thaler, R.H. & Sunstein, C.R. (2008). *Nudge: Improving Decisions About Health, Wealth, and Happiness*. Yale University Press.

VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems. *Educational Psychologist*, 46(4), 197–221.

Venable, J., Pries-Heje, J. & Baskerville, R. (2016). FEDS: A framework for evaluation in design science research. *European Journal of Information Systems*, 25(1), 77–89.
