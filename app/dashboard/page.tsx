"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Users, FileText, MessageSquare, DollarSign, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useRealtimeData } from "@/lib/hooks/use-realtime-data";

async function fetchDashboardData() {
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const [perfexcrmRes, uchatRes] = await Promise.all([
      fetch("/api/perfexcrm?endpoint=statistics", {
        signal: controller.signal,
      }).catch((err) => {
        if (err.name === 'AbortError') {
          throw new Error("PerfexCRM request timed out after 30 seconds");
        }
        throw err;
      }),
      fetch("/api/uchat?endpoint=statistics", {
        signal: controller.signal,
      }).catch((err) => {
        if (err.name === 'AbortError') {
          throw new Error("Uchat request timed out after 30 seconds");
        }
        throw err;
      }),
    ]);

    clearTimeout(timeoutId);

    const perfexcrm = await perfexcrmRes.json().catch(() => ({
      success: false,
      error: "Failed to parse PerfexCRM response",
    }));
    const uchat = await uchatRes.json().catch(() => ({
      success: false,
      error: "Failed to parse Uchat response",
    }));

    // Check for errors
    if (!perfexcrmRes.ok || !perfexcrm.success) {
      console.error("PerfexCRM error:", perfexcrm);
      // Extract error message, truncate if it's HTML
      let errorMessage = perfexcrm.error || "Failed to fetch PerfexCRM data";
      
      // If error message contains HTML, replace with a cleaner message
      if (errorMessage.includes("<!doctype") || errorMessage.includes("<html")) {
        errorMessage = "PerfexCRM: Received HTML response instead of JSON. This usually means Cloudflare is blocking the request. Please check:\n1. IP restrictions in Cloudflare\n2. Bot protection settings\n3. API endpoint accessibility";
      }
      
      throw new Error(errorMessage);
    }

    if (!uchatRes.ok || !uchat.success) {
      console.error("Uchat error:", uchat);
      throw new Error(uchat.error || "Failed to fetch Uchat data");
    }

    return {
      perfexcrm: perfexcrm.data || {},
      uchat: uchat.data || {},
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export default function DashboardPage() {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { aggregatedInsights } = useRealtimeData();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-data"],
    queryFn: fetchDashboardData,
    refetchInterval: 60000, // Refetch every 60 seconds
    retry: 1, // Only retry once on failure
    retryDelay: 2000, // Wait 2 seconds before retry
  });

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
    </div>
  );
}
