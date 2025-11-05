-- Migration to support storing daily metrics instead of overwriting
-- This allows tracking historical data per day

-- Add date column to uchat_metrics table
ALTER TABLE uchat_metrics 
ADD COLUMN IF NOT EXISTS metric_date DATE DEFAULT CURRENT_DATE;

-- Drop the old unique constraint that only used metric_type and metric_key
ALTER TABLE uchat_metrics 
DROP CONSTRAINT IF EXISTS uchat_metrics_metric_type_metric_key_key;

-- Add new unique constraint that includes date to allow multiple records per day
ALTER TABLE uchat_metrics 
ADD CONSTRAINT uchat_metrics_metric_type_metric_key_date_key 
UNIQUE(metric_type, metric_key, metric_date);

-- Create index on metric_date for better query performance
CREATE INDEX IF NOT EXISTS idx_uchat_metrics_date ON uchat_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_uchat_metrics_type_date ON uchat_metrics(metric_type, metric_date);

-- Add date column to perfexcrm_metrics table as well for consistency
ALTER TABLE perfexcrm_metrics 
ADD COLUMN IF NOT EXISTS metric_date DATE DEFAULT CURRENT_DATE;

-- Drop the old unique constraint
ALTER TABLE perfexcrm_metrics 
DROP CONSTRAINT IF EXISTS perfexcrm_metrics_metric_type_metric_key_key;

-- Add new unique constraint that includes date
ALTER TABLE perfexcrm_metrics 
ADD CONSTRAINT perfexcrm_metrics_metric_type_metric_key_date_key 
UNIQUE(metric_type, metric_key, metric_date);

-- Create index on metric_date for better query performance
CREATE INDEX IF NOT EXISTS idx_perfexcrm_metrics_date ON perfexcrm_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_perfexcrm_metrics_type_date ON perfexcrm_metrics(metric_type, metric_date);

-- For aggregated_insights, we can keep the current structure since it's meant to be the latest
-- But if needed, we could add date tracking here too


