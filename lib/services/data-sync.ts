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

      // Get current date in YYYY-MM-DD format for daily metrics storage
      const today = new Date().toISOString().split('T')[0];

      // Fetch statistics
      const statistics = await client.getStatistics();

      // Store in Supabase with date to preserve daily values
      // This allows tracking historical data per day instead of overwriting
      await supabaseAdmin.from("perfexcrm_metrics").upsert({
        metric_type: "statistics",
        metric_key: "dashboard",
        metric_date: today,
        metric_value: statistics,
      }, {
        onConflict: "metric_type,metric_key,metric_date"
      });

      // Fetch and store customers
      const customers = await client.getCustomers({ limit: 1000 });
      await supabaseAdmin.from("perfexcrm_metrics").upsert({
        metric_type: "customers",
        metric_key: "total",
        metric_date: today,
        metric_value: { count: customers.length, data: customers },
      }, {
        onConflict: "metric_type,metric_key,metric_date"
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
        metric_date: today,
        metric_value: {
          count: invoices.length,
          total_revenue: totalRevenue,
          data: invoices,
        },
      }, {
        onConflict: "metric_type,metric_key,metric_date"
      });

      // Fetch and store leads
      const leads = await client.getLeads({ limit: 1000 });
      await supabaseAdmin.from("perfexcrm_metrics").upsert({
        metric_type: "leads",
        metric_key: "total",
        metric_date: today,
        metric_value: { count: leads.length, data: leads },
      }, {
        onConflict: "metric_type,metric_key,metric_date"
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

      // Get current date in YYYY-MM-DD format for daily metrics storage
      const today = new Date().toISOString().split('T')[0];

      // Fetch statistics with last_7_days range to get current data (includes today)
      // This matches what the dashboard uses for consistency
      const statistics = await client.getStatistics({ range: "last_7_days" });

      // Store in Supabase with date to preserve daily values
      // This allows tracking historical data per day instead of overwriting
      await supabaseAdmin.from("uchat_metrics").upsert({
        metric_type: "statistics",
        metric_key: "dashboard",
        metric_date: today,
        metric_value: statistics,
      }, {
        onConflict: "metric_type,metric_key,metric_date"
      });

      // Fetch active chats
      const activeChats = await client.getActiveChats();
      await supabaseAdmin.from("uchat_metrics").upsert({
        metric_type: "chats",
        metric_key: "active",
        metric_date: today,
        metric_value: {
          count: activeChats.length,
          data: activeChats,
        },
      }, {
        onConflict: "metric_type,metric_key,metric_date"
      });

      // Fetch all chats
      const allChats = await client.getChats({ limit: 1000 });
      await supabaseAdmin.from("uchat_metrics").upsert({
        metric_type: "chats",
        metric_key: "total",
        metric_date: today,
        metric_value: {
          count: allChats.length,
          data: allChats,
        },
      }, {
        onConflict: "metric_type,metric_key,metric_date"
      });

      // Analytics endpoint doesn't exist in Uchat API - skip it
      // Note: Analytics endpoint was removed as it returns 404 in Uchat API

      // Store aggregated insights
      await supabaseAdmin.from("aggregated_insights").upsert({
        insight_type: "chat_summary",
        insight_key: "uchat",
        insight_value: {
          total_chats: statistics.total_chats || allChats.length,
          active_chats: statistics.active_chats || activeChats.length,
          average_response_time: statistics.average_response_time,
          satisfaction_score: statistics.satisfaction_score,
          // Include all statistics fields from Uchat
          new_users_today: statistics.new_users_today || 0,
          total_messages_today: statistics.total_messages_today || 0,
          incoming_messages: statistics.incoming_messages || 0,
          agent_messages: statistics.agent_messages || 0,
          assigned_today: statistics.assigned_today || 0,
          resolved_today: statistics.resolved_today || 0,
          avg_resolve_time: statistics.avg_resolve_time || 0,
          emails_sent: statistics.emails_sent || 0,
          emails_opened: statistics.emails_opened || 0,
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

