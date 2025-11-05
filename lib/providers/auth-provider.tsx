"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAuthorized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    // Get initial session with timeout
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Check authorization with timeout (don't block loading state)
        const authPromise = checkAuthorization(session?.user);
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 5000)); // 5 second timeout
        
        Promise.race([authPromise, timeoutPromise]).finally(() => {
          if (isMounted) {
            setLoading(false);
          }
        });
      } catch (error) {
        console.error("Auth initialization error:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      // Check authorization with timeout
      const authPromise = checkAuthorization(session?.user);
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 5000));
      
      Promise.race([authPromise, timeoutPromise]).finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const checkAuthorization = async (user: User | null | undefined) => {
    if (!user?.email) {
      setIsAuthorized(false);
      return;
    }

    try {
      // Get the session token with timeout
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Session check timeout")), 3000)
      );
      
      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any;
      
      if (!session?.access_token) {
        setIsAuthorized(false);
        return;
      }

      // Check authorization via API route with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        const response = await fetch("/api/auth/check", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const result = await response.json();
        
        if (result.authorized) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.warn("Authorization check timeout");
        } else {
          console.error("Authorization check error:", fetchError);
        }
        setIsAuthorized(false);
      }
    } catch (error) {
      console.error("Authorization check error:", error);
      setIsAuthorized(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      if (data.user) {
        await checkAuthorization(data.user);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAuthorized(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signOut,
        isAuthorized,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

