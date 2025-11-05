"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw, LogOut, Calendar } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import { useRouter } from "next/navigation";

interface DashboardHeaderProps {
  onRefresh?: () => void;
  lastUpdated?: Date;
  selectedDate?: string;
  onDateChange?: (date: string) => void;
}

export function DashboardHeader({
  onRefresh,
  lastUpdated,
  selectedDate,
  onDateChange,
}: DashboardHeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { signOut, user } = useAuth();
  const router = useRouter();
  
  // Default to today's date if not provided
  const currentDate = selectedDate || new Date().toISOString().split('T')[0];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Wait for sync to complete before refreshing
      const syncResponse = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "all" }),
      });
      
      if (syncResponse.ok) {
        const syncResult = await syncResponse.json();
        console.log("[Dashboard] Sync completed:", syncResult);
        
        // Wait a brief moment for database to update
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Now trigger the refresh
      onRefresh?.();
    } catch (error) {
      console.error("Refresh error:", error);
      // Still trigger refresh even if sync fails
      onRefresh?.();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    onDateChange?.(newDate);
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
        {/* Date Picker */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={currentDate}
            onChange={handleDateChange}
            max={new Date().toISOString().split('T')[0]} // Can't select future dates
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            title="Select date to view historical data"
          />
        </div>
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

