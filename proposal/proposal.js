import { createProposalClient } from "/supabase-client.js";

const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const responseStatus = document.querySelector("#responseStatus");

let proposalClient = null;
let currentProposal = null;

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function dateLabel(value) {
  if (!value) return "Not specified";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value + "T12:00:00"));
}

function text(selector, value) {
  document.querySelector(selector).textContent = value ?? "";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadProposal() {
  if (!token) {
    responseStatus.className = "form-status error";
    responseStatus.textContent = "This proposal link is incomplete.";
    return;
  }

  proposalClient = createProposalClient(token);

  const { data: proposal, error } = await proposalClient
    .from("proposals")
    .select("id,proposal_number,client_name,client_email,title,status,issue_date,valid_until,introduction,notes,terms,subtotal,discount,total")
    .eq("public_token", token)
    .maybeSingle();

  if (error || !proposal) {
    console.error(error);
    responseStatus.className = "form-status error";
    responseStatus.textContent = "This proposal could not be found or is not available for review.";
    return;
  }

  currentProposal = proposal;

  const { data: items, error: itemsError } = await proposalClient
    .from("proposal_items")
    .select("description,details,quantity,unit_price,sort_order,created_at")
    .eq("proposal_id", proposal.id)
    .order("sort_order")
    .order("created_at");

  if (itemsError) {
    console.error(itemsError);
    responseStatus.className = "form-status error";
    responseStatus.textContent = "The proposal loaded, but its line items could not be displayed.";
    return;
  }

  document.title =
    "Proposal #" + String(proposal.proposal_number || "").padStart(4, "0") + " | CleanFreaks";

  text("#proposalNumber", "Proposal #" + String(proposal.proposal_number || "").padStart(4, "0"));
  text("#proposalStatusBadge", proposal.status);
  document.querySelector("#proposalStatusBadge").className = "proposal-status " + proposal.status;
  text("#proposalTitle", proposal.title || "Cleaning Proposal");
  text("#proposalIntro", proposal.introduction || "");
  text("#proposalClient", proposal.client_name || "");
  text("#proposalClientEmail", proposal.client_email || "");
  text("#proposalIssued", dateLabel(proposal.issue_date));
  text("#proposalValid", dateLabel(proposal.valid_until));

  const itemsContainer = document.querySelector("#proposalItems");
  itemsContainer.innerHTML = (items || []).map((item) => {
    const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
    return `
      <div class="proposal-item">
        <div class="proposal-item-main">
          <strong>${escapeHtml(item.description)}</strong>
          ${item.details ? "<span>" + escapeHtml(item.details) + "</span>" : ""}
        </div>
        <span>${Number(item.quantity)}</span>
        <span>${money(item.unit_price)}</span>
        <span>${money(lineTotal)}</span>
      </div>
    `;
  }).join("");

  text("#proposalSubtotal", money(proposal.subtotal));
  text("#proposalDiscount", "-" + money(proposal.discount));
  text("#proposalTotal", money(proposal.total));

  document.querySelector("#proposalDiscountRow").hidden =
    Number(proposal.discount || 0) <= 0;

  const notesSection = document.querySelector("#proposalNotesSection");
  notesSection.hidden = !proposal.notes;
  text("#proposalNotes", proposal.notes || "");

  const termsSection = document.querySelector("#proposalTermsSection");
  termsSection.hidden = !proposal.terms;
  text("#proposalTerms", proposal.terms || "");

  const response = document.querySelector("#proposalResponse");
  if (proposal.status !== "sent") {
    response.hidden = true;

    if (proposal.status === "accepted") {
      responseStatus.className = "form-status success";
      responseStatus.textContent = "This proposal has been accepted.";
    } else if (proposal.status === "declined") {
      responseStatus.textContent = "This proposal has been declined.";
    }
  }
}

async function respond(response) {
  if (!proposalClient || !currentProposal) return;

  const confirmed = window.confirm(
    response === "accepted"
      ? "Accept this CleanFreaks proposal?"
      : "Decline this CleanFreaks proposal?"
  );

  if (!confirmed) return;

  responseStatus.className = "form-status";
  responseStatus.textContent = "Saving response...";

  const now = new Date().toISOString();
  const payload = {
    status: response,
    updated_at: now,
  };

  if (response === "accepted") payload.accepted_at = now;
  if (response === "declined") payload.declined_at = now;

  const { data, error } = await proposalClient
    .from("proposals")
    .update(payload)
    .eq("id", currentProposal.id)
    .select("status")
    .single();

  if (error || !data) {
    console.error(error);
    responseStatus.className = "form-status error";
    responseStatus.textContent =
      "We could not save your response. Please contact CleanFreaks directly.";
    return;
  }

  window.location.reload();
}

document.querySelector("#acceptButton").addEventListener("click", () => respond("accepted"));
document.querySelector("#declineButton").addEventListener("click", () => respond("declined"));
document.querySelector("#printButton").addEventListener("click", () => window.print());

await loadProposal();
