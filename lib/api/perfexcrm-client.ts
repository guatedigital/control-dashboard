import axios, { AxiosInstance, AxiosError } from "axios";
import type {
  PerfexCRMConfig,
  PerfexCRMResponse,
  PerfexCRMCustomer,
  PerfexCRMInvoice,
  PerfexCRMLead,
} from "@/types/api";

export class PerfexCRMClient {
  private client: AxiosInstance;
  private config: PerfexCRMConfig;
  private baseURL: string; // Store normalized baseURL
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor(config: PerfexCRMConfig) {
    this.config = config;
    // Normalize baseURL - remove trailing /api if present to avoid double /api/api
    this.baseURL = config.apiUrl.replace(/\/api\/?$/, ''); // Remove trailing /api
    
    // PerfexCRM uses 'authtoken' header for authentication (per official API documentation)
    // Add browser-like headers to bypass Cloudflare protection
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json",
        "authtoken": config.apiKey,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": this.baseURL,
        "Origin": this.baseURL,
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
      const requestHeaders = error.config?.headers || {};
      
      console.error("[PerfexCRM Error Details]", {
        status,
        statusText: error.response.statusText,
        url: `${this.config.apiUrl}${requestUrl}`,
        headers: Object.keys(requestHeaders),
        responseData: typeof responseData === 'string' ? responseData.substring(0, 500) : responseData,
      });

      // Check if response is Cloudflare challenge
      const contentType = error.response.headers['content-type'] || '';
      const responseText = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
      const isCloudflareChallenge = contentType.includes('text/html') || 
                                   responseText.includes('Just a moment') || 
                                   responseText.includes('cf-challenge');

      // Extract error message, but truncate HTML responses
      let message = '';
      if (isCloudflareChallenge) {
        message = "Cloudflare is blocking the request. Please check IP restrictions and bot protection settings.";
      } else {
        message =
          (responseData as { message?: string })?.message ||
          (typeof responseData === 'string' 
            ? (responseData.includes('<!doctype') || responseData.includes('<html')
              ? 'Received HTML response instead of JSON'
              : responseData.substring(0, 200))
            : 'Unknown error') ||
          error.message;
      }

      // Create error with status code attached
      const customError = new Error(`PerfexCRM: ${message || `Request failed with status ${status}`}`) as Error & { statusCode?: number; isCloudflareChallenge?: boolean };
      customError.statusCode = status;
      customError.isCloudflareChallenge = isCloudflareChallenge;

      if (status === 401) {
        customError.message = "PerfexCRM: Authentication failed. Please check your API key.";
      } else if (status === 403) {
        if (isCloudflareChallenge) {
          customError.message = `PerfexCRM: Cloudflare protection is blocking the request. Please configure Cloudflare to allow API requests with 'authtoken' header.\n\nURL: ${this.config.apiUrl}${requestUrl}`;
        } else {
          customError.message = `PerfexCRM: Access forbidden (403). This usually means:\n1. API key is invalid or expired\n2. API key doesn't have required permissions\n3. IP restrictions are blocking the request\n4. Wrong authentication method\n\nURL: ${this.config.apiUrl}${requestUrl}\nResponse: ${message}`;
        }
      } else if (status === 429) {
        customError.message = "PerfexCRM: Rate limit exceeded. Please try again later.";
      } else if (status >= 500) {
        customError.message = `PerfexCRM: Server error (${status}). Please try again later.`;
      }

      throw customError;
    } else if (error.request) {
      // Request made but no response received
      const customError = new Error("PerfexCRM: No response from server. Please check your connection.") as Error & { statusCode?: number };
      customError.statusCode = 503;
      throw customError;
    } else {
      // Error setting up request
      const customError = new Error(`PerfexCRM: ${error.message}`) as Error & { statusCode?: number };
      customError.statusCode = 500;
      throw customError;
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
      const fullUrl = `${this.baseURL}${endpoint}`;
      console.log(`[PerfexCRM] Requesting: ${fullUrl}`);
      
      try {
        const response = await this.client.get<PerfexCRMResponse<T> | string>(endpoint);
        
        console.log(`[PerfexCRM] Response status: ${response.status}`);
        
        // Check if response is HTML (Cloudflare challenge or error page)
        const contentType = response.headers['content-type'] || '';
        let responseData: unknown = response.data;
        
        // If response.data is a string, check if it's HTML
        if (typeof responseData === 'string') {
          const responseText = responseData.trim();
          
          // Check for HTML indicators
          const isHTML = contentType.includes('text/html') || 
                         responseText.toLowerCase().startsWith('<!doctype') ||
                         responseText.toLowerCase().startsWith('<html') ||
                         responseText.includes('Just a moment') || 
                         responseText.includes('cf-challenge') ||
                         responseText.includes('<head>') ||
                         responseText.includes('<body>');
          
          if (isHTML) {
            const error = new Error("PerfexCRM: Received HTML response instead of JSON. This usually means:\n1. Cloudflare is blocking the request (check IP restrictions)\n2. The API endpoint is incorrect\n3. Bot protection is enabled\n\nPlease check your Cloudflare settings and ensure the API endpoint is accessible.") as Error & { statusCode?: number; isCloudflareChallenge?: boolean };
            error.statusCode = 403;
            error.isCloudflareChallenge = true;
            throw error;
          }
          
          // Try to parse as JSON
          try {
            responseData = JSON.parse(responseData);
          } catch (parseError) {
            const error = new Error(`PerfexCRM: Invalid response format. Expected JSON but received: ${contentType || 'unknown format'}`) as Error & { statusCode?: number };
            error.statusCode = 500;
            throw error;
          }
        }
        
        // Check if parsed data is HTML (in case axios parsed it as object but it's actually HTML)
        const dataString = JSON.stringify(responseData);
        if (dataString.includes('<!doctype') || dataString.includes('<html') || dataString.includes('<head>')) {
          const error = new Error("PerfexCRM: Received HTML response instead of JSON. Cloudflare may be blocking the request.") as Error & { statusCode?: number; isCloudflareChallenge?: boolean };
          error.statusCode = 403;
          error.isCloudflareChallenge = true;
          throw error;
        }
        
        console.log(`[PerfexCRM] Response data:`, dataString.substring(0, 500));
        
        // Handle different response formats
        if (responseData && typeof responseData === 'object') {
          // If response has success property
          if ('success' in responseData && (responseData as { success?: boolean }).success === false) {
            throw new Error(((responseData as { message?: string }).message) || "Request failed");
          }
          // If response has data property
          if ('data' in responseData) {
            return (responseData as { data: T }).data;
          }
          // If response is directly the data
          return responseData as T;
        }
        
        return responseData as T;
      } catch (error) {
        // Re-throw if it's already our custom error
        if (error instanceof Error && 'statusCode' in error) {
          throw error;
        }
        // Otherwise, let the error handler process it
        throw error;
      }
    });
  }

  // Get customers
  async getCustomers(params?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<PerfexCRMCustomer[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());
    if (params?.search) queryParams.append("search", params.search);

    const queryString = queryParams.toString() ? `?${queryParams}` : "";
    
    // PerfexCRM API uses /api/customers (not /api/v1/customers based on documentation)
    // Try different endpoint variations
    const endpoints = [
      `/api/customers${queryString}`,     // Standard PerfexCRM format (per documentation)
      `/api/v1/customers${queryString}`,  // Fallback: some versions use v1
      `/v1/customers${queryString}`,      // If baseURL already has /api
    ];

    // Try first endpoint, fallback to second if it fails
    let lastError: Error | null = null;
    for (const endpoint of endpoints) {
      try {
        return await this.get<PerfexCRMCustomer[]>(endpoint);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (endpoint !== endpoints[endpoints.length - 1]) {
          console.log(`[PerfexCRM] Endpoint ${endpoint} failed, trying next...`);
        }
      }
    }
    
    throw lastError || new Error("PerfexCRM: All endpoint variations failed");
  }

  // Get customer by ID
  async getCustomer(id: string): Promise<PerfexCRMCustomer> {
    const endpoints = [`/api/customers/${id}`, `/api/v1/customers/${id}`, `/v1/customers/${id}`];
    let lastError: Error | null = null;
    for (const endpoint of endpoints) {
      try {
        return await this.get<PerfexCRMCustomer>(endpoint);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (endpoint !== endpoints[endpoints.length - 1]) {
          continue;
        }
      }
    }
    throw lastError || new Error("PerfexCRM: Failed to get customer");
  }

  // Get invoices
  async getInvoices(params?: {
    limit?: number;
    offset?: number;
    status?: number;
  }): Promise<PerfexCRMInvoice[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());
    if (params?.status !== undefined)
      queryParams.append("status", params.status.toString());

    const queryString = queryParams.toString() ? `?${queryParams}` : "";
    const endpoints = [
      `/api/invoices${queryString}`,
      `/api/v1/invoices${queryString}`,
      `/v1/invoices${queryString}`,
    ];

    let lastError: Error | null = null;
    for (const endpoint of endpoints) {
      try {
        return await this.get<PerfexCRMInvoice[]>(endpoint);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (endpoint !== endpoints[endpoints.length - 1]) {
          continue;
        }
      }
    }
    throw lastError || new Error("PerfexCRM: Failed to get invoices");
  }

  // Get invoice by ID
  async getInvoice(id: string): Promise<PerfexCRMInvoice> {
    const endpoints = [`/api/invoices/${id}`, `/api/v1/invoices/${id}`, `/v1/invoices/${id}`];
    let lastError: Error | null = null;
    for (const endpoint of endpoints) {
      try {
        return await this.get<PerfexCRMInvoice>(endpoint);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (endpoint !== endpoints[endpoints.length - 1]) {
          continue;
        }
      }
    }
    throw lastError || new Error("PerfexCRM: Failed to get invoice");
  }

  // Get leads
  async getLeads(params?: {
    limit?: number;
    offset?: number;
    status?: number;
  }): Promise<PerfexCRMLead[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());
    if (params?.status !== undefined)
      queryParams.append("status", params.status.toString());

    const queryString = queryParams.toString() ? `?${queryParams}` : "";
    const endpoints = [
      `/api/leads${queryString}`,
      `/api/v1/leads${queryString}`,
      `/v1/leads${queryString}`,
    ];

    let lastError: Error | null = null;
    for (const endpoint of endpoints) {
      try {
        return await this.get<PerfexCRMLead[]>(endpoint);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (endpoint !== endpoints[endpoints.length - 1]) {
          continue;
        }
      }
    }
    throw lastError || new Error("PerfexCRM: Failed to get leads");
  }

  // Get lead by ID
  async getLead(id: string): Promise<PerfexCRMLead> {
    const endpoints = [`/api/leads/${id}`, `/api/v1/leads/${id}`, `/v1/leads/${id}`];
    let lastError: Error | null = null;
    for (const endpoint of endpoints) {
      try {
        return await this.get<PerfexCRMLead>(endpoint);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (endpoint !== endpoints[endpoints.length - 1]) {
          continue;
        }
      }
    }
    throw lastError || new Error("PerfexCRM: Failed to get lead");
  }

  // Get dashboard statistics (custom endpoint if available)
  async getStatistics(): Promise<Record<string, unknown>> {
    // Try statistics endpoint first with different variations
    const statEndpoints = [
      "/api/dashboard/statistics",
      "/api/v1/dashboard/statistics",
      "/v1/dashboard/statistics",
      "/api/statistics",
      "/api/v1/statistics",
      "/v1/statistics",
    ];

    for (const endpoint of statEndpoints) {
      try {
        return await this.get<Record<string, unknown>>(endpoint);
      } catch (error) {
        // Continue to next endpoint or fallback
        if (endpoint === statEndpoints[statEndpoints.length - 1]) {
          // If all statistics endpoints failed, calculate from other endpoints
          console.log("[PerfexCRM] Statistics endpoint not available, calculating from data...");
          const [customers, invoices, leads] = await Promise.all([
            this.getCustomers({ limit: 1 }),
            this.getInvoices({ limit: 1 }),
            this.getLeads({ limit: 1 }),
          ]);

          return {
            total_customers: customers.length,
            total_invoices: invoices.length,
            total_leads: leads.length,
          };
        }
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error("PerfexCRM: Failed to get statistics");
  }
}

