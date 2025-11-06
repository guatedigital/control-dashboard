import axios, { AxiosInstance, AxiosError } from "axios";
import type {
  UchatConfig,
  UchatResponse,
  UchatChat,
  UchatMessage,
  UchatAnalytics,
  UchatAgentActivityLog,
  UchatCustomEventSummary,
  UchatCustomEventData,
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
        "Authorization": `Bearer ${config.apiKey}`, // Uchat uses Bearer token authentication
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
        console.log(`[Uchat] Response data (raw):`, JSON.stringify(response.data).substring(0, 500));
        
        // Handle different response formats
        if (response.data && typeof response.data === 'object') {
          // If response has success property
          if ('success' in response.data && response.data.success === false) {
            throw new Error((response.data as { message?: string }).message || "Request failed");
          }
          // If response has data property
          if ('data' in response.data) {
            const extracted = (response.data as { data: T }).data;
            console.log(`[Uchat] Extracted data property:`, {
              type: typeof extracted,
              isArray: Array.isArray(extracted),
              sample: Array.isArray(extracted) && extracted.length > 0
                ? JSON.stringify(extracted[0]).substring(0, 200)
                : typeof extracted === 'object'
                ? JSON.stringify(extracted).substring(0, 200)
                : String(extracted).substring(0, 200),
            });
            return extracted;
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
      const result = await this.get<any>(endpoint);
      
      // Debug: Log raw result structure
      console.log("[Uchat] Raw conversations data result:", {
        type: typeof result,
        isArray: Array.isArray(result),
        isObject: result && typeof result === 'object',
        keys: result && typeof result === 'object' && !Array.isArray(result) ? Object.keys(result) : 'N/A',
        length: Array.isArray(result) ? result.length : 'N/A',
        sample: Array.isArray(result) && result.length > 0
          ? JSON.stringify(result[0]).substring(0, 200)
          : result && typeof result === 'object'
          ? JSON.stringify(result).substring(0, 200)
          : String(result).substring(0, 200),
      });
      
      // Normalize response to always return an array
      // Handle both array and single object responses
      if (Array.isArray(result)) {
        return result;
      } else if (result && typeof result === 'object') {
        // If it's a single object, wrap it in an array
        return [result];
      }
      return [];
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
  // Note: flow-summary accepts 'range' parameter (default is 'yesterday' if not specified)
  // Available ranges: 'yesterday', 'last_7_days', 'last_week', 'last_30_days', 'last_month', 'last_3_months'
  // If no range is specified, the API defaults to 'yesterday' which may show stale data
  async getStatistics(params?: {
    range?: string; // Optional: date range for statistics. Options: 'yesterday', 'last_7_days', 'last_week', 'last_30_days', 'last_month', 'last_3_months'
    flow_ns?: string; // Optional: filter by specific bot flow namespace (e.g., 'f45936')
  }): Promise<Record<string, unknown>> {
    try {
      // Only add range parameter if explicitly provided
      // If not provided, API will use its default (which is 'yesterday')
      const range = params?.range;
      
      // Get today's and yesterday's dates for comparison
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      if (range) {
        queryParams.append("range", range);
      }
      if (params?.flow_ns) {
        queryParams.append("flow_ns", params.flow_ns);
      }
      const queryString = queryParams.toString() ? `?${queryParams}` : "";
      
      // Try to get flow summary which contains analytics
      // The get() method extracts the 'data' property, so we get the array directly
      // Response structure from API: { data: [{ total_bot_users, day_active_bot_users, ... }], status: "ok" }
      // After get() extraction: [{ total_bot_users, day_active_bot_users, ... }]
      let flowSummaryArray = await this.get<any[]>(`/flow-summary${queryString}`);
      
      // If using 'last_7_days' and we don't find today's or yesterday's data, try 'yesterday' as fallback
      // This is because 'last_7_days' might return aggregated or older data
      if (range === 'last_7_days') {
        let hasRecentData = false;
        if (Array.isArray(flowSummaryArray)) {
          hasRecentData = flowSummaryArray.some((item: any) => 
            item.summary_date === today || item.summary_date === yesterday
          );
        } else if (flowSummaryArray && typeof flowSummaryArray === 'object') {
          const flowObj = flowSummaryArray as any;
          hasRecentData = flowObj.summary_date === today || flowObj.summary_date === yesterday;
        }
        
        if (!hasRecentData) {
          console.log("[Uchat] last_7_days doesn't contain today/yesterday data, trying 'yesterday' range");
          const yesterdayParams = new URLSearchParams();
          if (params?.flow_ns) {
            yesterdayParams.append("flow_ns", params.flow_ns);
          }
          yesterdayParams.append("range", "yesterday");
          const yesterdayQueryString = `?${yesterdayParams}`;
          flowSummaryArray = await this.get<any[]>(`/flow-summary${yesterdayQueryString}`);
          console.log("[Uchat] Using 'yesterday' range data instead");
        }
      }
      
      // For ranges like 'last_7_days', the API might return an array or a single object
      // We need to find today's data (most recent date) instead of just taking the first item
      let flowSummary: any;
      
      console.log("[Uchat] Looking for data for today:", today, "or yesterday:", yesterday);
      console.log("[Uchat] Flow summary array type:", Array.isArray(flowSummaryArray) ? "array" : typeof flowSummaryArray);
      console.log("[Uchat] Flow summary array length:", Array.isArray(flowSummaryArray) ? flowSummaryArray.length : 'N/A');
      
      if (Array.isArray(flowSummaryArray) && flowSummaryArray.length > 0) {
        // Log all dates in the array for debugging
        const dates = flowSummaryArray.map((item: any, index: number) => ({
          index,
          summary_date: item.summary_date,
          day_done: item.day_done,
          avg_agent_response_time: item.avg_agent_response_time,
        }));
        console.log("[Uchat] All dates in array:", JSON.stringify(dates, null, 2));
        
        // Try to find today's data first
        flowSummary = flowSummaryArray.find((item: any) => item.summary_date === today);
        
        // If today's data not found, try yesterday
        if (!flowSummary) {
          flowSummary = flowSummaryArray.find((item: any) => item.summary_date === yesterday);
          if (flowSummary) {
            console.log("[Uchat] Using yesterday's data:", flowSummary.summary_date);
          }
        } else {
          console.log("[Uchat] Using today's data:", flowSummary.summary_date);
        }
        
        // If still not found, find the most recent date
        if (!flowSummary) {
          // Sort by summary_date descending to get most recent
          const sorted = [...flowSummaryArray].sort((a: any, b: any) => {
            const dateA = a.summary_date || '';
            const dateB = b.summary_date || '';
            return dateB.localeCompare(dateA);
          });
          flowSummary = sorted[0];
          console.log("[Uchat] Today/yesterday not found, using most recent date:", flowSummary?.summary_date);
        }
      } else if (flowSummaryArray && typeof flowSummaryArray === 'object' && !Array.isArray(flowSummaryArray)) {
        // Single object response (not an array)
        flowSummary = flowSummaryArray;
        console.log("[Uchat] Single object response, summary_date:", flowSummary.summary_date);
      } else {
        flowSummary = flowSummaryArray as any;
      }
      
      console.log("[Uchat] Selected flow summary data:", {
        summary_date: flowSummary?.summary_date,
        day_done: flowSummary?.day_done,
        day_assigned: flowSummary?.day_assigned,
        avg_agent_response_time: flowSummary?.avg_agent_response_time,
        avg_resolve_time: flowSummary?.avg_resolve_time,
        day_new_bot_users: flowSummary?.day_new_bot_users,
        day_total_messages: flowSummary?.day_total_messages,
      });
      
      // Also try flow-agent-summary for additional metrics (with same range parameters)
      let flowAgentSummary: Record<string, unknown> | null = null;
      try {
        const agentSummaryArray = await this.get<any[]>(`/flow-agent-summary${queryString}`);
        flowAgentSummary = Array.isArray(agentSummaryArray) && agentSummaryArray.length > 0
          ? agentSummaryArray[0]
          : (agentSummaryArray as any);
      } catch (e) {
        // Ignore if not available
        console.log("[Uchat] Flow agent summary not available");
      }

      // Get conversations data for chat counts (optional, as we can use flow summary data)
      let conversationsData: any[] = [];
      let totalOpens = 0;
      try {
        // Fetch conversations - try with a larger limit first
        // Note: The API might return paginated results, so we fetch as many as possible
        const conversationsResponse = await this.getConversationsData({ limit: 1000 });
        conversationsData = conversationsResponse;
        
        // Debug: Log the structure of the conversations data
        console.log("[Uchat] Conversations response structure:", {
          isArray: Array.isArray(conversationsResponse),
          length: Array.isArray(conversationsResponse) ? conversationsResponse.length : 'N/A',
          firstItem: Array.isArray(conversationsResponse) && conversationsResponse.length > 0 
            ? Object.keys(conversationsResponse[0]) 
            : conversationsResponse && typeof conversationsResponse === 'object'
            ? Object.keys(conversationsResponse)
            : [],
          sampleData: Array.isArray(conversationsResponse) && conversationsResponse.length > 0
            ? JSON.stringify(conversationsResponse[0]).substring(0, 300)
            : conversationsResponse && typeof conversationsResponse === 'object'
            ? JSON.stringify(conversationsResponse).substring(0, 300)
            : String(conversationsResponse).substring(0, 300),
        });
        
        // Calculate total number_of_opens from all conversations
        // Handle both array and single object responses
        if (Array.isArray(conversationsResponse)) {
          totalOpens = conversationsResponse.reduce((sum: number, conv: any, index: number) => {
            // Handle different response structures:
            // 1. Direct object with number_of_opens: { number_of_opens: 0, ... }
            // 2. Object with nested data: { data: { number_of_opens: 0, ... } }
            const opens = conv?.number_of_opens ?? conv?.data?.number_of_opens ?? 0;
            const opensValue = typeof opens === 'number' ? opens : 0;
            
            // Debug: Log first few conversations
            if (index < 3) {
              console.log(`[Uchat] Conversation ${index}:`, { 
                convKeys: Object.keys(conv || {}), 
                hasNumber_of_opens: 'number_of_opens' in (conv || {}),
                hasData: 'data' in (conv || {}),
                number_of_opens: conv?.number_of_opens,
                data_number_of_opens: conv?.data?.number_of_opens,
                extractedValue: opensValue 
              });
            }
            
            return sum + opensValue;
          }, 0);
        } else if (conversationsResponse && typeof conversationsResponse === 'object' && !Array.isArray(conversationsResponse)) {
          // Single conversation object
          const convObj = conversationsResponse as any;
          const opens = convObj?.number_of_opens ?? convObj?.data?.number_of_opens ?? 0;
          totalOpens = typeof opens === 'number' ? opens : 0;
          console.log("[Uchat] Single conversation object:", {
            keys: Object.keys(convObj),
            number_of_opens: convObj?.number_of_opens,
            data_number_of_opens: convObj?.data?.number_of_opens,
            extractedValue: totalOpens,
          });
        }
        
        console.log("[Uchat] Total number_of_opens calculated:", totalOpens, "from", 
          Array.isArray(conversationsResponse) ? conversationsResponse.length : 1, "conversation(s)");
      } catch (e) {
        // Ignore if not available
        console.log("[Uchat] Conversations data not available:", e);
      }

      // Map the flow summary data to dashboard format
      // flow-summary provides: total_bot_users, day_active_bot_users, day_new_bot_users, day_total_messages, 
      // day_in_messages, day_out_messages, day_agent_messages, day_assigned, day_done, avg_agent_response_time, avg_resolve_time
      console.log("[Uchat] Mapping statistics:", {
        range: params?.range || "default (yesterday)",
        total_bot_users: flowSummary?.total_bot_users,
        day_active_bot_users: flowSummary?.day_active_bot_users,
        day_new_bot_users: flowSummary?.day_new_bot_users,
        day_total_messages: flowSummary?.day_total_messages,
        day_assigned: flowSummary?.day_assigned,
        day_done: flowSummary?.day_done,
        avg_agent_response_time: flowSummary?.avg_agent_response_time,
        avg_resolve_time: flowSummary?.avg_resolve_time,
        number_of_opens: totalOpens,
        fullFlowSummary: JSON.stringify(flowSummary).substring(0, 500),
      });
      
      return {
        total_chats: flowSummary?.total_bot_users ?? (conversationsData.length > 0 ? conversationsData.length : 0),
        active_chats: flowSummary?.day_active_bot_users ?? (conversationsData.length > 0 ? conversationsData.filter((c: any) => c.status === 'active').length : 0),
        average_response_time: flowSummary?.avg_agent_response_time ?? flowAgentSummary?.avg_agent_response_time ?? 0,
        satisfaction_score: 0, // Not available in flow-summary, would need separate endpoint
        // Additional metrics from flow-summary
        new_users_today: flowSummary?.day_new_bot_users ?? 0,
        total_messages_today: flowSummary?.day_total_messages ?? 0,
        incoming_messages: flowSummary?.day_in_messages ?? 0,
        agent_messages: flowSummary?.day_agent_messages ?? 0,
        assigned_today: flowSummary?.day_assigned ?? 0,
        resolved_today: flowSummary?.day_done ?? 0,
        avg_resolve_time: flowSummary?.avg_resolve_time ?? 0,
        emails_sent: flowSummary?.day_email_sent ?? 0,
        emails_opened: flowSummary?.day_email_open ?? 0,
        number_of_opens: totalOpens,
      };
    } catch (error) {
      console.error("[Uchat] Failed to get statistics:", error);
      // Fallback: try to get conversations data directly
      try {
        const conversations = await this.getConversationsData({ limit: 100 });
        // getConversationsData always returns an array
        const totalOpens = conversations.reduce((sum: number, conv: any) => {
          const opens = conv?.number_of_opens ?? conv?.data?.number_of_opens ?? 0;
          return sum + (typeof opens === 'number' ? opens : 0);
        }, 0);
        return {
          total_chats: conversations.length,
          active_chats: conversations.filter((c: any) => c.status === 'active').length,
          average_response_time: 0,
          satisfaction_score: 0,
          new_users_today: 0,
          total_messages_today: 0,
          incoming_messages: 0,
          agent_messages: 0,
          assigned_today: 0,
          resolved_today: 0,
          avg_resolve_time: 0,
          emails_sent: 0,
          emails_opened: 0,
          number_of_opens: totalOpens,
        };
      } catch (fallbackError) {
        console.error("[Uchat] Fallback also failed:", fallbackError);
        // Return empty statistics
        return {
          total_chats: 0,
          active_chats: 0,
          average_response_time: 0,
          satisfaction_score: 0,
          new_users_today: 0,
          total_messages_today: 0,
          incoming_messages: 0,
          agent_messages: 0,
          assigned_today: 0,
          resolved_today: 0,
          avg_resolve_time: 0,
          emails_sent: 0,
          emails_opened: 0,
          number_of_opens: 0,
        };
      }
    }
  }

  // Get agent activity log data
  async getAgentActivityLogData(params?: {
    limit?: number;
    offset?: number;
    agent_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<UchatAgentActivityLog[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());
    if (params?.agent_id) queryParams.append("agent_id", params.agent_id);
    if (params?.start_date) queryParams.append("start_date", params.start_date);
    if (params?.end_date) queryParams.append("end_date", params.end_date);

    const queryString = queryParams.toString() ? `?${queryParams}` : "";
    const endpoint = `/flow/agent-activity-log/data${queryString}`;
    
    try {
      const result = await this.get<any>(endpoint);
      // Handle both array and object responses
      if (Array.isArray(result)) {
        return result;
      } else if (result && typeof result === 'object' && 'data' in result) {
        return Array.isArray(result.data) ? result.data : [result.data];
      }
      return [];
    } catch (error) {
      console.error("[Uchat] Failed to get agent activity log data:", error);
      throw error;
    }
  }

  // Get custom events summary
  // Note: Requires event_ns parameter (required) and uses range instead of dates
  // Range options: "yesterday", "last_7_days", "last_week", "last_30_days", "last_month", "last_3_months"
  async getCustomEventsSummary(params?: {
    event_ns: string; // Required: the custom event ns
    range?: string; // Optional: "yesterday" (default), "last_7_days", "last_week", "last_30_days", "last_month", "last_3_months"
  }): Promise<UchatCustomEventSummary[]> {
    if (!params?.event_ns) {
      throw new Error("Uchat: event_ns parameter is required for custom events summary");
    }

    const queryParams = new URLSearchParams();
    queryParams.append("event_ns", params.event_ns);
    if (params?.range) queryParams.append("range", params.range);

    const queryString = queryParams.toString() ? `?${queryParams}` : "";
    const endpoint = `/flow/custom-events/summary${queryString}`;
    
    try {
      const result = await this.get<any>(endpoint);
      // Handle both array and object responses
      if (Array.isArray(result)) {
        return result;
      } else if (result && typeof result === 'object' && 'data' in result) {
        return Array.isArray(result.data) ? result.data : [result.data];
      }
      return [];
    } catch (error) {
      console.error("[Uchat] Failed to get custom events summary:", error);
      throw error;
    }
  }

  // Get custom events data (detailed)
  // Note: Requires event_ns parameter (required) and uses Unix timestamps for dates
  async getCustomEventsData(params?: {
    event_ns: string; // Required: the custom event ns
    limit?: number; // Optional: Number of items (1-100)
    start_time?: number; // Optional: Unix timestamp (between 6 months ago and now)
    end_time?: number; // Optional: Unix timestamp (between 6 months ago and now)
    start_id?: number; // Optional: Starting from id
  }): Promise<UchatCustomEventData[]> {
    if (!params?.event_ns) {
      throw new Error("Uchat: event_ns parameter is required for custom events data");
    }

    const queryParams = new URLSearchParams();
    queryParams.append("event_ns", params.event_ns);
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.start_time) queryParams.append("start_time", params.start_time.toString());
    if (params?.end_time) queryParams.append("end_time", params.end_time.toString());
    if (params?.start_id) queryParams.append("start_id", params.start_id.toString());

    const queryString = queryParams.toString() ? `?${queryParams}` : "";
    const endpoint = `/flow/custom-events/data${queryString}`;
    
    try {
      const result = await this.get<any>(endpoint);
      // Handle both array and object responses
      if (Array.isArray(result)) {
        return result;
      } else if (result && typeof result === 'object' && 'data' in result) {
        return Array.isArray(result.data) ? result.data : [result.data];
      }
      return [];
    } catch (error) {
      console.error("[Uchat] Failed to get custom events data:", error);
      throw error;
    }
  }
}

