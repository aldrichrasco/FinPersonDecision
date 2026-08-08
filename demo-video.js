// Landing-page product demo. Three things this has to get right:
//
//  1. Deploy-safe before the clip exists. The section ships hidden and is
//     only revealed once the file genuinely loads. A missing asset is
//     therefore invisible, not a broken player with a grey box.
//  2. Bandwidth. preload="none" in the markup means nothing is fetched
//     until the section actually scrolls into view (IntersectionObserver
//     below) — every byte is Railway egress, and most visitors never reach
//     this far down the page.
//  3. Motion sensitivity. prefers-reduced-motion gets the poster frame and
//     an explicit Play button instead of an autoplaying loop.
(function () {
  const section = document.getElementById("demo-video-section");
  const video = document.getElementById("demo-video");
  const toggle = document.getElementById("demo-video-toggle");
  if (!section || !video) return;

  const reduceMotion = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Only a real, playable file reveals the section. `loadeddata` (not
  // `loadedmetadata`) so a truncated/corrupt upload doesn't count either.
  video.addEventListener("loadeddata", () => {
    section.hidden = false;
    // Reclaim the hero's large top padding — that empty band is the space
    // the video now fills, so keeping both pushes the CTA below the fold.
    // Only applied once the clip really loaded, so a missing asset leaves
    // the original hero spacing untouched.
    // Queried from the document, not closest(): the banner is a sibling of
    // .hero now (it has to sit outside .wrap to go full-bleed), so walking
    // up from it would never find the hero.
    if (reduceMotion) {
      toggle.hidden = false;
    } else {
      video.play().catch(() => {
        // Autoplay refused (some mobile power-saving modes do this even
        // when muted) — fall back to the manual control rather than
        // leaving a frozen first frame with no affordance.
        toggle.hidden = false;
      });
    }
  });

  // Any failure to source the file keeps the whole section hidden.
  video.addEventListener("error", () => { section.hidden = true; }, true);

  toggle.addEventListener("click", () => {
    const playing = !video.paused;
    if (playing) {
      video.pause();
      toggle.textContent = "Play";
    } else {
      video.play().catch(() => {});
      toggle.textContent = "Pause";
    }
    toggle.setAttribute("aria-pressed", String(!playing));
  });

  // Defer the actual download until it's nearly on screen.
  function beginLoad() {
    if (video.dataset.started) return;
    video.dataset.started = "1";
    video.preload = "auto";
    video.load();
  }

  // Observe the sentinel, NOT the section: the section ships hidden, and a
  // display:none element has no layout box, so it never intersects — which
  // would deadlock (no load -> no loadeddata -> never revealed, even once
  // the file exists). The sentinel stays visible so the trigger still fires.
  const sentinel = document.getElementById("demo-video-sentinel");
  if ("IntersectionObserver" in window && sentinel) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { beginLoad(); io.disconnect(); }
      });
    }, { rootMargin: "300px" });
    io.observe(sentinel);
  } else {
    beginLoad();
  }
})();
