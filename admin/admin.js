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

const jobEditor = document.querySelector("#jobEditor");
const jobForm = document.querySelector("#jobForm");
const jobStatusMessage = document.querySelector("#jobStatusMessage");
const existingClientSelect = document.querySelector("#proposalExistingClient");

const careerEditor = document.querySelector("#careerEditor");
const careerForm = document.querySelector("#careerForm");
const careerStatus = document.querySelector("#careerStatus");

let ownerEmail = "";
let requests = [];
let proposals = [];
let clients = [];
let jobs = [];
let careers = [];
let proposalValueAdjustments = [];
let analyticsSummary = { page_views: 0, sessions: 0, page_views_30d: 0, sessions_30d: 0, page_views_month: 0, sessions_month: 0 };
let analyticsMonthly = [];
let selectedProposalValueYear = new Date().getFullYear();
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

function dateTimeLabel(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function responseMethodLabel(value) {
  const labels = {
    email: "email",
    proposal: "proposal",
    phone: "phone",
    other: "manual",
  };

  return labels[value] || "response";
}

async function markQuoteRequestResponded(requestId, via, statusValue = null) {
  if (!requestId) return;

  const request = requests.find((item) => item.id === requestId);
  const payload = {};

  if (statusValue) payload.status = statusValue;

  if (!request?.responded_at) {
    payload.responded_at = new Date().toISOString();
    payload.responded_via = via;
  }

  if (!Object.keys(payload).length) return;

  const { error } = await supabase
    .from("quote_requests")
    .update(payload)
    .eq("id", requestId);

  if (error) throw error;

  if (request) Object.assign(request, payload);
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
  if (!ownerEmail) 
await getOwnerEmail();
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
    jobs: "Jobs",
    clients: "Clients",
    careers: "Careers",
  };
  document.querySelector("#viewTitle").textContent = titles[view] || "CleanFreaks";
}

async function refreshAll() {
  const [requestResult, proposalResult, clientResult, jobResult, careerResult, adjustmentResult, analyticsResult, analyticsMonthlyResult] = await Promise.all([
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
    supabase
      .from("jobs")
      .select("*")
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("career_openings")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("proposal_value_adjustments")
      .select("*")
      .order("year", { ascending: false }),
    supabase
      .from("site_analytics_summary")
      .select("*")
      .single(),
    supabase
      .from("site_analytics_monthly")
      .select("*")
      .order("month_start", { ascending: false }),
  ]);

  requests = requestResult.data || [];
  proposals = proposalResult.data || [];
  clients = clientResult.data || [];
  jobs = jobResult.data || [];
  careers = careerResult.data || [];
  proposalValueAdjustments = adjustmentResult.data || [];
  analyticsSummary = analyticsResult.data || {
    page_views: 0,
    sessions: 0,
    page_views_30d: 0,
    sessions_30d: 0,
    page_views_month: 0,
    sessions_month: 0,
  };
  analyticsMonthly = analyticsMonthlyResult.data || [];

  renderStats();
  renderTrafficSummary();
  renderTrafficHistory();
  renderProposalValueDashboard();
  renderRequests();
  renderProposals();
  renderJobs();
  renderClients();
  renderCareers();
  populateExistingClientSelect();
}

function renderStats() {
  document.querySelector("#statRequests").textContent =
    requests.filter((item) => item.status === "new").length;
  document.querySelector("#statProposals").textContent =
    proposals.filter(
      (item) =>
        !item.archived_at &&
        ["draft", "sent"].includes(item.status)
    ).length;
  document.querySelector("#statJobs").textContent = jobs.length;
  document.querySelector("#statClients").textContent = clients.length;
}

