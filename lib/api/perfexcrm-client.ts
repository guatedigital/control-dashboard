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
      
      const response = await this.client.get<PerfexCRMResponse<T>>(endpoint);
      
      console.log(`[PerfexCRM] Response status: ${response.status}`);
      
      // Check if response is HTML (Cloudflare challenge)
      const contentType = response.headers['content-type'] || '';
      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      
      if (contentType.includes('text/html') || responseText.includes('Just a moment') || responseText.includes('cf-challenge')) {
        throw new Error("PerfexCRM: Cloudflare protection is blocking the request. Please check:\n1. IP restrictions in Cloudflare\n2. Firewall rules\n3. Consider using a different API endpoint or whitelisting Vercel IPs");
      }
      
      console.log(`[PerfexCRM] Response data:`, responseText.substring(0, 500));
      
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

