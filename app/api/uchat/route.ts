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
        // Analytics endpoint doesn't exist in Uchat API - return error
        return NextResponse.json(
          { error: "Analytics endpoint is not available in Uchat API" },
          { status: 404 }
        );
      case "statistics":
        // Allow range and flow_ns parameters to be passed
        // Available range options: 'yesterday' (API default), 'last_7_days', 'last_week', 'last_30_days', 'last_month', 'last_3_months'
        // If range is not specified, API defaults to 'yesterday'
        const range = searchParams.get("range") || undefined;
        const flowNs = searchParams.get("flow_ns") || undefined;
        data = await client.getStatistics({ range, flow_ns: flowNs });
        break;
      case "agent-activity-log":
      case "agent-activity":
        const agentId = searchParams.get("agent_id") || undefined;
        const logStartDate = searchParams.get("start_date") || undefined;
        const logEndDate = searchParams.get("end_date") || undefined;
        data = await client.getAgentActivityLogData({
          limit,
          offset,
          agent_id: agentId,
          start_date: logStartDate,
          end_date: logEndDate,
        });
        break;
      case "custom-events-summary":
      case "events-summary":
        const eventNs = searchParams.get("event_ns");
        if (!eventNs) {
          return NextResponse.json(
            { error: "event_ns parameter is required for custom events summary" },
            { status: 400 }
          );
        }
        const eventsRange = searchParams.get("range") || undefined;
        data = await client.getCustomEventsSummary({
          event_ns: eventNs,
          range: eventsRange,
        });
        break;
      case "custom-events":
      case "events":
        const eventNsForData = searchParams.get("event_ns");
        if (!eventNsForData) {
          return NextResponse.json(
            { error: "event_ns parameter is required for custom events data" },
            { status: 400 }
          );
        }
        const startTime = searchParams.get("start_time") 
          ? parseInt(searchParams.get("start_time")!) 
          : undefined;
        const endTime = searchParams.get("end_time") 
          ? parseInt(searchParams.get("end_time")!) 
          : undefined;
        const startId = searchParams.get("start_id") 
          ? parseInt(searchParams.get("start_id")!) 
          : undefined;
        data = await client.getCustomEventsData({
          event_ns: eventNsForData,
          limit,
          start_time: startTime,
          end_time: endTime,
          start_id: startId,
        });
        break;
      default:
        return NextResponse.json(
          { error: `Unknown endpoint: ${endpoint}` },
          { status: 400 }
        );
    }

    // Add cache-control headers to prevent browser caching
    const response = NextResponse.json({ success: true, data });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
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

