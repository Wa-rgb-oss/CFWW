import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
} from "/supabase-client.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storageKey: "cfww_employee_auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

const loginView = document.querySelector("#employeeLogin");
const appView = document.querySelector("#employeeApp");
const loginForm = document.querySelector("#employeeLoginForm");
const loginEmail = document.querySelector("#employeeLoginEmail");
const loginPassword = document.querySelector("#employeeLoginPassword");
const loginStatus = document.querySelector("#employeeLoginStatus");
const createLoginButton = document.querySelector("#employeeCreateLoginButton");
const signOutButton = document.querySelector("#employeeSignOutButton");
const employeeEmailLabel = document.querySelector("#employeeEmail");

const proposalEditor = document.querySelector("#employeeProposalEditor");
const proposalForm = document.querySelector("#employeeProposalForm");
const proposalStatus = document.querySelector("#employeeProposalStatus");
const lineItems = document.querySelector("#employeeLineItems");

let currentSession = null;
let proposals = [];
let editingProposal = null;

const calculatorCatalog = [
  { id: "single-hung", name: "Single Hung Window", price: 7 },
  { id: "large-window", name: "Large Window", price: 17 },
  { id: "two-hinge-door", name: "Two Hinge Door", price: 10 },
  { id: "four-hinge-door", name: "Four Hinge Door", price: 17 },
  { id: "4-pane", name: "4 Pane", price: 5 },
  { id: "8-pane", name: "8 Pane", price: 7 },
  { id: "12-pane", name: "12 Pane", price: 10 },
  { id: "16-pane", name: "16 Pane", price: 13 },
  { id: "18-pane", name: "18 Pane", price: 17 },
  { id: "20-pane", name: "20 Pane", price: 18 },
  { id: "24-pane", name: "24 Pane", price: 20 },
  { id: "casement", name: "Casement Window", price: 10 },
];

const calculatorCounts = Object.fromEntries(
  calculatorCatalog.map((item) => [item.id, 0])
);

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
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function showLogin(message = "") {
  loginView.hidden = false;
  appView.hidden = true;
  if (message) {
    loginStatus.className = "form-status error";
    loginStatus.textContent = message;
  }
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
  employeeEmailLabel.textContent = currentSession?.user?.email || "";
}

async function verifyEmployee(session) {
  if (!session?.user?.email) return false;

  const email = session.user.email.toLowerCase();

  const { data, error } = await supabase
    .from("employee_access")
    .select("id,email")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("Employee access verification failed.", error);
    return false;
  }

  return Boolean(data);
}

async function activateSession(session) {
  const allowed = await verifyEmployee(session);

  if (!allowed) {
    await supabase.auth.signOut();
    currentSession = null;
    showLogin("This email is not approved for CleanFreaks employee access.");
    return;
  }

  currentSession = session;
  showApp();
  await loadProposals();
  renderCalculator();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Signing in...";
  loginStatus.className = "form-status";
  loginStatus.textContent = "";

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail.value.trim(),
      password: loginPassword.value,
    });

    if (error) throw error;
    if (!data?.session) throw new Error("Sign-in completed without a session.");

    await activateSession(data.session);
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
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  loginStatus.className = "form-status";
  loginStatus.textContent = "";

  if (!email) {
    loginStatus.className = "form-status error";
    loginStatus.textContent = "Enter your approved employee email first.";
    return;
  }

  if (password.length < 8) {
    loginStatus.className = "form-status error";
    loginStatus.textContent = "Choose a password with at least 8 characters.";
    return;
  }

  createLoginButton.disabled = true;
  createLoginButton.textContent = "Creating...";

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/employee/",
      },
    });

    if (error) throw error;

    if (data?.session) {
      await activateSession(data.session);
      return;
    }

    loginStatus.className = "form-status success";
    loginStatus.textContent =
      "Employee login created. Check your email if confirmation is required, then return here and sign in.";
  } catch (error) {
    console.error(error);
    loginStatus.className = "form-status error";
    loginStatus.textContent = error.message || "Could not create the employee login.";
  } finally {
    createLoginButton.disabled = false;
    createLoginButton.textContent = "Create employee login";
  }
});

