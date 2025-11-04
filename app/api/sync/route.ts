import { NextRequest, NextResponse } from "next/server";
import { getDataSyncService } from "@/lib/services/data-sync";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const source = body.source || "all"; // 'perfexcrm', 'uchat', or 'all'

    const syncService = getDataSyncService();
    let results;

    if (source === "perfexcrm") {
      results = [await syncService.syncPerfexCRM()];
    } else if (source === "uchat") {
      results = [await syncService.syncUchat()];
    } else {
      results = await syncService.syncAll();
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Sync error:", error);
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
