import { supabase } from "/supabase-client.js";

const navToggle = document.querySelector("#navToggle");
const siteNav = document.querySelector("#siteNav");
const productsGrid = document.querySelector("#productsGrid");
const quoteForm = document.querySelector("#quoteForm");
const quoteStatus = document.querySelector("#quoteStatus");
const serviceSelect = document.querySelector("#serviceSelect");

navToggle?.addEventListener("click", () => {
  const isOpen = siteNav?.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));
});

siteNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    siteNav.classList.remove("open");
    navToggle?.setAttribute("aria-expanded", "false");
  });
});

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

async function loadProducts() {
  if (!productsGrid) return;

  const { data, error } = await supabase
    .from("products")
    .select("id,name,price,image_url")
    .eq("visible", true)
    .order("name");

  if (error) {
    productsGrid.innerHTML = '<div class="legacy-loading">Products are temporarily unavailable.</div>';
    return;
  }

  productsGrid.innerHTML = "";

  data.forEach((product) => {
    const article = document.createElement("article");
    article.className = "legacy-product-card";

    const media = document.createElement("div");
    media.className = "legacy-product-image";

    const image = document.createElement("img");
    image.loading = "lazy";
    image.src = product.image_url || "";
    image.alt = product.name;
    media.appendChild(image);

    const title = document.createElement("h3");
    title.textContent = product.name;

    const price = document.createElement("p");
    price.className = "legacy-product-price";
    price.textContent = "Price " + formatMoney(product.price);

    article.append(media, title, price);
    productsGrid.appendChild(article);
  });
}

async function loadServiceOptions() {
  if (!serviceSelect) return;

  const { data } = await supabase
    .from("services")
    .select("id,name")
    .eq("active", true)
    .order("sort_order");

  if (!data) return;

  data.forEach((service) => {
    const option = document.createElement("option");
    option.value = service.id;
    option.textContent = service.name;
    serviceSelect.appendChild(option);
  });
}

function setStatus(element, type, message) {
  if (!element) return;
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
    setStatus(quoteStatus, "error", "We couldn't send your request. Please contact us directly.");
    return;
  }

  quoteForm.reset();
  const stateField = quoteForm.querySelector('[name="state"]');
  if (stateField) stateField.value = "GA";
  setStatus(quoteStatus, "success", "Your quote request has been received.");
});

await Promise.all([loadProducts(), loadServiceOptions()]);