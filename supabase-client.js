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
