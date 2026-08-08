// Public self-enrolment for the research study. Previously the ONLY way in
// was a private "?sc=CODE" link a researcher handed out — the backend
// (study.py's enrol()) already accepts any well-formed code and assigns an
// arm deterministically by hashing it, so self-enrolment needed no new
// server work, just a client-generated code and a real page to ask from.
//
// Deliberate trade-off, made explicit rather than silently inherited: this
// opens the sample to self-selection (people who go looking for a research
// study differ from people randomly handed a link), which a controlled trial
// section of the paper would need to account for or exclude. That's a call
// for whoever's running the study, not something to bury in a comment.
(function () {
  const content = document.getElementById("join-study-content");
  if (!content) return;

  // Already joined (came from an invite link earlier, or joined before) —
  // no need to ask again.
  if (typeof studyCode !== "undefined" && studyCode) {
    renderAlreadyIn();
    return;
  }

  renderIntro();

  function renderIntro() {
    content.innerHTML = `
      <div class="scenario-card" style="margin:22px 0;">
        <p class="scenario-eyebrow">What joining means</p>
        <ul style="font-size:14.5px;line-height:1.7;margin:8px 0 0;padding-left:18px;">
          <li>We record the choices you make in the practice sandbox, how you move through the app, and any questionnaire answers.</li>
          <li>Everything is linked to a random code only — never your name, email, or real financial accounts.</li>
          <li>You can withdraw at any time, which deletes everything recorded about you.</li>
          <li>The app works identically either way — joining adds nothing to unlock and nothing to lose.</li>
        </ul>
      </div>
      <button class="btn btn-primary" id="join-study-btn" type="button">Join the study</button>
    `;
    document.getElementById("join-study-btn").addEventListener("click", startEnrolment);
  }

  function renderAlreadyIn() {
    content.innerHTML = `
      <div class="scenario-card" style="margin:22px 0;">
        <p class="scenario-eyebrow">You're already in</p>
        <p style="font-size:14.5px;line-height:1.6;margin:8px 0 0;">This browser is already enrolled and has given consent. You can withdraw at any time from the study badge on any page.</p>
      </div>
      <a class="btn btn-primary" href="dashboard.html">Go to the sandbox &rarr;</a>
    `;
  }

  function randomStudyCode() {
    const rnd = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())).replace(/-/g, "").slice(0, 10).toUpperCase();
    return `SELF-${rnd}`;
  }

  async function startEnrolment() {
    const btn = document.getElementById("join-study-btn");
    btn.disabled = true;
    btn.textContent = "Joining…";
    try {
      await enrolStudy(randomStudyCode());
    } catch (e) {
      content.innerHTML = `<p class="scenario-empty-body">Couldn't join right now — try again in a moment.</p>`;
      return;
    }
    watchConsentOutcome();
    showConsentGate();
  }

  // showConsentGate()'s Yes/No buttons close the overlay themselves with no
  // callback hook — watching for the overlay's removal is simpler than
  // reaching into study.js to add one, and keeps this page decoupled from
  // that module's internals.
  function watchConsentOutcome() {
    const observer = new MutationObserver(() => {
      if (!document.getElementById("consent-overlay")) {
        observer.disconnect();
        renderOutcome();
      }
    });
    observer.observe(document.body, { childList: true });
  }

  function renderOutcome() {
    if (typeof studyConsented !== "undefined" && studyConsented) {
      content.innerHTML = `
        <div class="scenario-card" style="margin:22px 0;">
          <p class="scenario-eyebrow">You're in</p>
          <p style="font-size:14.5px;line-height:1.6;margin:8px 0 0;">Thanks — head to the sandbox whenever you're ready. Your practice counts either way; this just means it's part of the research too.</p>
        </div>
        <a class="btn btn-primary" href="dashboard.html">Go to the sandbox &rarr;</a>
      `;
    } else {
      renderIntro();
    }
  }
})();
