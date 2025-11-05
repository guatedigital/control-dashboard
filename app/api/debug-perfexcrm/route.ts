import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { verifyAuth } from "@/lib/auth/verify-auth";
import { withRateLimit, RateLimitPresets } from "@/lib/utils/rate-limit-middleware";

async function handleDebug(request: NextRequest) {
  // Verify authentication - debug endpoints should be protected
  const authResult = await verifyAuth(request);
  
  if (!authResult.authorized) {
    const status = authResult.error === "Account not authorized" ? 403 : 401;
    return NextResponse.json(
      { 
        error: authResult.error || "Unauthorized",
        message: "Authentication required to access this debug endpoint"
      },
      { status }
    );
  }
  const apiUrl = process.env.NEXT_PUBLIC_PERFEXCRM_API_URL || "";
  const apiKey = process.env.PERFEXCRM_API_KEY || "";

  if (!apiUrl || !apiKey) {
    return NextResponse.json({
      error: "Missing configuration",
      apiUrl: apiUrl || "NOT SET",
      apiKey: apiKey ? "SET" : "NOT SET",
    });
  }

  // Test different authentication methods
  const tests = [];

  // Normalize baseURL - remove trailing /api if present
  const baseURL = apiUrl.replace(/\/api\/?$/, '');

  // Test 1: authtoken header with /api/customers (per official API documentation)
  try {
    const response1 = await axios.get(`${baseURL}/api/customers`, {
      headers: {
        "authtoken": apiKey,
        "Content-Type": "application/json",
      },
      validateStatus: () => true, // Don't throw on any status
    });
    tests.push({
      method: "authtoken header (official)",
      endpoint: "/api/customers",
      status: response1.status,
      statusText: response1.statusText,
      data: response1.data,
      headers: response1.headers,
    });
  } catch (error: any) {
    tests.push({
      method: "authtoken header (official)",
      endpoint: "/api/customers",
      error: error.message,
    });
  }

  // Test 2: X-API-KEY header with /api/customers (fallback test)
  try {
    const response2 = await axios.get(`${baseURL}/api/customers`, {
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });
    tests.push({
      method: "X-API-KEY header",
      endpoint: "/api/customers",
      status: response2.status,
      statusText: response2.statusText,
      data: response2.data,
      headers: response2.headers,
    });
  } catch (error: any) {
    tests.push({
      method: "X-API-KEY header",
      endpoint: "/api/customers",
      error: error.message,
    });
  }

  // Test 3: Authorization Bearer with /api/customers
  try {
    const response3 = await axios.get(`${baseURL}/api/customers`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });
    tests.push({
      method: "Authorization Bearer",
      endpoint: "/api/customers",
      status: response3.status,
      statusText: response3.statusText,
      data: response3.data,
    });
  } catch (error: any) {
    tests.push({
      method: "Authorization Bearer",
      endpoint: "/api/customers",
      error: error.message,
    });
  }

  // Test 4: authtoken with /api/v1/customers (v1 variant)
  try {
    const response4 = await axios.get(`${baseURL}/api/v1/customers`, {
      headers: {
        "authtoken": apiKey,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });
    tests.push({
      method: "authtoken header",
      endpoint: "/api/v1/customers",
      status: response4.status,
      statusText: response4.statusText,
      data: response4.data,
    });
  } catch (error: any) {
    tests.push({
      method: "authtoken header",
      endpoint: "/api/v1/customers",
      error: error.message,
    });
  }

  return NextResponse.json({
    apiUrl,
    apiKeyLength: apiKey.length,
    tests,
  });
}

// Apply rate limiting (5 requests per 15 minutes per authenticated user - strict for debug endpoints)
export async function GET(request: NextRequest) {
  return withRateLimit(
    request,
    {
      ...RateLimitPresets.strict,
      requireAuth: true,
    },
    handleDebug
  );
}