signOutButton.addEventListener("click", async () => {
  await supabase.auth.signOut();
  currentSession = null;
  proposals = [];
  showLogin();
});

function setView(view) {
  document.querySelectorAll("[data-employee-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.employeeView === view);
  });

  document.querySelectorAll("[data-employee-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.employeePanel === view);
  });

  const titles = {
    dashboard: "Dashboard",
    calculator: "Quote Calculator",
    proposals: "My Proposals",
  };

  document.querySelector("#employeeViewTitle").textContent =
    titles[view] || "Employee Portal";
}

document.querySelectorAll("[data-employee-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.employeeView));
});

document.querySelectorAll("[data-employee-jump]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.employeeJump));
});

async function loadProposals() {
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load employee proposals.", error);
    proposals = [];
  } else {
    proposals = data || [];
  }

  renderProposalStats();
  renderProposalLists();
}

function renderProposalStats() {
  const open = proposals.filter(
    (proposal) =>
      !proposal.archived_at &&
      ["draft", "sent"].includes(proposal.status)
  );

  const accepted = proposals.filter(
    (proposal) => proposal.status === "accepted"
  );

  const pendingValue = open.reduce(
    (sum, proposal) => sum + Number(proposal.total || 0),
    0
  );

  document.querySelector("#employeeStatOpen").textContent = String(open.length);
  document.querySelector("#employeeStatAccepted").textContent = String(
    accepted.length
  );
  document.querySelector("#employeeStatPendingValue").textContent =
    money(pendingValue);
}

function proposalRow(proposal) {
  const canEdit = ["draft", "sent"].includes(proposal.status);
  const canSend = canEdit && Boolean(proposal.client_email);
  const canView = proposal.status !== "draft";

  return `
    <article class="employee-proposal-row">
      <div class="employee-proposal-main">
        <strong>
          Proposal #${String(proposal.proposal_number || "").padStart(4, "0")}
          · ${escapeHtml(proposal.client_name)}
        </strong>
        <span>${escapeHtml(proposal.title || "Cleaning Proposal")}</span>
      </div>

      <div class="employee-proposal-meta">
        <strong>${money(proposal.total)}</strong>
        <span>Created ${escapeHtml(dateLabel(proposal.created_at))}</span>
        <span class="employee-status ${escapeHtml(proposal.status)}">
          ${escapeHtml(proposal.status)}
        </span>
      </div>

      <div class="employee-proposal-actions">
        ${canEdit ? '<button type="button" data-edit-employee-proposal="' + proposal.id + '">Edit</button>' : ""}
        ${canSend ? '<button type="button" data-send-employee-proposal="' + proposal.id + '">' + (proposal.status === "sent" ? "Resend" : "Send") + '</button>' : ""}
        ${canView ? '<a href="/proposal/?token=' + encodeURIComponent(proposal.public_token) + '" target="_blank" rel="noopener">View</a>' : ""}
      </div>
    </article>
  `;
}

