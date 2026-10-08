import { supabase } from "/supabase-client.js";

const loginView = document.querySelector("#loginView");
const adminApp = document.querySelector("#adminApp");
const loginForm = document.querySelector("#loginForm");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const loginStatus = document.querySelector("#loginStatus");
const createLoginButton = document.querySelector("#createLoginButton");
const signOutButton = document.querySelector("#signOutButton");
const adminEmail = document.querySelector("#adminEmail");

const editor = document.querySelector("#proposalEditor");
const proposalForm = document.querySelector("#proposalForm");
const lineItems = document.querySelector("#lineItems");
const proposalStatus = document.querySelector("#proposalStatus");

let ownerEmail = "";
let requests = [];
let proposals = [];
let clients = [];
let editingProposal = null;
let editingRequest = null;

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dateLabel(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(value));
}

async function getOwnerEmail() {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "business")
    .single();

  ownerEmail = String(data?.value?.email || "").toLowerCase();
  if (ownerEmail) loginEmail.value = ownerEmail;
}

async function verifyOwner(session) {
  if (!session?.user?.email) return false;
  if (!ownerEmail) await getOwnerEmail();
  return session.user.email.toLowerCase() === ownerEmail;
}

function showLogin(message = "") {
  loginView.hidden = false;
  adminApp.hidden = true;
  loginStatus.textContent = message;
}

async function showAdmin(session) {
  const allowed = await verifyOwner(session);
  if (!allowed) {
    await supabase.auth.signOut();
    showLogin("This account is not authorized for CleanFreaks admin.");
    return;
  }

  loginView.hidden = true;
  adminApp.hidden = false;
  adminEmail.textContent = session.user.email;
  await refreshAll();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Signing in...";
  loginStatus.className = "form-status";
  loginStatus.textContent = "";

  try {
    const timeout = new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("Sign-in took too long. Please try again.")), 15000);
    });

    const signIn = supabase.auth.signInWithPassword({
      email: loginEmail.value.trim(),
      password: loginPassword.value,
    });

    const { data, error } = await Promise.race([signIn, timeout]);

    if (error) throw error;
    if (!data?.session) throw new Error("Sign-in completed without a session.");

    await showAdmin(data.session);
  } catch (error) {
    console.error(error);
    loginStatus.className = "form-status error";
    loginStatus.textContent = error.message || "Could not sign in.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Sign In";
  }
});

createLoginButton.addEventListener("click", async () => {
  loginStatus.textContent = "";

  if (loginEmail.value.trim().toLowerCase() !== ownerEmail) {
    loginStatus.className = "form-status error";
    loginStatus.textContent = "Use the CleanFreaks owner email to create the admin login.";
    return;
  }

  if (loginPassword.value.length < 8) {
    loginStatus.className = "form-status error";
    loginStatus.textContent = "Choose a password with at least 8 characters.";
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email: loginEmail.value.trim(),
    password: loginPassword.value,
    options: {
      emailRedirectTo: window.location.origin + "/admin/",
    },
  });

  if (error) {
    loginStatus.className = "form-status error";
    loginStatus.textContent = error.message;
    return;
  }

  if (data.session) {
    await showAdmin(data.session);
  } else {
    loginStatus.className = "form-status success";
    loginStatus.textContent = "Admin login created. Check your email if Supabase asks you to confirm the account, then return here and sign in.";
  }
});

signOutButton.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showLogin();
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});
document.querySelectorAll("[data-jump]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.jump));
});

function setView(view) {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.viewPanel === view);
  });
  const titles = {
    dashboard: "Dashboard",
    requests: "Quote Requests",
    proposals: "Proposals",
    clients: "Clients",
  };
  document.querySelector("#viewTitle").textContent = titles[view] || "CleanFreaks";
}

