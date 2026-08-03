# FinPerson — redesigned landing page + working sandbox

## Deploying to Railway

1. Push this folder to a GitHub repo, then in Railway: **New Project → Deploy
   from GitHub repo** → select it. Railway reads `railway.json` (Nixpacks
   build, `gunicorn` start command, `/health` healthcheck) and `Procfile`.
2. Add a Postgres database from Railway's plugin catalog and attach it to the
   service — this sets `DATABASE_URL` automatically, which `db.py` picks up
   to switch from SQLite to Postgres.
3. Set the remaining environment variables in the service's Variables tab:
   `SECRET_KEY`, `GOOGLE_CLIENT_ID`, `ANTHROPIC_API_KEY` (or your chosen
   `LLM_PROVIDER`/`LLM_MODEL`), and `COOKIE_SECURE=1`. See `.env.example` for
   the full list.
4. After the first deploy, add your Railway URL to "Authorized JavaScript
   origins" in Google Cloud Console, and put the same client ID in `auth.js`.

That's it: signed-in users' sandbox progress now persists in Postgres across
devices; anonymous users still work fully via localStorage.

**Alternative — Render Blueprint:** `render.yaml` is still in the repo and
works the same way (Render: **New → Blueprint** → select the repo) if you'd
rather deploy there instead of Railway.

A static, dependency-free frontend backed by its own Flask app (`server.py`).
The quiz and sandbox are fully functional client-side — not mockups — running
on illustrative data until you wire them to real accounts.

## Production features

**Authentication** — two ways in:
- Google sign-in (verified server-side, real session cookie)
- Email + password (`/api/auth/signup`, `/api/auth/login`), passwords hashed
  with werkzeug, 8-char minimum, duplicate-email protection

**Per-user persistence** — signed-in sandbox progress saves to Postgres/SQLite
and restores across devices; anonymous users still work fully on localStorage.

**Rate limiting** — `ratelimit.py`, no external dependency. Login 10/5min,
signup 10/hr, exports/deletes 5/hr, writes 120/min, all per client IP. Returns
429 with `Retry-After`. Move to Redis if you run multiple instances.

**Admin view** — `/admin.html`, gated by an `is_admin` flag and a 403 from
`/api/admin/stats`. Aggregate metrics only (user counts, decisions, persona
breakdown) — never individual personal data. Promote the first admin:
`python make_admin.py you@example.com`.

**GDPR / data rights** — signed-in users can download everything stored about
them (account menu, served by `/api/me/export`) or hard-delete their account
and all linked data (`/api/me/delete`).

**Backups** — `backup.py` dumps Postgres via pg_dump (or safely copies the
SQLite file locally), keeping the last 14 with rotation. On Railway, run it as
a Cron Job service pointed at the same repo, and add an upload step to
external storage — Railway's service filesystem is ephemeral and won't
persist dumps between deploys.

## Coaching chat (the core product)

The persona cards and quiz now open `chat.html`, a real coaching conversation
backed by `/api/chat/<slug>`. It's provider-agnostic:

- **`llm.py`** — one `chat()` function. `LLM_PROVIDER` picks anthropic (default),
  openai, or gemini; each has a sensible default model you can override with
  `LLM_MODEL`. Only the Anthropic SDK is in requirements.txt; the other two
  branches work the moment you add their key + SDK, so you can A/B on your own
  prompts without code changes.
- **`coach.py`** — the eleven persona voices plus `SHARED_GUARDRAILS`, prepended
  to every system prompt. This is the safety core: the model is instructed to
  stay an educational coach, never give specific/personalized financial advice,
  never shame the user, and redirect to a licensed professional when asked for
  real advice or when a user seems in distress.

To turn it on: set `ANTHROPIC_API_KEY` (and optionally `LLM_PROVIDER`). Without
a key, the chat page detects this via `/api/chat-info` and tells the user
honestly that live coaching isn't configured — the quiz and sandbox still work.

Cost note: coaching replies are short (a few hundred tokens each way), so even
on a paid tier this runs a fraction of a cent per message. Server-side history
is capped (20 messages, 2000 chars each) to keep both cost and abuse bounded.

## Financial capability model (PIPE alignment)

This build maps to the four PIPE tenets, with the two weakest ones now addressed:

- **Personalisation** — `fbm.js` implements the study's six-axis Financial
  Behavioural Model (Impulse Regulation, Risk Disposition, Temporal
  Orientation, Financial Attentiveness, Financial Self-Efficacy, Prosocial
  Orientation) — each a bipolar dimension scored 0-100, shown to users with a
  plain-language subtitle. The quiz scores all six; the profile matches to the
  nearest of the eleven archetypes by Euclidean distance (verified: all 11
  reachable). Formal construct definitions and citations live in the paper;
  the code carries only the axis names and user-facing subtitles. Axes are
  defined in one editable block.
