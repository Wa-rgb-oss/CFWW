// CFWW Supabase client
// The publishable key is intended for browser use. Row Level Security controls data access.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";

export const SUPABASE_URL = "https://jsrvcmsnsbuuhtwtqvoq.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NapgM6sZ3p8W9oFGxY-GrQ_j1nEvrxo";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

export function createProposalClient(token) {
  return createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: {
          "x-proposal-token": token,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}


export function createBookingClient(token) {
  return createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: {
          "x-booking-token": token,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}


const ANALYTICS_SESSION_KEY = "cfww_site_session";
const ANALYTICS_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function getAnalyticsSessionId() {
  const now = Date.now();
  let current = null;

  try {
    current = JSON.parse(localStorage.getItem(ANALYTICS_SESSION_KEY) || "null");
  } catch {
    current = null;
  }

  const expired =
    !current?.id ||
    !current?.lastActivity ||
    now - Number(current.lastActivity) > ANALYTICS_SESSION_TIMEOUT_MS;

  if (expired) {
    current = {
      id: crypto.randomUUID(),
      lastActivity: now,
    };
  } else {
    current.lastActivity = now;
  }

  try {
    localStorage.setItem(ANALYTICS_SESSION_KEY, JSON.stringify(current));
  } catch {
    // Analytics should never block the site if storage is unavailable.
  }

  return current.id;
}

export async function trackSitePageView(path = window.location.pathname) {
  if (!path || path.startsWith("/admin")) return;

  const sessionId = getAnalyticsSessionId();

  const { error } = await supabase
    .from("site_analytics_events")
    .insert({
      session_id: sessionId,
      path: String(path).slice(0, 255),
      event_type: "page_view",
    });

  if (error) {
    console.warn("Site analytics event was not recorded.", error);
  }
}
