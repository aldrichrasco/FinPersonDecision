// Dumps the app's own curated behavioral-finance content — idm.js's
// DECISION_MODELS (the "beliefs being tested" citations) and learn.js's
// LEARN_CONTENT (per-axis lessons + research citations) — into a flat JSON
// corpus (corpus_js.json) that rag/build_index.py embeds into the
// retrieval index the coach's search_research_notes tool searches.
//
// This script only reads idm.js/learn.js (via the Node-only module.exports
// guards added to each); the content's one source of truth stays those
// files, not a hand-copied duplicate here that could drift out of sync.
//
// Run this manually and commit the result whenever idm.js/learn.js content
// changes — rag/build_index.py deliberately does NOT invoke this at deploy
// time (Railway's Python-only build container has no Node runtime; see
// build_index.py's docstring), so corpus_js.json is checked into git as a
// snapshot rather than gitignored as a pure build artifact.
//
//   node rag/build_corpus.js && git add rag/corpus_js.json
const fs = require("fs");
const path = require("path");

const { DECISION_MODELS } = require(path.join(__dirname, "..", "idm.js"));
const { LEARN_CONTENT } = require(path.join(__dirname, "..", "learn.js"));

const docs = [];

Object.entries(DECISION_MODELS).forEach(([key, m]) => {
  docs.push({
    id: `belief:${key}`,
    source: "idm.js",
    title: `Belief: ${m.label}`,
    text: `Money belief: "${m.label}". The stance: ${m.stance} What contradicts it: ${m.counter} ${m.blurb} Source: ${m.citation}`,
  });
});

Object.entries(LEARN_CONTENT).forEach(([axis, c]) => {
  const axisLabel = axis.replace(/_/g, " ");
  docs.push({
    id: `axis-research:${axis}`,
    source: "learn.js",
    title: `Research grounding: ${axisLabel}`,
    text: `${axisLabel}. ${c.research}`,
  });
  (c.lessons || []).forEach((lesson, i) => {
    docs.push({
      id: `lesson:${axis}:${i}`,
      source: "learn.js",
      title: lesson.title,
      text: `Lesson on ${axisLabel} — "${lesson.title}": ${lesson.body}`,
    });
  });
});

const outPath = path.join(__dirname, "corpus_js.json");
fs.writeFileSync(outPath, JSON.stringify(docs, null, 2));
console.log(`Wrote ${docs.length} documents to ${outPath}`);