function renderTrafficSummary() {
  const number = new Intl.NumberFormat("en-US");

  document.querySelector("#siteSessions").textContent =
    number.format(Number(analyticsSummary.sessions || 0));

  document.querySelector("#sitePageViews").textContent =
    number.format(Number(analyticsSummary.page_views || 0));

  document.querySelector("#siteSessions30d").textContent =
    number.format(Number(analyticsSummary.sessions_30d || 0)) +
    " in the last 30 days";

  document.querySelector("#sitePageViews30d").textContent =
    number.format(Number(analyticsSummary.page_views_30d || 0)) +
    " in the last 30 days";
}
function renderTrafficHistory() {
  const container = document.querySelector("#trafficHistoryRows");
  if (!container) return;

  const number = new Intl.NumberFormat("en-US");
  const currentMonthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  const currentSessions = Number(analyticsSummary.sessions_month || 0);
  const currentViews = Number(analyticsSummary.page_views_month || 0);
  const currentRatio = currentSessions
    ? (currentViews / currentSessions).toFixed(1)
    : "0.0";

  const currentRow = `
    <div class="traffic-history-row current">
      <span>${currentMonthLabel} <em>Live</em></span>
      <span>${number.format(currentSessions)}</span>
      <span>${number.format(currentViews)}</span>
      <span>${currentRatio}</span>
    </div>
  `;

  const archivedRows = analyticsMonthly.map((row) => {
    const date = new Date(row.month_start + "T12:00:00");
    const label = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(date);

    const sessions = Number(row.sessions || 0);
    const views = Number(row.page_views || 0);
    const ratio = sessions ? (views / sessions).toFixed(1) : "0.0";

    return `
      <div class="traffic-history-row">
        <span>${escapeHtml(label)}</span>
        <span>${number.format(sessions)}</span>
        <span>${number.format(views)}</span>
        <span>${ratio}</span>
      </div>
    `;
  }).join("");

  container.innerHTML =
    currentRow +
    (archivedRows || '<div class="traffic-history-empty">Completed months will appear here automatically.</div>');
}

function proposalValueYear(proposal) {
  const value =
    proposal.status === "accepted"
      ? proposal.accepted_at || proposal.updated_at || proposal.created_at
      : proposal.declined_at || proposal.updated_at || proposal.created_at;

  return new Date(value).getFullYear();
}

function getProposalValueAdjustment(year, status) {
  return Number(
    proposalValueAdjustments.find(
      (item) => Number(item.year) === Number(year) && item.status === status
    )?.amount || 0
  );
}

function availableProposalValueYears() {
  const years = new Set([new Date().getFullYear()]);

  proposals.forEach((proposal) => {
    if (["accepted", "declined"].includes(proposal.status)) {
      years.add(proposalValueYear(proposal));
    }
  });

  proposalValueAdjustments.forEach((item) => years.add(Number(item.year)));

  return [...years]
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
}

function renderProposalValueDashboard() {
  const yearSelect = document.querySelector("#proposalValueYear");
  if (!yearSelect) return;

  const years = availableProposalValueYears();

  if (!years.includes(Number(selectedProposalValueYear))) {
    selectedProposalValueYear = years[0] || new Date().getFullYear();
  }

  yearSelect.innerHTML = years
    .map(
      (year) =>
        '<option value="' +
        year +
        '"' +
        (Number(year) === Number(selectedProposalValueYear) ? " selected" : "") +
        ">" +
        year +
        "</option>"
    )
    .join("");

  const acceptedBase = proposals
    .filter(
      (proposal) =>
        proposal.status === "accepted" &&
        proposalValueYear(proposal) === Number(selectedProposalValueYear)
    )
    .reduce((sum, proposal) => sum + Number(proposal.total || 0), 0);

  const declinedBase = proposals
    .filter(
      (proposal) =>
        proposal.status === "declined" &&
        proposalValueYear(proposal) === Number(selectedProposalValueYear)
    )
    .reduce((sum, proposal) => sum + Number(proposal.total || 0), 0);

  const acceptedAdjustment = getProposalValueAdjustment(
    selectedProposalValueYear,
    "accepted"
  );
  const declinedAdjustment = getProposalValueAdjustment(
    selectedProposalValueYear,
    "declined"
  );

  document.querySelector("#acceptedProposalValue").textContent =
    money(acceptedBase + acceptedAdjustment);

  document.querySelector("#declinedProposalValue").textContent =
    money(declinedBase + declinedAdjustment);

  document.querySelector("#acceptedProposalBreakdown").textContent =
    money(acceptedBase) +
    " from proposals" +
    (acceptedAdjustment
      ? " · " + money(acceptedAdjustment) + " manual adjustment"
      : "");

  document.querySelector("#declinedProposalBreakdown").textContent =
    money(declinedBase) +
    " from proposals" +
    (declinedAdjustment
      ? " · " + money(declinedAdjustment) + " manual adjustment"
      : "");

  document.querySelector("#acceptedValueAdjustment").value =
    String(acceptedAdjustment);

  document.querySelector("#declinedValueAdjustment").value =
    String(declinedAdjustment);

  const note =
    proposalValueAdjustments.find(
      (item) =>
        Number(item.year) === Number(selectedProposalValueYear) &&
        item.note
    )?.note || "";

  document.querySelector("#proposalValueAdjustmentNote").value = note;
}

