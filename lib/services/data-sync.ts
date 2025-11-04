import { supabaseAdmin } from "@/lib/supabase/server";
import { PerfexCRMClient } from "@/lib/api/perfexcrm-client";
import { UchatClient } from "@/lib/api/uchat-client";

const perfexcrmConfig = {
  apiUrl: process.env.NEXT_PUBLIC_PERFEXCRM_API_URL || "",
  apiKey: process.env.PERFEXCRM_API_KEY || "",
};

const uchatConfig = {
  apiUrl: process.env.NEXT_PUBLIC_UCHAT_API_URL || "",
  apiKey: process.env.UCHAT_API_KEY || "",
};

export interface SyncResult {
  success: boolean;
  source: "perfexcrm" | "uchat" | "combined";
  error?: string;
  timestamp: string;
}

export class DataSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private intervalMs: number;

  constructor(intervalMs: number = 60000) {
    this.intervalMs = intervalMs;
  }

  async syncPerfexCRM(): Promise<SyncResult> {
    if (!perfexcrmConfig.apiUrl || !perfexcrmConfig.apiKey) {
      return {
        success: false,
        source: "perfexcrm",
        error: "PerfexCRM API configuration is missing",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const client = new PerfexCRMClient(perfexcrmConfig);

      // Fetch statistics
      const statistics = await client.getStatistics();

      // Store in Supabase
      await supabaseAdmin.from("perfexcrm_metrics").upsert({
        metric_type: "statistics",
        metric_key: "dashboard",
        metric_value: statistics,
      });

      // Fetch and store customers
      const customers = await client.getCustomers({ limit: 1000 });
      await supabaseAdmin.from("perfexcrm_metrics").upsert({
        metric_type: "customers",
        metric_key: "total",
        metric_value: { count: customers.length, data: customers },
      });

      // Fetch and store invoices
      const invoices = await client.getInvoices({ limit: 1000 });
      const totalRevenue = invoices.reduce(
        (sum, inv) => sum + (inv.total || 0),
        0
      );
      await supabaseAdmin.from("perfexcrm_metrics").upsert({
        metric_type: "invoices",
        metric_key: "summary",
        metric_value: {
          count: invoices.length,
          total_revenue: totalRevenue,
          data: invoices,
        },
      });

      // Fetch and store leads
      const leads = await client.getLeads({ limit: 1000 });
      await supabaseAdmin.from("perfexcrm_metrics").upsert({
        metric_type: "leads",
        metric_key: "total",
        metric_value: { count: leads.length, data: leads },
      });

      // Store aggregated insights
      await supabaseAdmin.from("aggregated_insights").upsert({
        insight_type: "sales_summary",
        insight_key: "perfexcrm",
        insight_value: {
          total_customers: customers.length,
          total_invoices: invoices.length,
          total_revenue: totalRevenue,
          total_leads: leads.length,
          updated_at: new Date().toISOString(),
        },
        source: "perfexcrm",
      });

      return {
        success: true,
        source: "perfexcrm",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("PerfexCRM sync error:", error);
      return {
        success: false,
        source: "perfexcrm",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  async syncUchat(): Promise<SyncResult> {
    if (!uchatConfig.apiUrl || !uchatConfig.apiKey) {
      return {
        success: false,
        source: "uchat",
        error: "Uchat API configuration is missing",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const client = new UchatClient(uchatConfig);

      // Fetch statistics
      const statistics = await client.getStatistics();

      // Store in Supabase
      await supabaseAdmin.from("uchat_metrics").upsert({
        metric_type: "statistics",
        metric_key: "dashboard",
        metric_value: statistics,
      });

      // Fetch active chats
      const activeChats = await client.getActiveChats();
      await supabaseAdmin.from("uchat_metrics").upsert({
        metric_type: "chats",
        metric_key: "active",
        metric_value: {
          count: activeChats.length,
          data: activeChats,
        },
      });

      // Fetch all chats
      const allChats = await client.getChats({ limit: 1000 });
      await supabaseAdmin.from("uchat_metrics").upsert({
        metric_type: "chats",
        metric_key: "total",
        metric_value: {
          count: allChats.length,
          data: allChats,
        },
      });

      // Fetch analytics
      const analytics = await client.getAnalytics();
      await supabaseAdmin.from("uchat_metrics").upsert({
        metric_type: "analytics",
        metric_key: "summary",
        metric_value: analytics,
      });

      // Store aggregated insights
      await supabaseAdmin.from("aggregated_insights").upsert({
        insight_type: "chat_summary",
        insight_key: "uchat",
        insight_value: {
          total_chats: statistics.total_chats || allChats.length,
          active_chats: statistics.active_chats || activeChats.length,
          average_response_time: statistics.average_response_time,
          satisfaction_score: statistics.satisfaction_score,
          updated_at: new Date().toISOString(),
        },
        source: "uchat",
      });

      return {
        success: true,
        source: "uchat",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Uchat sync error:", error);
      return {
        success: false,
        source: "uchat",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  async syncAll(): Promise<SyncResult[]> {
    const [perfexcrmResult, uchatResult] = await Promise.all([
      this.syncPerfexCRM(),
      this.syncUchat(),
    ]);

    // Create combined insights
    if (perfexcrmResult.success && uchatResult.success) {
      try {
        const perfexcrmData = await supabaseAdmin
          .from("aggregated_insights")
          .select("insight_value")
          .eq("source", "perfexcrm")
          .eq("insight_type", "sales_summary")
          .single();

        const uchatData = await supabaseAdmin
          .from("aggregated_insights")
          .select("insight_value")
          .eq("source", "uchat")
          .eq("insight_type", "chat_summary")
          .single();

        if (perfexcrmData.data && uchatData.data) {
          await supabaseAdmin.from("aggregated_insights").upsert({
            insight_type: "combined_summary",
            insight_key: "dashboard",
            insight_value: {
              ...perfexcrmData.data.insight_value,
              ...uchatData.data.insight_value,
              updated_at: new Date().toISOString(),
            },
            source: "combined",
          });
        }
      } catch (error) {
        console.error("Error creating combined insights:", error);
      }
    }

    return [perfexcrmResult, uchatResult];
  }

  startPeriodicSync() {
    if (this.syncInterval) {
      this.stopPeriodicSync();
    }

    this.syncInterval = setInterval(() => {
      this.syncAll().catch((error) => {
        console.error("Periodic sync error:", error);
      });
    }, this.intervalMs);

    // Initial sync
    this.syncAll().catch((error) => {
      console.error("Initial sync error:", error);
    });
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  setInterval(intervalMs: number) {
    this.intervalMs = intervalMs;
    if (this.syncInterval) {
      this.stopPeriodicSync();
      this.startPeriodicSync();
    }
  }
}

// Singleton instance
let syncServiceInstance: DataSyncService | null = null;

export function getDataSyncService(): DataSyncService {
  if (!syncServiceInstance) {
    const intervalMs = parseInt(
      process.env.DATA_SYNC_INTERVAL || "60000",
      10
    );
    syncServiceInstance = new DataSyncService(intervalMs);
  }
  return syncServiceInstance;
}