- **Immersion + PIPE homeostatic control + characteristic drift** — the
  sandbox models decisions as a homeostatic control system. A per-decision
  0-100 stability score is plotted against a homeostasis zone bounded by upper
  distortion and lower breakdown thresholds, with three trajectories (observed,
  archetype-expected, recalibrated) and PIPE trigger markers on threshold
  breach. Crucially, each archetype carries its **characteristic gap** from the
  study's Person-Archetype Gap table (baseline behaviour, observed tendency,
  named failure mode, and drift *direction* — toward breakdown or distortion).
  The sandbox emphasises when observed behaviour drifts in that archetype's
  *own* characteristic direction (e.g. an Impulsive Spender sliding toward
  breakdown, a Cautious Guardian rising into over-protective distortion) —
  making the misalignment diagnostic rather than generic. Surfaces both as
  chart lines and a named-gap callout. All in `deviation.js` (ARCHETYPE_GAPS).
- **Financial homeostasis (theorised)** — the zone is not an arbitrary band but
  a theory of regulated financial *wellbeing*: money sustainably serving life.
  It is a REGULATED variable, not a maximised one, so it has two boundaries and
  BOTH are genuine dysregulation — LOWER/breakdown (under-provisioning,
  fragility) and UPPER/distortion (over-provisioning at the cost of living;
  hoarding, fear-based overprotection). The wellbeing score is therefore
  NON-MONOTONIC: it peaks in the viable zone and declines toward both poles, so
  a spendthrift and a hoarder can share low viability yet sit at OPPOSITE ends
  of the axis — the property that distinguishes this from wealth-maximisation
  framings. Boundaries are defined in ratios (months of cover, debt share,
  future provisioning) so the zone is personal and scales with income. The full
  rationale is documented at the top of `deviation.js` for direct citation.

- **Evolution** — `progress.html` tracks a Financial Capability Index (0-100)
  over time, charts the trend, shows the current six-axis profile, and prompts
  re-assessment. This is the measurement layer the evaluation noted was missing
  — capability change becomes visible rather than assumed.
- **Persuasion** — quiz, archetypes, in-character coach reactions, decision
  counter (unchanged from prior builds).

The six axes are proposed defaults grounded in behavioural-finance constructs
(self-regulation/present bias, loss aversion, temporal discounting, financial
avoidance, self-efficacy per Lown, and prosocial spending) — each axis names its
construct in `fbm.js`. Rename or reweight there; scoring, matching, and the
capability index all read from that one definition block.

## Telemetry & longitudinal evidence

Every sandbox decision writes a PIPE telemetry row (`scenario_choices`):
`decision_index, wellbeing, zone, archetype_expected, gap, trigger_kind,
characteristic_drift, session_id`. `session_id` groups a run so a full
trajectory can be reconstructed for analysis without identifying the person.
Server-side validation rejects any `zone`/`trigger_kind` outside the known
enum, so the analytics tables can't be poisoned by client input.

Trajectories (observed / archetype-expected / recalibrated / triggers) are
persisted with the sandbox state, so a signed-in learner's homeostasis history
survives reload and follows them across devices — this is what makes the
Evolution tenet measurable rather than assumed. Saves written before this
existed are detected and re-seeded rather than rendering an empty chart.

`db.py` runs an idempotent column migration on every boot, so an existing
deployment picks up the new fields without manual SQL or data loss.

The admin view aggregates the research signals: share of decisions inside the
zone, breakdown/distortion counts, PIPE trigger count, characteristic-drift
count, mean wellbeing, and mean person-archetype gap. All aggregate-only — no
individual data is shown.

## Coach integration (Persuasion)

The chat coach reads the learner's homeostasis state, so it responds to where
they actually are rather than talking in generalities. `coach.py` builds three
layers into every system prompt:

1. **Guardrails** — unchanged: educational coach, never a financial advisor.
2. **The homeostasis briefing** — the model is taught that wellbeing is a
   *regulated* state with two failure poles, and explicitly told that more
   saving is not automatically better, never to congratulate someone for
   drifting into distortion, and never to shame someone in breakdown.
3. **Live context** — current zone, wellbeing, decisions in vs out of the zone,
   PIPE trigger count, person-archetype gap, and this archetype's
   *characteristic* failure mode (mirrored from `ARCHETYPE_GAPS` in
   `deviation.js`). When the latest decision moved along that characteristic
   direction, the coach is told to name the pattern gently.

