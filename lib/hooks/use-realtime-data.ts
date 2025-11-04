"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { PerfexCRMMetric, UchatMetric, AggregatedInsight } from "@/types/database";

export function useRealtimeData() {
  const [perfexcrmMetrics, setPerfexcrmMetrics] = useState<PerfexCRMMetric[]>([]);
  const [uchatMetrics, setUchatMetrics] = useState<UchatMetric[]>([]);
  const [aggregatedInsights, setAggregatedInsights] = useState<AggregatedInsight[]>([]);

  useEffect(() => {
    // Subscribe to PerfexCRM metrics changes
    const perfexcrmChannel = supabase
      .channel("perfexcrm_metrics_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "perfexcrm_metrics",
        },
        (payload) => {
          console.log("PerfexCRM metrics changed:", payload);
          // Fetch updated data
          fetchPerfexcrmMetrics();
        }
      )
      .subscribe();

    // Subscribe to Uchat metrics changes
    const uchatChannel = supabase
      .channel("uchat_metrics_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "uchat_metrics",
        },
        (payload) => {
          console.log("Uchat metrics changed:", payload);
          // Fetch updated data
          fetchUchatMetrics();
        }
      )
      .subscribe();

    // Subscribe to aggregated insights changes
    const insightsChannel = supabase
      .channel("aggregated_insights_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "aggregated_insights",
        },
        (payload) => {
          console.log("Aggregated insights changed:", payload);
          // Fetch updated data
          fetchAggregatedInsights();
        }
      )
      .subscribe();

    // Initial fetch
    fetchPerfexcrmMetrics();
    fetchUchatMetrics();
    fetchAggregatedInsights();

    return () => {
      supabase.removeChannel(perfexcrmChannel);
      supabase.removeChannel(uchatChannel);
      supabase.removeChannel(insightsChannel);
    };
  }, []);

  async function fetchPerfexcrmMetrics() {
    const { data, error } = await supabase
      .from("perfexcrm_metrics")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setPerfexcrmMetrics(data);
    }
  }

  async function fetchUchatMetrics() {
    const { data, error } = await supabase
      .from("uchat_metrics")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setUchatMetrics(data);
    }
  }

  async function fetchAggregatedInsights() {
    const { data, error } = await supabase
      .from("aggregated_insights")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setAggregatedInsights(data);
    }
  }

  return {
    perfexcrmMetrics,
    uchatMetrics,
    aggregatedInsights,
    refetch: () => {
      fetchPerfexcrmMetrics();
      fetchUchatMetrics();
      fetchAggregatedInsights();
    },
  };
}

