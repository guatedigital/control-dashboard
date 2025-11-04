import { NextRequest, NextResponse } from "next/server";
import { PerfexCRMClient } from "@/lib/api/perfexcrm-client";

const perfexcrmConfig = {
  apiUrl: process.env.NEXT_PUBLIC_PERFEXCRM_API_URL || "",
  apiKey: process.env.PERFEXCRM_API_KEY || "",
};

export async function GET(request: NextRequest) {
  try {
    if (!perfexcrmConfig.apiUrl || !perfexcrmConfig.apiKey) {
      return NextResponse.json(
        { error: "PerfexCRM API configuration is missing" },
        { status: 500 }
      );
    }

    const client = new PerfexCRMClient(perfexcrmConfig);
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get("endpoint") || "statistics";
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : undefined;
    const offset = searchParams.get("offset")
      ? parseInt(searchParams.get("offset")!)
      : undefined;
    const status = searchParams.get("status")
      ? parseInt(searchParams.get("status")!)
      : undefined;

    let data;

    switch (endpoint) {
      case "customers":
        data = await client.getCustomers({ limit, offset });
        break;
      case "invoices":
        data = await client.getInvoices({ limit, offset, status });
        break;
      case "leads":
        data = await client.getLeads({ limit, offset, status });
        break;
      case "statistics":
        data = await client.getStatistics();
        break;
      default:
        return NextResponse.json(
          { error: `Unknown endpoint: ${endpoint}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("PerfexCRM API error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

