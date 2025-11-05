import { NextRequest, NextResponse } from "next/server";
import { UchatClient } from "@/lib/api/uchat-client";
import { verifyAuth } from "@/lib/auth/verify-auth";
import { withRateLimit, RateLimitPresets } from "@/lib/utils/rate-limit-middleware";

const uchatConfig = {
  apiUrl: process.env.NEXT_PUBLIC_UCHAT_API_URL || "",
  apiKey: process.env.UCHAT_API_KEY || "",
};

async function handleGet(request: NextRequest) {
  // Verify authentication first
  const authResult = await verifyAuth(request);
  
  if (!authResult.authorized) {
    const status = authResult.error === "Account not authorized" ? 403 : 401;
    return NextResponse.json(
      { 
        success: false,
        error: authResult.error || "Unauthorized",
        message: "Authentication required to access this endpoint"
      },
      { status }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get("endpoint") || "statistics";
  
  try {
    if (!uchatConfig.apiUrl || !uchatConfig.apiKey) {
      return NextResponse.json(
        { error: "Uchat API configuration is missing" },
        { status: 500 }
      );
    }

    const client = new UchatClient(uchatConfig);
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : undefined;
    const offset = searchParams.get("offset")
      ? parseInt(searchParams.get("offset")!)
      : undefined;
    const status = searchParams.get("status") || undefined;

    let data;

    switch (endpoint) {
      case "chats":
        // Uchat doesn't have /chats endpoint, use conversations data instead
        data = await client.getConversationsData({ limit, offset });
        break;
      case "conversations":
        // Direct access to conversations endpoint
        data = await client.getConversationsData({ limit, offset });
        break;
      case "analytics":
        const startDate = searchParams.get("start_date") || undefined;
        const endDate = searchParams.get("end_date") || undefined;
        data = await client.getAnalytics({ start_date: startDate, end_date: endDate });
        break;
      case "statistics":
        data = await client.getStatistics();
        break;
      default:
        return NextResponse.json(
          { error: `Unknown endpoint: ${endpoint}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Uchat API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    const errorDetails = {
      success: false,
      error: errorMessage,
      endpoint,
      config: {
        apiUrl: uchatConfig.apiUrl ? "configured" : "missing",
        apiKey: uchatConfig.apiKey ? "configured" : "missing",
      },
    };
    return NextResponse.json(errorDetails, { status: 500 });
  }
}

// Apply rate limiting (20 requests per minute per authenticated user)
export async function GET(request: NextRequest) {
  return withRateLimit(
    request,
    {
      ...RateLimitPresets.moderate,
      requireAuth: true,
    },
    handleGet
  );
}

