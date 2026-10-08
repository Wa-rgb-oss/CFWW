import { supabase, createProposalClient, trackSitePageView } from "/supabase-client.js";

const params = new URLSearchParams(window.location.search);
const token = params.get("token");

const responseStatus = document.querySelector("#responseStatus");
const proposalResponse = document.querySelector("#proposalResponse");
const proposalResult = document.querySelector("#proposalResult");
const acceptButton = document.querySelector("#acceptButton");
const declineButton = document.querySelector("#declineButton");

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

function renderResponseState(status) {
  const badge = document.querySelector("#proposalStatusBadge");

  badge.textContent = status;
  badge.className = "proposal-status " + status;

  if (status === "accepted") {
    proposalResponse.hidden = true;
    proposalResult.hidden = false;
    proposalResult.className = "proposal-result accepted";
    text("#proposalResultMark", "✓");
    text("#proposalResultKicker", "Response recorded");
    text("#proposalResultTitle", "Proposal Accepted");
    text(
      "#proposalResultCopy",
      "Thank you. CleanFreaks has received your acceptance. Scheduling will be finalized separately."
    );
    responseStatus.textContent = "";
    return;
  }

  if (status === "declined") {
    proposalResponse.hidden = true;
    proposalResult.hidden = false;
    proposalResult.className = "proposal-result declined";
    text("#proposalResultMark", "×");
    text("#proposalResultKicker", "Response recorded");
    text("#proposalResultTitle", "Proposal Declined");
    text(
      "#proposalResultCopy",
      "Your response has been recorded. You can contact CleanFreaks directly if you would like to revise the scope or request a new proposal."
    );
    responseStatus.textContent = "";
    return;
  }

  proposalResult.hidden = true;
  proposalResponse.hidden = status !== "sent";
}

async function loadProposal() {
  if (!token) {
    responseStatus.textContent = "This proposal link is incomplete.";
    return;
  }

  proposalClient = createProposalClient(token);

  const { data: proposal, error } = await proposalClient
    .from("proposals")
    .select(
      "id,proposal_number,client_name,client_email,title,status,issue_date,valid_until,introduction,notes,terms,subtotal,discount,total"
    )
    .eq("public_token", token)
    .maybeSingle();

  if (error || !proposal) {
    console.error(error);
    responseStatus.textContent =
      "This proposal could not be found or is not available for review.";
    proposalResponse.hidden = true;
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
    responseStatus.textContent =
      "The proposal loaded, but its line items could not be displayed.";
    return;
  }

  document.title =
    "Proposal #" +
    String(proposal.proposal_number || "").padStart(4, "0") +
    " | CleanFreaks";

  text(
    "#proposalNumber",
    "Proposal #" +
      String(proposal.proposal_number || "").padStart(4, "0")
  );
  text("#proposalTitle", proposal.title || "Cleaning Proposal");
  text("#proposalIntro", proposal.introduction || "");
  text("#proposalClient", proposal.client_name || "");
  text("#proposalClientEmail", proposal.client_email || "");
  text("#proposalIssued", dateLabel(proposal.issue_date));
  text("#proposalValid", dateLabel(proposal.valid_until));

  document.querySelector("#proposalIntroSection").hidden =
    !proposal.introduction;

  const itemsContainer = document.querySelector("#proposalItems");

  itemsContainer.innerHTML = (items || [])
    .map((item) => {
      const lineTotal =
        Number(item.quantity || 0) * Number(item.unit_price || 0);

      return `
        <div class="proposal-item">
          <div class="proposal-item-main">
            <strong>${escapeHtml(item.description)}</strong>
            ${
              item.details
                ? "<span>" + escapeHtml(item.details) + "</span>"
                : ""
            }
          </div>
          <span>${Number(item.quantity)}</span>
          <span>${money(item.unit_price)}</span>
          <span>${money(lineTotal)}</span>
        </div>
      `;
    })
    .join("");

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

  renderResponseState(proposal.status);
}

async function respond(response) {
  if (!token || !currentProposal) return;

  const confirmed = window.confirm(
    response === "accepted"
      ? "Accept this CleanFreaks proposal?"
      : "Decline this CleanFreaks proposal?"
  );

  if (!confirmed) return;

  acceptButton.disabled = true;
  declineButton.disabled = true;
  responseStatus.className = "proposal-response-status";
  responseStatus.textContent = "Saving response...";

  try {
    const { data, error } = await supabase.functions.invoke(
      "respond-to-proposal",
      {
        body: {
          token,
          response,
        },
      }
    );

    if (error) {
      let message = error.message || "Could not save your response.";

      try {
        if (error.context instanceof Response) {
          const payload = await error.context.clone().json();

          if (payload?.error === "proposal_not_open") {
            message =
              "This proposal is no longer open for a new response.";
          } else if (payload?.error === "proposal_not_found") {
            message = "This proposal could not be found.";
          } else if (payload?.error) {
            message = payload.error;
          }
        }
      } catch {
        // Keep the original error message.
      }

      throw new Error(message);
    }

    if (!data?.ok || !["accepted", "declined"].includes(data.status)) {
      throw new Error("The response was not saved.");
    }

    currentProposal.status = data.status;
    renderResponseState(data.status);

    responseStatus.className = "proposal-response-status success";
    responseStatus.textContent =
      data.status === "accepted"
        ? "Acceptance recorded."
        : "Decline response recorded.";

    window.setTimeout(() => {
      responseStatus.textContent = "";
    }, 2500);
  } catch (error) {
    console.error(error);
    responseStatus.className = "proposal-response-status";
    responseStatus.textContent =
      error.message ||
      "We could not save your response. Please contact CleanFreaks directly.";
  } finally {
    acceptButton.disabled = false;
    declineButton.disabled = false;
  }
}

acceptButton.addEventListener("click", () => respond("accepted"));
declineButton.addEventListener("click", () => respond("declined"));

document
  .querySelector("#printButton")
  .addEventListener("click", () => window.print());

await loadProposal();

trackSitePageView("/proposal/").catch((error) => {
  console.warn("Site analytics failed.", error);
});
