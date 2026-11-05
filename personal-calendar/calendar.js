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
  field("starts_on").value = dateKey(cursor);
  if (item) {
    for (const name of ["title", "starts_on", "category", "repeat", "amount", "notes"]) {
      field(name).value = item[name] ?? "";
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
  const label = element("label", "", entry);
  const checkbox = element("input", "", label);
  checkbox.type = "checkbox";
  checkbox.checked = done;
  label.append(" " + item.title);
  const details = [item.category, item.amount === null ? "" : money.format(item.amount), item.notes].filter(Boolean);
  element("span", details.join(" · "), entry).className = "meta";
  checkbox.onchange = () => run(async () => {
    const table = supabase.from("personal_calendar_done");
    const record = { item_id: item.id, occurs_on: key };
    try {
      checked(await (checkbox.checked
        ? table.upsert(record, { ignoreDuplicates: true })
        : table.delete().match(record)));
      if ($("view").value === "bills") await load();
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
  const mode = $("view").value;
  const weekly = mode === "week";
  const first = weekly ? addDays(cursor, -((cursor.getDay() + 6) % 7))
    : new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = weekly ? addDays(first, 6) : new Date(first.getFullYear(), first.getMonth() + 1, 0);
  let itemsQuery = supabase.from("personal_calendar_items").select().lte("starts_on", dateKey(last))
    .or("repeat.neq.none,starts_on.gte." + dateKey(first)).order("title");
  if (mode === "bills") itemsQuery = itemsQuery.eq("category", "Bill");
  const [itemsResult, doneResult] = await Promise.all([
    itemsQuery,
    supabase.from("personal_calendar_done").select().gte("occurs_on", dateKey(first)).lte("occurs_on", dateKey(last)),
  ]);
  if (version !== loadVersion) return;
  const items = checked(itemsResult);
  const done = new Set(checked(doneResult).map((row) => row.item_id + row.occurs_on));
  const grid = $("days");
  grid.replaceChildren();
  $("period").textContent = weekly ? dayName.format(first) + " – " + dayName.format(last) : monthName.format(first);
  let billTotal = 0;
  let billPaid = 0;
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const key = dateKey(date);
    const entries = items.filter((item) => occurs(item, date, key));
    if (mode === "bills" && !entries.length) continue;
    const card = element("article", "", grid);
    if (key === dateKey(new Date())) card.className = "today";
    element("h3", dayName.format(date), card);
    if (!entries.length) element("p", "Nothing scheduled", card).className = "meta";
    for (const item of entries) {
      const complete = done.has(item.id + key);
      renderEntry(card, item, key, complete);
      if (mode === "bills") {
        billTotal += Number(item.amount ?? 0);
        if (complete) billPaid += Number(item.amount ?? 0);
      }
    }
    if (mode !== "bills") {
      const add = element("button", "+ Add", card);
      add.onclick = () => {
        edit(null);
        field("starts_on").value = key;
        editor.scrollIntoView({ block: "nearest" });
        field("title").focus({ preventScroll: true });
      };
    }
  }
  if (mode === "bills") {
    $("period").textContent += " · " + money.format(billPaid) + " paid of " + money.format(billTotal);
    if (!grid.childElementCount) element("p", "No bills scheduled this month.", grid);
  }
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
    const table = supabase.from("personal_calendar_items");
    checked(await (editing ? table.update(item).eq("id", editing) : table.insert(item)));
    const [year, month, day] = item.starts_on.split("-").map(Number);
    cursor = new Date(year, month - 1, day);
    if ($("view").value === "bills" && item.category !== "Bill") $("view").value = "week";
    edit(null);
    await load();
  }, event.submitter);
};

field("category").onchange = () => { $("amount-label").hidden = field("category").value !== "Bill"; };
$("cancel").onclick = () => edit(null);
$("view").onchange = () => run(load);
$("refresh").onclick = () => run(load, $("refresh"));
$("today").onclick = () => { cursor = new Date(); run(load); };
for (const [id, step] of [["previous", -1], ["next", 1]]) {
  $(id).onclick = () => {
    cursor = $("view").value === "week" ? addDays(cursor, step * 7)
      : new Date(cursor.getFullYear(), cursor.getMonth() + step, 1);
    run(load);
  };
}

run(async () => open(checked(await supabase.auth.getSession()).session));
