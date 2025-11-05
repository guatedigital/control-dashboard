// Rate limiting utility for Next.js API routes
// Works with serverless environments (Vercel)
// Can be upgraded to use Redis/Upstash for distributed rate limiting

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  identifier?: string; // Optional identifier (IP, user ID, etc.)
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (for single-instance deployments)
// For distributed deployments, consider using Redis/Upstash
const store: RateLimitStore = {};

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 60000; // 1 minute
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return;
  }
  
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
  
  lastCleanup = now;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export function rateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  cleanupExpiredEntries();

  const { windowMs, maxRequests } = options;
  const now = Date.now();
  const key = identifier;

  // Get or create entry
  let entry = store[key];

  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired one
    entry = {
      count: 0,
      resetTime: now + windowMs,
    };
    store[key] = entry;
  }

  // Increment count
  entry.count += 1;

  const remaining = Math.max(0, maxRequests - entry.count);
  const success = entry.count <= maxRequests;

  return {
    success,
    limit: maxRequests,
    remaining,
    reset: entry.resetTime,
    retryAfter: success ? undefined : Math.ceil((entry.resetTime - now) / 1000),
  };
}

// Get identifier from request (IP address or user ID)
export function getRateLimitIdentifier(
  request: Request,
  userId?: string
): string {
  // Use user ID if available (for authenticated requests)
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  // In Vercel, we can get IP from headers
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",")[0].trim()
    : request.headers.get("x-real-ip") || "unknown";

  return `ip:${ip}`;
}

// Rate limit presets
export const RateLimitPresets = {
  // Strict: 5 requests per 15 minutes (for login, sensitive operations)
  strict: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  // Standard: 100 requests per minute (for API endpoints)
  standard: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
  // Moderate: 20 requests per minute (for data-heavy endpoints)
  moderate: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
  },
  // Generous: 200 requests per minute (for lightweight endpoints)
  generous: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
  },
} as const;