async function refreshAll() {
  const [requestResult, proposalResult, clientResult] = await Promise.all([
    supabase
      .from("quote_requests")
      .select("*, services(name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("proposals")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("clients")
      .select("*")
      .order("updated_at", { ascending: false }),
  ]);

  requests = requestResult.data || [];
  proposals = proposalResult.data || [];
  clients = clientResult.data || [];

  renderStats();
  renderRequests();
  renderProposals();
  renderClients();
}

function renderStats() {
  document.querySelector("#statRequests").textContent =
    requests.filter((item) => item.status === "new").length;
  document.querySelector("#statProposals").textContent =
    proposals.filter((item) => ["draft", "sent"].includes(item.status)).length;
  document.querySelector("#statAccepted").textContent =
    proposals.filter((item) => item.status === "accepted").length;
  document.querySelector("#statClients").textContent = clients.length;
}

function requestRow(request) {
  const service = request.services?.name || "General cleaning";
  const location = [request.city, request.state].filter(Boolean).join(", ");
  return `
    <article class="admin-row">
      <div class="admin-row-main">
        <strong>${escapeHtml(request.name)}</strong>
        <span>${escapeHtml(service)}${location ? " · " + escapeHtml(location) : ""}</span>
      </div>
      <div class="admin-row-meta">
        <span>${escapeHtml(request.email)}</span>
        <span>${dateLabel(request.created_at)}</span>
        <span class="status-badge">${escapeHtml(request.status)}</span>
      </div>
      <div class="admin-row-actions">
        <button type="button" data-build-request="${request.id}">Build Proposal</button>
        <button type="button" data-contact-request="${request.id}">Contact</button>
      </div>
    </article>
  `;
}

function renderRequests() {
  const all = document.querySelector("#requestsList");
  const recent = document.querySelector("#dashboardRequests");

  all.innerHTML = requests.length
    ? requests.map(requestRow).join("")
    : '<div class="empty-state">No quote requests yet.</div>';

  recent.innerHTML = requests.length
    ? requests.slice(0, 5).map(requestRow).join("")
    : '<div class="empty-state">No quote requests yet.</div>';

  document.querySelectorAll("[data-build-request]").forEach((button) => {
    button.addEventListener("click", () => openRequestProposal(button.dataset.buildRequest));
  });

  document.querySelectorAll("[data-contact-request]").forEach((button) => {
    button.addEventListener("click", () => {
      const request = requests.find((item) => item.id === button.dataset.contactRequest);
      if (!request) return;
      window.location.href = "mailto:" + request.email + "?subject=" +
        encodeURIComponent("CleanFreaks quote request") +
        "&body=" + encodeURIComponent("Hi " + request.name + ",\n\nThanks for reaching out to CleanFreaks.\n\n");
    });
  });
}

function renderProposals() {
  const list = document.querySelector("#proposalsList");

  list.innerHTML = proposals.length
    ? proposals.map((proposal) => `
      <article class="admin-row">
        <div class="admin-row-main">
          <strong>#${String(proposal.proposal_number || "").padStart(4, "0")} · ${escapeHtml(proposal.client_name)}</strong>
          <span>${escapeHtml(proposal.title)}</span>
        </div>
        <div class="admin-row-meta">
          <span>${money(proposal.total)}</span>
          <span>${dateLabel(proposal.created_at)}</span>
          <span class="status-badge ${escapeHtml(proposal.status)}">${escapeHtml(proposal.status)}</span>
        </div>
        <div class="admin-row-actions">
          <button type="button" data-edit-proposal="${proposal.id}">Edit</button>
          <button type="button" data-copy-proposal="${proposal.id}">Copy Link</button>
          <button type="button" data-email-proposal="${proposal.id}">Email</button>
        </div>
      </article>
    `).join("")
    : '<div class="empty-state">No proposals yet. Create one from a quote request or use New Proposal.</div>';

  document.querySelectorAll("[data-edit-proposal]").forEach((button) => {
    button.addEventListener("click", () => openExistingProposal(button.dataset.editProposal));
  });
  document.querySelectorAll("[data-copy-proposal]").forEach((button) => {
    button.addEventListener("click", async () => {
      const proposal = proposals.find((item) => item.id === button.dataset.copyProposal);
      if (!proposal) return;
      await navigator.clipboard.writeText(proposalLink(proposal));
      button.textContent = "Copied";
      setTimeout(() => button.textContent = "Copy Link", 1200);
    });
  });
  document.querySelectorAll("[data-email-proposal]").forEach((button) => {
    button.addEventListener("click", async () => {
      const proposal = proposals.find((item) => item.id === button.dataset.emailProposal);
      if (!proposal) return;

      button.disabled = true;
      const previousLabel = button.textContent;
      button.textContent = "Sending...";

      try {
        await sendProposalEmail(proposal);
        button.textContent = "Sent";
        await refreshAll();
        setTimeout(() => {
          button.textContent = previousLabel;
          button.disabled = false;
        }, 1400);
      } catch (error) {
        console.error(error);
        button.textContent = previousLabel;
        button.disabled = false;
        alert(error.message || "Could not send the proposal email.");
      }
    });
  });
}

function renderClients() {
  const list = document.querySelector("#clientsList");

  list.innerHTML = clients.length
    ? clients.map((client) => `
      <article class="admin-row">
        <div class="admin-row-main">
          <strong>${escapeHtml(client.name)}</strong>
          <span>${escapeHtml(client.company || "")}</span>
        </div>
        <div class="admin-row-meta">
          <span>${escapeHtml(client.email || "")}</span>
          <span>${escapeHtml(client.phone || "")}</span>
        </div>
        <div class="admin-row-actions">
          ${client.email ? '<button type="button" data-email-client="' + client.id + '">Email</button>' : ""}
        </div>
      </article>
    `).join("")
    : '<div class="empty-state">Clients are created when you save proposals.</div>';

  document.querySelectorAll("[data-email-client]").forEach((button) => {
    button.addEventListener("click", () => {
      const client = clients.find((item) => item.id === button.dataset.emailClient);
      if (client?.email) window.location.href = "mailto:" + client.email;
    });
  });
}

function proposalLink(proposal) {
  return window.location.origin + "/proposal/?token=" + proposal.public_token;
}

async function sendProposalEmail(proposal) {
  if (!proposal?.id) {
    throw new Error("Save the proposal before emailing it.");
  }

  if (!proposal.client_email) {
    throw new Error("Add a client email address before sending the proposal.");
  }

  const { data, error } = await supabase.functions.invoke("send-proposal-email", {
    body: { proposal_id: proposal.id },
  });

  if (error) {
    const detail = error?.context?.body?.message || error?.message || "";
    if (String(detail).includes("email_provider_not_configured")) {
      throw new Error("Proposal email is ready, but the outbound email provider still needs to be connected.");
    }
    throw new Error(detail || "The proposal email could not be sent.");
  }

  if (!data?.ok) {
    if (data?.error === "email_provider_not_configured") {
      throw new Error("Proposal email is ready, but the outbound email provider still needs to be connected.");
    }
    throw new Error(data?.message || "The proposal email could not be sent.");
  }

  return data;
}

document.querySelector("#newProposalButton").addEventListener("click", () => openNewProposal());

document.querySelectorAll("[data-close-editor]").forEach((element) => {
  element.addEventListener("click", closeEditor);
});

function resetEditor() {
  proposalForm.reset();
  document.querySelector("#proposalId").value = "";
  document.querySelector("#proposalRequestId").value = "";
  document.querySelector("#proposalClientId").value = "";
  document.querySelector("#proposalClientState").value = "GA";
  document.querySelector("#proposalTitle").value = "Cleaning Proposal";
  document.querySelector("#proposalDiscount").value = "0";
  document.querySelector("#proposalTerms").value =
    "Proposal pricing is based on the scope described above. Changes to access, condition, quantity, or requested work may require a revised proposal. Scheduling is confirmed separately. No payment is collected through this website.";
  proposalStatus.textContent = "";
  lineItems.innerHTML = "";
  addLineItem();
  editingProposal = null;
  editingRequest = null;
  setDefaultValidUntil();
  recalcTotals();
}

function setDefaultValidUntil() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  document.querySelector("#proposalValidUntil").value = date.toISOString().slice(0, 10);
}