function renderProposalLists() {
  const list = document.querySelector("#employeeProposalsList");
  const recent = document.querySelector("#employeeRecentProposals");

  list.innerHTML = proposals.length
    ? proposals.map(proposalRow).join("")
    : '<div class="employee-empty">You have not created any proposals yet.</div>';

  recent.innerHTML = proposals.length
    ? proposals.slice(0, 4).map(proposalRow).join("")
    : '<div class="employee-empty">You have not created any proposals yet.</div>';

  document.querySelectorAll("[data-edit-employee-proposal]").forEach((button) => {
    button.addEventListener("click", () =>
      openExistingProposal(button.dataset.editEmployeeProposal)
    );
  });

  document.querySelectorAll("[data-send-employee-proposal]").forEach((button) => {
    button.addEventListener("click", async () => {
      const proposal = proposals.find(
        (item) => item.id === button.dataset.sendEmployeeProposal
      );
      if (!proposal) return;

      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "Sending...";

      try {
        await sendProposalEmail(proposal);
        await loadProposals();
      } catch (error) {
        console.error(error);
        alert(error.message || "The proposal email could not be sent.");
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });
}

function renderCalculator() {
  const container = document.querySelector("#calculatorItems");

  container.innerHTML = calculatorCatalog
    .map(
      (item) => `
        <article class="calculator-item">
          <div class="calculator-item-top">
            <strong>${escapeHtml(item.name)}</strong>
            <span class="calculator-item-price">${money(item.price)}</span>
          </div>
          <div class="calculator-counter">
            <button type="button" data-calc-minus="${item.id}" aria-label="Remove one ${escapeHtml(item.name)}">−</button>
            <output id="calc-count-${item.id}">${calculatorCounts[item.id]}</output>
            <button type="button" data-calc-plus="${item.id}" aria-label="Add one ${escapeHtml(item.name)}">+</button>
          </div>
        </article>
      `
    )
    .join("");

  document.querySelectorAll("[data-calc-minus]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.calcMinus;
      calculatorCounts[id] = Math.max(0, Number(calculatorCounts[id] || 0) - 1);
      updateCalculatorDisplay();
    });
  });

  document.querySelectorAll("[data-calc-plus]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.calcPlus;
      calculatorCounts[id] = Number(calculatorCounts[id] || 0) + 1;
      updateCalculatorDisplay();
    });
  });

  updateCalculatorDisplay();
}

function calculatorTotals() {
  const exterior = calculatorCatalog.reduce(
    (sum, item) => sum + Number(calculatorCounts[item.id] || 0) * item.price,
    0
  );

  const interior = Math.round(exterior * 0.7);
  const full = exterior + interior;

  return { exterior, interior, full };
}

function selectedCalculatorItems() {
  return calculatorCatalog
    .filter((item) => Number(calculatorCounts[item.id] || 0) > 0)
    .map((item) => ({
      ...item,
      quantity: Number(calculatorCounts[item.id] || 0),
    }));
}

function updateCalculatorDisplay() {
  calculatorCatalog.forEach((item) => {
    const output = document.querySelector("#calc-count-" + item.id);
    if (output) output.textContent = String(calculatorCounts[item.id] || 0);
  });

  const totals = calculatorTotals();

  document.querySelector("#calculatorExterior").textContent =
    money(totals.exterior);
  document.querySelector("#calculatorInterior").textContent =
    money(totals.interior);
  document.querySelector("#calculatorFull").textContent = money(totals.full);

  const selected = selectedCalculatorItems();
  const summary = document.querySelector("#calculatorSelectedItems");

  summary.innerHTML = selected.length
    ? selected
        .map(
          (item) =>
            "<div>" +
            item.quantity +
            " × " +
            escapeHtml(item.name) +
            " · " +
            money(item.quantity * item.price) +
            "</div>"
        )
        .join("")
    : "No items selected.";
}

document.querySelector("#calculatorResetButton").addEventListener("click", () => {
  calculatorCatalog.forEach((item) => {
    calculatorCounts[item.id] = 0;
  });
  updateCalculatorDisplay();
});

document.querySelectorAll("[data-use-quote]").forEach((button) => {
  button.addEventListener("click", () => {
    const selected = selectedCalculatorItems();

    if (!selected.length) {
      alert("Add at least one item to the calculator first.");
      return;
    }

    const totals = calculatorTotals();
    const type = button.dataset.useQuote;

    const configurations = {
      exterior: {
        description: "Exterior Window Cleaning",
        price: totals.exterior,
        label: "Exterior only",
      },
      interior: {
        description: "Interior Window Cleaning",
        price: totals.interior,
        label: "Interior only",
      },
      full: {
        description: "Interior & Exterior Window Cleaning",
        price: totals.full,
        label: "Interior and exterior",
      },
    };

    const configuration = configurations[type];
    const detailLines = selected.map(
      (item) =>
        item.quantity + " × " + item.name + " @ " + money(item.price)
    );

    openNewProposal({
      calculatorItem: {
        description: configuration.description,
        details:
          configuration.label +
          " quote based on: " +
          detailLines.join("; "),
        quantity: 1,
        unit_price: configuration.price,
      },
    });
  });
});

