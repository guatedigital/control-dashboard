import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseAdminInstance: SupabaseClient | null = null;

function getSupabaseAdminClient(): SupabaseClient {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    // During build time, allow build to proceed with placeholder values
    // This prevents build errors - actual runtime will need proper env vars
    // Create with placeholder values for build
    supabaseAdminInstance = createClient(
      supabaseUrl || "https://placeholder.supabase.co",
      supabaseServiceRoleKey || "placeholder-key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    return supabaseAdminInstance;
  }

  // Server-side client with service role key for admin operations
  supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return supabaseAdminInstance;
}

export const supabaseAdmin = getSupabaseAdminClient();

