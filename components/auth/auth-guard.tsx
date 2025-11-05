"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/providers/auth-provider";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthorized, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (!isAuthorized) {
        router.push("/login");
      }
    }
  }, [user, isAuthorized, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user || !isAuthorized) {
    return null; // Redirecting...
  }

  return <>{children}</>;
}

