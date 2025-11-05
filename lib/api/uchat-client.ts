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
        "X-API-Key": config.apiKey,
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
      const message =
        (error.response.data as { message?: string })?.message ||
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
    });
  }

  // Get chats
  async getChats(params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<UchatChat[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());
    if (params?.status) queryParams.append("status", params.status);

    const queryString = queryParams.toString() ? `?${queryParams}` : "";
    
    // Check if baseURL already ends with /api
    const baseURL = this.config.apiUrl;
    const hasApiInBase = baseURL.endsWith('/api');
    
    // Try different endpoint paths based on baseURL structure
    const endpoints = hasApiInBase
      ? [
          `/chats${queryString}`,  // If baseURL has /api, use /chats
        ]
      : [
          `/chats${queryString}`,  // If baseURL doesn't have /api, try /chats first
          `/api/chats${queryString}`,  // Then try /api/chats
        ];

    // Try first endpoint, fallback to others if it fails
    let lastError: Error | null = null;
    for (const endpoint of endpoints) {
      try {
        return await this.get<UchatChat[]>(endpoint);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // If this is the last endpoint, we'll throw below
        if (endpoint !== endpoints[endpoints.length - 1]) {
          console.log(`[Uchat] Endpoint ${endpoint} failed, trying next...`);
        }
      }
    }
    
    // If all endpoints failed, throw the last error
    throw lastError || new Error("Uchat: All endpoint variations failed");
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

  // Get active chats
  async getActiveChats(): Promise<UchatChat[]> {
    return this.getChats({ status: "active" });
  }

  // Get chat statistics
  async getStatistics(): Promise<Record<string, unknown>> {
    try {
      const analytics = await this.getAnalytics();
      const activeChats = await this.getActiveChats();

      return {
        total_chats: analytics.total_chats,
        active_chats: activeChats.length,
        average_response_time: analytics.average_response_time,
        satisfaction_score: analytics.satisfaction_score,
      };
    } catch (error) {
      // Fallback if analytics endpoint doesn't exist
      const chats = await this.getChats();
      const activeChats = chats.filter((chat) => chat.status === "active");

      return {
        total_chats: chats.length,
        active_chats: activeChats.length,
      };
    }
  }
}