function openNewProposal() {
  resetEditor();
  document.querySelector("#proposalEditorTitle").textContent = "New Proposal";
  editor.hidden = false;
}

function openRequestProposal(id) {
  const request = requests.find((item) => item.id === id);
  if (!request) return;

  resetEditor();
  editingRequest = request;
  document.querySelector("#proposalEditorTitle").textContent = "Proposal from Request";
  document.querySelector("#proposalRequestId").value = request.id;
  document.querySelector("#proposalClientName").value = request.name || "";
  document.querySelector("#proposalClientEmail").value = request.email || "";
  document.querySelector("#proposalClientPhone").value = request.phone || "";
  document.querySelector("#proposalClientAddress").value = request.address || "";
  document.querySelector("#proposalClientCity").value = request.city || "";
  document.querySelector("#proposalClientState").value = request.state || "GA";
  document.querySelector("#proposalClientZip").value = request.postal_code || "";
  document.querySelector("#proposalIntroduction").value =
    "Thank you for the opportunity to provide a cleaning proposal. The scope below is based on the information provided in your request.";

  const firstDescription = request.services?.name || "Cleaning Service";
  const first = lineItems.querySelector(".line-item-description");
  if (first) first.value = firstDescription;

  const detail = lineItems.querySelector(".line-item-details textarea");
  if (detail && request.message) detail.value = request.message;

  editor.hidden = false;
}