function setDefaultValidUntil() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  document.querySelector("#employeeProposalValidUntil").value =
    date.toISOString().slice(0, 10);
}

function resetProposalEditor() {
  proposalForm.reset();
  document.querySelector("#employeeProposalId").value = "";
  document.querySelector("#employeeClientState").value = "GA";
  document.querySelector("#employeeProposalTitle").value = "Cleaning Proposal";
  document.querySelector("#employeeProposalDiscount").value = "0";
  document.querySelector("#employeeProposalIntroduction").value =
    "Thank you for the opportunity to provide a cleaning proposal. The scope and pricing are outlined below.";
  document.querySelector("#employeeProposalTerms").value =
    "Proposal pricing is based on the scope described above. Changes to access, condition, quantity, or requested work may require a revised proposal. Scheduling is confirmed separately. No payment is collected through this website.";
  lineItems.innerHTML = "";
  addLineItem();
  setDefaultValidUntil();
  editingProposal = null;
  proposalStatus.className = "form-status";
  proposalStatus.textContent = "";
  recalcProposalTotals();
}

function openNewProposal(options = {}) {
  resetProposalEditor();

  if (options.calculatorItem) {
    lineItems.innerHTML = "";
    addLineItem(options.calculatorItem);
  }

  document.querySelector("#employeeProposalEditorTitle").textContent =
    options.calculatorItem ? "Proposal from Quote Calculator" : "New Proposal";

  proposalEditor.hidden = false;
}

async function openExistingProposal(id) {
  const proposal = proposals.find((item) => item.id === id);
  if (!proposal) return;

  if (!["draft", "sent"].includes(proposal.status)) {
    alert("Accepted or declined proposals are read-only in the employee portal.");
    return;
  }

  const { data: items, error } = await supabase
    .from("proposal_items")
    .select("*")
    .eq("proposal_id", id)
    .order("sort_order");

  if (error) {
    console.error(error);
    alert("Could not load proposal items.");
    return;
  }

  resetProposalEditor();
  editingProposal = proposal;

  document.querySelector("#employeeProposalId").value = proposal.id;
  document.querySelector("#employeeClientName").value =
    proposal.client_name || "";
  document.querySelector("#employeeClientEmail").value =
    proposal.client_email || "";
  document.querySelector("#employeeClientPhone").value =
    proposal.client_phone || "";
  document.querySelector("#employeeClientCompany").value =
    proposal.client_company || "";
  document.querySelector("#employeeClientAddress").value =
    proposal.client_address || "";
  document.querySelector("#employeeClientCity").value =
    proposal.client_city || "";
  document.querySelector("#employeeClientState").value =
    proposal.client_state || "GA";
  document.querySelector("#employeeClientZip").value =
    proposal.client_postal_code || "";
  document.querySelector("#employeeProposalTitle").value =
    proposal.title || "Cleaning Proposal";
  document.querySelector("#employeeProposalValidUntil").value =
    proposal.valid_until || "";
  document.querySelector("#employeeProposalIntroduction").value =
    proposal.introduction || "";
  document.querySelector("#employeeProposalNotes").value =
    proposal.notes || "";
  document.querySelector("#employeeProposalTerms").value =
    proposal.terms || "";
  document.querySelector("#employeeProposalDiscount").value =
    proposal.discount || 0;

  lineItems.innerHTML = "";
  if (items?.length) {
    items.forEach((item) => addLineItem(item));
  } else {
    addLineItem();
  }

  document.querySelector("#employeeProposalEditorTitle").textContent =
    "Proposal #" + String(proposal.proposal_number || "").padStart(4, "0");

  recalcProposalTotals();
  proposalEditor.hidden = false;
}

function closeProposalEditor() {
  proposalEditor.hidden = true;
  editingProposal = null;
}

