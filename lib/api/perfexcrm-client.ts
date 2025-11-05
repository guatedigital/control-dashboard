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
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor(config: PerfexCRMConfig) {
    this.config = config;
    // PerfexCRM uses X-API-KEY header for authentication
    // Add browser-like headers to bypass Cloudflare protection
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": config.apiKey,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": config.apiUrl.replace("/api", ""),
        "Origin": config.apiUrl.replace("/api", ""),
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

      const message =
        (responseData as { message?: string })?.message ||
        (typeof responseData === 'string' ? responseData.substring(0, 200) : 'Unknown error') ||
        error.message;

      // Create error with status code attached
      const customError = new Error(`PerfexCRM: ${message || `Request failed with status ${status}`}`) as Error & { statusCode?: number; isCloudflareChallenge?: boolean };
      customError.statusCode = status;
      customError.isCloudflareChallenge = isCloudflareChallenge;

      if (status === 401) {
        customError.message = "PerfexCRM: Authentication failed. Please check your API key.";
      } else if (status === 403) {
        if (isCloudflareChallenge) {
          customError.message = `PerfexCRM: Cloudflare protection is blocking the request. Please configure Cloudflare to allow API requests with X-API-KEY header.\n\nURL: ${this.config.apiUrl}${requestUrl}`;
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
      const fullUrl = `${this.config.apiUrl}${endpoint}`;
      console.log(`[PerfexCRM] Requesting: ${fullUrl}`);
      
      try {
        const response = await this.client.get<PerfexCRMResponse<T>>(endpoint);
        
        console.log(`[PerfexCRM] Response status: ${response.status}`);
        
        // Check if response is HTML (Cloudflare challenge or error page)
        const contentType = response.headers['content-type'] || '';
        let responseData = response.data;
        
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
          if ('success' in responseData && responseData.success === false) {
            throw new Error((responseData as { message?: string }).message || "Request failed");
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

    // Try with /v1/ prefix first, fallback to direct path
    const endpoint = `/v1/customers${queryParams.toString() ? `?${queryParams}` : ""}`;
    return this.get<PerfexCRMCustomer[]>(endpoint);
  }

  // Get customer by ID
  async getCustomer(id: string): Promise<PerfexCRMCustomer> {
    return this.get<PerfexCRMCustomer>(`/v1/customers/${id}`);
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

    const endpoint = `/v1/invoices${queryParams.toString() ? `?${queryParams}` : ""}`;
    return this.get<PerfexCRMInvoice[]>(endpoint);
  }

  // Get invoice by ID
  async getInvoice(id: string): Promise<PerfexCRMInvoice> {
    return this.get<PerfexCRMInvoice>(`/v1/invoices/${id}`);
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

    const endpoint = `/v1/leads${queryParams.toString() ? `?${queryParams}` : ""}`;
    return this.get<PerfexCRMLead[]>(endpoint);
  }

  // Get lead by ID
  async getLead(id: string): Promise<PerfexCRMLead> {
    return this.get<PerfexCRMLead>(`/v1/leads/${id}`);
  }

  // Get dashboard statistics (custom endpoint if available)
  async getStatistics(): Promise<Record<string, unknown>> {
    try {
      return await this.get<Record<string, unknown>>("/v1/dashboard/statistics");
    } catch (error) {
      // If statistics endpoint doesn't exist, calculate from other endpoints
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

