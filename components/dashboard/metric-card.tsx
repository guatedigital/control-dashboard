"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: {
    value: number;
    label: string;
  };
  icon?: React.ReactNode;
  className?: string;
  isCurrency?: boolean; // Add flag to indicate if value should be formatted as currency
}

export function MetricCard({
  title,
  value,
  description,
  trend,
  icon,
  className,
  isCurrency = false,
}: MetricCardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === "number") {
      // Only format as currency if explicitly marked
      if (isCurrency) {
        if (val >= 1000000) {
          return `$${(val / 1000000).toFixed(2)}M`;
        } else if (val >= 1000) {
          return `$${(val / 1000).toFixed(2)}K`;
        }
        return `$${val.toLocaleString()}`;
      }
      // For non-currency values, just format as number
      return val.toLocaleString();
    }
    return val;
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (trend.value < 0) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(value)}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-2 text-xs">
            {getTrendIcon()}
            <span
              className={cn(
                trend.value > 0 && "text-green-500",
                trend.value < 0 && "text-red-500",
                trend.value === 0 && "text-gray-500"
              )}
            >
              {Math.abs(trend.value)}% {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

