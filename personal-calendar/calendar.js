import { supabase } from "/supabase-client.js";

const $ = (id) => document.getElementById(id);
const editor = $("editor");
const share = $("share");
const field = (name) => editor.elements.namedItem(name);
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" });
const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
let cursor = new Date();
let editing = null;
let activeView = "today";
const taskCategories = ["Task", "Cleaning", "Pet care", "Self-care"];
const timeLabel = (value) => {
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
};
const mode = () => activeView === "week" ? $("view").value : activeView;

function dateKey(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0")).join("-");
}

function addDays(date, count) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
}

function occurs(item, date, key) {
  if (key < item.starts_on) return false;
  if (key === item.starts_on) return true;
  const [year, month, day] = item.starts_on.split("-").map(Number);
  if (item.repeat === "weekly") return new Date(year, month - 1, day).getDay() === date.getDay();
  if (item.repeat === "none") return false;
  if (item.repeat === "yearly" && month !== date.getMonth() + 1) return false;
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDate() === Math.min(day, lastDay);
}

function element(tag, text, parent) {
  const node = document.createElement(tag);
  node.textContent = text;
  parent.append(node);
  return node;
}

function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}

async function run(action, control) {
  if (control) control.disabled = true;
  $("status").textContent = "";
  try {
    await action();
  } catch (error) {
    $("status").textContent = error.message || "Something went wrong.";
  } finally {
    if (control) control.disabled = false;
  }
}

function edit(item) {
  editing = item?.id ?? null;
  editor.reset();
  field("starts_on").value = activeView === "tasks" ? "" : dateKey(cursor);
  if (activeView === "meals") field("category").value = "Dinner";
  if (activeView === "bills") {
    field("category").value = "Bill";
    field("repeat").value = "monthly";
  }
  if (item) {
    for (const name of ["title", "starts_on", "category", "repeat", "amount", "notes", "starts_at", "ends_at", "assignee"]) {
      field(name).value = ["starts_at", "ends_at"].includes(name) ? (item[name] ?? "").slice(0, 5) : item[name] ?? "";
    }
    editor.scrollIntoView({ block: "nearest" });
    field("title").focus({ preventScroll: true });
  }
  $("amount-label").hidden = field("category").value !== "Bill";
  $("editor-title").textContent = editing ? "Edit item" : "Add an item";
  $("save").textContent = editing ? "Save changes" : "Add item";
  $("cancel").hidden = !editing;
}

function renderEntry(parent, item, key, done) {
  const entry = element("div", "", parent);
  entry.className = "entry";
  entry.dataset.category = item.category;
  const label = element("label", "", entry);
  const checkbox = element("input", "", label);
  checkbox.type = "checkbox";
  checkbox.checked = done;
  label.append(" " + item.title);
  const time = item.starts_at ? [item.starts_at, item.ends_at].filter(Boolean).map(timeLabel).join(" – ") : "";
  const details = [time, item.category, item.assignee, item.repeat === "none" ? "" : item.repeat, item.amount === null ? "" : money.format(item.amount), item.notes].filter(Boolean);
  element("span", details.join(" · "), entry).className = "meta";
  checkbox.onchange = () => run(async () => {
    const table = supabase.from("personal_calendar_done");
    const record = { item_id: item.id, occurs_on: key };
    try {
      if (!key) {
        checked(await supabase.from("personal_calendar_items").update({ undated_done: checkbox.checked }).eq("id", item.id).select("id").single());
      } else {
        checked(await (checkbox.checked
        ? table.upsert(record, { ignoreDuplicates: true })
        : table.delete().match(record)));
      }
      if (mode() === "bills" || mode() === "today") await load();
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      throw error;
    }
  }, checkbox);
  const editButton = element("button", "Edit", entry);
  editButton.onclick = () => edit(item);
  const remove = element("button", "Delete", entry);
  remove.onclick = () => {
    if (!confirm(item.repeat === "none" ? "Delete this item?" : "Delete this entire repeating schedule?")) return;
    run(async () => {
      checked(await supabase.from("personal_calendar_items").delete().eq("id", item.id));
      if (editing === item.id) edit(null);
      await load();
    }, remove);
  };
}

