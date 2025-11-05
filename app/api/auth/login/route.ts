import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withRateLimit, RateLimitPresets } from "@/lib/utils/rate-limit-middleware";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function handleLogin(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase configuration missing" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Invalid email or password" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Apply strict rate limiting to login endpoint (5 attempts per 15 minutes per IP)
export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    {
      ...RateLimitPresets.strict,
      requireAuth: false, // Login doesn't require auth yet
    },
    handleLogin
  );
}

