// ⚠️ SECURITY WARNING: This browser client is DEPRECATED and should NOT be used
// It exposes the API key in the client-side JavaScript bundle, which is a critical security risk.
// 
// Use the server-side API routes (/api/perfexcrm) with authentication instead.
// This file is kept for reference only and should be removed in production.
//
// For Cloudflare challenges, whitelist Vercel IPs on PerfexCRM instead of using this client.
//
// Browser-compatible PerfexCRM client that makes requests directly from the browser
// This allows the browser to handle Cloudflare challenges automatically
// Note: Requires NEXT_PUBLIC_PERFEXCRM_API_KEY to be set in environment variables

export class PerfexCRMClientBrowser {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    // Get from environment variables (must be NEXT_PUBLIC_* to be available in browser)
    this.apiUrl = (process.env.NEXT_PUBLIC_PERFEXCRM_API_URL || "").replace(/\/api\/?$/, ''); // Remove trailing /api
    this.apiKey = process.env.NEXT_PUBLIC_PERFEXCRM_API_KEY || "";
    
    if (!this.apiUrl || !this.apiKey) {
      console.warn("[PerfexCRM Browser] Missing API configuration. Make sure NEXT_PUBLIC_PERFEXCRM_API_URL and NEXT_PUBLIC_PERFEXCRM_API_KEY are set.");
    }
  }

  private async fetchWithRetry<T>(
    endpoint: string,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    const fullUrl = `${this.apiUrl}${endpoint}`;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`[PerfexCRM Browser] Requesting (attempt ${attempt + 1}/${retries}): ${fullUrl}`);
        
        const response = await fetch(fullUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "authtoken": this.apiKey,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
          },
          credentials: "omit", // Don't send cookies
          mode: "cors", // Enable CORS
        });

        // Check if we got a Cloudflare challenge page
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          const text = await response.text();
          
          // Check for Cloudflare challenge indicators
          if (
            text.includes("Just a moment") ||
            text.includes("cf-challenge") ||
            text.includes("Checking your browser")
          ) {
            console.warn("[PerfexCRM Browser] Cloudflare challenge detected, waiting and retrying...");
            
            if (attempt < retries - 1) {
              // Wait a bit longer for Cloudflare to process
              await new Promise(resolve => setTimeout(resolve, delay * (attempt + 2)));
              continue;
            } else {
              throw new Error(
                "PerfexCRM: Cloudflare challenge detected. Please whitelist your IP or disable bot protection."
              );
            }
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Handle PerfexCRM response format
        if (data && typeof data === 'object') {
          if ('success' in data && data.success === false) {
            throw new Error(data.message || "Request failed");
          }
          if ('data' in data) {
            return data.data as T;
          }
          return data as T;
        }
        
        return data as T;
      } catch (error: any) {
        if (attempt === retries - 1) {
          throw error;
        }
        console.warn(`[PerfexCRM Browser] Attempt ${attempt + 1} failed, retrying...`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error("PerfexCRM: All retry attempts failed");
  }

  async getStatistics(): Promise<Record<string, unknown>> {
    const endpoints = [
      "/api/dashboard/statistics",
      "/api/v1/dashboard/statistics",
      "/api/statistics",
    ];

    for (const endpoint of endpoints) {
      try {
        return await this.fetchWithRetry<Record<string, unknown>>(endpoint);
      } catch (error) {
        if (endpoint === endpoints[endpoints.length - 1]) {
          // Last endpoint failed, try fallback
          console.log("[PerfexCRM Browser] Statistics endpoints failed, using fallback calculation");
          const [customers, invoices, leads] = await Promise.allSettled([
            this.getCustomers({ limit: 1 }).catch(() => []),
            this.getInvoices({ limit: 1 }).catch(() => []),
            this.getLeads({ limit: 1 }).catch(() => []),
          ]);

          return {
            total_customers: customers.status === 'fulfilled' ? customers.value.length : 0,
            total_invoices: invoices.status === 'fulfilled' ? invoices.value.length : 0,
            total_leads: leads.status === 'fulfilled' ? leads.value.length : 0,
          };
        }
      }
    }

    throw new Error("PerfexCRM: Failed to get statistics");
  }

  async getCustomers(params?: { limit?: number; offset?: number; search?: string }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());
    if (params?.search) queryParams.append("search", params.search);

    const queryString = queryParams.toString() ? `?${queryParams}` : "";
    const endpoints = [
      `/api/customers${queryString}`,
      `/api/v1/customers${queryString}`,
    ];

    for (const endpoint of endpoints) {
      try {
        return await this.fetchWithRetry<any[]>(endpoint);
      } catch (error) {
        if (endpoint === endpoints[endpoints.length - 1]) {
          throw error;
        }
      }
    }

    throw new Error("PerfexCRM: Failed to get customers");
  }

  async getInvoices(params?: { limit?: number; offset?: number; status?: number }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());
    if (params?.status !== undefined) queryParams.append("status", params.status.toString());

    const queryString = queryParams.toString() ? `?${queryParams}` : "";
    const endpoints = [
      `/api/invoices${queryString}`,
      `/api/v1/invoices${queryString}`,
    ];

    for (const endpoint of endpoints) {
      try {
        return await this.fetchWithRetry<any[]>(endpoint);
      } catch (error) {
        if (endpoint === endpoints[endpoints.length - 1]) {
          throw error;
        }
      }
    }

    throw new Error("PerfexCRM: Failed to get invoices");
  }

  async getLeads(params?: { limit?: number; offset?: number; status?: number }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());
    if (params?.status !== undefined) queryParams.append("status", params.status.toString());

    const queryString = queryParams.toString() ? `?${queryParams}` : "";
    const endpoints = [
      `/api/leads${queryString}`,
      `/api/v1/leads${queryString}`,
    ];

    for (const endpoint of endpoints) {
      try {
        return await this.fetchWithRetry<any[]>(endpoint);
      } catch (error) {
        if (endpoint === endpoints[endpoints.length - 1]) {
          throw error;
        }
      }
    }

    throw new Error("PerfexCRM: Failed to get leads");
  }
}

