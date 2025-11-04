export interface PerfexCRMMetric {
  id: string;
  metric_type: string;
  metric_key: string;
  metric_value: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UchatMetric {
  id: string;
  metric_type: string;
  metric_key: string;
  metric_value: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AggregatedInsight {
  id: string;
  insight_type: string;
  insight_key: string;
  insight_value: Record<string, unknown>;
  source: "perfexcrm" | "uchat" | "combined";
  created_at: string;
  updated_at: string;
}

