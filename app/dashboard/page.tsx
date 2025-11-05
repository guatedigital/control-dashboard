"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Users, FileText, MessageSquare, DollarSign, TrendingUp, UserPlus, Mail, Clock, CheckCircle, ArrowDown, ArrowUp, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useRealtimeData } from "@/lib/hooks/use-realtime-data";

async function fetchDashboardData() {
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error("[Dashboard] Request timeout after 30 seconds");
    controller.abort();
  }, 30000); // 30 second timeout

  try {
    console.log("[Dashboard] Starting API requests...");
    
    // Get session token for authenticated API requests
    const { supabase } = await import("@/lib/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error("Not authenticated. Please log in again.");
    }
    
    // Fetch both APIs in parallel, but don't fail if one fails
    // Use server-side API routes with authentication headers
    // This keeps API keys secure on the server
    const [perfexcrmRes, uchatRes] = await Promise.allSettled([
      fetch("/api/perfexcrm?endpoint=statistics", {
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      }).catch(err => {
        console.error("[Dashboard] PerfexCRM fetch error:", err);
        throw err;
      }),
      fetch("/api/uchat?endpoint=statistics", {
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      }).catch(err => {
        console.error("[Dashboard] Uchat fetch error:", err);
        throw err;
      }),
    ]);

    clearTimeout(timeoutId);
    console.log("[Dashboard] API requests completed");

    // Process PerfexCRM response
    let perfexcrm = {};
    let perfexcrmError: string | null = null;
    
    if (perfexcrmRes.status === 'fulfilled') {
      try {
        const perfexcrmData = await perfexcrmRes.value.json().catch(() => ({
          success: false,
          error: "Failed to parse PerfexCRM response",
        }));

        if (perfexcrmRes.value.ok && perfexcrmData.success) {
          perfexcrm = perfexcrmData.data || {};
        } else {
          let errorMessage = perfexcrmData.error || "Failed to fetch PerfexCRM data";
          if (errorMessage.includes("<!doctype") || errorMessage.includes("<html")) {
            errorMessage = "PerfexCRM: Cloudflare is blocking the request. Check IP restrictions and bot protection settings.";
          }
          perfexcrmError = errorMessage;
          console.error("PerfexCRM error:", errorMessage);
        }
      } catch (err) {
        perfexcrmError = err instanceof Error ? err.message : "Failed to fetch PerfexCRM data";
        console.error("PerfexCRM error:", perfexcrmError);
      }
    } else {
      perfexcrmError = perfexcrmRes.reason instanceof Error 
        ? perfexcrmRes.reason.message 
        : "PerfexCRM request failed";
      console.error("PerfexCRM request error:", perfexcrmError);
    }

    // Process Uchat response
    let uchat = {};
    let uchatError: string | null = null;
    
    if (uchatRes.status === 'fulfilled') {
      try {
        const uchatData = await uchatRes.value.json().catch(() => ({
          success: false,
          error: "Failed to parse Uchat response",
        }));

        if (uchatRes.value.ok && uchatData.success) {
          uchat = uchatData.data || {};
        } else {
          uchatError = uchatData.error || "Failed to fetch Uchat data";
          console.error("Uchat error:", uchatError);
        }
      } catch (err) {
        uchatError = err instanceof Error ? err.message : "Failed to fetch Uchat data";
        console.error("Uchat error:", uchatError);
      }
    } else {
      uchatError = uchatRes.reason instanceof Error 
        ? uchatRes.reason.message 
        : "Uchat request failed";
      console.error("Uchat request error:", uchatError);
    }

    // If both APIs failed, throw an error
    if (perfexcrmError && uchatError) {
      throw new Error(`Both APIs failed:\n- PerfexCRM: ${perfexcrmError}\n- Uchat: ${uchatError}`);
    }

    // If at least one succeeded, return the data (with warnings for failed ones)
    if (perfexcrmError) {
      console.warn("PerfexCRM failed, but continuing with Uchat data:", perfexcrmError);
    }
    if (uchatError) {
      console.warn("Uchat failed, but continuing with PerfexCRM data:", uchatError);
    }

    return {
      perfexcrm,
      uchat,
      errors: {
        perfexcrm: perfexcrmError,
        uchat: uchatError,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export default function DashboardPage() {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { aggregatedInsights } = useRealtimeData();

  const { data, isLoading, error, refetch, isError } = useQuery({
    queryKey: ["dashboard-data"],
    queryFn: fetchDashboardData,
    refetchInterval: 60000, // Refetch every 60 seconds
    retry: false, // Don't retry - show error immediately if it fails
    staleTime: 0, // Always consider data stale - ensures fresh fetch on mount
    gcTime: 300000, // Keep data in cache for 5 minutes (for performance)
    refetchOnMount: 'always', // Always refetch when component mounts (even if data is fresh)
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  // Log query state for debugging
  useEffect(() => {
    console.log("[Dashboard] Query state:", { isLoading, isError, hasData: !!data, hasError: !!error });
  }, [isLoading, isError, data, error]);

  useEffect(() => {
    if (data) {
      setLastUpdated(new Date());
    }
  }, [data]);

  // Update from real-time data when available
  useEffect(() => {
    if (aggregatedInsights.length > 0) {
      const perfexcrmInsight = aggregatedInsights.find(
        (i) => i.source === "perfexcrm" && i.insight_type === "sales_summary"
      );
      const uchatInsight = aggregatedInsights.find(
        (i) => i.source === "uchat" && i.insight_type === "chat_summary"
      );

      if (perfexcrmInsight || uchatInsight) {
        setLastUpdated(new Date());
        // Trigger a refetch to update the UI
        refetch();
      }
    }
  }, [aggregatedInsights, refetch]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="text-muted-foreground">Loading dashboard...</div>
          <div className="text-sm text-muted-foreground">
            Fetching data from PerfexCRM and Uchat APIs
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            This may take up to 30 seconds. Check browser console (F12) for details.
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4 max-w-2xl">
          <div className="text-destructive text-lg font-semibold">
            Error loading dashboard
          </div>
          <div className="text-destructive text-sm whitespace-pre-line text-center">
            {error instanceof Error ? error.message : "Unknown error"}
          </div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
          <div className="text-xs text-muted-foreground mt-4">
            Check the browser console (F12) for more details
          </div>
        </div>
      </div>
    );
  }

  const perfexcrm = data?.perfexcrm || {};
  const uchat = data?.uchat || {};
  const errors = data?.errors;

  // Try to get data from real-time insights if available
  const perfexcrmInsight = aggregatedInsights.find(
    (i) => i.source === "perfexcrm" && i.insight_type === "sales_summary"
  );
  const uchatInsight = aggregatedInsights.find(
    (i) => i.source === "uchat" && i.insight_type === "chat_summary"
  );

  const perfexcrmData = perfexcrmInsight?.insight_value as Record<string, unknown> || perfexcrm;
  const uchatData = uchatInsight?.insight_value as Record<string, unknown> || uchat;

  return (
    <div className="container mx-auto p-6">
      <DashboardHeader
        onRefresh={() => refetch()}
        lastUpdated={lastUpdated}
      />

      {/* Show warnings if one API failed */}
      {errors && (
        <div className="mb-6 space-y-2">
          {errors.perfexcrm && (
            <div className="rounded-md bg-yellow-500/15 p-3 text-sm text-yellow-700 dark:text-yellow-400">
              <strong>PerfexCRM:</strong> {errors.perfexcrm}
            </div>
          )}
          {errors.uchat && (
            <div className="rounded-md bg-yellow-500/15 p-3 text-sm text-yellow-700 dark:text-yellow-400">
              <strong>Uchat:</strong> {errors.uchat}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard
          title="Total Customers"
          value={(perfexcrmData.total_customers as number) || 0}
          description="From PerfexCRM"
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          title="Total Revenue"
          value={(perfexcrmData.total_revenue as number) || 0}
          description="From PerfexCRM"
          icon={<DollarSign className="h-4 w-4" />}
          isCurrency={true}
        />
        <MetricCard
          title="Total Invoices"
          value={(perfexcrmData.total_invoices as number) || 0}
          description="From PerfexCRM"
          icon={<FileText className="h-4 w-4" />}
        />
        <MetricCard
          title="Active Chats"
          value={(uchatData.active_chats as number) || 0}
          description="From Uchat"
          icon={<MessageSquare className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard
          title="Total Leads"
          value={(perfexcrmData.total_leads as number) || 0}
          description="From PerfexCRM"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          title="Total Chats"
          value={(uchatData.total_chats as number) || 0}
          description="From Uchat"
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <MetricCard
          title="Avg Response Time"
          value={
            uchatData.average_response_time
              ? `${Math.round(uchatData.average_response_time as number)}s`
              : "N/A"
          }
          description="From Uchat"
        />
        <MetricCard
          title="Satisfaction Score"
          value={
            uchatData.satisfaction_score
              ? `${((uchatData.satisfaction_score as number) * 100).toFixed(1)}%`
              : "N/A"
          }
          description="From Uchat"
        />
      </div>

      {/* Uchat Daily Metrics Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Uchat - Daily Activity</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <MetricCard
            title="New Users Today"
            value={(uchatData.new_users_today as number) || 0}
            description="From Uchat"
            icon={<UserPlus className="h-4 w-4" />}
          />
          <MetricCard
            title="Total Messages Today"
            value={(uchatData.total_messages_today as number) || 0}
            description="From Uchat"
            icon={<MessageSquare className="h-4 w-4" />}
          />
          <MetricCard
            title="Incoming Messages"
            value={(uchatData.incoming_messages as number) || 0}
            description="From Uchat"
            icon={<ArrowDown className="h-4 w-4" />}
          />
          <MetricCard
            title="Agent Messages"
            value={(uchatData.agent_messages as number) || 0}
            description="From Uchat"
            icon={<ArrowUp className="h-4 w-4" />}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <MetricCard
            title="Assigned Today"
            value={(uchatData.assigned_today as number) || 0}
            description="From Uchat"
            icon={<CheckCircle className="h-4 w-4" />}
          />
          <MetricCard
            title="Resolved Today"
            value={(uchatData.resolved_today as number) || 0}
            description="From Uchat"
            icon={<CheckCircle className="h-4 w-4" />}
          />
          <MetricCard
            title="Avg Resolve Time"
            value={
              uchatData.avg_resolve_time
                ? `${Math.round(uchatData.avg_resolve_time as number)}s`
                : "N/A"
            }
            description="From Uchat"
            icon={<Clock className="h-4 w-4" />}
          />
          <MetricCard
            title="Emails Sent"
            value={(uchatData.emails_sent as number) || 0}
            description="From Uchat"
            icon={<Send className="h-4 w-4" />}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Emails Opened"
            value={(uchatData.emails_opened as number) || 0}
            description="From Uchat"
            icon={<Mail className="h-4 w-4" />}
          />
        </div>
      </div>
    </div>
  );
}
