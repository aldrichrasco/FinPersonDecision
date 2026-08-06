// Standalone Stripe Checkout entry point — same flow as chat.js's paywall
// and pro-turtle-page.js's upsell, just reachable without hitting the
// paywall first. Kept in its own file (not inline) because this app's CSP
// is script-src 'self' — no inline script execution at all.
(function () {
  const PRICES = {
    monthly: { amount: "$5", suffix: "/mo", note: "Everything in Free, plus:" },
    yearly: { amount: "$40", suffix: "/yr", note: "Two months free vs monthly. Everything in Free, plus:" },
  };

  let interval = "monthly";

  const amountEl = document.getElementById("pricing-amount");
  const subEl = document.getElementById("pricing-sub");
  const intervalRow = document.getElementById("pricing-interval");
  const btn = document.getElementById("pricing-subscribe-btn");
  const status = document.getElementById("pricing-status");

  function renderPrice() {
    const p = PRICES[interval];
    amountEl.innerHTML = `${p.amount}<span style="font-size:15px;color:var(--slate);font-weight:400;">${p.suffix}</span>`;
    subEl.textContent = p.note;
    btn.textContent = `Become a supporter — ${p.amount}${p.suffix}`;
  }

  // Only reveal the toggle once the server confirms a real yearly price
  // exists; otherwise the card stays monthly-only rather than offering a
  // plan that would fall back to charging monthly.
  fetch(`${API_BASE_URL}/api/billing/status`, { credentials: "include" })
    .then(r => r.json())
    .then(data => { if (data && data.yearly_available) intervalRow.hidden = false; })
    .catch(() => {});

  intervalRow.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      if (chip.dataset.interval === interval) return;
      interval = chip.dataset.interval;
      intervalRow.querySelectorAll(".chip").forEach(c => {
        c.classList.toggle("active", c === chip);
        c.setAttribute("aria-pressed", String(c === chip));
      });
      renderPrice();
    });
  });

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    status.textContent = "Starting checkout…";
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ interval }),
      });
      if (res.status === 401) {
        status.textContent = "Sign in first, then come back to subscribe.";
        btn.disabled = false;
        return;
      }
      if (res.status === 503) {
        status.textContent = "Subscriptions aren't set up yet on this deployment.";
        btn.disabled = false;
        return;
      }
      if (!res.ok) throw new Error("checkout failed");
      const data = await res.json();
      window.location.href = data.url;
    } catch (err) {
      status.textContent = "Something went wrong — try again in a moment.";
      btn.disabled = false;
    }
  });

  renderPrice();
})();
