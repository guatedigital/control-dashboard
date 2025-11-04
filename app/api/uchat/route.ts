import { NextRequest, NextResponse } from "next/server";
import { UchatClient } from "@/lib/api/uchat-client";

const uchatConfig = {
  apiUrl: process.env.NEXT_PUBLIC_UCHAT_API_URL || "",
  apiKey: process.env.UCHAT_API_KEY || "",
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get("endpoint") || "statistics";
  
  try {
    if (!uchatConfig.apiUrl || !uchatConfig.apiKey) {
      return NextResponse.json(
        { error: "Uchat API configuration is missing" },
        { status: 500 }
      );
    }

    const client = new UchatClient(uchatConfig);
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : undefined;
    const offset = searchParams.get("offset")
      ? parseInt(searchParams.get("offset")!)
      : undefined;
    const status = searchParams.get("status") || undefined;

    let data;

    switch (endpoint) {
      case "chats":
        data = await client.getChats({ limit, offset, status });
        break;
      case "analytics":
        const startDate = searchParams.get("start_date") || undefined;
        const endDate = searchParams.get("end_date") || undefined;
        data = await client.getAnalytics({ start_date: startDate, end_date: endDate });
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
    console.error("Uchat API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    const errorDetails = {
      success: false,
      error: errorMessage,
      endpoint,
      config: {
        apiUrl: uchatConfig.apiUrl ? "configured" : "missing",
        apiKey: uchatConfig.apiKey ? "configured" : "missing",
      },
    };
    return NextResponse.json(errorDetails, { status: 500 });
  }
}