let loadVersion = 0;
async function load() {
  const version = ++loadVersion;
  const current = mode();
  const tasks = current === "tasks";
  const today = current === "today";
  const weekly = current === "week" || current === "meals";
  const bills = current === "bills";
  const monthGrid = current === "month";
  const first = today ? cursor : weekly ? addDays(cursor, -((cursor.getDay() + 6) % 7))
    : new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = today ? first : weekly ? addDays(first, 6)
    : new Date(first.getFullYear(), first.getMonth() + 1, 0);
  let itemsQuery = supabase.from("personal_calendar_items").select().order("starts_at", { nullsFirst: true }).order("title");
  if (tasks) itemsQuery = itemsQuery.in("category", taskCategories);
  else itemsQuery = itemsQuery.lte("starts_on", dateKey(last))
    .or("repeat.neq.none,starts_on.gte." + dateKey(first));
  if (bills) itemsQuery = itemsQuery.eq("category", "Bill");
  if (current === "meals") itemsQuery = itemsQuery.eq("category", "Dinner");
  const [itemsResult, doneResult] = await Promise.all([
    itemsQuery,
    tasks ? supabase.from("personal_calendar_done").select() :
      supabase.from("personal_calendar_done").select().gte("occurs_on", dateKey(first)).lte("occurs_on", dateKey(last)),
  ]);
  if (version !== loadVersion) return;
  const items = checked(itemsResult);
  const done = new Set(checked(doneResult).map((row) => row.item_id + row.occurs_on));
  const grid = $("days");
  grid.replaceChildren();
  $("daily-summary").hidden = !today;
  grid.classList.toggle("timeline", today);
  if (today) {
    const key = dateKey(first);
    const agenda = items.filter((item) => occurs(item, first, key));
    const complete = agenda.filter((item) => done.has(item.id + key)).length;
    $("daily-date").textContent = dayName.format(first);
    $("daily-progress").textContent = agenda.length ? complete + " of " + agenda.length + " items complete" : "Nothing on the agenda yet";
    $("progress-bar").max = Math.max(1, agenda.length);
    $("progress-bar").value = complete;
    $("daily-dinner").textContent = agenda.filter((item) => item.category === "Dinner").map((item) => item.title).join(", ") || "Nothing planned yet";
  }
  grid.classList.toggle("calendar-grid", monthGrid || current === "week");
  $("calendar-zoom").hidden = activeView !== "week";
  $("previous").hidden = $("next").hidden = $("today").hidden = tasks;
  for (const button of document.querySelectorAll("[data-mode]")) {
    if (button.dataset.mode === activeView) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  if (tasks) {
    $("period").textContent = "Tasks & Routines";
    for (const [title, entries] of [
      ["To-do inbox", items.filter((item) => !item.starts_on)],
      ["Scheduled tasks", items.filter((item) => item.starts_on && item.repeat === "none")],
      ["Repeating routines", items.filter((item) => item.repeat !== "none")],
    ]) {
      const card = element("article", "", grid);
      element("h3", title, card);
      if (!entries.length) element("p", "Nothing here yet.", card).className = "meta";
      for (const item of entries) {
        if (item.repeat === "none") {
          const key = item.starts_on;
          if (key) element("span", key, card).className = "meta";
          renderEntry(card, item, key, key ? done.has(item.id + key) : item.undated_done);
        } else {
          const row = element("div", "", card);
          row.className = "entry";
          element("strong", item.title, row);
          element("span", [item.starts_on, item.repeat, item.assignee].filter(Boolean).join(" · "), row).className = "meta";
          element("button", "Edit", row).onclick = () => edit(item);
          element("button", "View schedule", row).onclick = () => {
            const [year, month, day] = item.starts_on.split("-").map(Number);
            const start = new Date(year, month - 1, day);
            cursor = item.repeat !== "none" && start < new Date() ? new Date() : start;
            $("view").value = item.repeat === "weekly" ? "week" : "month";
            switchView("week");
          };
        }
      }
    }
    return;
  }
  $("period").textContent = today ? "Timeline" : weekly
    ? dayName.format(first) + " – " + dayName.format(last) : monthName.format(first);
  if (monthGrid) {
    for (const name of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      element("div", name, grid).className = "calendar-heading";
    }
    for (let offset = 0; offset < (first.getDay() + 6) % 7; offset++) element("div", "", grid);
  }
  let billTotal = 0;
  let billPaid = 0;
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const key = dateKey(date);
    const entries = items.filter((item) => occurs(item, date, key));
    if (bills && !entries.length) continue;
    const card = element("article", "", grid);
    if (key === dateKey(new Date())) card.className = "today";
    if (!today) element("h3", monthGrid ? String(date.getDate()) : dayName.format(date), card);
    if (!entries.length && !monthGrid) element("p", current === "meals" ? "Dinner not planned" : "Nothing scheduled", card).className = "meta";
    for (const item of entries) {
      const complete = done.has(item.id + key);
      renderEntry(card, item, key, complete);
      if (bills) {
        billTotal += Number(item.amount ?? 0);
        if (complete) billPaid += Number(item.amount ?? 0);
      }
    }
    if (!bills) {
      const add = element("button", current === "meals" ? "+ Dinner" : "+ Add", card);
      add.setAttribute("aria-label", "Add item for " + dayName.format(date));
      add.onclick = () => newItem(key);
    }
  }
  if (bills) {
    $("period").textContent += " · " + money.format(billPaid) + " paid of " + money.format(billTotal);
    if (!grid.childElementCount) element("p", "No bills scheduled this month.", grid);
  }
}

