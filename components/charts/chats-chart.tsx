"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ChatsChartProps {
  data: Array<{
    date: string;
    active: number;
    total: number;
  }>;
}

export function ChatsChart({ data }: ChatsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Area
          type="monotone"
          dataKey="active"
          stackId="1"
          stroke="hsl(var(--chart-2))"
          fill="hsl(var(--chart-2))"
        />
        <Area
          type="monotone"
          dataKey="total"
          stackId="1"
          stroke="hsl(var(--chart-3))"
          fill="hsl(var(--chart-3))"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

