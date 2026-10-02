/* =========================================================
   Valentine Tide — script
   ---------------------------------------------------------
   Email capture: client-side validation + submit handling
   with graceful success / error states.
   ========================================================= */

"use strict";

/*
 * Where signups go:
 *   1. The shop worker's /subscribe once API_BASE is set in config.js.
 *   2. Otherwise FormSubmit, which emails each signup to SIGNUP_FALLBACK_EMAIL.
 *   3. If neither is configured the form says so honestly instead of
 *      pretending (signups used to be silently dropped).
 */
const VT = window.VT_CONFIG || {};
const API_BASE = VT.API_BASE && !VT.API_BASE.startsWith("REPLACE") ? VT.API_BASE.replace(/\/$/, "") : "";
const FALLBACK_EMAIL = VT.SIGNUP_FALLBACK_EMAIL || "";

/* Pragmatic email check — not full RFC 5322, but catches the real mistakes. */
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/* Sends the signup. Resolves on success, throws on failure. */
async function submitEmail(email, interest) {
  if (API_BASE) {
    const response = await fetch(`${API_BASE}/subscribe`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ email, interest }),
    });
    if (!response.ok) throw new Error(`Submit failed with status ${response.status}`);
    return;
  }

  if (FALLBACK_EMAIL) {
    const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(FALLBACK_EMAIL)}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        interest: interest || "general",
        source: "valentinetide.com",
        _subject: `New Valentine Tide signup${interest ? ` (${interest})` : ""}`,
        _template: "table",
        _captcha: "false",
      }),
    });
    const data = await response.json().catch(() => ({}));
    // Before the one time activation, FormSubmit replies with an activation
    // notice; the owner activates from their inbox, so treat it as received.
    if (!response.ok && !/activat/i.test(data.message || "")) throw new Error(`Submit failed with status ${response.status}`);
    return;
  }

  throw new Error("NO_ENDPOINT");
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
      const interestField = form.querySelector("#signup-interest");
      const interest = interestField ? interestField.value : "";
      await submitEmail(email, interest);
      form.reset();
      form.classList.add("is-done");
      setStatus(
        interest
          ? "You're in. You'll hear the moment it drops."
          : "You're in. Watch the horizon for the next drop.",
        "success"
      );
    } catch (error) {
      console.error("[Valentine Tide] submit error:", error);
      button.disabled = false;
      setStatus(
        error && error.message === "NO_ENDPOINT"
          ? "Signups open soon. Follow @valentinetide on X for drop news."
          : "The tide pulled back. Try again in a moment.",
        "error"
      );
    }
  });
});
