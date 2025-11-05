import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface AuthResult {
  authorized: boolean;
  user?: {
    email: string;
    id: string;
  };
  error?: string;
}

export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader) {
      return {
        authorized: false,
        error: "No authorization header",
      };
    }

    // Extract the token
    const token = authHeader.replace("Bearer ", "");

    // Verify the token with Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        authorized: false,
        error: "Supabase configuration missing",
      };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Verify the token and get user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return {
        authorized: false,
        error: "Invalid token",
      };
    }

    // Only allow the specific authorized email
    const AUTHORIZED_EMAIL = "info@intercambioinmobiliario.com";
    
    if (user.email?.toLowerCase() !== AUTHORIZED_EMAIL.toLowerCase()) {
      return {
        authorized: false,
        error: "Account not authorized",
      };
    }

    // Optionally check if user is in authorized_accounts table (for additional validation)
    const { data: authorizedAccount, error: dbError } = await supabaseAdmin
      .from("authorized_accounts")
      .select("email, is_active")
      .eq("email", user.email)
      .eq("is_active", true)
      .single();

    if (dbError || !authorizedAccount) {
      return {
        authorized: false,
        error: "Account not authorized",
      };
    }

    return {
      authorized: true,
      user: {
        email: user.email,
        id: user.id,
      },
    };
  } catch (error) {
    console.error("Authorization verification error:", error);
    return {
      authorized: false,
      error: "Internal server error",
    };
  }
}

