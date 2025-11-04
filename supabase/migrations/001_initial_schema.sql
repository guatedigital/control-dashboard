-- Create table for PerfexCRM metrics cache
CREATE TABLE IF NOT EXISTS perfexcrm_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(100) NOT NULL,
  metric_key VARCHAR(200) NOT NULL,
  metric_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(metric_type, metric_key)
);

-- Create table for Uchat metrics cache
CREATE TABLE IF NOT EXISTS uchat_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(100) NOT NULL,
  metric_key VARCHAR(200) NOT NULL,
  metric_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(metric_type, metric_key)
);

-- Create table for aggregated insights
CREATE TABLE IF NOT EXISTS aggregated_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type VARCHAR(100) NOT NULL,
  insight_key VARCHAR(200) NOT NULL,
  insight_value JSONB NOT NULL,
  source VARCHAR(50) NOT NULL CHECK (source IN ('perfexcrm', 'uchat', 'combined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(insight_type, insight_key, source)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_perfexcrm_metrics_type ON perfexcrm_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_perfexcrm_metrics_updated ON perfexcrm_metrics(updated_at);
CREATE INDEX IF NOT EXISTS idx_uchat_metrics_type ON uchat_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_uchat_metrics_updated ON uchat_metrics(updated_at);
CREATE INDEX IF NOT EXISTS idx_aggregated_insights_source ON aggregated_insights(source);
CREATE INDEX IF NOT EXISTS idx_aggregated_insights_type ON aggregated_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_aggregated_insights_updated ON aggregated_insights(updated_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_perfexcrm_metrics_updated_at
  BEFORE UPDATE ON perfexcrm_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_uchat_metrics_updated_at
  BEFORE UPDATE ON uchat_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aggregated_insights_updated_at
  BEFORE UPDATE ON aggregated_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE perfexcrm_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE uchat_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregated_insights ENABLE ROW LEVEL SECURITY;

-- Create policies for read access (adjust as needed for your auth requirements)
CREATE POLICY "Allow read access to perfexcrm_metrics" ON perfexcrm_metrics
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to uchat_metrics" ON uchat_metrics
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to aggregated_insights" ON aggregated_insights
  FOR SELECT USING (true);

-- Note: Service role key will bypass RLS, so write operations from server-side code will work

