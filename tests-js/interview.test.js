const test = require("node:test");
const assert = require("node:assert");
const {
  INTERVIEW_WEIGHT, nextInterviewQuestion, applyInterviewToRivalry,
  selfModelGap, alreadyAsked,
} = require("../interview.js");

const rivalry = (o) => Object.assign({
  id: "why_the_pause_fails",
  question: "Why does your pause fail?",
  a: { id: "clock", claim: "Because there is a clock on it." },
  b: { id: "stakes", claim: "Because the amount is small." },
  resolved: false, margin: 0.1, leading: "a",
}, o);

// ------------------------------------------------------------ when to ask

test("the twin keeps watching rather than asking too early", () => {
  // An observed answer beats a reported one, so patience is the right default.
  global.twinCompetingExplanations = () => [rivalry()];
  const q = nextInterviewQuestion(null, Array(3).fill({}), { answers: [] });
  assert.strictEqual(q, null, "three decisions is not a stalled investigation");
});

test("a stalled rivalry becomes a question once behaviour has had its chance", () => {
  global.twinCompetingExplanations = () => [rivalry()];
  const q = nextInterviewQuestion(null, Array(10).fill({}), { answers: [] });
  assert.strictEqual(q.kind, "rivalry");
  assert.strictEqual(q.options.length, 3, "must include a way to reject both");
  assert.match(q.caveat, /will not override/i,
    "the limit of the answer has to be stated or it gets answered strategically");
});

test("a rivalry behaviour already settled is not asked about", () => {
  global.twinCompetingExplanations = () => [rivalry({ resolved: true })];
  assert.strictEqual(nextInterviewQuestion(null, Array(20).fill({}), { answers: [] }), null);
});

test("the same question is never asked twice", () => {
  global.twinCompetingExplanations = () => [rivalry()];
  const answers = [{ subjectId: "rival:why_the_pause_fails", side: "a" }];
  assert.strictEqual(nextInterviewQuestion(null, Array(20).fill({}), { answers }), null,
    "a second answer to a settled question is not new evidence");
  assert.strictEqual(alreadyAsked("rival:why_the_pause_fails", answers), true);
});

test("a contested rule is asked about, framed as the model being wrong", () => {
  global.twinCompetingExplanations = () => [];
  const twin = { contested: [{ id: "r1", statement: "You decide fast under a deadline." }] };
  const q = nextInterviewQuestion(twin, Array(6).fill({}), { answers: [] });
  assert.strictEqual(q.kind, "contested");
  assert.match(q.preamble, /I had you down for this/,
    "the twin owns the mistake rather than accusing the person of inconsistency");
});

// ------------------------------------------------- what an answer may do

test("a stated reason breaks a genuine tie", () => {
  const r = applyInterviewToRivalry(rivalry({ margin: 0.1 }), { side: "a" });
  assert.strictEqual(r.applied, true);
  assert.ok(Math.abs(r.margin - (0.1 + INTERVIEW_WEIGHT)) < 1e-9);
});

test("a stated reason cannot move evidence that already leans", () => {
  const r = applyInterviewToRivalry(rivalry({ margin: 0.6 }), { side: "b" });
  assert.strictEqual(r.applied, false);
  assert.strictEqual(r.margin, 0.6, "the observed margin must survive untouched");
  assert.match(r.reason, /already leans/);
});

test("a stated reason cannot overturn something behaviour has settled", () => {
  // The load-bearing constraint: otherwise the twin stops modelling what
  // someone does and starts recording what they wish were true.
  const r = applyInterviewToRivalry(rivalry({ resolved: true, margin: 0.9 }), { side: "b" });
  assert.strictEqual(r.applied, false);
  assert.match(r.reason, /behaviour already settled/);
});

test("declining to pick a side changes nothing", () => {
  const r = applyInterviewToRivalry(rivalry({ margin: 0.05 }), { side: null });
  assert.strictEqual(r.applied, false);
});

// --------------------------------------------------------- self-model gap

test("the gap stays quiet until it has happened more than once", () => {
  const rivals = [rivalry({ resolved: true, leading: "b" })];
  const answers = [{ subject: "rivalry", subjectId: "rival:why_the_pause_fails", side: "a" }];
  assert.strictEqual(selfModelGap(rivals, answers), null,
    "one mismatch is misremembering a situation, not a self-model");
});

test("repeated disagreement between what they say and what they do is reported", () => {
  const rivals = [
    rivalry({ id: "r1", resolved: true, leading: "b" }),
    rivalry({ id: "r2", resolved: true, leading: "b" }),
  ];
  const answers = [
    { subject: "rivalry", subjectId: "rival:r1", side: "a" },
    { subject: "rivalry", subjectId: "rival:r2", side: "a" },
  ];
  const gap = selfModelGap(rivals, answers);
  assert.strictEqual(gap.n, 2);
  assert.strictEqual(gap.agreed, 0);
  assert.strictEqual(gap.diverges, true);
});
