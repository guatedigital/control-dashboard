import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify-auth";

export async function GET(request: NextRequest) {
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