**Transparency.** The chat page shows a banner stating exactly what the coach
can see, with a one-tap "Don't share" toggle. Passing this context silently
would be a trust problem rather than a feature. Context is also scoped to the
archetype being spoken to — another coach's context is never sent — and stale
snapshots (>14 days) are discarded rather than producing confidently wrong
statements.

**Input safety.** Context originates on the client and lands in a model prompt,
so `server.py` bounds-checks every field: enums are allow-listed, integers are
clamped to sane ranges, and anything else becomes null. Prompt-injection
attempts through the context fields are dropped before reaching the model.

## Adaptive scenarios (Immersion)

Scenario selection responds to homeostatic state, so pressure is felt where the
learner actually is rather than sampled at random:

- **In breakdown** — recovery pressure dominates (~48%): settlement offers,
  extra shifts, liquidating an unused asset. The question is whether they can
  take a repair route rather than deepen the hole.
- **In distortion** — living pressure dominates (~49%): a friend's wedding, a
  postponed health check, replacing equipment that slows their work. The
  question is whether they can actually deploy resources rather than defer life.
- **In zone** — the full range stays visible, so the sandbox never narrows.
- **Drifting characteristically** — archetype-themed pressure is amplified when
  their last move went in their archetype's own failure direction.

Weighted, never hard-filtered, and consecutive repeats are suppressed.

This is where the non-monotonic wellbeing model earns its keep: for a learner
in distortion, *spending* raises their wellbeing score, because it moves them
back toward the viable band. A monotonic "more savings is better" model could
not represent that, and would have coached hoarding as success.

## Safeguarding

A financial capability tool meets people in real difficulty. `safeguarding.py`
detects language signalling risk and makes sure they reach help.

**Design principles, and why:**
- **High recall, low precision by design.** A false positive costs a gentle,
  dismissable offer of support. A false negative hands someone in crisis a
  budgeting tip. Those are not symmetric, so the patterns are deliberately wide.
- **Never blocks the conversation.** The coach still replies; safeguarding is
  attached alongside. Being cut off mid-disclosure is its own harm.
- **Cannot fail closed.** If the AI provider is down, a detected signal is
  still delivered (200 with resources, not a 503). The persistent "Need real
  help?" button on every page calls a separate endpoint and falls back to a
  hard-coded directory if even that fails — nobody should have to converse with
  an AI to find a helpline.
- **No verbatim storage.** Detection returns only `{severity, category}`.
  What someone wrote is never logged or returned.
- **Persona is overridden at crisis level.** The model is instructed to drop
  the character voice entirely, stop problem-solving money, and respond plainly.

Three severity tiers: `crisis` (risk to life), `urgent` (coercion, gambling,
destitution), `support` (debt crisis needing real advice).

**!! BEFORE DEPLOYMENT !!** `RESOURCES` must be localised and every contact
detail verified. Phone fields ship **blank on purpose** — publishing a wrong
crisis number is worse than publishing none. Set `SAFEGUARDING_REGION` and fill
in verified details. A `nz` set and a generic international fallback are
included as structure, not as verified data.

## Architecture: theory in the engine, plain language in the interface

The engine reasons in scores, zones, thresholds and gaps. The person never sees
any of it. `observations.js` is the translation layer:

```
engine:  wellbeing 38 · breakdown · gap -14 · characteristic drift
person:  "That's the third time you've reached for credit when something
          came up."
```

**Rule for anything added to the learner surface:** if a sentence contains a
number that only makes sense inside the model, it belongs in the research view.
Counts of the person's own actions are fine — those are observable facts.

**The front door is a situation, not a control panel.** `situations.js` asks
"what are you dealing with right now?" and quietly seeds the starting state,
a working coach voice, and scenario bias. The archetype is a hypothesis the
engine refines from behaviour — never announced as a verdict on arrival.