function newItem(key) {
  edit(null);
  if (key) field("starts_on").value = key;
  editor.scrollIntoView({ block: "nearest" });
  field("title").focus({ preventScroll: true });
}

function switchView(view) {
  activeView = view;
  if (view === "today") cursor = new Date();
  if (!editing) edit(null);
  run(load);
}

async function open(session) {
  $("calendar").hidden = true;
  $("login").hidden = Boolean(session);
  if (!session) return;
  const access = checked(await supabase.from("personal_calendar_access").select().maybeSingle());
  if (!access) {
    $("login").hidden = false;
    throw new Error("This account does not have access to the personal calendar.");
  }
  $("sharing").hidden = access.owner_id !== session.user.id;
  share.elements.partner.value = access.partner_id ?? "";
  $("calendar").hidden = false;
  edit(null);
  await load();
}

$("login").onsubmit = (event) => {
  event.preventDefault();
  run(async () => {
    const form = event.currentTarget;
    const data = new FormData(form);
    const { session } = checked(await supabase.auth.signInWithPassword({
      email: data.get("email").trim(), password: data.get("password"),
    }));
    form.reset();
    await open(session);
  }, event.submitter);
};

$("logout").onclick = () => run(async () => {
  checked(await supabase.auth.signOut({ scope: "local" }));
  await open(null);
}, $("logout"));

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    loadVersion++;
    $("days").replaceChildren();
    $("calendar").hidden = true;
    $("login").hidden = false;
  }
});

share.onsubmit = (event) => {
  event.preventDefault();
  run(async () => {
    const partner = share.elements.partner.value.trim();
    if (partner && !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(partner)) {
      throw new Error("Enter the user ID shown in Supabase Authentication.");
    }
    const { user } = checked(await supabase.auth.getUser());
    checked(await supabase.from("personal_calendar_access").update({ partner_id: partner || null })
      .eq("owner_id", user.id).select("partner_id").single());
    $("status").textContent = partner ? "Shared access saved." : "Shared access removed.";
  }, event.submitter);
};

editor.onsubmit = (event) => {
  event.preventDefault();
  run(async () => {
    const item = Object.fromEntries(new FormData(editor));
    item.title = item.title.trim();
    item.amount = item.category === "Bill" && item.amount !== "" ? Number(item.amount) : null;
    for (const name of ["starts_on", "starts_at", "ends_at", "assignee"]) item[name] ||= null;
    if (!item.starts_on && (!taskCategories.includes(item.category) || item.repeat !== "none" || item.starts_at)) {
      throw new Error("Add a date for events, meals, bills, timed items, and recurring routines.");
    }
    if (item.ends_at && (!item.starts_at || item.ends_at <= item.starts_at)) {
      throw new Error("End time must be later than start time on the same day.");
    }
    if (item.starts_on) item.undated_done = false;
    const table = supabase.from("personal_calendar_items");
    checked(await (editing ? table.update(item).eq("id", editing).select("id").single() : table.insert(item)));
    if (item.starts_on) {
      const [year, month, day] = item.starts_on.split("-").map(Number);
      cursor = new Date(year, month - 1, day);
      if (activeView === "today" && item.starts_on !== dateKey(new Date())) activeView = "week";
      if (activeView === "bills" && item.category !== "Bill") activeView = "week";
      if (activeView === "meals" && item.category !== "Dinner") activeView = "week";
    } else {
      activeView = "tasks";
    }
    edit(null);
    await load();
  }, event.submitter);
};

field("category").onchange = () => { $("amount-label").hidden = field("category").value !== "Bill"; };
$("cancel").onclick = () => edit(null);
$("new-item").onclick = $("mobile-add").onclick = () => newItem();
for (const button of document.querySelectorAll("[data-mode]")) {
  button.onclick = () => switchView(button.dataset.mode);
}
$("view").onchange = () => run(load);
$("refresh").onclick = () => run(load, $("refresh"));
$("today").onclick = () => { cursor = new Date(); run(load); };
for (const [id, step] of [["previous", -1], ["next", 1]]) {
  $(id).onclick = () => {
    cursor = ["week", "meals", "today"].includes(mode()) ? addDays(cursor, step * (mode() === "today" ? 1 : 7))
      : new Date(cursor.getFullYear(), cursor.getMonth() + step, 1);
    run(load);
  };
}

run(async () => open(checked(await supabase.auth.getSession()).session));
