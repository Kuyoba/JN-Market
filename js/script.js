(function () {
  "use strict";

  // ============================================================
  // FORM VALIDATION
  // ============================================================

  // colors a field's border and shows the message under it
  function setFieldState(field, state, message) {
    field.classList.remove("right-input", "wrong-input", "missing-input");
    if (state) field.classList.add(`${state}-input`);

    const result = document.getElementById(`${field.id}-res`);
    if (!result) return;

    result.classList.remove("right-result", "wrong-result", "missing-result");
    if (state) result.classList.add(`${state}-result`);
    result.textContent = message;
    result.style.display = message ? "block" : "none";
  }

  // checks one field using native HTML5 validity (required, type=email,
  // pattern) plus a light custom check for names; messages stay centralized
  function validateField(field) {
    const validity = field.validity;
    const labels = {
      name: "nom",
      email: "e-mail",
      phone: "téléphone",
      message: "message",
    };
    const label = labels[field.id] || field.id;

    if (validity.valueMissing) {
      setFieldState(field, "missing", "champ requis.");
      return false;
    }

    if (validity.typeMismatch) {
      setFieldState(field, "wrong", "adresse e-mail invalide.");
      return false;
    }

    if (validity.patternMismatch) {
      setFieldState(field, "wrong", "numéro de téléphone invalide.");
      return false;
    }

    // names may contain letters, spaces, apostrophes and hyphens (accents OK)
    if (
      field.id === "name" &&
      !/^[\p{L}\p{M}\s'’-]+$/u.test(field.value.trim())
    ) {
      setFieldState(field, "wrong", "nom invalide.");
      return false;
    }

    setFieldState(field, "right", `${label} valide.`);
    return true;
  }

  // checks every field and focuses the first invalid one
  function validateForm(form) {
    const fields = form.querySelectorAll(
      FIELD_SELECTOR
    );
    let allValid = true;

    fields.forEach((field) => {
      if (!validateField(field)) allValid = false;
    });

    if (!allValid) {
      const firstBad = form.querySelector(".wrong-input, .missing-input");
      if (firstBad) firstBad.focus();
    }
    return allValid;
  }

  // validates a field as the user types (debounced)
  function initValidation(form) {
    form
      .querySelectorAll(
        FIELD_SELECTOR
      )
      .forEach((field) => {
        let timer = null;
        field.addEventListener("input", () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            validateField(field);
          }, 300);
        });
      });
  }

  // ============================================================
  // FORM SUBMISSION
  // ============================================================

  // sends the form to Web3Forms
  async function submitForm(form) {
    const submitBtn = form.querySelector("button[type='submit']");
    const originalText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.textContent = "Envoi...";
      submitBtn.disabled = true;
    }

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: new FormData(form),
      });
      const data = await response.json();
      return { ok: response.ok && data.success, message: data.message };
    } finally {
      if (submitBtn) {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }
  }

  // ============================================================
  // MODAL / POPOUT
  // ============================================================

  // whether a close was requested while the form was still loading, and
  // which element opened the dialog (to restore focus on close)
  let formCloseRequested = false;
  let popoutOpener = null;

  // hides/shows the page behind the dialog from assistive tech while open
  function setBackgroundHidden(hidden) {
    [
      document.querySelector(".site-header"),
      document.querySelector(".site-footer"),
      document.getElementById("main-page"),
      document.getElementById("sub-pages"),
    ].forEach((el) => {
      if (!el) return;
      if (hidden) el.setAttribute("aria-hidden", "true");
      else el.removeAttribute("aria-hidden");
    });
  }

  function closePopout() {
    const popout = document.getElementById("popout-form");
    // remember the close even while the form page is still loading
    formCloseRequested = true;
    if (!popout.classList.contains("active")) return;

    popout.classList.add("closing");
    setTimeout(() => {
      popout.classList.remove("active", "closing");
      document.body.style.overflow = "";
      setBackgroundHidden(false);
      // restore focus to the element that opened the dialog
      if (popoutOpener && popoutOpener.focus) popoutOpener.focus();
      popoutOpener = null;
    }, 300);
  }

  // wires up the popout form (submit, reset, close)
  function initPopout() {
    const popout = document.getElementById("popout-form");
    const form = popout.querySelector("form");
    if (!form) return;

    initValidation(form);

    let submitting = false;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (submitting) return;
      if (!validateForm(form)) return;

      const errorLine = popout.querySelector(".form-error");
      if (errorLine) errorLine.classList.add("hidden");
      submitting = true;
      try {
        const result = await submitForm(form);
        if (!result.ok)
          throw new Error(result.message || "La requête a échoué.");
        form.classList.add("hidden");
        popout.querySelector(".form-success").classList.remove("hidden");
      } catch (err) {
        console.warn("Form submission failed:", err.message);
        if (errorLine) {
          errorLine.textContent =
            "Quelque chose s'est mal passé, veuillez réessayer.";
          errorLine.classList.remove("hidden");
        }
      } finally {
        submitting = false;
      }
    });

    form.addEventListener("reset", () => {
      form.classList.remove("hidden");
      popout.querySelector(".form-success").classList.add("hidden");
      const errorLine = popout.querySelector(".form-error");
      if (errorLine) errorLine.classList.add("hidden");
      form.querySelectorAll("input, textarea").forEach((field) => {
        setFieldState(field, "", "");
      });
    });

    popout.querySelectorAll(".close, .success-close").forEach((btn) => {
      btn.addEventListener("click", closePopout);
    });

    // focus the first visible field (skip the hidden access_key input
    // and the hidden botcheck honeypot)
    const first = form.querySelector(
      FIELD_SELECTOR + ", select"
    );
    if (first) first.focus();
  }

  // loads the form page into the popout; `opener` (optional) is the element
  // to restore focus to on close
  let formLoading = false;
  // the fragment never changes, so fetch it once and reuse it — later
  // opens are instant (the innerHTML is re-parsed each time, so field
  // values and listeners are still fresh per open)
  let formHtmlCache = null;
  async function loadFormPage(opener) {
    const popout = document.getElementById("popout-form");
    if (popout.classList.contains("active") || formLoading) return;

    formLoading = true;
    formCloseRequested = false;
    try {
      let data = formHtmlCache;
      if (data === null) {
        data = await fetchText("pages/form.html");
        formHtmlCache = data;
      }

      // the user pressed Escape while the page was still loading
      if (formCloseRequested) return;

      popout.innerHTML = data;
      popout.classList.add("active");
      document.body.style.overflow = "hidden";
      setBackgroundHidden(true);
      // remember who opened it so focus can return there on close.
      // Click listeners pass the event as the first argument, so only
      // accept a real element here.
      popoutOpener =
        opener instanceof Element ? opener : document.activeElement;
      initPopout();
    } catch (err) {
      console.warn("Failed to load pages/form.html:", err.message);
    } finally {
      formLoading = false;
    }
  }

  // ============================================================
  // PAGE LOADING
  // ============================================================

  // keeps the page hidden until the background image is ready (or errors),
  // so the reveal doesn't flash a blank section
  function revealWhenBackgroundReady(page) {
    const img = document.getElementById("bg-image");
    const footer = document.querySelector(".site-footer");
    let revealed = false;

    function reveal() {
      if (revealed) return;
      revealed = true;
      page.classList.remove("hidden");
      if (footer) footer.classList.remove("hidden");
    }

    // no image to wait for, or it already finished loading (e.g. cached)
    if (!img || (img.complete && img.naturalWidth > 0)) {
      reveal();
      return;
    }

    page.classList.add("hidden");
    if (footer) footer.classList.add("hidden");

    img.addEventListener("load", reveal);
    img.addEventListener("error", reveal);

    // safety net: never leave the page hidden if the image stalls
    setTimeout(reveal, 8000);
  }

  // loads the home page
  async function loadMainPage() {
    const container = document.getElementById("main-page");
    try {
      container.innerHTML = await fetchText(`pages/home.html`);
      revealWhenBackgroundReady(container);
    } catch (err) {
      console.warn(`Failed to load pages/home.html:`, err.message);
    }
  }

  // loads the remaining sections, hidden until a nav link is clicked
  let sectionsLoaded = false;
  async function loadSubPages() {
    const container = document.getElementById("sub-pages");
    const pages = ["about", "service", "why", "process", "contact"];
    if (sectionsLoaded) return;
    sectionsLoaded = true;

    for (const page of pages) {
      try {
        const data = await fetchText(`pages/${page}.html`);
        container.innerHTML += data;
        const section = document.getElementById(page);
        if (section) section.classList.add("hidden");
      } catch (err) {
        console.warn(`Failed to load pages/${page}.html:`, err.message);
      }
    }
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  // slides the mobile menu in from the right
  function initMobileNav() {
    const header = document.querySelector(".site-header");
    const toggle = document.querySelector(".nav-toggle");
    if (!header || !toggle) return;

    const icon = toggle.querySelector("span");

    function closeMenu() {
      header.classList.remove("nav-open");
      document.body.classList.remove("menu-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Ouvrir le menu");
      if (icon) icon.className = "fi-rr-menu-burger";
    }

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = header.classList.toggle("nav-open");
      document.body.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute(
        "aria-label",
        open ? "Fermer le menu" : "Ouvrir le menu"
      );
      if (icon) icon.className = open ? "fi-rr-cross" : "fi-rr-menu-burger";
    });

    header.querySelectorAll("nav a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });

    document.addEventListener("click", (e) => {
      if (!header.contains(e.target) && header.classList.contains("nav-open")) {
        closeMenu();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) closeMenu();
    });
  }

  // nav links reveal hidden sections, then smooth-scroll to them
  function initSectionLinks() {
    const sectionIds = ["about", "service", "why", "process", "contact"];
    const links = document.querySelectorAll(
      '.nav-pill a[href^="#"], .site-footer nav a[href^="#"], .hero a[href^="#"]'
    );

    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        const id = link.getAttribute("href").slice(1);
        if (sectionIds.indexOf(id) === -1) return;

        // if no target section is hidden anymore, let the default anchor
        // jump run (CSS scroll-behavior: smooth handles the glide)
        const anyHidden = sectionIds.some((sid) => {
          const section = document.getElementById(sid);
          return section && section.classList.contains("hidden");
        });
        if (!anyHidden) return;

        e.preventDefault();
        revealSections();
        try {
          if (history.pushState) history.pushState(null, "", "#" + id);
        } catch (err) {
          // sandboxed contexts can throw on pushState; the scroll below
          // is what matters
        }

        const target = document.getElementById(id);
        if (!target) return;
        const delay = target.classList.contains("page") ? 150 : 0;
        setTimeout(() => {
          const reduce = reduceMotion();
          target.scrollIntoView({
            behavior: reduce ? "auto" : "smooth",
            block: "start",
          });
        }, delay);
      });
    });
  }

  // highlights the nav link of the section currently in view
  let scrollSpyUpdate = null;
  function initScrollSpy() {
    const links = document.querySelectorAll(".nav-pill a");
    const sections = Array.prototype.map.call(links, (link) => {
      return document.getElementById(link.getAttribute("href").slice(1));
    });

    function update() {
      const marker = window.innerHeight * 0.35;
      let current = null;

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        if (!section || section.classList.contains("hidden")) continue;
        if (section.getBoundingClientRect().top <= marker) current = section;
      }

      links.forEach((link) => {
        link.classList.toggle(
          "active",
          current !== null && link.getAttribute("href") === "#" + current.id
        );
      });
    }

    scrollSpyUpdate = update;
    // rAF-throttle: at most one layout read (getBoundingClientRect)
    // per frame instead of one per scroll event
    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(() => {
            ticking = false;
            update();
          });
        }
      },
      { passive: true }
    );
    window.addEventListener("resize", update);
    update();
  }

  // ============================================================
  // SCROLL / SECTION REVEAL
  // ============================================================

  // hides the header while scrolling
  function initScrollEffect() {
    const header = document.querySelector(".site-header");
    let scrollTimer = null;

    window.addEventListener("scroll", () => {
      if (header.classList.contains("nav-open")) return;
      header.classList.add("hide");
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        header.classList.remove("hide");
      }, 500);
    });
  }

  // scroll-triggered card reveal: cards slide/fade in the first time
  // their section scrolls into view (IntersectionObserver), instead of
  // all animating when the page loads. The reveal classes are added from
  // JS, so cards stay fully visible without JS or under reduced motion.
  function initScrollReveal() {
    if (reduceMotion()) return;
    if (!("IntersectionObserver" in window)) return;

    const groups = [
      ".about .stats > div",
      ".service .card-holder .flip-card",
      ".why .list > p",
      ".process .card-holder .card",
      ".contact .card-holder .card",
    ];

    const pending = [];
    groups.forEach((selector) => {
      document.querySelectorAll(selector).forEach((card, index) => {
        // stagger each card within its group for a cascade effect
        card.classList.add("reveal", "reveal-up");
        card._revealDelay = index * 90;
        pending.push(card);
      });
    });

    if (!pending.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const card = entry.target;
          const delay = card._revealDelay || 0;

          // inline transition (with the stagger delay) so it wins over
          // the cards' own hover transitions, then play once and clean up
          card.style.transition =
            `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`;
          card.classList.add("revealed");
          observer.unobserve(card);

          setTimeout(() => {
            card.classList.remove("reveal", "reveal-up", "revealed");
            card.style.transition = "";
            delete card._revealDelay;
          }, delay + 800);
        });
      },
      { threshold: 0.15 }
    );

    pending.forEach((card) => {
      observer.observe(card);
    });
  }

  // reveals the hidden sections when a nav link is clicked
  function revealSections() {
    const container = document.getElementById("sub-pages");
    if (!container) return;
    const sections = container.children;

    if (sections.length === 0) {
      console.warn("No sections to reveal.");
      return;
    }

    for (const section of sections) {
      section.classList.remove("hidden");
    }

    // the reveal changes which sections exist, so refresh the active link
    if (scrollSpyUpdate) scrollSpyUpdate();

    // the front buttons fade in right after the reveal, so keep them
    // disabled until that fade has finished (per-card generation guard,
    // so an early flip can't be re-enabled by this stale timeout)
    const reduce = reduceMotion();
    const timing = flipTiming();
    const delay = reduce ? 0 : timing.flip + timing.fade;
    document
      .querySelectorAll(".flip-card .flip-front .flip-badge")
      .forEach((btn) => {
        const card = btn.closest(".flip-card");
        const gen = (card._flipGen || 0) + 1;
        card._flipGen = gen;
        btn.disabled = true;
        setTimeout(() => {
          if (card._flipGen === gen) btn.disabled = false;
        }, delay);
      });
  }

  // ============================================================
  // FLIP CARDS
  // ============================================================

  // flips a service card and syncs its accessibility state
  function toggleFlipCard(card) {
    const flipped = card.classList.toggle("flipped");

    // every flip disables both buttons; the one that just became visible
    // is re-enabled once its fade-in has finished
    card.querySelectorAll(".flip-badge").forEach((btn) => {
      btn.setAttribute("aria-pressed", flipped ? "true" : "false");
      btn.disabled = true;
    });

    const front = card.querySelector(".flip-front");
    const back = card.querySelector(".flip-back");
    const frontBadge = card.querySelector(".flip-front .flip-badge");
    const backBadge = card.querySelector(".flip-back-badge");
    if (front) front.setAttribute("aria-hidden", flipped ? "true" : "false");
    if (back) back.setAttribute("aria-hidden", flipped ? "false" : "true");
    if (backBadge)
      backBadge.setAttribute("aria-hidden", flipped ? "false" : "true");

    // only the button on the visible side stays in the tab order
    if (frontBadge) frontBadge.setAttribute("tabindex", flipped ? "-1" : "0");
    if (backBadge) backBadge.setAttribute("tabindex", flipped ? "0" : "-1");

    // the button that was just activated is now hidden, so move focus to
    // its counterpart on the visible side (it is disabled until its fade
    // completes, so focus is restored there when it becomes active)
    const target = flipped ? backBadge : frontBadge;
    if (target) target.focus({ preventScroll: true });

    if (target) {
      // a generation counter keeps a stale timeout from enabling a button
      // after the card has already been flipped again
      const gen = (card._flipGen || 0) + 1;
      card._flipGen = gen;
      const reduce = reduceMotion();
      const timing = flipTiming();
      const delay = reduce ? 0 : timing.flip + timing.fade;
      setTimeout(() => {
        if (card._flipGen !== gen) return;
        target.disabled = false;
        // restore focus to the freshly-appeared button if the flip
        // dropped it (it was disabled, so focus fell back to the body)
        if (document.activeElement === document.body) {
          target.focus({ preventScroll: true });
        }
      }, delay);
    }
  }

  // flips a card when its arrow button is clicked; the buttons are real
  // <button> elements, so Enter/Space activation works natively
  function initFlipCards() {
    document.addEventListener("click", (e) => {
      if (!(e.target instanceof Element)) return;
      const badge = e.target.closest(".flip-badge");
      if (!badge || badge.disabled) return; // ignore clicks while fading in
      const card = badge.closest(".flip-card");
      if (card) toggleFlipCard(card);
    });
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  // the selector for the real, user-facing form fields (skips the hidden
  // access_key input and the invisible botcheck honeypot)
  const FIELD_SELECTOR =
    "input:not([type='hidden']):not([name='botcheck']), textarea";

  // whether the user asked the OS to reduce motion
  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // fetches a URL and returns its text, throwing on HTTP errors
  async function fetchText(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("HTTP " + response.status);
    return await response.text();
  }

  // flip + fade timing (ms), read from the CSS variables so JS can never
  // drift apart from the badge-fade-in animation
  function flipTiming() {
    const root = getComputedStyle(document.documentElement);
    const dur = parseFloat(root.getPropertyValue("--flip-duration"));
    const fade = parseFloat(root.getPropertyValue("--badge-fade"));
    return {
      flip: isFinite(dur) ? dur * 1000 : 650,
      fade: isFinite(fade) ? fade * 1000 : 300,
    };
  }

  // ============================================================
  // STARTUP
  // ============================================================

  initScrollEffect();
  initMobileNav();
  initFlipCards();

  document.addEventListener("DOMContentLoaded", async () => {
    const popout = document.getElementById("popout-form");
    popout.addEventListener("click", (e) => {
      if (e.target === popout) closePopout();
    });
    document.addEventListener("keydown", (e) => {
      const active = popout.classList.contains("active");
      if (e.key === "Escape" && active) {
        closePopout();
        return;
      }

      // trap focus inside the dialog while it is open
      if (e.key === "Tab" && active) {
        const focusables = popout.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const current = document.activeElement;
        if (e.shiftKey && (current === first || !popout.contains(current))) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (current === last || !popout.contains(current))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    await loadMainPage();
    await loadSubPages();
    initScrollSpy();
    initSectionLinks();
    initScrollReveal();

    // CTA buttons open the quote form popout; the secondary hero CTA is an
    // anchor handled by initSectionLinks (reveal + scroll to #service)
    const ctaQuote = document.getElementById("cta-quote");
    const loadForm = document.getElementById("load-form");
    const navCta = document.getElementById("nav-cta");
    const navPhone = document.getElementById("nav-phone");
    if (ctaQuote) ctaQuote.addEventListener("click", loadFormPage);
    if (loadForm) loadForm.addEventListener("click", loadFormPage);
    if (navCta) navCta.addEventListener("click", loadFormPage);
    if (navPhone) navPhone.addEventListener("click", loadFormPage);
  });
})();
