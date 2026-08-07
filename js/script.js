// form

// colors a field's border and shows the message under it
function setFieldState(field, state, message) {
  field.classList.remove("right-input", "wrong-input", "missing-input");
  if (state) field.classList.add(state + "-input");

  var result = document.getElementById(field.id + "-res");
  if (!result) return;

  result.classList.remove("right-result", "wrong-result", "missing-result");
  if (state) result.classList.add(state + "-result");
  result.textContent = message;
  result.style.display = message ? "block" : "none";
}

// checks one field against its rule
function validateField(field) {
  var value = field.value.trim();

  if (!value) {
    setFieldState(field, "missing", "champ requis.");
    return false;
  }

  var rules = {
    name: /^[a-zA-Z\s]+$/,
    email: /^[a-z0-9]+@[a-z]+\.[a-z]+$/i,
    phone: /^(?:\+216)?\d{8}$/,
    message: /.+/,
  };

  var labels = { name: "nom", email: "e-mail", phone: "téléphone", message: "message" };
  var label = labels[field.id] || field.id;

  var rule = rules[field.id];
  if (rule && !rule.test(value)) {
    setFieldState(field, "wrong", label + " invalide ! réessayez.");
    return false;
  }

  setFieldState(field, "right", label + " valide.");
  return true;
}

// checks every field and focuses the first invalid one
function validateForm(form) {
  var fields = form.querySelectorAll("input, textarea");
  var allValid = true;

  fields.forEach(function (field) {
    if (!validateField(field)) allValid = false;
  });

  if (!allValid) {
    var firstBad = form.querySelector(".wrong-input, .missing-input");
    if (firstBad) firstBad.focus();
  }
  return allValid;
}

// validates a field as the user types
function initValidation(form) {
  form.querySelectorAll("input, textarea").forEach(function (field) {
    var timer = null;
    field.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        validateField(field);
      }, 300);
    });
  });
}

// sends the form to Web3Forms
async function submitForm(form) {
  var submitBtn = form.querySelector("button[type='submit']");
  var originalText = submitBtn ? submitBtn.textContent : "";
  if (submitBtn) {
    submitBtn.textContent = "Envoi...";
    submitBtn.disabled = true;
  }

  try {
    var response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: new FormData(form),
    });
    var data = await response.json();
    return { ok: response.ok && data.success, message: data.message };
  } finally {
    if (submitBtn) {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }
}

// closes the form popout
var formCloseRequested = false;
function closePopout() {
  var popout = document.getElementById("popout-form");
  // remember the close even while the form page is still loading
  formCloseRequested = true;
  if (!popout.classList.contains("active")) return;

  popout.classList.add("closing");
  setTimeout(function () {
    popout.classList.remove("active", "closing");
    document.body.style.overflow = "";
  }, 300);
}

// wires up the popout form (submit, reset, close)
function initPopout() {
  var popout = document.getElementById("popout-form");
  var form = popout.querySelector("form");

  initValidation(form);

  var submitting = false;
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (submitting) return;
    if (!validateForm(form)) return;

    var errorLine = popout.querySelector(".form-error");
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
        errorLine.textContent = "Quelque chose s'est mal passé, veuillez réessayer.";
        errorLine.classList.remove("hidden");
      }
    } finally {
      submitting = false;
    }
  });

  form.addEventListener("reset", function () {
    form.classList.remove("hidden");
    popout.querySelector(".form-success").classList.add("hidden");
    var errorLine = popout.querySelector(".form-error");
    if (errorLine) errorLine.classList.add("hidden");
    form.querySelectorAll("input, textarea").forEach(function (field) {
      setFieldState(field, "", "");
    });
  });

  popout.querySelectorAll(".close, .success-close").forEach(function (btn) {
    btn.addEventListener("click", closePopout);
  });

  var first = form.querySelector("input");
  if (first) first.focus();
}

// loads the form page into the popout
var formLoading = false;
async function loadFormPage() {
  var popout = document.getElementById("popout-form");
  if (popout.classList.contains("active") || formLoading) return;

  formLoading = true;
  formCloseRequested = false;
  try {
    const response = await fetch("pages/form.html");
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    // the user pressed Escape while the page was still loading
    if (formCloseRequested) return;

    popout.innerHTML = await response.text();
    popout.classList.add("active");
    document.body.style.overflow = "hidden";
    initPopout();
  } catch (err) {
    console.warn("Failed to load pages/form.html:", err.message);
  } finally {
    formLoading = false;
  }
}

// page

// hides the header while scrolling
function initScrollEffect() {
  var header = document.querySelector(".site-header");
  var scrollTimer = null;

  window.addEventListener("scroll", function () {
    if (header.classList.contains("nav-open")) return;
    header.classList.add("hide");
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      header.classList.remove("hide");
    }, 500);
  });
}

