import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify-auth";
import { withRateLimit, RateLimitPresets } from "@/lib/utils/rate-limit-middleware";

async function handleCheck(request: NextRequest) {
  const authResult = await verifyAuth(request);

  if (!authResult.authorized) {
    const status = authResult.error === "Account not authorized" ? 403 : 401;
    return NextResponse.json(
      { authorized: false, error: authResult.error },
      { status }
    );
  }

  return NextResponse.json({
    authorized: true,
    user: authResult.user,
  });
}

// Apply rate limiting (100 requests per minute per IP)
export async function GET(request: NextRequest) {
  return withRateLimit(
    request,
    {
      ...RateLimitPresets.standard,
      requireAuth: false, // This endpoint is used to check auth, so it can't require auth
    },
    handleCheck
  );
}

