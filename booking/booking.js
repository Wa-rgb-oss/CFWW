import { createBookingClient } from "/supabase-client.js";

const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const errorEl = document.querySelector("#bookingError");

function text(selector, value) {
  document.querySelector(selector).textContent = value ?? "";
}

function formatDate(value) {
  if (!value) return "Not scheduled";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value + "T12:00:00"));
}

function formatTime(value) {
  if (!value) return "";

  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function zonedLocalToUtc(dateValue, timeValue, timeZone = "America/New_York") {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.slice(0, 5).split(":").map(Number);
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  let candidate = desiredUtc;

  for (let i = 0; i < 3; i += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(candidate));

    const map = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)])
    );

    const representedUtc = Date.UTC(
      map.year,
      map.month - 1,
      map.day,
      map.hour,
      map.minute,
      map.second || 0
    );

    const offset = representedUtc - candidate;
    candidate = desiredUtc - offset;
  }

  return new Date(candidate);
}

function compactUtc(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function icsEscape(value = "") {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\n");
}

function setupCalendar(job, address) {
  const section = document.querySelector("#bookingCalendarSection");

  if (
    !job.scheduled_date ||
    !job.start_time ||
    !job.end_time ||
    ["cancelled", "completed"].includes(job.status)
  ) {
    section.hidden = true;
    return;
  }

  const startUtc = zonedLocalToUtc(
    job.scheduled_date,
    job.start_time,
    job.timezone || "America/New_York"
  );

  const endUtc = zonedLocalToUtc(
    job.scheduled_date,
    job.end_time,
    job.timezone || "America/New_York"
  );

  const title = "CleanFreaks - " + (job.title || "Cleaning Appointment");
  const bookingUrl = window.location.href;

  const description = [
    "CleanFreaks Window Washing",
    "Service: " + (job.title || "Cleaning Service"),
    job.scheduling_notes ? "Scheduling note: " + job.scheduling_notes : "",
    "Booking details: " + bookingUrl,
    "Questions or schedule changes: (563) 209-4627",
  ]
    .filter(Boolean)
    .join("\n");

  const googleParams = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: compactUtc(startUtc) + "/" + compactUtc(endUtc),
    details: description,
    location: address || "",
    ctz: job.timezone || "America/New_York",
  });

  document.querySelector("#bookingGoogleCalendar").href =
    "https://calendar.google.com/calendar/render?" +
    googleParams.toString();

  document.querySelector("#bookingDownloadIcs").onclick = () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CleanFreaks Window Washing//Booking//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "DTSTAMP:" + compactUtc(new Date()),
      "DTSTART:" + compactUtc(startUtc),
      "DTEND:" + compactUtc(endUtc),
      "SUMMARY:" + icsEscape(title),
      address ? "LOCATION:" + icsEscape(address) : "",
      "DESCRIPTION:" + icsEscape(description),
      "URL:" + icsEscape(bookingUrl),
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");

    const blob = new Blob([ics], {
      type: "text/calendar;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "CleanFreaks-Appointment.ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  section.hidden = false;
}

async function loadBooking() {
  if (!token) {
    errorEl.textContent = "This booking link is incomplete.";
    return;
  }

  const client = createBookingClient(token);

  const { data: job, error } = await client
    .from("jobs")
    .select(
      "client_name,title,status,scheduled_date,start_time,end_time,timezone,service_address,city,state,postal_code,scheduling_notes"
    )
    .eq("booking_token", token)
    .maybeSingle();

  if (error || !job) {
    console.error(error);
    errorEl.textContent = "This booking could not be found.";
    return;
  }

  text("#bookingClient", job.client_name);
  text("#bookingDate", formatDate(job.scheduled_date));

  const start = formatTime(job.start_time);
  const end = formatTime(job.end_time);

  text(
    "#bookingTime",
    end
      ? start + " - " + end + " Eastern Time"
      : start
        ? start + " Eastern Time"
        : "Time to be confirmed"
  );

  const address = [
    job.service_address,
    job.city,
    job.state,
    job.postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  if (address) {
    text("#bookingAddress", address);
  } else {
    document.querySelector("#bookingAddressRow").hidden = true;
  }

  text("#bookingService", job.title || "Cleaning Service");

  if (job.scheduling_notes) {
    document.querySelector("#bookingNoteSection").hidden = false;
    text("#bookingNote", job.scheduling_notes);
  }

  if (job.status === "cancelled") {
    text("#bookingTitle", "Booking Cancelled");
    text(
      "#bookingStatusCopy",
      "This appointment is no longer scheduled."
    );
  } else if (job.status === "completed") {
    text("#bookingTitle", "Service Completed");
    text(
      "#bookingStatusCopy",
      "This CleanFreaks job has been completed."
    );
  } else if (job.status === "scheduling") {
    text("#bookingTitle", "Scheduling in Progress");
    text(
      "#bookingStatusCopy",
      "Your appointment details are still being finalized."
    );
  }

  setupCalendar(job, address);
}

await loadBooking();