document.querySelector("#proposalValueYear")?.addEventListener("change", (event) => {
  selectedProposalValueYear = Number(event.target.value);
  renderProposalValueDashboard();
});

document.querySelector("#editProposalValuesButton")?.addEventListener("click", () => {
  renderProposalValueDashboard();
  document.querySelector("#proposalValueEditor").hidden = false;
});

document.querySelector("#cancelProposalValuesButton")?.addEventListener("click", () => {
  document.querySelector("#proposalValueEditor").hidden = true;
  document.querySelector("#proposalValueStatus").textContent = "";
});

document.querySelector("#proposalValueEditor")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const status = document.querySelector("#proposalValueStatus");
  status.className = "form-status";
  status.textContent = "Saving...";

  const note =
    document.querySelector("#proposalValueAdjustmentNote").value.trim() || null;

  const rows = [
    {
      year: Number(selectedProposalValueYear),
      status: "accepted",
      amount: Number(document.querySelector("#acceptedValueAdjustment").value || 0),
      note,
      updated_at: new Date().toISOString(),
    },
    {
      year: Number(selectedProposalValueYear),
      status: "declined",
      amount: Number(document.querySelector("#declinedValueAdjustment").value || 0),
      note,
      updated_at: new Date().toISOString(),
    },
  ];

  const { error } = await supabase
    .from("proposal_value_adjustments")
    .upsert(rows, { onConflict: "year,status" });

  if (error) {
    console.error(error);
    status.className = "form-status error";
    status.textContent = error.message || "Could not save adjustments.";
    return;
  }

  status.className = "form-status success";
  status.textContent = "Adjustments saved.";
  await refreshAll();
});

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
        <span>Received ${dateLabel(request.created_at)}</span>
        <span class="${request.responded_at ? "response-tracked" : "response-pending"}">
          ${request.responded_at
            ? "Responded " + escapeHtml(dateTimeLabel(request.responded_at)) + " · " + escapeHtml(responseMethodLabel(request.responded_via))
            : "Awaiting response"}
        </span>
        <span class="status-badge ${escapeHtml(request.status)}">${escapeHtml(request.status)}</span>
      </div>
      <div class="admin-row-actions">
        <button type="button" data-build-request="${request.id}">Build Proposal</button>
        <button type="button" data-contact-request="${request.id}">Contact</button>
        ${!request.responded_at ? '<button type="button" data-mark-responded="' + request.id + '">Mark Responded</button>' : ""}
        <button class="danger-action" type="button" data-delete-request="${request.id}">Delete</button>
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
    button.addEventListener("click", async () => {
      const request = requests.find((item) => item.id === button.dataset.contactRequest);
      if (!request) return;

      if (!request.responded_at) {
        const now = new Date().toISOString();

        const { error } = await supabase
          .from("quote_requests")
          .update({
            status: "contacted",
            responded_at: now,
            responded_via: "email",
          })
          .eq("id", request.id);

        if (error) {
          console.error(error);
          alert("Could not record the response time.");
          return;
        }

        request.status = "contacted";
        request.responded_at = now;
        request.responded_via = "email";
      }

      window.location.href =
        "mailto:" + request.email +
        "?subject=" + encodeURIComponent("CleanFreaks quote request") +
        "&body=" + encodeURIComponent(
          "Hi " + request.name + ",\n\nThanks for reaching out to CleanFreaks.\n\n"
        );
    });
  });

  document.querySelectorAll("[data-mark-responded]").forEach((button) => {
    button.addEventListener("click", async () => {
      const request = requests.find((item) => item.id === button.dataset.markResponded);
      if (!request) return;

      const { error } = await supabase
        .from("quote_requests")
        .update({
          status: request.status === "new" ? "contacted" : request.status,
          responded_at: new Date().toISOString(),
          responded_via: "other",
        })
        .eq("id", request.id);

      if (error) {
        console.error(error);
        alert("Could not mark this request as responded.");
        return;
      }

      await refreshAll();
    });
  });

  document.querySelectorAll("[data-delete-request]").forEach((button) => {
    button.addEventListener("click", async () => {
      const request = requests.find((item) => item.id === button.dataset.deleteRequest);
      if (!request) return;

      const confirmed = window.confirm(
        "Delete the quote request from " +
          request.name +
          "?\n\nThe client record and any proposals or Jobs already created from it will remain.\n\nThis cannot be undone."
      );

      if (!confirmed) return;

      const { error } = await supabase
        .from("quote_requests")
        .delete()
        .eq("id", request.id);

      if (error) {
        console.error(error);
        alert("Could not delete the quote request.");
        return;
      }

      await refreshAll();
    });
  });
}

