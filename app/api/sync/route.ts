import { NextRequest, NextResponse } from "next/server";
import { getDataSyncService } from "@/lib/services/data-sync";
import { verifyAuth } from "@/lib/auth/verify-auth";
import { withRateLimit, RateLimitPresets } from "@/lib/utils/rate-limit-middleware";

async function handlePost(request: NextRequest) {
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

  try {
    const body = await request.json();
    const source = body.source || "all"; // 'perfexcrm', 'uchat', or 'all'

    const syncService = getDataSyncService();
    let results;

    if (source === "perfexcrm") {
      results = [await syncService.syncPerfexCRM()];
    } else if (source === "uchat") {
      results = [await syncService.syncUchat()];
    } else {
      results = await syncService.syncAll();
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

// Apply rate limiting (5 requests per 15 minutes per authenticated user - strict for sync operations)
export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    {
      ...RateLimitPresets.strict,
      requireAuth: true,
    },
    handlePost
  );
}
