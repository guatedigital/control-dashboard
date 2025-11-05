"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/providers/auth-provider";

export default function Home() {
  const router = useRouter();
  const { user, isAuthorized, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user && isAuthorized) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [user, isAuthorized, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}

