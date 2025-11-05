"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import { useRouter } from "next/navigation";

interface DashboardHeaderProps {
  onRefresh?: () => void;
  lastUpdated?: Date;
}

export function DashboardHeader({
  onRefresh,
  lastUpdated,
}: DashboardHeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { signOut, user } = useAuth();
  const router = useRouter();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "all" }),
      });
      onRefresh?.();
    } catch (error) {
      console.error("Refresh error:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Company Insights</h1>
        <p className="text-muted-foreground">
          Real-time metrics from PerfexCRM and Uchat
        </p>
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <span className="text-sm text-muted-foreground">
            {user.email}
          </span>
        )}
        {lastUpdated && (
          <span className="text-sm text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="icon"
          title="Refresh data"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </Button>
        <Button
          onClick={handleSignOut}
          variant="outline"
          size="icon"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

