// Rate limiting middleware for Next.js API routes
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getRateLimitIdentifier, RateLimitPresets, RateLimitResult } from "./rate-limit";
import { verifyAuth } from "@/lib/auth/verify-auth";

// Re-export RateLimitPresets for convenience
export { RateLimitPresets } from "./rate-limit";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  requireAuth?: boolean; // If true, use user ID instead of IP
}

export async function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  handler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  let userId: string | undefined;

  // If rate limiting requires auth, verify and get user ID
  if (config.requireAuth) {
    const authResult = await verifyAuth(request);
    if (!authResult.authorized || !authResult.user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }
    userId = authResult.user.id;
  }

  // Get identifier for rate limiting
  const identifier = getRateLimitIdentifier(request, userId);

  // Apply rate limit
  const result: RateLimitResult = rateLimit(identifier, {
    windowMs: config.windowMs,
    maxRequests: config.maxRequests,
    identifier,
  });

  // If rate limit exceeded, return error
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: `Too many requests. Please try again after ${result.retryAfter} seconds.`,
        limit: result.limit,
        remaining: result.remaining,
        reset: new Date(result.reset).toISOString(),
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": result.limit.toString(),
          "X-RateLimit-Remaining": result.remaining.toString(),
          "X-RateLimit-Reset": result.reset.toString(),
          "Retry-After": result.retryAfter?.toString() || "60",
        },
      }
    );
  }

  // Add rate limit headers to successful response
  const response = await handler(request);
  
  // Add rate limit headers
  response.headers.set("X-RateLimit-Limit", result.limit.toString());
  response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
  response.headers.set("X-RateLimit-Reset", result.reset.toString());

  return response;
}

// Convenience functions for common rate limit presets
export const rateLimitStrict = (handler: (request: NextRequest) => Promise<NextResponse>) => {
  return (request: NextRequest) =>
    withRateLimit(request, {
      ...RateLimitPresets.strict,
      requireAuth: false, // Login endpoints don't require auth yet
    }, handler);
};

export const rateLimitStandard = (handler: (request: NextRequest) => Promise<NextResponse>) => {
  return (request: NextRequest) =>
    withRateLimit(request, {
      ...RateLimitPresets.standard,
      requireAuth: true,
    }, handler);
};

export const rateLimitModerate = (handler: (request: NextRequest) => Promise<NextResponse>) => {
  return (request: NextRequest) =>
    withRateLimit(request, {
      ...RateLimitPresets.moderate,
      requireAuth: true,
    }, handler);
};

