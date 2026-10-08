import { supabase, trackSitePageView } from "/supabase-client.js";

const menuButton = document.querySelector("#menuButton");
const mobileMenu = document.querySelector("#mobileMenu");

menuButton?.addEventListener("click", () => {
  const open = mobileMenu?.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(Boolean(open)));
});

mobileMenu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mobileMenu.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
  });
});

document.querySelector("#currentYear")?.replaceChildren(String(new Date().getFullYear()));

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
  }).format(Number(value));
}

async function loadMaintenancePlans() {
  const grid = document.querySelector("[data-maintenance-grid]");
  if (!grid) return;

  const limit = Number(grid.dataset.limit || 20);

  const { data, error } = await supabase
    .from("maintenance_plans")
    .select("id,name,description,total_price,billing_period_count,display_index")
    .eq("active", true)
    .eq("visibility", "PUBLIC")
    .order("display_index")
    .limit(limit);

  if (error) {
    console.error(error);
    grid.innerHTML = '<div class="loading-card">Maintenance plans are temporarily unavailable.</div>';
    return;
  }

  grid.innerHTML = "";

  data.forEach((plan) => {
    const card = document.createElement("article");
    card.className = "plan-card";

    const priceMatch = (plan.description || "").match(/\$(\d+(?:\.\d+)?)\/mo/i);
    const price = document.createElement("div");
    price.className = "plan-price";
    price.textContent = priceMatch ? "$" + priceMatch[1] + "/mo" : money(plan.total_price || 0);

    const title = document.createElement("h3");
    title.textContent = plan.name;

    const copy = document.createElement("p");
    copy.textContent = plan.description || "Recurring window maintenance.";

    card.append(price, title, copy);
    grid.appendChild(card);
  });
}

async function loadServiceOptions() {
  const select = document.querySelector("#serviceSelect");
  if (!select) return;

  const { data, error } = await supabase
    .from("services")
    .select("id,name")
    .eq("active", true)
    .order("sort_order");

  if (error || !data) return;

  data.forEach((service) => {
    const option = document.createElement("option");
    option.value = service.id;
    option.textContent = service.name;
    select.appendChild(option);
  });
}

const quoteForm = document.querySelector("#quoteForm");
const quoteStatus = document.querySelector("#quoteStatus");

quoteForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submit = quoteForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = "Sending...";
  quoteStatus.textContent = "";

  const form = new FormData(quoteForm);
  const sqft = form.get("property_sqft");

  const payload = {
    service_id: form.get("service_id") || null,
    name: String(form.get("name") || "").trim(),
    email: String(form.get("email") || "").trim(),
    phone: String(form.get("phone") || "").trim() || null,
    address: String(form.get("address") || "").trim() || null,
    city: String(form.get("city") || "").trim() || null,
    state: String(form.get("state") || "").trim().toUpperCase() || null,
    postal_code: String(form.get("postal_code") || "").trim() || null,
    property_sqft: sqft ? Number(sqft) : null,
    message: String(form.get("message") || "").trim() || null,
    company_website: String(form.get("company_website") || "").trim() || null,
  };

  const { data, error } = await supabase.functions.invoke(
    "submit-quote-request",
    { body: payload }
  );

  if (error || !data?.ok) {
    console.error(error || data);
    quoteStatus.className = "form-status error";
    quoteStatus.textContent = "We couldn't send your request. Please call or email us instead.";
  } else {
    quoteForm.reset();
    const state = quoteForm.querySelector('[name="state"]');
    if (state) state.value = "GA";
    quoteStatus.className = "form-status success";
    quoteStatus.textContent = "Request received. We will follow up with you.";
  }

  submit.disabled = false;
  submit.textContent = "Send Quote Request";
});

await Promise.all([loadMaintenancePlans(), loadServiceOptions()]);

trackSitePageView().catch((error) => {
  console.warn("Site analytics failed.", error);
});
