import { NextRequest, NextResponse } from "next/server";
import { UchatClient } from "@/lib/api/uchat-client";
import { verifyAuth } from "@/lib/auth/verify-auth";
import { withRateLimit, RateLimitPresets } from "@/lib/utils/rate-limit-middleware";

async function handleDebug(request: NextRequest) {
  // Verify authentication - debug endpoints should be protected
  const authResult = await verifyAuth(request);
  
  if (!authResult.authorized) {
    const status = authResult.error === "Account not authorized" ? 403 : 401;
    return NextResponse.json(
      { 
        error: authResult.error || "Unauthorized",
        message: "Authentication required to access this debug endpoint"
      },
      { status }
    );
  }

  const apiUrl = process.env.NEXT_PUBLIC_UCHAT_API_URL || "";
  const apiKey = process.env.UCHAT_API_KEY || "";

  if (!apiUrl || !apiKey) {
    return NextResponse.json({
      error: "Missing configuration",
      apiUrl: apiUrl || "NOT SET",
      apiKey: apiKey ? "SET" : "NOT SET",
    });
  }

  const tests: any[] = [];
  const client = new UchatClient({ apiUrl, apiKey });

  // Test 1: Statistics endpoint
  try {
    const result = await client.getStatistics();
    tests.push({
      endpoint: "statistics",
      method: "getStatistics()",
      status: "success",
      data: result,
      dataKeys: Object.keys(result || {}),
    });
  } catch (error: any) {
    tests.push({
      endpoint: "statistics",
      method: "getStatistics()",
      status: "error",
      error: error.message,
      stack: error.stack,
    });
  }

  // Test 2: Conversations endpoint
  try {
    const result = await client.getConversationsData({ limit: 10 });
    tests.push({
      endpoint: "conversations",
      method: "getConversationsData({ limit: 10 })",
      status: "success",
      dataType: Array.isArray(result) ? "array" : typeof result,
      dataLength: Array.isArray(result) ? result.length : "N/A",
      sampleData: Array.isArray(result) && result.length > 0 ? result[0] : result,
    });
  } catch (error: any) {
    tests.push({
      endpoint: "conversations",
      method: "getConversationsData({ limit: 10 })",
      status: "error",
      error: error.message,
      stack: error.stack,
    });
  }

  // Test 3: Analytics endpoint - NOT AVAILABLE in Uchat API
  tests.push({
    endpoint: "analytics",
    method: "getAnalytics()",
    status: "skipped",
    note: "Analytics endpoint does not exist in Uchat API (returns 404)",
  });

  // Test 4: Agent Activity Log endpoint
  try {
    const result = await client.getAgentActivityLogData({ limit: 10 });
    tests.push({
      endpoint: "agent-activity-log",
      method: "getAgentActivityLogData({ limit: 10 })",
      status: "success",
      dataType: Array.isArray(result) ? "array" : typeof result,
      dataLength: Array.isArray(result) ? result.length : "N/A",
      sampleData: Array.isArray(result) && result.length > 0 ? result[0] : result,
    });
  } catch (error: any) {
    tests.push({
      endpoint: "agent-activity-log",
      method: "getAgentActivityLogData({ limit: 10 })",
      status: "error",
      error: error.message,
      stack: error.stack,
    });
  }

  // Test 5: Custom Events Summary endpoint
  // Note: Requires event_ns parameter (required by API)
  tests.push({
    endpoint: "custom-events-summary",
    method: "getCustomEventsSummary({ event_ns, range })",
    status: "skipped",
    note: "Requires event_ns parameter (required). Cannot test without knowing event namespace.",
  });

  // Test 6: Custom Events Data endpoint
  // Note: Requires event_ns parameter (required by API)
  tests.push({
    endpoint: "custom-events",
    method: "getCustomEventsData({ event_ns, limit, start_time, end_time })",
    status: "skipped",
    note: "Requires event_ns parameter (required). Cannot test without knowing event namespace.",
  });

  // Summary
  const successCount = tests.filter(t => t.status === "success").length;
  const errorCount = tests.filter(t => t.status === "error").length;
  const skippedCount = tests.filter(t => t.status === "skipped").length;

  return NextResponse.json({
    apiUrl,
    apiKeyLength: apiKey.length,
    summary: {
      total: tests.length,
      success: successCount,
      errors: errorCount,
      skipped: skippedCount,
      successRate: `${((successCount / (tests.length - skippedCount)) * 100).toFixed(1)}%`,
    },
    tests,
    timestamp: new Date().toISOString(),
  });
}

// Apply rate limiting (5 requests per 15 minutes per authenticated user - strict for debug endpoints)
export async function GET(request: NextRequest) {
  return withRateLimit(
    request,
    {
      ...RateLimitPresets.strict,
      requireAuth: true,
    },
    handleDebug
  );
}

