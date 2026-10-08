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
  const [hour, minute] = value.slice(0,5).split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

async function loadBooking() {
  if (!token) {
    errorEl.textContent = "This booking link is incomplete.";
    return;
  }

  const client = createBookingClient(token);

  const { data: job, error } = await client
    .from("jobs")
    .select("client_name,title,status,scheduled_date,start_time,end_time,service_address,city,state,postal_code,scheduling_notes")
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
  text("#bookingTime", end ? start + " - " + end : start || "Time to be confirmed");

  const address = [job.service_address, job.city, job.state, job.postal_code]
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
    text("#bookingStatusCopy", "This appointment is no longer scheduled.");
  } else if (job.status === "completed") {
    text("#bookingTitle", "Service Completed");
    text("#bookingStatusCopy", "This CleanFreaks job has been completed.");
  } else if (job.status === "scheduling") {
    text("#bookingTitle", "Scheduling in Progress");
    text("#bookingStatusCopy", "Your appointment details are still being finalized.");
  }
}

await loadBooking();