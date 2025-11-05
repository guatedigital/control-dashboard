import axios, { AxiosInstance, AxiosError } from "axios";
import type {
  UchatConfig,
  UchatResponse,
  UchatChat,
  UchatMessage,
  UchatAnalytics,
} from "@/types/api";

export class UchatClient {
  private client: AxiosInstance;
  private config: UchatConfig;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor(config: UchatConfig) {
    this.config = config;
    // Uchat API URL - normalize to remove trailing slashes
    // The baseURL should be the full API base URL (e.g., https://www.uchat.com.au/api)
    // We'll handle endpoint paths in each method to avoid duplication
    const baseURL = config.apiUrl.replace(/\/+$/, ''); // Remove trailing slashes
    
    this.client = axios.create({
      baseURL: baseURL,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.apiKey, // Uchat uses API token authentication
      },
      timeout: 30000,
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        return this.handleError(error);
      }
    );
  }

  private async handleError(error: AxiosError): Promise<never> {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const responseData = error.response.data;
      const requestUrl = error.config?.url || "unknown";
      
      // Log Uchat-specific error details
      console.error("[Uchat Error Details]", {
        status,
        statusText: error.response.statusText,
        url: `${this.config.apiUrl}${requestUrl}`,
        responseData: typeof responseData === 'string' ? responseData.substring(0, 500) : responseData,
      });

      const message =
        (responseData as { message?: string })?.message ||
        (typeof responseData === 'string' ? responseData.substring(0, 200) : 'Unknown error') ||
        error.message;

      if (status === 401) {
        throw new Error("Uchat: Authentication failed. Please check your API key.");
      } else if (status === 429) {
        throw new Error("Uchat: Rate limit exceeded. Please try again later.");
      } else if (status >= 500) {
        throw new Error(`Uchat: Server error (${status}). Please try again later.`);
      } else {
        throw new Error(`Uchat: ${message || `Request failed with status ${status}`}`);
      }
    } else if (error.request) {
      // Request made but no response received
      throw new Error("Uchat: No response from server. Please check your connection.");
    } else {
      // Error setting up request
      throw new Error(`Uchat: ${error.message}`);
    }
  }

  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    retries: number = this.maxRetries
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error) {
      if (retries > 0 && this.isRetryableError(error)) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        return this.retryRequest(requestFn, retries - 1);
      }
      throw error;
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("timeout") ||
        message.includes("network") ||
        message.includes("server error")
      );
    }
    return false;
  }

  // Generic GET request with retry logic
  private async get<T>(endpoint: string): Promise<T> {
    return this.retryRequest(async () => {
      const fullUrl = `${this.config.apiUrl}${endpoint}`;
      console.log(`[Uchat] Requesting: ${fullUrl}`);
      console.log(`[Uchat] Base URL: ${this.config.apiUrl}`);
      console.log(`[Uchat] Endpoint: ${endpoint}`);
      
      try {
        const response = await this.client.get<UchatResponse<T>>(endpoint);
        
        console.log(`[Uchat] Response status: ${response.status}`);
        console.log(`[Uchat] Response data:`, JSON.stringify(response.data).substring(0, 500));
        
        // Handle different response formats
        if (response.data && typeof response.data === 'object') {
          // If response has success property
          if ('success' in response.data && response.data.success === false) {
            throw new Error((response.data as { message?: string }).message || "Request failed");
          }
          // If response has data property
          if ('data' in response.data) {
            return (response.data as { data: T }).data;
          }
          // If response is directly the data
          return response.data as T;
        }
        
        return response.data as T;
      } catch (error: any) {
        // Log more details about the error
        if (error.response) {
          console.error(`[Uchat] Error response:`, {
            status: error.response.status,
            statusText: error.response.statusText,
            url: error.config?.url || fullUrl,
            baseURL: error.config?.baseURL,
            data: typeof error.response.data === 'string' 
              ? error.response.data.substring(0, 200) 
              : error.response.data,
          });
        }
        throw error;
      }
    });
  }

  // Get chats - Uchat doesn't have /chats endpoint, use conversations instead
  async getChats(params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<UchatChat[]> {
    // Uchat doesn't have a /chats endpoint
    // Instead, we can get conversations data or subscriber chat messages
    // For now, return empty array or get conversations data
    // This method may not be directly applicable to Uchat API structure
    console.warn("[Uchat] getChats called but Uchat doesn't have /chats endpoint. Use getConversationsData() instead.");
    return [];
  }
  
  // Get conversations data (Uchat's equivalent to chats)
  async getConversationsData(params?: {
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());

    const queryString = queryParams.toString() ? `?${queryParams}` : "";
    const endpoint = `/flow/conversations/data${queryString}`;
    
    try {
      return await this.get<any[]>(endpoint);
    } catch (error) {
      console.error("[Uchat] Failed to get conversations data:", error);
      throw error;
    }
  }

  // Get chat by ID
  async getChat(id: string): Promise<UchatChat> {
    return this.get<UchatChat>(`/chats/${id}`);
  }

  // Get messages for a chat
  async getChatMessages(
    chatId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<UchatMessage[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());

    const endpoint = `/chats/${chatId}/messages${
      queryParams.toString() ? `?${queryParams}` : ""
    }`;
    return this.get<UchatMessage[]>(endpoint);
  }

  // Get analytics
  async getAnalytics(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<UchatAnalytics> {
    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.append("start_date", params.start_date);
    if (params?.end_date) queryParams.append("end_date", params.end_date);

    const endpoint = `/analytics${queryParams.toString() ? `?${queryParams}` : ""}`;
    return this.get<UchatAnalytics>(endpoint);
  }

  // Get active chats - Uchat doesn't have this endpoint structure
  async getActiveChats(): Promise<UchatChat[]> {
    // Uchat uses conversations instead of chats
    try {
      const conversations = await this.getConversationsData();
      // Filter for active conversations if needed
      return conversations as UchatChat[];
    } catch (error) {
      console.error("[Uchat] Failed to get active chats:", error);
      return [];
    }
  }

  // Get chat statistics
  async getStatistics(): Promise<Record<string, unknown>> {
    try {
      // Try to get flow summary which contains analytics
      // The get() method extracts the 'data' property, so we get the array directly
      // Response structure from API: { data: [{ total_bot_users, day_active_bot_users, ... }], status: "ok" }
      // After get() extraction: [{ total_bot_users, day_active_bot_users, ... }]
      const flowSummaryArray = await this.get<any[]>("/flow-summary");
      
      // Extract the first summary item from the data array
      const flowSummary = Array.isArray(flowSummaryArray) && flowSummaryArray.length > 0
        ? flowSummaryArray[0]
        : (flowSummaryArray as any);
      
      console.log("[Uchat] Flow summary data:", flowSummary);
      console.log("[Uchat] Flow summary array:", flowSummaryArray);
      
      // Also try flow-agent-summary for additional metrics
      let flowAgentSummary: Record<string, unknown> | null = null;
      try {
        const agentSummaryArray = await this.get<any[]>("/flow-agent-summary");
        flowAgentSummary = Array.isArray(agentSummaryArray) && agentSummaryArray.length > 0
          ? agentSummaryArray[0]
          : (agentSummaryArray as any);
      } catch (e) {
        // Ignore if not available
        console.log("[Uchat] Flow agent summary not available");
      }

      // Get conversations data for chat counts (optional, as we can use flow summary data)
      let conversationsData: any[] = [];
      try {
        const conversationsResponse = await this.getConversationsData({ limit: 1000 });
        conversationsData = Array.isArray(conversationsResponse) ? conversationsResponse : [];
      } catch (e) {
        // Ignore if not available
        console.log("[Uchat] Conversations data not available");
      }

      // Map the flow summary data to dashboard format
      // flow-summary provides: total_bot_users, day_active_bot_users, day_total_messages, avg_agent_response_time, avg_resolve_time
      console.log("[Uchat] Mapping statistics:", {
        total_bot_users: flowSummary?.total_bot_users,
        day_active_bot_users: flowSummary?.day_active_bot_users,
        avg_agent_response_time: flowSummary?.avg_agent_response_time,
      });
      
      return {
        total_chats: flowSummary?.total_bot_users ?? (conversationsData.length > 0 ? conversationsData.length : 0),
        active_chats: flowSummary?.day_active_bot_users ?? (conversationsData.length > 0 ? conversationsData.filter((c: any) => c.status === 'active').length : 0),
        average_response_time: flowSummary?.avg_agent_response_time ?? flowAgentSummary?.avg_agent_response_time ?? 0,
        satisfaction_score: 0, // Not available in flow-summary, would need separate endpoint
      };
    } catch (error) {
      console.error("[Uchat] Failed to get statistics:", error);
      // Fallback: try to get conversations data directly
      try {
        const conversations = await this.getConversationsData({ limit: 100 });
        return {
          total_chats: Array.isArray(conversations) ? conversations.length : 0,
          active_chats: Array.isArray(conversations) ? conversations.filter((c: any) => c.status === 'active').length : 0,
          average_response_time: 0,
          satisfaction_score: 0,
        };
      } catch (fallbackError) {
        console.error("[Uchat] Fallback also failed:", fallbackError);
        // Return empty statistics
        return {
          total_chats: 0,
          active_chats: 0,
          average_response_time: 0,
          satisfaction_score: 0,
        };
      }
    }
  }
}

