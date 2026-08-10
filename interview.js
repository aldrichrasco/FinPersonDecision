// The twin interview: the questions behaviour cannot answer.
//
// The loop runs hypothesis, experiment, observation, update. It works until it
// reaches something no amount of watching can settle. Two rules can fit the
// same run of decisions perfectly and only differ in WHY, and the sandbox can
// keep serving scenarios forever without separating them if the discriminating
// case never comes up. At that point the honest move is to stop guessing and
// ask.
//
// The whole design rests on one constraint: SELF-REPORT IS WEAKER EVIDENCE
// THAN BEHAVIOUR, and it must never be allowed to overrule it. A person who
// says "I'm careful with money" while consistently choosing otherwise has told
// you something interesting about their self-image and nothing about their
// behaviour. If an answer here could flip a confirmed rule, the twin would
// stop being a model of what someone does and become a record of what they
// would like to be true, which is the thing every other product in this space
// already is.
//
// So an answer can do exactly one thing: break a tie that behaviour has failed
// to break. Where the evidence genuinely does not distinguish two explanations,
// a reason the person gives is better than a coin flip. Everywhere else it is
// stored, shown, and given no power at all.
//
// The gap between the two is itself a finding, and the most interesting one
// the interview produces: when someone's stated reason keeps losing to their
// observed behaviour, that divergence is worth more than either alone.

// How much a stated reason counts against an observed decision. Deliberately
// well under one: it is enough to tip a genuine tie and not enough to move
// anything that evidence has already settled.
const INTERVIEW_WEIGHT = 0.34;

// Decisions that must pass without the discriminating case appearing before
// the twin gives up waiting and asks. Below this it should keep watching,
// because an observed answer beats a reported one and patience is cheap.
const INTERVIEW_PATIENCE = 8;

// A contested rule is asked about sooner: the twin currently believes
// something its own evidence is arguing with, and that is worth interrupting
// for.
const INTERVIEW_CONTESTED_PATIENCE = 4;

const INTERVIEW_KEY = "finperson_twin_interview";

