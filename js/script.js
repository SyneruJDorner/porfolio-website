(function () {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  const SCROLL_LOCK_MS = 650;
  const TIMELINE_STAGGER_MS = 70;
  const CARD_STAGGER_MS = 85;
  const SECTION_REVEAL_THRESHOLD = 0.38;
  const TIMELINE_REVEAL_THRESHOLD = 0.3;
  const CARD_REVEAL_THRESHOLD = 0.24;
  const RATE_LIMIT_MS = 30_000;
  const MIN_WHEEL_DELTA = 8;
  const BACKGROUND_SAMPLE_FPS = 60;
  const VIDEO_SEEK_EPSILON = 1 / BACKGROUND_SAMPLE_FPS;
  const BACKGROUND_VIDEO_PATH = "assets/bg/background.mp4";

  function resetToHeroOnLoad() {
    if (window.location.hash) {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }

  resetToHeroOnLoad();

  const progressBar = document.getElementById("scrollProgress");
  const bgCycle = document.getElementById("bgCycle");
  const contactForm = document.getElementById("contactForm");
  const contactStatus = document.getElementById("contactStatus");
  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function isCompactViewport() {
    return (
      window.matchMedia("(max-width: 1024px)").matches ||
      window.matchMedia("(pointer: coarse)").matches
    );
  }

  function syncSnapMode() {
    if (prefersReducedMotion || isCompactViewport()) {
      document.body.classList.remove("snap-enabled");
    } else {
      document.body.classList.add("snap-enabled");
    }
  }

  let bgVideo = null;
  let hasVideoBackground = false;
  let videoDuration = 0;
  let activeVideoTime = -1;
  let isSnapAnimating = false;
  let snapSections = [];
  let cachedMaxScroll = 1;
  let progressRaf = 0;
  let lastProgressWidth = -1;

  function refreshSnapSections() {
    snapSections = Array.from(
      document.querySelectorAll("header.hero, main > section"),
    );
  }

  function getClosestSectionIndex() {
    if (!snapSections.length) return 0;

    let closestIndex = 0;
    let minDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < snapSections.length; i += 1) {
      const rect = snapSections[i].getBoundingClientRect();
      const distance = Math.abs(rect.top);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  function scrollToSection(nextIndex) {
    if (!snapSections.length) return;

    const clampedIndex = Math.min(
      snapSections.length - 1,
      Math.max(0, nextIndex),
    );

    isSnapAnimating = true;
    snapSections[clampedIndex].scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    setTimeout(() => {
      isSnapAnimating = false;
    }, SCROLL_LOCK_MS);
  }

  function revealCardsInSection(sectionElement, shouldReveal) {
    if (!sectionElement || !sectionElement.querySelectorAll) return;

    const cards = sectionElement.querySelectorAll(
      ".values-grid .value-card, .bento article, .cards .project-card",
    );

    for (const card of cards) {
      card.classList.toggle("card-visible", shouldReveal);
    }
  }

  function bindSectionReveal() {
    if (!snapSections.length || !window.IntersectionObserver) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const replayEnabled = !isCompactViewport();
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            revealCardsInSection(entry.target, true);
          } else if (replayEnabled) {
            entry.target.classList.remove("in-view");
            revealCardsInSection(entry.target, false);
          }
        }
      },
      {
        threshold: SECTION_REVEAL_THRESHOLD,
      },
    );

    for (const section of snapSections) {
      observer.observe(section);
    }
  }

  function bindTimelineReveal() {
    const timelineItems = Array.from(document.querySelectorAll(".timeline li"));
    if (!timelineItems.length) return;

    for (let i = 0; i < timelineItems.length; i += 1) {
      timelineItems[i].style.setProperty(
        "--timeline-delay",
        `${i * TIMELINE_STAGGER_MS}ms`,
      );
    }

    if (prefersReducedMotion || !window.IntersectionObserver) {
      for (const item of timelineItems) {
        item.classList.add("timeline-visible");
      }
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const replayEnabled = !isCompactViewport();
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("timeline-visible");
          } else if (replayEnabled) {
            entry.target.classList.remove("timeline-visible");
          }
        }
      },
      {
        threshold: TIMELINE_REVEAL_THRESHOLD,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    for (const item of timelineItems) {
      observer.observe(item);
    }
  }

  function bindCardReveal() {
    const cardGroups = [
      Array.from(document.querySelectorAll(".values-grid .value-card")),
      Array.from(document.querySelectorAll(".bento article")),
      Array.from(document.querySelectorAll(".cards .project-card")),
    ].filter((group) => group.length > 0);

    if (!cardGroups.length) return;

    for (const group of cardGroups) {
      for (let i = 0; i < group.length; i += 1) {
        group[i].style.setProperty("--card-delay", `${i * CARD_STAGGER_MS}ms`);
      }
    }

    const allCards = cardGroups.flat();

    if (prefersReducedMotion || !window.IntersectionObserver) {
      for (const card of allCards) {
        card.classList.add("card-visible");
      }
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const replayEnabled = !isCompactViewport();
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("card-visible");
          } else if (replayEnabled) {
            entry.target.classList.remove("card-visible");
          }
        }
      },
      {
        threshold: CARD_REVEAL_THRESHOLD,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    for (const card of allCards) {
      observer.observe(card);
    }
  }

  function bindWheelSnap() {
    syncSnapMode();

    window.addEventListener(
      "wheel",
      (event) => {
        if (isCompactViewport()) return;
        if (event.ctrlKey) return;
        if (Math.abs(event.deltaY) < MIN_WHEEL_DELTA) return;
        if (isSnapAnimating) {
          event.preventDefault();
          return;
        }

        const target = event.target;
        if (
          target &&
          target.closest &&
          target.closest("textarea, input, select, [contenteditable='true']")
        ) {
          return;
        }

        const current = getClosestSectionIndex();
        const direction = event.deltaY > 0 ? 1 : -1;
        const next = current + direction;
        if (next < 0 || next >= snapSections.length) return;

        event.preventDefault();
        scrollToSection(next);
      },
      { passive: false },
    );
  }

  function initBackgroundVideo() {
    if (!bgCycle) return Promise.resolve(false);

    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.className = "bg-video";
      video.setAttribute("aria-hidden", "true");
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.preload = "auto";
      video.loop = false;
      video.muted = true;
      video.playsInline = true;
      video.src = BACKGROUND_VIDEO_PATH;

      const cleanup = () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
      };

      const onLoaded = () => {
        cleanup();

        videoDuration = Number.isFinite(video.duration) ? video.duration : 0;
        if (videoDuration <= 0) {
          video.remove();
          resolve(false);
          return;
        }

        bgVideo = video;
        hasVideoBackground = true;
        bgCycle.style.display = "none";
        resolve(true);
      };

      const onError = () => {
        cleanup();
        video.remove();
        resolve(false);
      };

      video.addEventListener("loadedmetadata", onLoaded, { once: true });
      video.addEventListener("error", onError, { once: true });

      bgCycle.parentNode.insertBefore(video, bgCycle);
      video.load();
    });
  }

  function updateBackgroundByScroll(scrollRatio) {
    if (!hasVideoBackground || !bgVideo || videoDuration <= 0) return;

    const clampedRatio = Math.min(1, Math.max(0, scrollRatio));
    const steppedTime =
      Math.round(clampedRatio * videoDuration * BACKGROUND_SAMPLE_FPS) /
      BACKGROUND_SAMPLE_FPS;

    if (Math.abs(steppedTime - activeVideoTime) >= VIDEO_SEEK_EPSILON) {
      bgVideo.currentTime = steppedTime;
      activeVideoTime = steppedTime;
    }
  }

  function recomputeScrollBounds() {
    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;
    cachedMaxScroll = maxScroll > 0 ? maxScroll : 1;
  }

  function renderProgress() {
    const ratio = Math.min(1, Math.max(0, window.scrollY / cachedMaxScroll));

    if (progressBar) {
      const value = Math.min(100, Math.max(0, ratio * 100));
      if (value !== lastProgressWidth) {
        progressBar.style.width = `${value}%`;
        lastProgressWidth = value;
      }
    }

    updateBackgroundByScroll(ratio);
  }

  function scheduleProgressRender() {
    if (progressRaf) return;

    progressRaf = window.requestAnimationFrame(() => {
      renderProgress();
      progressRaf = 0;
    });
  }

  function setContactStatus(text, isError) {
    if (!contactStatus) return;
    contactStatus.textContent = text;
    contactStatus.style.color = isError ? "#ffcb9a" : "#d1e8e2";
  }

  function setContactStatusWithLink(text, href, linkLabel, isError) {
    if (!contactStatus) return;

    contactStatus.style.color = isError ? "#ffcb9a" : "#d1e8e2";
    contactStatus.textContent = "";

    const prefix = document.createElement("span");
    prefix.textContent = `${text} `;
    contactStatus.appendChild(prefix);

    const link = document.createElement("a");
    link.href = href;
    link.textContent = linkLabel;
    link.style.color = "inherit";
    link.style.textDecoration = "underline";
    contactStatus.appendChild(link);
  }

  function triggerMailto(mailtoUrl) {
    try {
      const tempLink = document.createElement("a");
      tempLink.href = mailtoUrl;
      tempLink.style.display = "none";
      document.body.appendChild(tempLink);
      tempLink.click();
      tempLink.remove();
    } catch {
      // Fail silently and rely on fallback message.
    }
  }

  function isRateLimited() {
    const key = "contact:lastSubmit";
    const now = Date.now();
    const last = Number(localStorage.getItem(key) || 0);
    if (now - last < RATE_LIMIT_MS) {
      return true;
    }
    localStorage.setItem(key, String(now));
    return false;
  }

  function bindContactForm() {
    if (!contactForm) return;

    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const name = document.getElementById("contactName").value.trim();
      const email = document.getElementById("contactEmail").value.trim();
      const message = document.getElementById("contactMessage").value.trim();
      const website = document.getElementById("contactWebsite").value.trim();

      if (website) {
        setContactStatus("Thanks. Your message was received.", false);
        return;
      }

      if (!name || !email || !message) {
        setContactStatus("Please fill in name, email, and message.", true);
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setContactStatus("Please enter a valid email address.", true);
        return;
      }

      if (isRateLimited()) {
        setContactStatus(
          "Please wait 30 seconds before sending another message.",
          true,
        );
        return;
      }

      const subject = encodeURIComponent(`Portfolio Contact from ${name}`);
      const body = encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      );
      const mailtoUrl = `mailto:justindd1994@gmail.com?subject=${subject}&body=${body}`;

      triggerMailto(mailtoUrl);
      setContactStatus("Opening your email app...", false);

      window.setTimeout(() => {
        setContactStatusWithLink(
          "If nothing opened, use this direct link:",
          mailtoUrl,
          "Open email draft",
          false,
        );
      }, 1200);
    });
  }

  async function init() {
    const videoReady = await initBackgroundVideo();
    if (!videoReady && bgCycle) {
      bgCycle.style.display = "none";
    }

    refreshSnapSections();
    document.body.classList.add("js-enhanced");
    bindSectionReveal();
    bindTimelineReveal();
    bindCardReveal();
    bindWheelSnap();
    recomputeScrollBounds();
    renderProgress();
    bindContactForm();
  }

  init();

  window.addEventListener("scroll", scheduleProgressRender, { passive: true });
  window.addEventListener("resize", () => {
    syncSnapMode();
    refreshSnapSections();
    recomputeScrollBounds();
    scheduleProgressRender();
  });
  window.addEventListener("pageshow", resetToHeroOnLoad);
  window.addEventListener("load", () => {
    resetToHeroOnLoad();
    recomputeScrollBounds();
    scheduleProgressRender();
  });
})();
