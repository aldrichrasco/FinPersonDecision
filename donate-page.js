// "Monthly supporter" card — real Stripe Checkout, gated on nothing (this
// is a recurring payment, not unlocked content, so it doesn't touch
// report-page.js's "never fake-gate" stance). Every other card on this page
// is a plain link out; this one needs JS because starting a Checkout
// session requires a signed-in user_id (see billing.py, server.py).
(function () {
  const btn = document.getElementById("donate-stripe-btn");
  const status = document.getElementById("donate-stripe-status");
  if (!btn || !status) return;

  const params = new URLSearchParams(window.location.search);
  if (params.get("billing") === "success") {
    status.textContent = "Thank you — your subscription is active.";
  } else if (params.get("billing") === "cancel") {
    status.textContent = "Checkout was cancelled — no charge was made.";
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    status.textContent = "Starting checkout…";
    try {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        credentials: "include",
      });
      if (res.status === 401) {
        status.textContent = "Sign in first, then come back to become a supporter.";
        btn.disabled = false;
        return;
      }
      if (res.status === 503) {
        status.textContent = "Monthly subscriptions aren't set up yet — try one of the other options above.";
        btn.disabled = false;
        return;
      }
      if (!res.ok) throw new Error("checkout failed");
      const data = await res.json();
      window.location.href = data.url;
    } catch (e) {
      status.textContent = "Something went wrong — try again in a moment.";
      btn.disabled = false;
    }
  });
})();