document.querySelectorAll("[data-close-employee-proposal]").forEach((element) => {
  element.addEventListener("click", closeProposalEditor);
});

document.querySelector("#employeeNewProposalButton").addEventListener("click", () => {
  openNewProposal();
});

document.querySelector("#dashboardNewProposalButton").addEventListener("click", () => {
  openNewProposal();
});

function addLineItem(item = {}) {
  const row = document.createElement("div");
  row.className = "employee-line-item";

  row.innerHTML = `
    <label>Service / item
      <input class="employee-line-item-description" value="${escapeHtml(item.description || "")}" required>
    </label>
    <label>Qty
      <input class="employee-line-item-quantity" type="number" min="0.01" step="0.01" value="${item.quantity ?? 1}">
    </label>
    <label>Unit price
      <input class="employee-line-item-price" type="number" min="0" step="0.01" value="${item.unit_price ?? 0}">
    </label>
    <button class="employee-line-item-remove" type="button" aria-label="Remove line item">×</button>
    <label class="employee-line-item-details">Details
      <textarea rows="2">${escapeHtml(item.details || "")}</textarea>
    </label>
  `;

  row.querySelector(".employee-line-item-remove").addEventListener("click", () => {
    row.remove();
    if (!lineItems.children.length) addLineItem();
    recalcProposalTotals();
  });

  row.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", recalcProposalTotals);
  });

  lineItems.appendChild(row);
  recalcProposalTotals();
}

document.querySelector("#employeeAddLineItemButton").addEventListener("click", () => {
  addLineItem();
});

document.querySelector("#employeeProposalDiscount").addEventListener(
  "input",
  recalcProposalTotals
);

function lineItemData() {
  return [...lineItems.querySelectorAll(".employee-line-item")]
    .map((row, index) => ({
      description: row
        .querySelector(".employee-line-item-description")
        .value.trim(),
      details:
        row.querySelector(".employee-line-item-details textarea").value.trim() ||
        null,
      quantity: Number(
        row.querySelector(".employee-line-item-quantity").value || 1
      ),
      unit_price: Number(
        row.querySelector(".employee-line-item-price").value || 0
      ),
      sort_order: index,
    }))
    .filter((item) => item.description);
}

function recalcProposalTotals() {
  const subtotal = lineItemData().reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  const discount = Number(
    document.querySelector("#employeeProposalDiscount").value || 0
  );

  const total = Math.max(0, subtotal - discount);

  document.querySelector("#employeeProposalSubtotal").textContent =
    money(subtotal);
  document.querySelector("#employeeProposalTotal").textContent = money(total);

  return { subtotal, discount, total };
}

