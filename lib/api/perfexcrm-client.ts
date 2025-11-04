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
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
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
        throw new Error("PerfexCRM: Authentication failed. Please check your API key.");
      } else if (status === 429) {
        throw new Error("PerfexCRM: Rate limit exceeded. Please try again later.");
      } else if (status >= 500) {
        throw new Error(`PerfexCRM: Server error (${status}). Please try again later.`);
      } else {
        throw new Error(`PerfexCRM: ${message || `Request failed with status ${status}`}`);
      }
    } else if (error.request) {
      // Request made but no response received
      throw new Error("PerfexCRM: No response from server. Please check your connection.");
    } else {
      // Error setting up request
      throw new Error(`PerfexCRM: ${error.message}`);
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
      const response = await this.client.get<PerfexCRMResponse<T>>(endpoint);
      if (response.data.success === false) {
        throw new Error(response.data.message || "Request failed");
      }
      return response.data.data as T;
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

    const endpoint = `/api/customers${queryParams.toString() ? `?${queryParams}` : ""}`;
    return this.get<PerfexCRMCustomer[]>(endpoint);
  }

  // Get customer by ID
  async getCustomer(id: string): Promise<PerfexCRMCustomer> {
    return this.get<PerfexCRMCustomer>(`/api/customers/${id}`);
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

    const endpoint = `/api/invoices${queryParams.toString() ? `?${queryParams}` : ""}`;
    return this.get<PerfexCRMInvoice[]>(endpoint);
  }

  // Get invoice by ID
  async getInvoice(id: string): Promise<PerfexCRMInvoice> {
    return this.get<PerfexCRMInvoice>(`/api/invoices/${id}`);
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

    const endpoint = `/api/leads${queryParams.toString() ? `?${queryParams}` : ""}`;
    return this.get<PerfexCRMLead[]>(endpoint);
  }

  // Get lead by ID
  async getLead(id: string): Promise<PerfexCRMLead> {
    return this.get<PerfexCRMLead>(`/api/leads/${id}`);
  }

  // Get dashboard statistics (custom endpoint if available)
  async getStatistics(): Promise<Record<string, unknown>> {
    try {
      return await this.get<Record<string, unknown>>("/api/dashboard/statistics");
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

