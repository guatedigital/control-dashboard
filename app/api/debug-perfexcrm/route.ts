import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { verifyAuth } from "@/lib/auth/verify-auth";

export async function GET(request: NextRequest) {
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

  // Test 1: X-API-KEY header with /v1/customers
  try {
    const response1 = await axios.get(`${apiUrl}/v1/customers`, {
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      validateStatus: () => true, // Don't throw on any status
    });
    tests.push({
      method: "X-API-KEY header",
      endpoint: "/v1/customers",
      status: response1.status,
      statusText: response1.statusText,
      data: response1.data,
      headers: response1.headers,
    });
  } catch (error: any) {
    tests.push({
      method: "X-API-KEY header",
      endpoint: "/v1/customers",
      error: error.message,
    });
  }

  // Test 2: Authorization Bearer with /v1/customers
  try {
    const response2 = await axios.get(`${apiUrl}/v1/customers`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });
    tests.push({
      method: "Authorization Bearer",
      endpoint: "/v1/customers",
      status: response2.status,
      statusText: response2.statusText,
      data: response2.data,
    });
  } catch (error: any) {
    tests.push({
      method: "Authorization Bearer",
      endpoint: "/v1/customers",
      error: error.message,
    });
  }

  // Test 3: X-API-KEY header with /customers (no v1)
  try {
    const response3 = await axios.get(`${apiUrl}/customers`, {
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });
    tests.push({
      method: "X-API-KEY header",
      endpoint: "/customers",
      status: response3.status,
      statusText: response3.statusText,
      data: response3.data,
    });
  } catch (error: any) {
    tests.push({
      method: "X-API-KEY header",
      endpoint: "/customers",
      error: error.message,
    });
  }

  // Test 4: Query parameter
  try {
    const response4 = await axios.get(`${apiUrl}/v1/customers`, {
      params: {
        api_key: apiKey,
      },
      headers: {
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });
    tests.push({
      method: "Query parameter api_key",
      endpoint: "/v1/customers",
      status: response4.status,
      statusText: response4.statusText,
      data: response4.data,
    });
  } catch (error: any) {
    tests.push({
      method: "Query parameter api_key",
      endpoint: "/v1/customers",
      error: error.message,
    });
  }

  return NextResponse.json({
    apiUrl,
    apiKeyLength: apiKey.length,
    tests,
  });
}