// slides the mobile menu in from the right
function initMobileNav() {
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  if (!header || !toggle) return;

  var icon = toggle.querySelector("span");

  function closeMenu() {
    header.classList.remove("nav-open");
    document.body.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Ouvrir le menu");
    if (icon) icon.className = "fi-rr-menu-burger";
  }

  toggle.addEventListener("click", function (e) {
    e.stopPropagation();
    var open = header.classList.toggle("nav-open");
    document.body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    if (icon) icon.className = open ? "fi-rr-cross" : "fi-rr-menu-burger";
  });

  header.querySelectorAll("nav a").forEach(function (link) {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });

  document.addEventListener("click", function (e) {
    if (!header.contains(e.target) && header.classList.contains("nav-open")) {
      closeMenu();
    }
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 768) closeMenu();
  });
}

function revealWhenBackgroundReady(page) {
  var img = document.getElementById("bg-image");
  var footer = document.querySelector(".site-footer");
  var revealed = false;

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
    const response = await fetch(`pages/home.html`);
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const data = await response.text();
    container.innerHTML = data;
    revealWhenBackgroundReady(container);
  } catch (err) {
    console.warn(`Failed to load pages/home.html:`, err.message);
  }
}

// loads the remaining sections, hidden until "en savoir plus" is clicked
var sectionsLoaded = false;
async function pageFetch() {
  const container = document.getElementById("sub-pages");
  const pages = ["about", "service", "why", "process", "contact"];
  if (sectionsLoaded) return;
  sectionsLoaded = true;

  for (const page of pages) {
    try {
      const response = await fetch(`pages/${page}.html`);
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const data = await response.text();
      container.innerHTML += data;
      const section = document.getElementById(page);
      if (section) section.classList.add("hidden");
    } catch (err) {
      console.warn(`Failed to load pages/${page}.html:`, err.message);
    }
  }
}


function initSectionLinks() {
  var sectionIds = ["about", "service", "why", "process", "contact"];
  var links = document.querySelectorAll(
    '.nav-pill a[href^="#"], .site-footer nav a[href^="#"]'
  );

  links.forEach(function (link) {
    link.addEventListener("click", function (e) {
      var id = link.getAttribute("href").slice(1);
      if (sectionIds.indexOf(id) === -1) return;

      // if no target section is hidden anymore, let the default anchor
      // jump run (CSS scroll-behavior: smooth handles the glide)
      var anyHidden = sectionIds.some(function (sid) {
        var section = document.getElementById(sid);
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


      var target = document.getElementById(id);
      if (!target) return;
      var delay = target.classList.contains("page") ? 150 : 0;
      setTimeout(function () {
        var reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;
        target.scrollIntoView({
          behavior: reduce ? "auto" : "smooth",
          block: "start",
        });
      }, delay);
    });
  });
}

// scroll-triggered card reveal: cards slide/fade in the first time
// their section scrolls into view (IntersectionObserver), instead of
// all animating when the page loads. The reveal classes are added from
// JS, so cards stay fully visible without JS or under reduced motion.
function initScrollReveal() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;

  var groups = [
    ".about .stats > div",
    ".service .card-holder .flip-card",
    ".why .list > p",
    ".process .card-holder .card",
    ".contact .card-holder .card",
  ];

  var pending = [];
  groups.forEach(function (selector) {
    document.querySelectorAll(selector).forEach(function (card, index) {
      // stagger each card within its group for a cascade effect
      card.classList.add("reveal", "reveal-up");
      card._revealDelay = index * 90;
      pending.push(card);
    });
  });

  if (!pending.length) return;

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var card = entry.target;
        var delay = card._revealDelay || 0;

        // inline transition (with the stagger delay) so it wins over
        // the cards' own hover transitions, then play once and clean up
        card.style.transition =
          "opacity 0.7s ease " + delay + "ms, transform 0.7s ease " + delay + "ms";
        card.classList.add("revealed");
        observer.unobserve(card);

        setTimeout(function () {
          card.classList.remove("reveal", "reveal-up", "revealed");
          card.style.transition = "";
          delete card._revealDelay;
        }, delay + 800);
      });
    },
    { threshold: 0.15 }
  );

  pending.forEach(function (card) {
    observer.observe(card);
  });
}

