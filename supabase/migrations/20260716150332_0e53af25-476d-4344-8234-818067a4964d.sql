
ALTER TABLE workshop.repair_parts
  ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'initial_assessment'
    CHECK (provenance IN ('initial_assessment','found_during_repair')),
  ADD COLUMN IF NOT EXISTS discovery_stage text
    CHECK (discovery_stage IN ('dismantling','repair','qc')),
  ADD COLUMN IF NOT EXISTS reason_required text,
  ADD COLUMN IF NOT EXISTS recommended_action text
    CHECK (recommended_action IN ('replace','repair')),
  ADD COLUMN IF NOT EXISTS related_damage text,
  ADD COLUMN IF NOT EXISTS photo_file_id uuid REFERENCES core.files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_suggestion jsonb,
  ADD COLUMN IF NOT EXISTS revision_status text NOT NULL DEFAULT 'approved'
    CHECK (revision_status IN ('approved','draft_revision'));

CREATE INDEX IF NOT EXISTS repair_parts_job_provenance_idx
  ON workshop.repair_parts (job_id, provenance);