async function openExistingProposal(id) {
  const proposal = proposals.find((item) => item.id === id);
  if (!proposal) return;

  const { data: items, error } = await supabase
    .from("proposal_items")
    .select("*")
    .eq("proposal_id", id)
    .order("sort_order");

  if (error) {
    alert("Could not load proposal items.");
    return;
  }

  resetEditor();
  editingProposal = proposal;
  document.querySelector("#proposalEditorTitle").textContent =
    "Proposal #" + String(proposal.proposal_number || "").padStart(4, "0");
  document.querySelector("#proposalId").value = proposal.id;
  document.querySelector("#proposalRequestId").value = proposal.quote_request_id || "";
  document.querySelector("#proposalClientId").value = proposal.client_id || "";
  document.querySelector("#proposalClientName").value = proposal.client_name || "";
  document.querySelector("#proposalClientEmail").value = proposal.client_email || "";
  document.querySelector("#proposalTitle").value = proposal.title || "Cleaning Proposal";
  document.querySelector("#proposalValidUntil").value = proposal.valid_until || "";
  document.querySelector("#proposalIntroduction").value = proposal.introduction || "";
  document.querySelector("#proposalNotes").value = proposal.notes || "";
  document.querySelector("#proposalTerms").value = proposal.terms || "";
  document.querySelector("#proposalDiscount").value = proposal.discount || 0;

  const client = clients.find((item) => item.id === proposal.client_id);
  if (client) {
    document.querySelector("#proposalClientPhone").value = client.phone || "";
    document.querySelector("#proposalClientCompany").value = client.company || "";
    document.querySelector("#proposalClientAddress").value = client.address || "";
    document.querySelector("#proposalClientCity").value = client.city || "";
    document.querySelector("#proposalClientState").value = client.state || "GA";
    document.querySelector("#proposalClientZip").value = client.postal_code || "";
  }

  lineItems.innerHTML = "";
  if (items?.length) items.forEach((item) => addLineItem(item));
  else addLineItem();

  recalcTotals();
  editor.hidden = false;
}

function closeEditor() {
  editor.hidden = true;
}

document.querySelector("#addLineItemButton").addEventListener("click", () => addLineItem());

function addLineItem(item = {}) {
  const row = document.createElement("div");
  row.className = "line-item";
  row.innerHTML = `
    <label>Service / item
      <input class="line-item-description" value="${escapeHtml(item.description || "")}" required>
    </label>
    <label>Qty
      <input class="line-item-quantity" type="number" min="0.01" step="0.01" value="${item.quantity ?? 1}">
    </label>
    <label>Unit price
      <input class="line-item-price" type="number" min="0" step="0.01" value="${item.unit_price ?? 0}">
    </label>
    <button class="line-item-remove" type="button" aria-label="Remove item">×</button>
    <label class="line-item-details">Details
      <textarea rows="2">${escapeHtml(item.details || "")}</textarea>
    </label>
  `;
  row.querySelector(".line-item-remove").addEventListener("click", () => {
    row.remove();
    if (!lineItems.children.length) addLineItem();
    recalcTotals();
  });
  row.querySelectorAll("input").forEach((input) => input.addEventListener("input", recalcTotals));
  lineItems.appendChild(row);
  recalcTotals();
}

document.querySelector("#proposalDiscount").addEventListener("input", recalcTotals);

function lineItemData() {
  return [...lineItems.querySelectorAll(".line-item")].map((row, index) => ({
    description: row.querySelector(".line-item-description").value.trim(),
    details: row.querySelector(".line-item-details textarea").value.trim() || null,
    quantity: Number(row.querySelector(".line-item-quantity").value || 1),
    unit_price: Number(row.querySelector(".line-item-price").value || 0),
    sort_order: index,
  })).filter((item) => item.description);
}

function recalcTotals() {
  const subtotal = lineItemData().reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const discount = Number(document.querySelector("#proposalDiscount").value || 0);
  const total = Math.max(0, subtotal - discount);
  document.querySelector("#proposalSubtotal").textContent = money(subtotal);
  document.querySelector("#proposalTotal").textContent = money(total);
  return { subtotal, discount, total };
}

