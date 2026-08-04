/* ==================================================== */
/*                    form validation                    */
/* ==================================================== */


// One function that updates a field's border color AND the message under it.
function setFieldState(field, state, message) {
  // 1) color the input's border
  field.classList.remove("right-input", "wrong-input", "missing-input");
  if (state) field.classList.add(state + "-input");

  // 2) show the message under the input, if it has a <span id="xxx-res">
  var result = document.getElementById(field.id + "-res");
  if (!result) return;

  result.classList.remove("right-result", "wrong-result", "missing-result");
  if (state) result.classList.add(state + "-result");
  result.textContent = message;
  result.style.display = message ? "block" : "none";
}

// Check one field against its rule. Returns true when the field is valid.
function validateField(field) {
  var value = field.value.trim();

  if (!value) {
    setFieldState(field, "missing", "champ requis.");
    return false;
  }

  // the rule each field must match
  var rules = {
    name: /^[a-zA-Z\s]+$/,
    email: /^[a-z0-9]+@[a-z]+\.[a-z]+$/i,
    phone: /^(?:\+216)?\d{8}$/,
    message: /.+/,
  };

  // French label used in the messages below (the field ids stay in English)
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

// Check every field in the form and focus the first bad one.
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

// Check a field 300ms after the user stops typing.
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
// Send the form to Web3Forms and return the fetch Response.
// The caller is responsible for the success/error UI.
async function submitForm(form) {
  var submitBtn = form.querySelector("button[type='submit']");
  var originalText = submitBtn ? submitBtn.textContent : "";
  if (submitBtn) {
    submitBtn.textContent = "Envoi...";
    submitBtn.disabled = true;
  }

  try {
    // the hidden <input name="access_key"> is already inside the form
    var response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: new FormData(form),
    });
    var data = await response.json();
    // so trust the success flag in the body rather than just response.ok.
    return { ok: response.ok && data.success, message: data.message };
  } finally {
    if (submitBtn) {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }
}

/* ==================================================== */
/*                      popout form                     */
/* ==================================================== */

function closePopout() {
  var popout = document.getElementById("popout-form");
  if (!popout.classList.contains("active")) return; // already closed or closing

  popout.classList.add("closing"); // fade out first...
  setTimeout(function () {
    popout.classList.remove("active", "closing");
    document.body.style.overflow = ""; // ...then unlock the page behind
  }, 300); // matches the .closing animation duration (0.3s)
}

// Wire up the form that was just loaded into the popout.
function initPopout() {
  var popout = document.getElementById("popout-form");
  var form = popout.querySelector("form");

  initValidation(form);

  var submitting = false;
  form.addEventListener("submit", async function (e) {
    e.preventDefault(); // we handle the send ourselves: no page reload
    if (submitting) return; // ignore double-clicks while a send is in flight
    if (!validateForm(form)) return; // don't send until every field is valid

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
    form.classList.remove("hidden"); // show the form again (if we were on the success screen)
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

var formLoading = false;
async function loadFormPage() {
  var popout = document.getElementById("popout-form");
  if (popout.classList.contains("active") || formLoading) return; // already open or loading

  formLoading = true;
  try {
    const response = await fetch("pages/form.html");
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    popout.innerHTML = await response.text();
    popout.classList.add("active");
    document.body.style.overflow = "hidden"; // lock the page behind
    initPopout();
  } catch (err) {
    console.warn("Failed to load pages/form.html:", err.message);
  } finally {
    formLoading = false;
  }
}

/* ==================================================== */
/*                     page loading                     */
/* ==================================================== */

function initScrollEffect() {
  var header = document.querySelector(".site-header");
  var scrollTimer = null;

  window.addEventListener("scroll", function () {
    // don't hide the header while the mobile menu is open
    if (header.classList.contains("nav-open")) return;
    header.classList.add("hide");
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      header.classList.remove("hide");
    }, 500);
  });
}

/* ==================================================== */
/*                     mobile nav                       */
/* ==================================================== */

// Hamburger menu: slides the nav in from the right on small screens.
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

  // close after choosing a destination
  header.querySelectorAll("nav a").forEach(function (link) {
    link.addEventListener("click", closeMenu);
  });

  // close with Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });

  // close when tapping outside the header
  document.addEventListener("click", function (e) {
    if (!header.contains(e.target) && header.classList.contains("nav-open")) {
      closeMenu();
    }
  });

  // reset the state when the viewport grows back to desktop
  window.addEventListener("resize", function () {
    if (window.innerWidth > 768) closeMenu();
  });
}

async function loadMainPage() {
  const container = document.getElementById("main-page");
  try {
    const response = await fetch(`pages/home.html`);
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const data = await response.text();
    container.innerHTML = data;
  } catch (err) {
    console.warn(`Failed to load pages/home.html:`, err.message);
  }
}

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
      if (section) {
        section.classList.add("hidden");
      }
    } catch (err) {
      console.warn(`Failed to load pages/${page}.html:`, err.message);
    }
  }
}

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

  document.getElementById("discover").disabled = true;
}

console.log("script.js loaded");
initScrollEffect();
initMobileNav();

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

  // guard each button: if its page failed to load, don't crash the rest of startup
  var discover = document.getElementById("discover");
  var loadForm = document.getElementById("load-form");
  if (discover) discover.addEventListener("click", revealSections);
  if (loadForm) loadForm.addEventListener("click", loadFormPage);
});
