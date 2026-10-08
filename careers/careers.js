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
    <article class="career-card">
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
        <a class="button button-accent" href="mailto:${encodeURIComponent(opening.application_email)}?subject=${encodeURIComponent("Application - " + opening.title)}">
          Apply by Email
        </a>
        <span>Applications go to ${escapeHtml(opening.application_email)}</span>
      </div>
    </article>
  `;
}

async function loadCareers() {
  const { data, error } = await supabase
    .from("career_openings")
    .select("id,title,employment_type,location,pay_range,summary,description,requirements,application_email,sort_order,created_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    container.innerHTML = '<div class="career-empty">We could not load current openings right now. Please check back soon.</div>';
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
}

await loadCareers();

trackSitePageView("/careers/").catch((error) => {
  console.warn("Site analytics failed.", error);
});