async function saveProposal(statusOverride = null) {
  proposalStatus.className = "form-status";
  proposalStatus.textContent = "Saving...";

  const clientName = document.querySelector("#proposalClientName").value.trim();
  if (!clientName) {
    proposalStatus.className = "form-status error";
    proposalStatus.textContent = "Client name is required.";
    return null;
  }

  const items = lineItemData();
  if (!items.length) {
    proposalStatus.className = "form-status error";
    proposalStatus.textContent = "Add at least one line item.";
    return null;
  }

  const clientPayload = {
    name: clientName,
    company: document.querySelector("#proposalClientCompany").value.trim() || null,
    email: document.querySelector("#proposalClientEmail").value.trim() || null,
    phone: document.querySelector("#proposalClientPhone").value.trim() || null,
    address: document.querySelector("#proposalClientAddress").value.trim() || null,
    city: document.querySelector("#proposalClientCity").value.trim() || null,
    state: document.querySelector("#proposalClientState").value.trim().toUpperCase() || null,
    postal_code: document.querySelector("#proposalClientZip").value.trim() || null,
    updated_at: new Date().toISOString(),
  };

  let clientId = document.querySelector("#proposalClientId").value || null;

  if (clientId) {
    const { error } = await supabase.from("clients").update(clientPayload).eq("id", clientId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("clients").insert(clientPayload).select("id").single();
    if (error) throw error;
    clientId = data.id;
    document.querySelector("#proposalClientId").value = clientId;
  }

  const totals = recalcTotals();
  const currentId = document.querySelector("#proposalId").value || null;
  const current = currentId ? proposals.find((item) => item.id === currentId) : null;

  const proposalPayload = {
    client_id: clientId,
    client_name: clientName,
    client_email: clientPayload.email,
    quote_request_id: document.querySelector("#proposalRequestId").value || null,
    title: document.querySelector("#proposalTitle").value.trim() || "Cleaning Proposal",
    valid_until: document.querySelector("#proposalValidUntil").value || null,
    introduction: document.querySelector("#proposalIntroduction").value.trim() || null,
    notes: document.querySelector("#proposalNotes").value.trim() || null,
    terms: document.querySelector("#proposalTerms").value.trim() || null,
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    status: statusOverride || current?.status || "draft",
    updated_at: new Date().toISOString(),
  };

  if (statusOverride === "sent") proposalPayload.sent_at = new Date().toISOString();

  let savedProposal;

  if (currentId) {
    const { data, error } = await supabase
      .from("proposals")
      .update(proposalPayload)
      .eq("id", currentId)
      .select("*")
      .single();
    if (error) throw error;
    savedProposal = data;

    const { error: deleteError } = await supabase
      .from("proposal_items")
      .delete()
      .eq("proposal_id", currentId);
    if (deleteError) throw deleteError;
  } else {
    const { data, error } = await supabase
      .from("proposals")
      .insert(proposalPayload)
      .select("*")
      .single();
    if (error) throw error;
    savedProposal = data;
    document.querySelector("#proposalId").value = savedProposal.id;
  }

  const itemPayloads = items.map((item) => ({ ...item, proposal_id: savedProposal.id }));
  const { error: itemError } = await supabase.from("proposal_items").insert(itemPayloads);
  if (itemError) throw itemError;

  const requestId = document.querySelector("#proposalRequestId").value;
  if (requestId) {
    await supabase.from("quote_requests").update({ status: "quoted" }).eq("id", requestId);
  }

  proposalStatus.className = "form-status success";
  proposalStatus.textContent = "Proposal saved.";
  await refreshAll();
  return proposals.find((item) => item.id === savedProposal.id) || savedProposal;
}

document.querySelector("#saveDraftButton").addEventListener("click", async () => {
  try {
    await saveProposal();
  } catch (error) {
    console.error(error);
    proposalStatus.className = "form-status error";
    proposalStatus.textContent = error.message || "Could not save proposal.";
  }
});

document.querySelector("#emailProposalButton").addEventListener("click", async () => {
  const button = document.querySelector("#emailProposalButton");
  try {
    button.disabled = true;
    button.textContent = "Saving...";
    const proposal = await saveProposal();

    if (!proposal) return;

    button.textContent = "Sending...";
    await sendProposalEmail(proposal);

    proposalStatus.className = "form-status success";
    proposalStatus.textContent = "Proposal emailed successfully.";
    button.textContent = "Sent";
    await refreshAll();

    setTimeout(() => {
      button.textContent = "Save & Email Proposal";
      button.disabled = false;
    }, 1400);
  } catch (error) {
    console.error(error);
    proposalStatus.className = "form-status error";
    proposalStatus.textContent = error.message || "Could not send proposal email.";
    button.textContent = "Save & Email Proposal";
    button.disabled = false;
  }
});

await getOwnerEmail();

const { data: sessionData } = await supabase.auth.getSession();
if (sessionData.session) await showAdmin(sessionData.session);
else showLogin();

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    showLogin();
  }
});