// reveals the hidden sections when "en savoir plus" is clicked
function revealSections() {
  var container = document.getElementById("sub-pages");
  var sections = container.children;

  if (sections.length === 0) {
    console.warn("No sections to reveal.");
    return;
  }

  for (const section of sections) {
    section.classList.remove("hidden");
  }

  // the reveal changes which sections exist, so refresh the active link
  if (scrollSpyUpdate) scrollSpyUpdate();
  var discover = document.getElementById("discover");
  if (discover) discover.disabled = true;

  // the front buttons fade in right after the reveal, so keep them
  // disabled until that fade has finished (per-card generation guard,
  // so an early flip can't be re-enabled by this stale timeout)
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var timing = flipTiming();
  var delay = reduce ? 0 : timing.flip + timing.fade;
  document
    .querySelectorAll(".flip-card .flip-front .flip-badge")
    .forEach(function (btn) {
      var card = btn.closest(".flip-card");
      var gen = (card._flipGen || 0) + 1;
      card._flipGen = gen;
      btn.disabled = true;
      setTimeout(function () {
        if (card._flipGen === gen) btn.disabled = false;
      }, delay);
    });
}

// highlights the nav link of the section currently in view
var scrollSpyUpdate = null;
function initScrollSpy() {
  var links = document.querySelectorAll(".nav-pill a");
  var sections = Array.prototype.map.call(links, function (link) {
    return document.getElementById(link.getAttribute("href").slice(1));
  });

  function update() {
    var marker = window.innerHeight * 0.35;
    var current = null;

    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      if (!section || section.classList.contains("hidden")) continue;
      if (section.getBoundingClientRect().top <= marker) current = section;
    }

    links.forEach(function (link) {
      link.classList.toggle(
        "active",
        current !== null && link.getAttribute("href") === "#" + current.id
      );
    });
  }

  scrollSpyUpdate = update;
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

// flip + fade timing (ms), read from the CSS variables so JS can never
// drift apart from the badge-fade-in animation
function flipTiming() {
  var root = getComputedStyle(document.documentElement);
  var dur = parseFloat(root.getPropertyValue("--flip-duration"));
  var fade = parseFloat(root.getPropertyValue("--badge-fade"));
  return {
    flip: isFinite(dur) ? dur * 1000 : 650,
    fade: isFinite(fade) ? fade * 1000 : 300,
  };
}

// flips a service card and syncs its accessibility state
function toggleFlipCard(card) {
  var flipped = card.classList.toggle("flipped");

  // every flip disables both buttons; the one that just became visible
  // is re-enabled once its fade-in has finished
  card.querySelectorAll(".flip-badge").forEach(function (btn) {
    btn.setAttribute("aria-pressed", flipped ? "true" : "false");
    btn.disabled = true;
  });

  var front = card.querySelector(".flip-front");
  var back = card.querySelector(".flip-back");
  var frontBadge = card.querySelector(".flip-front .flip-badge");
  var backBadge = card.querySelector(".flip-back-badge");
  if (front) front.setAttribute("aria-hidden", flipped ? "true" : "false");
  if (back) back.setAttribute("aria-hidden", flipped ? "false" : "true");
  if (backBadge) backBadge.setAttribute("aria-hidden", flipped ? "false" : "true");

  // only the button on the visible side stays in the tab order
  if (frontBadge) frontBadge.setAttribute("tabindex", flipped ? "-1" : "0");
  if (backBadge) backBadge.setAttribute("tabindex", flipped ? "0" : "-1");

  // the button that was just activated is now hidden, so move focus to
  // its counterpart on the visible side (it is disabled until its fade
  // completes, so focus is restored there when it becomes active)
  var target = flipped ? backBadge : frontBadge;
  if (target) target.focus({ preventScroll: true });

  if (target) {
    // a generation counter keeps a stale timeout from enabling a button
    // after the card has already been flipped again
    var gen = (card._flipGen || 0) + 1;
    card._flipGen = gen;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var timing = flipTiming();
    var delay = reduce ? 0 : timing.flip + timing.fade;
    setTimeout(function () {
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
  document.addEventListener("click", function (e) {
    if (!(e.target instanceof Element)) return;
    var badge = e.target.closest(".flip-badge");
    if (!badge || badge.disabled) return; // ignore clicks while fading in
    var card = badge.closest(".flip-card");
    if (card) toggleFlipCard(card);
  });
}

// startup
initScrollEffect();
initMobileNav();
initFlipCards();

document.addEventListener("DOMContentLoaded", async function () {
  var popout = document.getElementById("popout-form");
  popout.addEventListener("click", function (e) {
    if (e.target === popout) closePopout();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && popout.classList.contains("active"))
      closePopout();
  });

  await loadMainPage();
  await pageFetch();
  initScrollSpy();
  initSectionLinks();
  initScrollReveal();

  var discover = document.getElementById("discover");
  var loadForm = document.getElementById("load-form");
  var navCta = document.getElementById("nav-cta");
  if (discover) discover.addEventListener("click", revealSections);
  if (loadForm) loadForm.addEventListener("click", loadFormPage);
  if (navCta) navCta.addEventListener("click", loadFormPage);
});
