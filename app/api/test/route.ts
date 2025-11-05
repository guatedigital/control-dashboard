import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify-auth";

export async function GET(request: NextRequest) {
  // Verify authentication - test endpoints should be protected
  const authResult = await verifyAuth(request);
  
  if (!authResult.authorized) {
    const status = authResult.error === "Account not authorized" ? 403 : 401;
    return NextResponse.json(
      { 
        error: authResult.error || "Unauthorized",
        message: "Authentication required to access this test endpoint"
      },
      { status }
    );
  }
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

