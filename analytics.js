// Plausible analytics — cookie-free, no personal data collected, matches
// the privacy stance the rest of this app already takes (no bank
// aggregation, simulated money only). data-domain is set from the actual
// hostname at load time rather than hardcoded, so the same script works
// unchanged on localhost (skipped), a Railway *.up.railway.app domain, and
// a future custom domain — no per-environment config needed.
//
// To activate: create a free Plausible.io site for your production
// domain (Site Settings -> add site -> enter the domain, no code changes
// needed there). Until that's done, this script loads and silently does
// nothing useful — Plausible just won't have a matching site to log to.
(function () {
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "") return;
  const s = document.createElement("script");
  s.defer = true;
  s.setAttribute("data-domain", host);
  s.src = "https://plausible.io/js/script.js";
  document.head.appendChild(s);
})();
