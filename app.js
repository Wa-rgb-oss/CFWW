import { supabase } from "./supabase-client.js";

const servicesGrid = document.querySelector("#servicesGrid");
const plansGrid = document.querySelector("#plansGrid");
const productsGrid = document.querySelector("#productsGrid");
const serviceSelect = document.querySelector("#serviceSelect");
const quoteForm = document.querySelector("#quoteForm");
const contactForm = document.querySelector("#contactForm");
const quoteStatus = document.querySelector("#quoteStatus");
const contactStatus = document.querySelector("#contactStatus");
const navToggle = document.querySelector("#navToggle");
const siteNav = document.querySelector("#siteNav");

document.querySelector("#year").textContent = new Date().getFullYear();

navToggle?.addEventListener("click", () => {
  const open = siteNav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});

siteNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    siteNav.classList.remove("open");
    navToggle?.setAttribute("aria-expanded", "false");
  });
});

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
  }).format(Number(value));
}

function fallbackImage(el) {
  el.addEventListener("error", () => {
    el.closest(".card-media")?.classList.add("image-error");
    el.remove();
  });
}

async function loadServices() {
  const { data, error } = await supabase
    .from("services")
    .select("id,slug,name,tagline,description,category,duration_minutes,rate_type,fixed_price,min_price,max_price,price_label,image_url,sort_order")
    .eq("active", true)
    .order("sort_order");

  if (error) {
    servicesGrid.innerHTML = '<div class="loading-card">Services are temporarily unavailable.</div>';
    return;
  }

  servicesGrid.innerHTML = "";
  serviceSelect.innerHTML = '<option value="">Select a service</option>';

  data.forEach((service) => {
    const option = document.createElement("option");
    option.value = service.id;
    option.textContent = service.name;
    serviceSelect.appendChild(option);

    const card = document.createElement("article");
    card.className = "service-card";

    const media = document.createElement("div");
    media.className = "card-media";
    const image = document.createElement("img");
    image.loading = "lazy";
    image.src = service.image_url || "";
    image.alt = service.name;
    fallbackImage(image);
    media.appendChild(image);

    const body = document.createElement("div");
    body.className = "card-body";

    const meta = document.createElement("div");
    meta.className = "card-meta";
    const category = document.createElement("span");
    category.textContent = service.category;
    const price = document.createElement("span");
    price.textContent =
      service.price_label ||
      (service.fixed_price != null ? money(service.fixed_price) : "Quote");
    meta.append(category, price);

    const title = document.createElement("h3");
    title.textContent = service.name;

    const copy = document.createElement("p");
    copy.textContent = service.tagline || service.description || "Request details and pricing.";

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const quoteButton = document.createElement("button");
    quoteButton.type = "button";
    quoteButton.className = "card-link";
    quoteButton.textContent = "Request quote →";
    quoteButton.addEventListener("click", () => {
      serviceSelect.value = service.id;
      document.querySelector("#quote").scrollIntoView({ behavior: "smooth" });
      setTimeout(() => quoteForm.querySelector('[name="name"]')?.focus(), 450);
    });
    actions.appendChild(quoteButton);

    body.append(meta, title, copy, actions);
    card.append(media, body);
    servicesGrid.appendChild(card);
  });
}

async function loadPlans() {
  const { data, error } = await supabase
    .from("membership_plans")
    .select("id,name,description,total_price,billing_period_count,display_index")
    .eq("active", true)
    .eq("visibility", "PUBLIC")
    .order("display_index");

  if (error) {
    plansGrid.innerHTML = '<div class="loading-card loading-card-dark">Care plans are temporarily unavailable.</div>';
    return;
  }

  plansGrid.innerHTML = "";
  data.forEach((plan) => {
    const monthlyMatch = plan.description.match(/\$(\d+(?:\.\d+)?)\/mo/i);
    const displayPrice = monthlyMatch ? "$" + monthlyMatch[1] + "/mo" : money(plan.total_price);

    const card = document.createElement("article");
    card.className = "plan-card";

    const price = document.createElement("div");
    price.className = "plan-price";
    price.textContent = displayPrice;

    const title = document.createElement("h3");
    title.textContent = plan.name;

    const copy = document.createElement("p");
    copy.textContent = plan.description;

    const action = document.createElement("button");
    action.type = "button";
    action.className = "card-link";
    action.textContent = "Ask about this plan →";
    action.addEventListener("click", () => {
      quoteForm.querySelector('[name="message"]').value = "I'm interested in the " + plan.name + ".";
      document.querySelector("#quote").scrollIntoView({ behavior: "smooth" });
    });

    card.append(price, title, copy, action);
    plansGrid.appendChild(card);
  });
}

async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,slug,price,currency,image_url")
    .eq("visible", true)
    .order("name");

  if (error) {
    productsGrid.innerHTML = '<div class="loading-card">Products are temporarily unavailable.</div>';
    return;
  }

  productsGrid.innerHTML = "";
  data.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";

    const media = document.createElement("div");
    media.className = "card-media";
    const image = document.createElement("img");
    image.loading = "lazy";
    image.src = product.image_url || "";
    image.alt = product.name;
    fallbackImage(image);
    media.appendChild(image);

    const body = document.createElement("div");
    body.className = "card-body";

    const meta = document.createElement("div");
    meta.className = "card-meta";
    const label = document.createElement("span");
    label.textContent = "CleanFreaks Gear";
    const price = document.createElement("span");
    price.className = "product-price";
    price.textContent = money(product.price);
    meta.append(label, price);

    const title = document.createElement("h3");
    title.textContent = product.name;

    const copy = document.createElement("p");
    copy.textContent = "Catalog item migrated from the CleanFreaks Wix store.";

    const action = document.createElement("button");
    action.type = "button";
    action.className = "card-link";
    action.textContent = "Ask about this item →";
    action.addEventListener("click", () => {
      contactForm.querySelector('[name="subject"]').value = "Product inquiry: " + product.name;
      contactForm.querySelector('[name="message"]').value = "I'm interested in the " + product.name + " (" + money(product.price) + ").";
      document.querySelector("#contact").scrollIntoView({ behavior: "smooth" });
    });

    body.append(meta, title, copy, action);
    card.append(media, body);
    productsGrid.appendChild(card);
  });
}

function setStatus(element, type, message) {
  element.className = "form-status " + type;
  element.textContent = message;
}

quoteForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(quoteStatus, "", "Sending…");

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
    source: "website",
  };

  const { error } = await supabase.from("quote_requests").insert(payload);

  if (error) {
    console.error(error);
    setStatus(quoteStatus, "error", "We couldn't send your request. Please call or email us instead.");
    return;
  }

  quoteForm.reset();
  quoteForm.querySelector('[name="state"]').value = "GA";
  setStatus(quoteStatus, "success", "Quote request received. We'll follow up with you.");
});

contactForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(contactStatus, "", "Sending…");

  const form = new FormData(contactForm);
  const payload = {
    name: String(form.get("name") || "").trim(),
    email: String(form.get("email") || "").trim(),
    phone: String(form.get("phone") || "").trim() || null,
    subject: String(form.get("subject") || "").trim() || null,
    message: String(form.get("message") || "").trim(),
  };

  const { error } = await supabase.from("contact_messages").insert(payload);

  if (error) {
    console.error(error);
    setStatus(contactStatus, "error", "We couldn't send your message. Please call or email us instead.");
    return;
  }

  contactForm.reset();
  setStatus(contactStatus, "success", "Message received. Thanks for reaching out.");
});

await Promise.all([loadServices(), loadPlans(), loadProducts()]);
