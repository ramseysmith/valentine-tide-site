/* =========================================================
   Valentine Tide — script
   ---------------------------------------------------------
   Email capture: client-side validation + submit handling
   with graceful success / error states.
   ========================================================= */

"use strict";

/*
 * Form endpoint.
 * Swap this for a real Formspree, Shopify, or custom POST URL later, e.g.
 *   const FORM_ENDPOINT = "https://formspree.io/f/yourid";
 *
 * While it is left as the placeholder below, submits are SIMULATED so the
 * success state can be previewed without a backend (see submitEmail()).
 */
const FORM_ENDPOINT = "REPLACE_WITH_FORM_ENDPOINT";
const ENDPOINT_PLACEHOLDER = "REPLACE_WITH_FORM_ENDPOINT";

/* Pragmatic email check — not full RFC 5322, but catches the real mistakes. */
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/*
 * Send the email to the endpoint.
 * Resolves on success, throws on failure.
 */
async function submitEmail(email) {
  // No endpoint configured yet → simulate a short round-trip + success.
  if (FORM_ENDPOINT === ENDPOINT_PLACEHOLDER) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    console.info(
      "[Valentine Tide] FORM_ENDPOINT not configured — simulated submit for:",
      email
    );
    return;
  }

  const response = await fetch(FORM_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(`Submit failed with status ${response.status}`);
  }
}

/* Wire up the signup form once the DOM is ready. */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signup-form");
  if (!form) return;

  const input = form.querySelector("#email");
  const status = form.querySelector("#form-status");
  const button = form.querySelector('button[type="submit"]');

  /* Helper: set the live-region message + its visual state. */
  const setStatus = (message, state) => {
    status.textContent = message;
    if (state) {
      status.dataset.state = state;
    } else {
      delete status.dataset.state;
    }
  };

  /* Clear an error the moment the user starts correcting it. */
  input.addEventListener("input", () => {
    if (status.dataset.state === "error") {
      setStatus("", null);
      input.removeAttribute("aria-invalid");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = input.value.trim();

    // ---- Validate before sending ----
    if (!email) {
      input.setAttribute("aria-invalid", "true");
      setStatus("Enter an email to join the cult.", "error");
      input.focus();
      return;
    }
    if (!isValidEmail(email)) {
      input.setAttribute("aria-invalid", "true");
      setStatus("That email looks cursed. Check it and try again.", "error");
      input.focus();
      return;
    }

    // ---- Submit ----
    input.removeAttribute("aria-invalid");
    button.disabled = true;
    setStatus("Summoning the tide…", "pending");

    try {
      await submitEmail(email);
      form.reset();
      form.classList.add("is-done");
      setStatus("You're in. Watch the horizon — Drop 001 is coming.", "success");
    } catch (error) {
      console.error("[Valentine Tide] submit error:", error);
      button.disabled = false;
      setStatus("The tide pulled back. Try again in a moment.", "error");
    }
  });
});