async function saveProposal() {
  if (!currentSession?.user) throw new Error("Your employee session has expired.");

  proposalStatus.className = "form-status";
  proposalStatus.textContent = "Saving...";

  const clientName = document
    .querySelector("#employeeClientName")
    .value.trim();

  if (!clientName) {
    throw new Error("Client name is required.");
  }

  const items = lineItemData();

  if (!items.length) {
    throw new Error("Add at least one proposal line item.");
  }

  const totals = recalcProposalTotals();
  const currentId =
    document.querySelector("#employeeProposalId").value || null;
  const current = currentId
    ? proposals.find((item) => item.id === currentId)
    : null;

  if (current && !["draft", "sent"].includes(current.status)) {
    throw new Error("This proposal is read-only.");
  }

  const payload = {
    client_id: null,
    quote_request_id: null,
    client_name: clientName,
    client_email:
      document.querySelector("#employeeClientEmail").value.trim() || null,
    client_phone:
      document.querySelector("#employeeClientPhone").value.trim() || null,
    client_company:
      document.querySelector("#employeeClientCompany").value.trim() || null,
    client_address:
      document.querySelector("#employeeClientAddress").value.trim() || null,
    client_city:
      document.querySelector("#employeeClientCity").value.trim() || null,
    client_state:
      document.querySelector("#employeeClientState").value.trim().toUpperCase() ||
      null,
    client_postal_code:
      document.querySelector("#employeeClientZip").value.trim() || null,
    title:
      document.querySelector("#employeeProposalTitle").value.trim() ||
      "Cleaning Proposal",
    valid_until:
      document.querySelector("#employeeProposalValidUntil").value || null,
    introduction:
      document.querySelector("#employeeProposalIntroduction").value.trim() ||
      null,
    notes:
      document.querySelector("#employeeProposalNotes").value.trim() || null,
    terms:
      document.querySelector("#employeeProposalTerms").value.trim() || null,
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    status: current?.status || "draft",
    created_by_user_id: currentSession.user.id,
    created_by_email: currentSession.user.email.toLowerCase(),
    archived_at: null,
    updated_at: new Date().toISOString(),
  };

  let saved;

  if (currentId) {
    const { data, error } = await supabase
      .from("proposals")
      .update(payload)
      .eq("id", currentId)
      .select("*")
      .single();

    if (error) throw error;
    saved = data;

    const { error: deleteError } = await supabase
      .from("proposal_items")
      .delete()
      .eq("proposal_id", currentId);

    if (deleteError) throw deleteError;
  } else {
    const { data, error } = await supabase
      .from("proposals")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    saved = data;
    document.querySelector("#employeeProposalId").value = saved.id;
  }

  const itemPayloads = items.map((item) => ({
    ...item,
    proposal_id: saved.id,
  }));

  const { error: itemError } = await supabase
    .from("proposal_items")
    .insert(itemPayloads);

  if (itemError) throw itemError;

  await loadProposals();
  editingProposal = proposals.find((item) => item.id === saved.id) || saved;

  proposalStatus.className = "form-status success";
  proposalStatus.textContent = "Proposal saved.";

  return editingProposal;
}

proposalForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = document.querySelector("#employeeSaveDraftButton");
  button.disabled = true;
  button.textContent = "Saving...";

  try {
    await saveProposal();
  } catch (error) {
    console.error(error);
    proposalStatus.className = "form-status error";
    proposalStatus.textContent =
      error.message || "Could not save the proposal.";
  } finally {
    button.disabled = false;
    button.textContent = "Save Draft";
  }
});

async function sendProposalEmail(proposal) {
  if (!proposal?.id) throw new Error("Save the proposal before emailing it.");
  if (!proposal.client_email) {
    throw new Error("Add a client email address before sending.");
  }

  const { data, error } = await supabase.functions.invoke(
    "send-proposal-email",
    {
      body: { proposal_id: proposal.id },
    }
  );

  if (error || !data?.ok) {
    let detail =
      data?.message ||
      error?.message ||
      "The proposal email could not be sent.";

    try {
      if (error?.context instanceof Response) {
        const payload = await error.context.clone().json();
        detail =
          payload?.provider_response?.message ||
          payload?.message ||
          payload?.error ||
          detail;
      }
    } catch {
      // Keep the original error detail.
    }

    throw new Error(detail);
  }

  return data;
}

document.querySelector("#employeeSendProposalButton").addEventListener(
  "click",
  async () => {
    const button = document.querySelector("#employeeSendProposalButton");
    button.disabled = true;
    button.textContent = "Saving...";

    try {
      const saved = await saveProposal();

      button.textContent = "Sending...";
      await sendProposalEmail(saved);

      proposalStatus.className = "form-status success";
      proposalStatus.textContent = "Proposal emailed to the client.";

      await loadProposals();

      window.setTimeout(() => {
        closeProposalEditor();
        setView("proposals");
      }, 700);
    } catch (error) {
      console.error(error);
      proposalStatus.className = "form-status error";
      proposalStatus.textContent =
        error.message || "Could not email the proposal.";
    } finally {
      button.disabled = false;
      button.textContent = "Save & Email Proposal";
    }
  }
);

const {
  data: { session: initialSession },
} = await supabase.auth.getSession();

if (initialSession) {
  await activateSession(initialSession);
} else {
  showLogin();
}
