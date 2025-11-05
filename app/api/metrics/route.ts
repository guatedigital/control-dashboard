import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify-auth";
import { withRateLimit, RateLimitPresets } from "@/lib/utils/rate-limit-middleware";
import { supabaseAdmin } from "@/lib/supabase/server";

async function handleGet(request: NextRequest) {
  // Verify authentication
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
  const source = searchParams.get("source") || "all"; // 'perfexcrm', 'uchat', or 'all'
  const date = searchParams.get("date") || new Date().toISOString().split('T')[0]; // Default to today
  const metricType = searchParams.get("metric_type") || "statistics"; // Optional filter

  try {
    const results: Record<string, unknown> = {};

    // Fetch PerfexCRM metrics if requested
    if (source === "perfexcrm" || source === "all") {
      const { data: perfexcrmData, error: perfexcrmError } = await supabaseAdmin
        .from("perfexcrm_metrics")
        .select("*")
        .eq("metric_date", date)
        .eq("metric_type", metricType)
        .order("updated_at", { ascending: false });

      if (perfexcrmError) {
        console.error("Error fetching PerfexCRM metrics:", perfexcrmError);
        results.perfexcrm = { error: perfexcrmError.message };
      } else {
        // Group by metric_key for easier access
        const grouped: Record<string, unknown> = {};
        perfexcrmData?.forEach((metric) => {
          grouped[metric.metric_key] = metric.metric_value;
        });
        results.perfexcrm = grouped;
      }
    }

    // Fetch Uchat metrics if requested
    if (source === "uchat" || source === "all") {
      const { data: uchatData, error: uchatError } = await supabaseAdmin
        .from("uchat_metrics")
        .select("*")
        .eq("metric_date", date)
        .eq("metric_type", metricType)
        .order("updated_at", { ascending: false });

      if (uchatError) {
        console.error("Error fetching Uchat metrics:", uchatError);
        results.uchat = { error: uchatError.message };
      } else {
        // Group by metric_key for easier access
        const grouped: Record<string, unknown> = {};
        uchatData?.forEach((metric) => {
          grouped[metric.metric_key] = metric.metric_value;
        });
        results.uchat = grouped;
      }
    }

    // Get dashboard statistics (most common use case)
    const perfexcrmStats = source === "perfexcrm" || source === "all" 
      ? (results.perfexcrm as Record<string, unknown>)?.dashboard 
      : null;
    const uchatStats = source === "uchat" || source === "all"
      ? (results.uchat as Record<string, unknown>)?.dashboard
      : null;

    return NextResponse.json({
      success: true,
      date,
      source,
      data: {
        perfexcrm: perfexcrmStats || null,
        uchat: uchatStats || null,
      },
      // Include full data if requested
      all_metrics: results,
    });
  } catch (error) {
    console.error("Metrics API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
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

