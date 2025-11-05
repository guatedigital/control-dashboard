import { NextRequest, NextResponse } from "next/server";
import { PerfexCRMClient } from "@/lib/api/perfexcrm-client";
import { verifyAuth } from "@/lib/auth/verify-auth";
import { withRateLimit, RateLimitPresets } from "@/lib/utils/rate-limit-middleware";

const perfexcrmConfig = {
  apiUrl: process.env.NEXT_PUBLIC_PERFEXCRM_API_URL || "",
  apiKey: process.env.PERFEXCRM_API_KEY || "",
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
    if (!perfexcrmConfig.apiUrl || !perfexcrmConfig.apiKey) {
      return NextResponse.json(
        { error: "PerfexCRM API configuration is missing" },
        { status: 500 }
      );
    }

    const client = new PerfexCRMClient(perfexcrmConfig);
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : undefined;
    const offset = searchParams.get("offset")
      ? parseInt(searchParams.get("offset")!)
      : undefined;
    const status = searchParams.get("status")
      ? parseInt(searchParams.get("status")!)
      : undefined;

    let data;

    switch (endpoint) {
      case "customers":
        data = await client.getCustomers({ limit, offset });
        break;
      case "invoices":
        data = await client.getInvoices({ limit, offset, status });
        break;
      case "leads":
        data = await client.getLeads({ limit, offset, status });
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
    console.error("PerfexCRM API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    // Preserve the original status code if available
    const statusCode = (error as Error & { statusCode?: number })?.statusCode || 500;
    
    const errorDetails = {
      success: false,
      error: errorMessage,
      endpoint,
      isCloudflareChallenge: (error as Error & { isCloudflareChallenge?: boolean })?.isCloudflareChallenge || false,
      config: {
        apiUrl: perfexcrmConfig.apiUrl ? "configured" : "missing",
        apiKey: perfexcrmConfig.apiKey ? "configured" : "missing",
      },
    };
    
    // Use the original status code, but don't use 500 for client errors (4xx)
    // Only use 500 for server errors (5xx) or unknown errors
    const responseStatus = statusCode >= 400 && statusCode < 500 ? statusCode : 500;
    
    return NextResponse.json(errorDetails, { status: responseStatus });
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