function getInterviewAnswers() {
  try {
    const raw = localStorage.getItem(INTERVIEW_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}

function recordInterviewAnswer(entry) {
  try {
    const log = getInterviewAnswers();
    log.push({
      at: Date.now(),
      question: entry.question || null,
      // What the question was about, so the answer can be found again when
      // that hypothesis is next evaluated.
      subject: entry.subject || null,
      subjectId: entry.subjectId || null,
      answer: entry.answer || null,
      // Which side of a rivalry they endorsed, when the question had sides.
      side: entry.side || null,
      // Always. This is what stops the answer being mistaken for an
      // observation later, by code or by a person reading the log.
      evidenceType: "self_report",
      weight: INTERVIEW_WEIGHT,
    });
    localStorage.setItem(INTERVIEW_KEY, JSON.stringify(log.slice(-60)));
  } catch (e) {}
}

// Has this already been asked? Asking the same question twice is how an
// interview turns into an interrogation, and a second answer to a settled
// question is not new evidence.
function alreadyAsked(subjectId, answers) {
  return (answers || getInterviewAnswers()).some(a => a.subjectId === subjectId);
}

// What the twin should ask next, or null when behaviour is doing the job.
//
// Order matters. A rivalry that behaviour has stalled on is the best possible
// question, because the person's reason is genuinely the missing information.
// A contested rule is next: the twin believes something and the evidence
// disagrees, which is worth asking about directly. Everything else is left
// alone, because a model that asks questions it could answer by watching is
// outsourcing its job to the user.
function nextInterviewQuestion(twin, decisions, opts) {
  const log = decisions || [];
  const answers = (opts && opts.answers) || getInterviewAnswers();
  const patience = (opts && opts.patience) || INTERVIEW_PATIENCE;

  // 1. A rivalry that behaviour has had its chance to settle and has not.
  if (typeof twinCompetingExplanations === "function") {
    const rivals = twinCompetingExplanations(log) || [];
    const stalled = rivals.filter(r =>
      !r.resolved && !alreadyAsked(`rival:${r.id}`, answers) && log.length >= patience);
    if (stalled.length) {
      const r = stalled[0];
      return {
        kind: "rivalry",
        subject: "rivalry",
        subjectId: `rival:${r.id}`,
        question: r.question,
        // Framed as the model's limitation, not the person's inconsistency.
        // It is the twin that cannot tell these apart.
        preamble: `Your decisions fit both of these, and I have not seen the one situation that would separate them. You know which it is and I do not.`,
        options: [
          { side: "a", label: r.a.claim },
          { side: "b", label: r.b.claim },
          { side: null, label: "Neither of these is really it." },
        ],
        // Said plainly, because a question that pretends to be more powerful
        // than it is will be answered strategically.
        caveat: "Your answer helps me choose between these two. It will not override what I have watched you do.",
      };
    }
  }

  // 2. A rule the evidence is arguing with.
  const contested = (twin && twin.contested) || [];
  const live = contested.filter(r => !alreadyAsked(`rule:${r.id}`, answers));
  if (live.length && log.length >= INTERVIEW_CONTESTED_PATIENCE) {
    const rule = live[0];
    return {
      kind: "contested",
      subject: "rule",
      subjectId: `rule:${rule.id}`,
      question: "Has something changed?",
      preamble: `I had you down for this: ${stripFullStop(rule.statement || rule.refined)}. Your recent decisions are arguing with it.`,
      options: [
        { side: "changed", label: "Something changed. That used to be true." },
        { side: "never", label: "That was never right about me." },
        { side: "depends", label: "It depends on the situation." },
      ],
      caveat: "I will keep watching either way. This tells me which of those to look for.",
    };
  }

  return null;
}

function stripFullStop(t) {
  return String(t || "").replace(/\.$/, "");
}

// Applies an answer to a rivalry, and ONLY where the evidence is tied.
//
// Returns the adjusted margin and whether the answer was allowed to matter.
// The caller shows `applied` so the person can see when their reason counted
// and when it did not, which is the difference between a system that listens
// and one that pretends to.
function applyInterviewToRivalry(rivalry, answer) {
  if (!rivalry || !answer || !answer.side) {
    return { applied: false, reason: "no answer", margin: rivalry ? rivalry.margin : null };
  }
  if (rivalry.resolved) {
    return {
      applied: false,
      reason: "behaviour already settled this",
      margin: rivalry.margin,
    };
  }
  // A tie is the only place a reason is better than a coin flip. Anywhere
  // else, the observed margin is the better evidence and should stand.
  const tied = Math.abs(rivalry.margin || 0) < 0.34;
  if (!tied) {
    return {
      applied: false,
      reason: "the evidence already leans one way",
      margin: rivalry.margin,
    };
  }
  const dir = answer.side === "a" ? 1 : answer.side === "b" ? -1 : 0;
  return {
    applied: dir !== 0,
    reason: dir === 0 ? "no side chosen" : "evidence was tied, so your reason broke it",
    margin: (rivalry.margin || 0) + dir * INTERVIEW_WEIGHT,
    weight: INTERVIEW_WEIGHT,
  };
}

// Where stated reasons and observed behaviour disagree.
//
// This is the interview's real product. Someone whose explanation keeps losing
// to their own decisions has a self-model that is out of step, and that is a
// more useful thing to know than either the behaviour or the explanation on
// its own. Reported without blame: an out-of-date self-model is the ordinary
// human condition, not a character flaw.
function selfModelGap(rivalries, answers) {
  const said = answers || getInterviewAnswers();
  if (!said.length || !rivalries || !rivalries.length) return null;

  const compared = [];
  said.forEach(a => {
    if (a.subject !== "rivalry" || !a.side) return;
    const r = rivalries.find(x => `rival:${x.id}` === a.subjectId);
    if (!r || !r.resolved) return;
    compared.push({
      question: r.question,
      theySaid: a.side === "a" ? r.a.claim : r.b.claim,
      evidenceSays: r.leading === "a" ? r.a.claim : r.b.claim,
      agreed: a.side === r.leading,
    });
  });
  if (compared.length < 2) return null;

  const agreed = compared.filter(c => c.agreed).length;
  return {
    n: compared.length,
    agreed,
    compared,
    // Only called out once it has happened more than once. A single mismatch
    // is a person misremembering one situation, not a self-model.
    diverges: (compared.length - agreed) >= 2,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    INTERVIEW_WEIGHT, INTERVIEW_PATIENCE, INTERVIEW_CONTESTED_PATIENCE,
    getInterviewAnswers, recordInterviewAnswer, alreadyAsked,
    nextInterviewQuestion, applyInterviewToRivalry, selfModelGap,
  };
}
