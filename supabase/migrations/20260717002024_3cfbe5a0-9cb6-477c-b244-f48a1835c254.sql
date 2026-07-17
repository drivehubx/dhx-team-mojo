
ALTER TABLE workshop.jobs
  ADD COLUMN IF NOT EXISTS work_request_source text,
  ADD COLUMN IF NOT EXISTS ai_initial_assessment jsonb,
  ADD COLUMN IF NOT EXISTS ai_corrected_assessment jsonb,
  ADD COLUMN IF NOT EXISTS estimated_labour_hours numeric,
  ADD COLUMN IF NOT EXISTS estimated_paint_panels integer,
  ADD COLUMN IF NOT EXISTS estimated_days integer;
