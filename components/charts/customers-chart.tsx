"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CustomersChartProps {
  data: Array<{
    period: string;
    customers: number;
  }>;
}

export function CustomersChart({ data }: CustomersChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="customers" fill="hsl(var(--chart-1))" />
      </BarChart>
    </ResponsiveContainer>
  );
}

