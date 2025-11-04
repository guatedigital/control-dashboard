import { NextResponse } from "next/server";

export async function GET() {
  const config = {
    perfexcrm: {
      apiUrl: process.env.NEXT_PUBLIC_PERFEXCRM_API_URL || "NOT SET",
      apiKey: process.env.PERFEXCRM_API_KEY ? "SET (hidden)" : "NOT SET",
    },
    uchat: {
      apiUrl: process.env.NEXT_PUBLIC_UCHAT_API_URL || "NOT SET",
      apiKey: process.env.UCHAT_API_KEY ? "SET (hidden)" : "NOT SET",
    },
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET",
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET (hidden)" : "NOT SET",
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET (hidden)" : "NOT SET",
    },
  };

  return NextResponse.json({
    message: "Configuration check",
    config,
    timestamp: new Date().toISOString(),
  });
}

