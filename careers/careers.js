import { supabase, trackSitePageView } from "/supabase-client.js";

const container = document.querySelector("#careerOpenings");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function lines(value = "") {
  return String(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function renderOpening(opening) {
  const requirements = lines(opening.requirements);

  return `
    <article class="career-card" id="opening-${opening.id}">
      <div class="career-card-header">
        <div>
          <p class="career-meta">${escapeHtml(opening.employment_type)} · ${escapeHtml(opening.location)}</p>
          <h2>${escapeHtml(opening.title)}</h2>
          ${opening.pay_range ? '<p class="career-pay">' + escapeHtml(opening.pay_range) + '</p>' : ""}
        </div>
      </div>

      ${opening.summary ? '<p class="career-summary">' + escapeHtml(opening.summary) + '</p>' : ""}

      ${opening.description ? `
        <div class="career-section">
          <h3>About the role</h3>
          <p>${escapeHtml(opening.description).replaceAll("\n", "<br>")}</p>
        </div>
      ` : ""}

      ${requirements.length ? `
        <div class="career-section">
          <h3>What we're looking for</h3>
          <ul>
            ${requirements.map((item) => '<li>' + escapeHtml(item) + '</li>').join("")}
          </ul>
        </div>
      ` : ""}

      <div class="career-actions">
        <button class="button button-accent" type="button" data-open-application="${opening.id}">
          Apply Now
        </button>
        <span>Applications are submitted securely through CleanFreaks.</span>
      </div>

      <form class="career-application-form" data-application-form="${opening.id}" hidden>
        <input type="hidden" name="career_opening_id" value="${opening.id}">
        <label class="career-honeypot" aria-hidden="true">
          Company website
          <input name="company_website" tabindex="-1" autocomplete="off">
        </label>

        <div class="career-application-heading">
          <div>
            <p class="eyebrow">Apply for</p>
            <h3>${escapeHtml(opening.title)}</h3>
          </div>
          <button type="button" class="career-application-close" data-close-application="${opening.id}" aria-label="Close application form">×</button>
        </div>

        <div class="career-application-grid">
          <label>Full name
            <input name="name" maxlength="160" autocomplete="name" required>
          </label>
          <label>Email
            <input name="email" type="email" maxlength="320" autocomplete="email" required>
          </label>
          <label>Phone
            <input name="phone" type="tel" maxlength="80" autocomplete="tel" required>
          </label>
          <label>Availability
            <input name="availability" maxlength="1200" placeholder="Example: Saturdays and Sundays">
          </label>
        </div>

        <label>Relevant experience
          <textarea name="experience" rows="5" maxlength="4000" placeholder="Tell us about relevant work experience, customer service experience, or hands-on work."></textarea>
        </label>

        <label>Why are you interested in this position?
          <textarea name="message" rows="5" maxlength="4000" placeholder="Tell us a little about yourself and why you are interested in working with CleanFreaks."></textarea>
        </label>

        <p class="career-privacy-note">By submitting this application, you acknowledge the <a href="/privacy-policy/" target="_blank" rel="noopener">Privacy Policy</a>.</p>
        <button class="button button-accent career-submit" type="submit">Submit Application</button>
        <p class="form-status career-application-status" role="status"></p>
      </form>
    </article>
  `;
}

function bindApplicationForms() {
  document.querySelectorAll("[data-open-application]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = document.querySelector(
        '[data-application-form="' + button.dataset.openApplication + '"]'
      );

      if (!form) return;
      form.hidden = false;
      button.hidden = true;
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  document.querySelectorAll("[data-close-application]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.closeApplication;
      const form = document.querySelector('[data-application-form="' + id + '"]');
      const openButton = document.querySelector('[data-open-application="' + id + '"]');

      if (form) form.hidden = true;
      if (openButton) openButton.hidden = false;
    });
  });

  document.querySelectorAll("[data-application-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitButton = form.querySelector('button[type="submit"]');
      const status = form.querySelector(".career-application-status");
      const formData = new FormData(form);

      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
      status.className = "form-status career-application-status";
      status.textContent = "";

      const payload = {
        career_opening_id: formData.get("career_opening_id"),
        name: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        availability: String(formData.get("availability") || "").trim() || null,
        experience: String(formData.get("experience") || "").trim() || null,
        message: String(formData.get("message") || "").trim() || null,
        company_website: String(formData.get("company_website") || "").trim() || null,
      };

      try {
        const { data, error } = await supabase.functions.invoke(
          "submit-career-application",
          { body: payload }
        );

        if (error || !data?.ok) {
          let message =
            data?.message ||
            error?.message ||
            "We could not submit your application. Please try again.";

          try {
            if (error?.context instanceof Response) {
              const detail = await error.context.clone().json();
              message = detail?.message || detail?.error || message;
            }
          } catch {
            // Keep the original message.
          }

          throw new Error(message);
        }

        form.reset();
        status.className = "form-status career-application-status success";
        status.textContent =
          "Application submitted. Thank you. CleanFreaks will review your information and contact you if there is a fit.";

        submitButton.textContent = "Application Submitted";
      } catch (error) {
        console.error(error);
        status.className = "form-status career-application-status error";
        status.textContent =
          error.message || "We could not submit your application. Please try again.";
        submitButton.disabled = false;
        submitButton.textContent = "Submit Application";
      }
    });
  });
}

async function loadCareers() {
  const { data, error } = await supabase
    .from("career_openings")
    .select("id,title,employment_type,location,pay_range,summary,description,requirements,sort_order,created_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    container.innerHTML =
      '<div class="career-empty">We could not load current openings right now. Please check back soon.</div>';
    return;
  }

  if (!data?.length) {
    container.innerHTML = `
      <div class="career-empty">
        <h2>No openings right now.</h2>
        <p>There are no published positions at the moment. Check back here as CleanFreaks grows.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = data.map(renderOpening).join("");
  bindApplicationForms();
}

await loadCareers();

trackSitePageView("/careers/").catch((error) => {
  console.warn("Site analytics failed.", error);
});