// CFWW Supabase client
// The publishable key is designed for browser/client use.
// Database access must still be protected with Row Level Security (RLS).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";

const supabaseUrl = "https://jsrvcmsnsbuuhtwtqvoq.supabase.co";
const supabasePublishableKey = "sb_publishable_NapgM6sZ3p8W9oFGxY-GrQ_j1nEvrxo";

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
