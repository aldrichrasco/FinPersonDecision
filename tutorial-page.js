// Quick tour — a scripted conversation, not a live one. Reuses the real
// coach's chat-bubble markup/CSS so the tutorial visually feels like the
// product it's explaining, rather than a separate marketing component.
// Labeled "Guide" throughout (never "Coach") so nobody mistakes this
// canned walkthrough for the real AI coach.
(function () {
  const SCRIPT = [
    { role: "assistant", text: "Welcome to FinPerson. I'm not going to lecture you — let me just show you how this works." },
    { role: "assistant", text: "Everything here starts from one idea: you learn more from watching your own choices than from reading advice." },
    { role: "user", text: "Okay, where do I start?" },
    { role: "assistant", text: "A 30-second quiz gives you a starting profile across six behavioral axes, and matches you to one of eleven archetypes." },
    { role: "assistant", text: "Then the sandbox: real-feeling money scenarios. You pick what you'd actually do, and your numbers react immediately — no waiting, no guessing." },
    { role: "user", text: "What if I don't understand why something moved?" },
    { role: "assistant", text: "That's what I'm there for in the sandbox — ask anything about a decision and I'll help you think it through. I won't tell you what to pick." },
    { role: "assistant", text: "Everything you do feeds Progress: your trend over time, and calibration — how well your confidence matched what actually happened." },
    { role: "assistant", text: "There's also Learn, with short lessons matched to your biggest growth areas, plus a streak and a daily goal to keep it light." },
    { role: "assistant", text: "That's the whole loop. Ready to find your starting point?" },
  ];

  const win = document.getElementById("tutorial-window");
  const skipBtn = document.getElementById("tutorial-skip");
  const cta = document.getElementById("tutorial-cta");
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let index = 0;
  let timer = null;
  let done = false;

  function addBubble(role, text) {
    const row = document.createElement("div");
    row.className = `chat-msg chat-msg-${role}`;
    if (role === "assistant") {
      row.innerHTML = `<span class="chat-msg-icon">G</span><div class="chat-bubble">${esc(text)}</div>`;
    } else {
      row.innerHTML = `<div class="chat-bubble">${esc(text)}</div>`;
    }
    win.appendChild(row);
    win.scrollTop = win.scrollHeight;
  }

  function addPending() {
    const row = document.createElement("div");
    row.className = "chat-msg chat-msg-assistant chat-msg-pending";
    row.id = "tutorial-pending";
    row.innerHTML = `<span class="chat-msg-icon">G</span><div class="chat-bubble">&hellip;</div>`;
    win.appendChild(row);
    win.scrollTop = win.scrollHeight;
  }

  function removePending() {
    const el = document.getElementById("tutorial-pending");
    if (el) el.remove();
  }

  function finish() {
    done = true;
    clearTimeout(timer);
    removePending();
    cta.hidden = false;
    skipBtn.hidden = true;
  }

  function step() {
    if (index >= SCRIPT.length) { finish(); return; }
    const msg = SCRIPT[index];
    index += 1;

    if (reduceMotion || msg.role === "user") {
      addBubble(msg.role, msg.text);
      timer = setTimeout(step, reduceMotion ? 60 : 500);
      return;
    }
    addPending();
    timer = setTimeout(() => {
      removePending();
      addBubble(msg.role, msg.text);
      timer = setTimeout(step, 650);
    }, 550);
  }

  skipBtn.addEventListener("click", () => {
    clearTimeout(timer);
    removePending();
    win.innerHTML = "";
    SCRIPT.forEach(msg => addBubble(msg.role, msg.text));
    finish();
  });

  step();
})();