**The quiz is now optional and returns prose.** Same six-axis scoring
underneath, stored and used by the engine; the person gets a characterisation
("You tend to buy first and think after, and you'd rather not look too closely
at the numbers") plus an explicit hedge that it isn't a verdict. No axis bars,
no capability index, no construct names.

**`research.html`** is where the instrument lives — thresholds, the
archetype-expected line, gap annotations, PIPE trigger markers, archetype
positions, aggregate telemetry. Admin-gated, `noindex`. `chart.js` takes a mode:
`simple` for learners (a shaded "comfortable range", no scale, no vocabulary)
and `research` for the full instrument.

## UX architecture

**App shell.** `ui.js` injects persistent bottom navigation (Practise / Coach /
Progress) on every in-app surface. Previously the sandbox was a dead end — you
could get in but not across without going home first.

**Session structure.** Decisions are grouped into rounds of six (`session.js`).
A round ends in a recap: what you actually did, stated as facts about your own
actions, plus one specific thing to carry forward. This gives effort a payoff
and a natural place to stop, without gamifying money — no streaks, no points,
no badges, because that's the wrong register for this product.

**Information hierarchy.** The scenario owns the screen. Metrics, chart and
history collapse into a "Your numbers" drawer that keeps a live summary in its
label (`$6,000 saved · $2,000 owed`), so closing it costs nothing. Previously
eleven panels competed for attention at once.

**Keyboard control.** `1`–`4` pick a choice, `R` rolls a new scenario, `D`
toggles the drawer, `?` lists everything. Keys are shown on the buttons
themselves rather than hidden in a help menu. Shortcuts never fire while
typing or while a dialog is open.

**Feedback.** Every decision surfaces its observation as a toast, so an action
is never silent even with the drawer closed.

**Chat starters.** The coach opens with three contextual prompts rather than a
blank input — a blank box asks someone to invent a question about a subject
they may find stressful. Prompts adapt: a person running thin sees "How do I
rebuild a buffer from nothing?", someone over-saving sees "Why does spending
anything feel wrong?", and a returning practiser sees "What patterns are you
seeing in my choices?"

**Offline.** A banner states what's happening and reassures that progress is
saved, rather than letting sends fail silently. Reconnecting confirms via toast.

**First run.** One dismissible line ("there's no right answer, and none of this
is real money"), not a multi-step tour — people arrive to try it, not read it.

**Mobile.** Keyboard hints hide on touch (meaningless without a keyboard),
metrics go two-up, and every interactive target is at least 44px on coarse
pointers.

## Files
- `index.html` — landing page: hero, persona deck, quiz trigger
- `dashboard.html` — decision sandbox: persona/difficulty selection, scenarios, wellbeing panel, net worth chart
- `data.js` — **single source of truth**: persona list, baseline financial profiles, shared helpers, persona persistence
- `script.js` — persona deck rendering + sticky header + entrance animation (index.html only)
- `quiz.js` — 5-question quiz, scores five temperament groups, shows a match with a copy-able link, hands off to the sandbox (index.html only)
- `dashboard.js` — scenario engine (generic + persona-themed pools), persona-voiced reactions, wellbeing math, canvas net worth chart (dashboard.html only)
- `auth.js` — real Google sign-in via Google Identity Services, with server-side verification when a backend is available (both pages)
- `api.js` — backend integration seam: real fetch calls with mock-data fallback (both pages)
- `server.py` / `requirements.txt` — a real, runnable reference backend implementing every endpoint `api.js` expects
- `styles.css` — shared design system for both pages (dark mode, motion, all of it)
- `analysis/research_analysis.py` — pandas/statsmodels analysis pipeline for the Phase 3 study data described in `PAPER.md` §8 (`pip install -r analysis/requirements-analysis.txt` first; kept out of the app's own `requirements.txt` since the deployed server never needs it)
- `coach_agent.py` / `rag/` — LangChain tool-using agent variant of the coaching chat (`LLM_ENGINE=agent`), with a RAG tool (`search_research_notes`) that retrieves from a local vector index built from `idm.js`/`learn.js`/`PAPER.md`'s own citations. See `coach_agent.py`'s module docstring and `pip install -r requirements-agent.txt` + `python -m rag.build_index` to run it

## What's real vs. what's a stub
- **Real**: quiz scoring, the scenario engine (including persona-themed scenarios and
  in-character reactions to your choices), the emergency-fund/debt-to-income math, the
  net worth chart, empty/loading states, persona hand-off between pages, dark mode,
  the quiz modal's keyboard accessibility, Google sign-in, and — as of this pass — a
  working reference backend (`server.py`) that really does verify Google ID tokens and
  really does serve persona data over HTTP.
- **Stub, by design, until you point it at your own infrastructure**: `PERSONA_FINANCE`
  numbers (both in `data.js` and mirrored in `server.py`) are illustrative, and
  `API_BASE_URL` in `api.js` defaults to `""` so the frontend stays on mock data unless
  you explicitly turn `server.py` (or your real backend) on.

## Running the reference backend
```
pip install -r requirements.txt
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
python server.py
```
Then set `API_BASE_URL = "http://localhost:5000"` in `api.js` and `GOOGLE_CLIENT_ID`
in `auth.js` to the same value. From that point: persona data comes from a real HTTP
call (`GET /api/persona-finance/:slug`), every scenario choice is logged server-side
(`POST /api/scenario-choice`), and signing in actually verifies your Google ID token
against Google's servers (`POST /api/auth/verify`) instead of only decoding it in the
browser. `server.py` also serves the static files directly, so `python server.py` and
opening `http://localhost:5000` is enough to run the whole thing end to end.

## Scenario engine, in more detail
Every scenario choice carries a `flavor` (which of the five temperaments it represents).
After each decision, `reactionFor()` compares that flavor to the active persona's own
group and shows a short in-character line — affirming when they match, gently
noting the divergence when they don't. `THEMED_SCENARIOS` adds one scenario per
temperament group that's mixed in about 45% of the time once a persona is selected, on
top of the six generic scenarios everyone can see.

## UI pass — what changed
- Dark mode via `prefers-color-scheme`, no toggle needed — every color in `styles.css`
  routes through a CSS variable so it flips automatically.
- Sticky, blurring header on scroll on both pages.
- Persona deck fades/staggers in on load; new scenarios fade in on the sandbox; new
  change-log rows slide in; metric numbers count up and briefly outline their card
  when a decision changes them, instead of snapping instantly.
- Emergency-fund and debt-to-income are now progress bars, not just colored text,
  so "how close to the target" is visible at a glance.
- Net worth chart got an area fill under the line and min/max labels, and its colors
  now read from the same CSS variables as everything else (so it's correct in dark
  mode too, not just the rest of the page).
- Added a real favicon and `<meta description>`/Open Graph tags to both pages (link
  previews and browser tabs no longer look bare).
- Respects `prefers-reduced-motion` — all the above animation drops to instant for
  anyone who's asked their OS for that.

## Setting up real Google sign-in
`auth.js` uses [Google Identity Services](https://developers.google.com/identity/gsi/web/guides/overview),
the actual library Google ships for this — not a placeholder.
1. Create an OAuth client ID at https://console.cloud.google.com/apis/credentials
   (type: "Web application"), and add your deployed domain under "Authorized
   JavaScript origins."
2. Replace `GOOGLE_CLIENT_ID` at the top of `auth.js` with that client ID.
3. **Security note**: `auth.js` decodes the returned JWT client-side to show a name,
   email, and avatar — that's fine for UI display only. Before trusting a signed-in
   user for anything privileged (reading real financial data, writing to a database),
   send `response.credential` to your backend and verify it there. A client can fake
   anything the client itself decodes.

## Connecting a real backend
`api.js` defines the exact contract your backend needs to implement — two endpoints,
documented at the top of the file (`GET /api/persona-finance/:slug`,
`POST /api/scenario-choice`). Set `API_BASE_URL` once those exist and `dashboard.js`
switches from mock to live data automatically; no other file needs to change. Until
then, it silently falls back to `PERSONA_FINANCE` and logs a console warning.

## Design decisions
- **Type**: Fraunces (display) + IBM Plex Sans (body) + IBM Plex Mono (eyebrow label).
  Avoids the generic "cream background + terracotta accent" AI-default look.
- **Color**: a ledger-paper palette (`--paper`, `--ink`) with five accent hues, one per
  behavioral group (conservative / growth-seeking / impulsive / uncertain / generous),
  so color carries meaning instead of decorating randomly.
- **Signature element**: two-letter monogram badges instead of icons or emoji — reads
  like a ledger/card-catalog system and needs no icon library or asset pipeline.

## Recommended next changes (in priority order)

1. **Replace the in-memory backend with a real database.** `server.py` works, but
   `PERSONA_FINANCE` and `SCENARIO_LOG` reset every time the process restarts. Swap
   them for Postgres/SQLite once this needs to survive a deploy.

2. **Persist a real session after verification**, not just an echoed user object.
   `POST /api/auth/verify` currently just confirms the token and hands back the
   profile — issue a real session cookie or JWT of your own so subsequent requests
   don't need to re-send the Google credential every time.

3. **Seed `PERSONA_FINANCE` from the signed-in user's real accounts** once you have
   a source for that (Plaid, manual entry, whatever fits) instead of the shared
   illustrative baseline every persona currently uses.

4. **Build out the actual `/chat_api/<slug>` coaching pages.** Everything here — deck,
   quiz, sandbox — points at those routes but assumes they already exist server-side;
   this repo doesn't touch that conversation UI at all.

5. **Consider weighting scenario selection by wellbeing status**, not just persona
   group — e.g. surface debt-related scenarios more often once DTI crosses into
   "watch," so the sandbox responds to how someone's actually doing, not just who
   they picked at the start.
