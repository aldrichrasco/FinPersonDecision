// Reset-password page — reached via the emailed link
// (reset-password.html?token=...), not a modal, since the user hasn't
// loaded the app yet when they click that link.
(function () {
  const params = new URLSearchParams(location.search);
  const token = params.get("token") || "";

  const formEl = document.getElementById("reset-form");
  const doneEl = document.getElementById("reset-done");
  const invalidEl = document.getElementById("reset-invalid");

  if (!token) {
    formEl.hidden = true;
    invalidEl.hidden = false;
    return;
  }

  const pass1 = document.getElementById("rp-pass");
  const pass2 = document.getElementById("rp-pass2");
  const errEl = document.getElementById("rp-error");
  const submit = document.getElementById("rp-submit");

  submit.addEventListener("click", async () => {
    const password = pass1.value;
    errEl.hidden = true;

    if (password.length < 8) {
      errEl.textContent = "Password must be at least 8 characters.";
      errEl.hidden = false;
      return;
    }
    if (password !== pass2.value) {
      errEl.textContent = "Passwords don't match.";
      errEl.hidden = false;
      return;
    }

    submit.disabled = true;
    submit.textContent = "…";
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.error || "Something went wrong.";
        errEl.hidden = false;
        submit.disabled = false;
        submit.textContent = "Set new password";
        return;
      }
      formEl.hidden = true;
      doneEl.hidden = false;
    } catch (e) {
      errEl.textContent = "Couldn't reach the server.";
      errEl.hidden = false;
      submit.disabled = false;
      submit.textContent = "Set new password";
    }
  });

  const retryBtn = document.getElementById("reset-retry-btn");
  if (retryBtn) {
    retryBtn.addEventListener("click", () => { location.href = "index.html"; });
  }
})();