function renderProposals() {
  const list = document.querySelector("#proposalsList");
  const archiveList = document.querySelector("#archivedProposalsList");
  const archiveCount = document.querySelector("#archivedProposalCount");

  const activeProposals = proposals.filter((proposal) => !proposal.archived_at);
  const archivedProposals = proposals.filter((proposal) => proposal.archived_at);

  list.innerHTML = activeProposals.length
    ? activeProposals.map((proposal) => `
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
          <button type="button" data-archive-proposal="${proposal.id}">Archive</button>
        </div>
      </article>
    `).join("")
    : '<div class="empty-state">No active proposals. Create one from a quote request or use New Proposal.</div>';

  archiveCount.textContent = String(archivedProposals.length);

  archiveList.innerHTML = archivedProposals.length
    ? archivedProposals.map((proposal) => `
      <article class="admin-row archived-row">
        <div class="admin-row-main">
          <strong>#${String(proposal.proposal_number || "").padStart(4, "0")} · ${escapeHtml(proposal.client_name)}</strong>
          <span>${escapeHtml(proposal.title)}</span>
        </div>
        <div class="admin-row-meta">
          <span>${money(proposal.total)}</span>
          <span>Archived ${dateLabel(proposal.archived_at)}</span>
          <span class="status-badge ${escapeHtml(proposal.status)}">${escapeHtml(proposal.status)}</span>
        </div>
        <div class="admin-row-actions">
          <button type="button" data-restore-proposal="${proposal.id}">Restore</button>
          <button type="button" data-copy-proposal="${proposal.id}">Copy Link</button>
          <button class="danger-action" type="button" data-delete-proposal="${proposal.id}">Delete</button>
        </div>
      </article>
    `).join("")
    : '<div class="empty-state">No archived proposals.</div>';

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

  document.querySelectorAll("[data-archive-proposal]").forEach((button) => {
    button.addEventListener("click", async () => {
      const proposal = proposals.find((item) => item.id === button.dataset.archiveProposal);
      if (!proposal) return;

      const confirmed = window.confirm(
        "Archive proposal #" +
          String(proposal.proposal_number || "").padStart(4, "0") +
          " for " +
          proposal.client_name +
          "?\n\nIt will move out of the active proposal list but keep its status, history, client link, and any linked Job."
      );

      if (!confirmed) return;

      const { error } = await supabase
        .from("proposals")
        .update({
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposal.id);

      if (error) {
        console.error(error);
        alert("Could not archive the proposal.");
        return;
      }

      await refreshAll();
    });
  });

  document.querySelectorAll("[data-restore-proposal]").forEach((button) => {
    button.addEventListener("click", async () => {
      const proposal = proposals.find((item) => item.id === button.dataset.restoreProposal);
      if (!proposal) return;

      const { error } = await supabase
        .from("proposals")
        .update({
          archived_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposal.id);

      if (error) {
        console.error(error);
        alert("Could not restore the proposal.");
        return;
      }

      await refreshAll();
    });
  });

  document.querySelectorAll("[data-delete-proposal]").forEach((button) => {
    button.addEventListener("click", async () => {
      const proposal = proposals.find((item) => item.id === button.dataset.deleteProposal);
      if (!proposal || !proposal.archived_at) return;

      const linkedJob = jobs.find((job) => job.proposal_id === proposal.id);

      const confirmed = window.confirm(
        "Permanently delete archived proposal #" +
          String(proposal.proposal_number || "").padStart(4, "0") +
          " for " +
          proposal.client_name +
          "?\n\n" +
          (linkedJob
            ? "This proposal has a linked Job. Deleting it will also permanently delete that Job and its booking link."
            : "Its proposal line items will also be deleted.") +
          "\n\nThis cannot be undone."
      );

      if (!confirmed) return;

      const { error } = await supabase
        .from("proposals")
        .delete()
        .eq("id", proposal.id);

      if (error) {
        console.error(error);
        alert("Could not delete the proposal.");
        return;
      }

      await refreshAll();
    });
  });

  document.querySelectorAll("[data-email-proposal]").forEach((button) => {
    button.addEventListener("click", async () => {
      const proposal = proposals.find((item) => item.id === button.dataset.emailProposal);
      if (!proposal || proposal.archived_at) return;

      button.disabled = true;
      const previousLabel = button.textContent;
      button.textContent = "Sending...";

      try {
        await sendProposalEmail(proposal);
        await markQuoteRequestResponded(
          proposal.quote_request_id,
          "proposal",
          "quoted"
        );
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


function jobDateLabel(job) {
  if (!job.scheduled_date) return "Not scheduled";

  const date = new Date(job.scheduled_date + "T12:00:00");
  const day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  if (!job.start_time) return day;

  const [hour, minute] = String(job.start_time).slice(0, 5).split(":").map(Number);
  const timeDate = new Date();
  timeDate.setHours(hour, minute, 0, 0);

  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(timeDate);

  return day + " · " + time;
}

function renderJobs() {
  const list = document.querySelector("#jobsList");
  if (!list) return;

  list.innerHTML = jobs.length
    ? jobs.map((job) => {
        const location = [job.city, job.state].filter(Boolean).join(", ");
        return `
          <article class="admin-row">
            <div class="admin-row-main">
              <strong>${escapeHtml(job.client_name)}</strong>
              <span>${escapeHtml(job.title || "Cleaning Job")}${location ? " · " + escapeHtml(location) : ""}</span>
            </div>
            <div class="admin-row-meta">
              <span>${escapeHtml(jobDateLabel(job))}</span>
              <span>${escapeHtml(job.client_email || "")}</span>
              <span class="status-badge ${escapeHtml(job.status)}">${escapeHtml(job.status.replaceAll("_", " "))}</span>
            </div>
            <div class="admin-row-actions">
              <button type="button" data-schedule-job="${job.id}">Schedule</button>
              ${job.status === "confirmed" ? '<button type="button" data-copy-booking="' + job.id + '">Copy Booking Link</button>' : ""}
            </div>
          </article>
        `;
      }).join("")
    : '<div class="empty-state">Accepted proposals will appear here automatically for scheduling.</div>';

  document.querySelectorAll("[data-schedule-job]").forEach((button) => {
    button.addEventListener("click", () => openJobEditor(button.dataset.scheduleJob));
  });

  document.querySelectorAll("[data-copy-booking]").forEach((button) => {
    button.addEventListener("click", async () => {
      const job = jobs.find((item) => item.id === button.dataset.copyBooking);
      if (!job) return;
      const link = window.location.origin + "/booking/?token=" + job.booking_token;
      await navigator.clipboard.writeText(link);
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = "Copy Booking Link";
      }, 1200);
    });
  });
}

function populateExistingClientSelect() {
  if (!existingClientSelect) return;

  const selected = document.querySelector("#proposalClientId").value || "";

  existingClientSelect.innerHTML =
    '<option value="">New client / enter manually</option>' +
    clients.map((client) => {
      const label = client.company
        ? client.name + " · " + client.company
        : client.name;
      return '<option value="' + client.id + '">' + escapeHtml(label) + '</option>';
    }).join("");

  existingClientSelect.value = selected;
}

function fillClientForm(client) {
  if (!client) return;

  document.querySelector("#proposalClientId").value = client.id || "";
  document.querySelector("#proposalClientName").value = client.name || "";
  document.querySelector("#proposalClientEmail").value = client.email || "";
  document.querySelector("#proposalClientPhone").value = client.phone || "";
  document.querySelector("#proposalClientCompany").value = client.company || "";
  document.querySelector("#proposalClientAddress").value = client.address || "";
  document.querySelector("#proposalClientCity").value = client.city || "";
  document.querySelector("#proposalClientState").value = client.state || "GA";
  document.querySelector("#proposalClientZip").value = client.postal_code || "";

  if (existingClientSelect) existingClientSelect.value = client.id || "";
}

existingClientSelect?.addEventListener("change", () => {
  const client = clients.find((item) => item.id === existingClientSelect.value);

  if (!client) {
    document.querySelector("#proposalClientId").value = "";
    return;
  }

  fillClientForm(client);
});

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
          <button class="danger-action" type="button" data-delete-client="${client.id}">Delete</button>
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

  document.querySelectorAll("[data-delete-client]").forEach((button) => {
    button.addEventListener("click", async () => {
      const client = clients.find((item) => item.id === button.dataset.deleteClient);
      if (!client) return;

      const confirmed = window.confirm(
        "Delete the client record for " +
          client.name +
          "?\n\nHistorical quote requests, proposals, and Jobs will remain, but they will no longer be linked to this client record.\n\nThis cannot be undone."
      );

      if (!confirmed) return;

      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", client.id);

      if (error) {
        console.error(error);
        alert("Could not delete the client.");
        return;
      }

      await refreshAll();
    });
  });
}


function renderCareers() {
  const list = document.querySelector("#careersList");
  if (!list) return;

  list.innerHTML = careers.length
    ? careers.map((career) => `
      <article class="admin-row">
        <div class="admin-row-main">
          <strong>${escapeHtml(career.title)}</strong>
          <span>${escapeHtml(career.employment_type)} · ${escapeHtml(career.location)}</span>
        </div>
        <div class="admin-row-meta">
          <span>${escapeHtml(career.pay_range || "Pay not listed")}</span>
          <span>Order ${Number(career.sort_order || 0)}</span>
          <span class="status-badge ${career.is_active ? "accepted" : "void"}">
            ${career.is_active ? "Published" : "Hidden"}
          </span>
        </div>
        <div class="admin-row-actions">
          <button type="button" data-edit-career="${career.id}">Edit</button>
          <button type="button" data-toggle-career="${career.id}">
            ${career.is_active ? "Unpublish" : "Publish"}
          </button>
        </div>
      </article>
    `).join("")
    : '<div class="empty-state">No career openings yet. Use New Opening to add one.</div>';

  document.querySelectorAll("[data-edit-career]").forEach((button) => {
    button.addEventListener("click", () => openCareerEditor(button.dataset.editCareer));
  });

  document.querySelectorAll("[data-toggle-career]").forEach((button) => {
    button.addEventListener("click", async () => {
      const career = careers.find((item) => item.id === button.dataset.toggleCareer);
      if (!career) return;

      const { error } = await supabase
        .from("career_openings")
        .update({
          is_active: !career.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", career.id);

      if (error) {
        console.error(error);
        alert("Could not update the career opening.");
        return;
      }

      await refreshAll();
    });
  });
}

function resetCareerEditor() {
  careerForm.reset();
  document.querySelector("#careerId").value = "";
  document.querySelector("#careerEmploymentType").value = "Part-time";
  document.querySelector("#careerLocation").value = "Marietta, GA";
  document.querySelector("#careerApplicationEmail").value = "info@cleanfreaksmarietta.com";
  document.querySelector("#careerSortOrder").value = "0";
  document.querySelector("#careerIsActive").checked = true;
  document.querySelector("#careerEditorTitle").textContent = "New Opening";
  document.querySelector("#deleteCareerButton").hidden = true;
  careerStatus.className = "form-status";
  careerStatus.textContent = "";
}

function openCareerEditor(id = null) {
  resetCareerEditor();

  if (id) {
    const career = careers.find((item) => item.id === id);
    if (!career) return;

    document.querySelector("#careerId").value = career.id;
    document.querySelector("#careerTitle").value = career.title || "";
    document.querySelector("#careerEmploymentType").value = career.employment_type || "Part-time";
    document.querySelector("#careerLocation").value = career.location || "Marietta, GA";
    document.querySelector("#careerPayRange").value = career.pay_range || "";
    document.querySelector("#careerSummary").value = career.summary || "";
    document.querySelector("#careerDescription").value = career.description || "";
    document.querySelector("#careerRequirements").value = career.requirements || "";
    document.querySelector("#careerApplicationEmail").value =
      career.application_email || "info@cleanfreaksmarietta.com";
    document.querySelector("#careerSortOrder").value = String(career.sort_order || 0);
    document.querySelector("#careerIsActive").checked = Boolean(career.is_active);
    document.querySelector("#careerEditorTitle").textContent = "Edit Opening";
    document.querySelector("#deleteCareerButton").hidden = false;
  }

  careerEditor.hidden = false;
}

function closeCareerEditor() {
  careerEditor.hidden = true;
  resetCareerEditor();
}

document.querySelector("#newCareerButton")?.addEventListener("click", () => {
  openCareerEditor();
});

document.querySelectorAll("[data-close-career-editor]").forEach((element) => {
  element.addEventListener("click", closeCareerEditor);
});

careerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = careerForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Saving...";
  careerStatus.className = "form-status";
  careerStatus.textContent = "";

  const id = document.querySelector("#careerId").value || null;
  const payload = {
    title: document.querySelector("#careerTitle").value.trim(),
    employment_type: document.querySelector("#careerEmploymentType").value,
    location: document.querySelector("#careerLocation").value.trim() || "Marietta, GA",
    pay_range: document.querySelector("#careerPayRange").value.trim() || null,
    summary: document.querySelector("#careerSummary").value.trim() || null,
    description: document.querySelector("#careerDescription").value.trim() || null,
    requirements: document.querySelector("#careerRequirements").value.trim() || null,
    application_email:
      document.querySelector("#careerApplicationEmail").value.trim() ||
      "info@cleanfreaksmarietta.com",
    is_active: document.querySelector("#careerIsActive").checked,
    sort_order: Number(document.querySelector("#careerSortOrder").value || 0),
    updated_at: new Date().toISOString(),
  };

  try {
    if (!payload.title) throw new Error("Add a job title.");

    if (id) {
      const { error } = await supabase
        .from("career_openings")
        .update(payload)
        .eq("id", id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("career_openings")
        .insert(payload);

      if (error) throw error;
    }

    careerStatus.className = "form-status success";
    careerStatus.textContent = "Opening saved.";
    await refreshAll();

    window.setTimeout(() => closeCareerEditor(), 500);
  } catch (error) {
    console.error(error);
    careerStatus.className = "form-status error";
    careerStatus.textContent = error.message || "Could not save the opening.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Save Opening";
  }
});

document.querySelector("#deleteCareerButton")?.addEventListener("click", async () => {
  const id = document.querySelector("#careerId").value;
  if (!id) return;

  const career = careers.find((item) => item.id === id);
  if (!career) return;

  const confirmed = window.confirm(
    "Delete the career opening \"" + career.title + "\"?\n\nThis cannot be undone."
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from("career_openings")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    careerStatus.className = "form-status error";
    careerStatus.textContent = "Could not delete the opening.";
    return;
  }

  closeCareerEditor();
  await refreshAll();
});

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
    let detail = error?.message || "";

    try {
      if (error?.context instanceof Response) {
        const payload = await error.context.clone().json();

        if (payload?.error === "email_provider_not_configured") {
          throw new Error("Proposal email is ready, but the outbound email provider still needs to be connected.");
        }

        if (payload?.provider_response?.message) {
          detail = payload.provider_response.message;
        } else if (payload?.message) {
          detail = payload.message;
        } else if (payload?.error) {
          detail = payload.error;
        }
      }
    } catch (parseError) {
      if (parseError instanceof Error &&
          parseError.message !== "Proposal email is ready, but the outbound email provider still needs to be connected.") {
        console.warn("Could not parse Edge Function error response.", parseError);
      } else if (parseError instanceof Error) {
        throw parseError;
      }
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
  if (existingClientSelect) existingClientSelect.value = "";
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

  const linkedClient = clients.find((item) => item.id === request.client_id);

  if (linkedClient) {
    fillClientForm(linkedClient);
  } else {
    document.querySelector("#proposalClientName").value = request.name || "";
    document.querySelector("#proposalClientEmail").value = request.email || "";
    document.querySelector("#proposalClientPhone").value = request.phone || "";
    document.querySelector("#proposalClientAddress").value = request.address || "";
    document.querySelector("#proposalClientCity").value = request.city || "";
    document.querySelector("#proposalClientState").value = request.state || "GA";
    document.querySelector("#proposalClientZip").value = request.postal_code || "";
  }
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
  if (existingClientSelect) existingClientSelect.value = proposal.client_id || "";
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

  if (!clientId && clientPayload.email) {
    const matchingClient = clients.find(
      (client) =>
        String(client.email || "").toLowerCase() ===
        String(clientPayload.email || "").toLowerCase()
    );

    if (matchingClient) {
      clientId = matchingClient.id;
      document.querySelector("#proposalClientId").value = clientId;
      if (existingClientSelect) existingClientSelect.value = clientId;
    }
  }

  if (clientId) {
    const { error } = await supabase.from("clients").update(clientPayload).eq("id", clientId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("clients").insert(clientPayload).select("id").single();
    if (error) throw error;
    clientId = data.id;
    document.querySelector("#proposalClientId").value = clientId;
    if (existingClientSelect) existingClientSelect.value = clientId;
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
    await supabase
      .from("quote_requests")
      .update({ status: "quoted" })
      .eq("id", requestId);
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
    await markQuoteRequestResponded(
      proposal.quote_request_id,
      "proposal",
      "quoted"
    );

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

document.querySelectorAll("[data-close-job-editor]").forEach((element) => {
  element.addEventListener("click", closeJobEditor);
});

function openJobEditor(id) {
  const job = jobs.find((item) => item.id === id);
  if (!job) return;

  document.querySelector("#jobId").value = job.id;
  document.querySelector("#jobEditorTitle").textContent =
    job.status === "scheduling" ? "Schedule Job" : "Edit Job Schedule";
  document.querySelector("#jobClientName").textContent = job.client_name || "";
  document.querySelector("#jobClientEmail").textContent = job.client_email || "";
  document.querySelector("#jobAddress").textContent =
    [job.service_address, job.city, job.state, job.postal_code]
      .filter(Boolean)
      .join(", ");
  document.querySelector("#jobServiceTitle").textContent = job.title || "Cleaning Job";

  document.querySelector("#jobDate").value = job.scheduled_date || "";
  document.querySelector("#jobStartTime").value = job.start_time
    ? String(job.start_time).slice(0, 5)
    : "";
  document.querySelector("#jobEndTime").value = job.end_time
    ? String(job.end_time).slice(0, 5)
    : "";
  document.querySelector("#jobStatus").value = job.status || "scheduling";
  document.querySelector("#jobSchedulingNotes").value = job.scheduling_notes || "";

  jobStatusMessage.textContent = "";
  jobEditor.hidden = false;
}

function closeJobEditor() {
  jobEditor.hidden = true;
  jobForm.reset();
  jobStatusMessage.textContent = "";
}

async function saveJobSchedule() {
  const jobId = document.querySelector("#jobId").value;
  if (!jobId) throw new Error("Job not found.");

  const status = document.querySelector("#jobStatus").value;
  const now = new Date().toISOString();

  const payload = {
    scheduled_date: document.querySelector("#jobDate").value || null,
    start_time: document.querySelector("#jobStartTime").value || null,
    end_time: document.querySelector("#jobEndTime").value || null,
    scheduling_notes: document.querySelector("#jobSchedulingNotes").value.trim() || null,
    status,
    updated_at: now,
  };

  if (status === "completed") payload.completed_at = now;
  if (status === "cancelled") payload.cancelled_at = now;

  const { data, error } = await supabase
    .from("jobs")
    .update(payload)
    .eq("id", jobId)
    .select("*")
    .single();

  if (error) throw error;

  await refreshAll();
  return data;
}

document.querySelector("#saveJobButton")?.addEventListener("click", async () => {
  const button = document.querySelector("#saveJobButton");
  button.disabled = true;
  button.textContent = "Saving...";
  jobStatusMessage.className = "form-status";
  jobStatusMessage.textContent = "";

  try {
    await saveJobSchedule();
    jobStatusMessage.className = "form-status success";
    jobStatusMessage.textContent = "Schedule saved.";
    button.textContent = "Saved";
    window.setTimeout(() => {
      button.textContent = "Save Schedule";
      button.disabled = false;
    }, 1000);
  } catch (error) {
    console.error(error);
    jobStatusMessage.className = "form-status error";
    jobStatusMessage.textContent = error.message || "Could not save schedule.";
    button.textContent = "Save Schedule";
    button.disabled = false;
  }
});

document.querySelector("#sendBookingButton")?.addEventListener("click", async () => {
  const button = document.querySelector("#sendBookingButton");
  button.disabled = true;
  button.textContent = "Saving...";

  try {
    const job = await saveJobSchedule();

    if (!job.scheduled_date || !job.start_time || !job.end_time) {
      throw new Error("Select a date, start time, and end time before sending the booking confirmation.");
    }

    button.textContent = "Sending...";

    const { data, error } = await supabase.functions.invoke(
      "send-job-confirmation",
      { body: { job_id: job.id } }
    );

    if (error) {
      let message = error.message || "Could not send booking confirmation.";

      try {
        if (error.context instanceof Response) {
          const payload = await error.context.clone().json();
          message =
            payload?.provider_response?.message ||
            payload?.message ||
            payload?.error ||
            message;
        }
      } catch {
        // Keep original error.
      }

      throw new Error(message);
    }

    if (!data?.ok) {
      throw new Error(data?.message || data?.error || "Could not send booking confirmation.");
    }

    jobStatusMessage.className = "form-status success";
    jobStatusMessage.textContent = "Booking confirmation sent.";
    button.textContent = "Sent";

    await refreshAll();

    window.setTimeout(() => {
      button.textContent = "Send Booking Confirmation";
      button.disabled = false;
    }, 1200);
  } catch (error) {
    console.error(error);
    jobStatusMessage.className = "form-status error";
    jobStatusMessage.textContent = error.message || "Could not send booking confirmation.";
    button.textContent = "Send Booking Confirmation";
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