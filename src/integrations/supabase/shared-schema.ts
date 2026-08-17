// Hand-written types for shared `core.*` and `workshop.*` schemas.
// The auto-generated types.ts only covers the `public` schema in this project's
// types pipeline, so we declare cross-schema shapes here and cast at the boundary.

import { supabase } from "./client";

export type UUID = string;

export type AppRole =
  | "owner"
  | "administrator"
  | "manager"
  | "supervisor"
  | "member"
  // Legacy values that may exist on old rows — displayed as "Member" in the UI.
  | "worker"
  | "crew";

export type CorePosition = {
  id: UUID;
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
};

export type CoreEngagementType = {
  id: UUID;
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
};

export type TeamDirectoryRow = {
  id: UUID;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
  system_role: AppRole | null;
  engagement_code: string | null;
  engagement_label: string | null;
  engagement_type_id: UUID | null;
  positions: Array<{ id: UUID; code: string; label: string }> | null;
  teams: Array<{ id: UUID; name: string }> | null;
  active_job_count: number | null;
  created_at?: string | null;
};
export type FileStatus = "pending" | "approved" | "rejected";
export type AdvanceStatus = "pending" | "approved" | "rejected";
export type JobStatus = "open" | "in_progress" | "completed" | "cancelled";
export type IdType = "ic" | "passport";

export type CoreProfile = {
  id: UUID;
  workspace_id: UUID;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CoreRole = {
  id: UUID;
  workspace_id: UUID;
  profile_id: UUID;
  role: AppRole;
  created_at: string;
};

export type CoreWorkspace = {
  id: UUID;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type CoreVehicle = {
  id: UUID;
  workspace_id: UUID;
  plate_number: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  status: string | null;
  mileage: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CoreFile = {
  id: UUID;
  workspace_id: UUID;
  owner_type: string;
  owner_id: UUID;
  file_type: string;
  url: string;
  status: FileStatus;
  uploaded_by: UUID | null;
  created_at: string;
};

export type CoreIdentification = {
  id: UUID;
  workspace_id: UUID;
  profile_id: UUID;
  id_type: IdType;
  id_number: string;
  created_at: string;
  updated_at: string;
};

export type RepairStage =
  | "queued"
  | "disassembly"
  | "panel_repair"
  | "putty"
  | "primer"
  | "paint"
  | "assembly"
  | "polish"
  | "qc"
  | "completed";

export type IntakeChecklistArea = {
  checked: boolean;
  note: string;
};
export type IntakeChecklist = Partial<Record<
  "front" | "rear" | "left" | "right" | "roof" | "interior",
  IntakeChecklistArea
>>;

export type WorkshopJob = {
  id: UUID;
  workspace_id: UUID;
  /**
   * NULL for external/customer vehicles (walk-in, insurance, partner workshop).
   * Those never enter core.vehicles / the DHX asset register — the denormalized
   * plate_number / car_make / car_model / customer_* fields below carry the facts.
   */
  vehicle_id: UUID | null;
  /** Dedicated customer lane: workshop.customer_vehicles row (external jobs). */
  customer_vehicle_id: UUID | null;

  car_make: string | null;
  car_model: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  work_request_source: string | null;
  description: string | null;

  status: JobStatus;
  created_at: string;
  updated_at: string;
  repair_stage: RepairStage | null;
  damage_description: string | null;
  estimate_amount: number | null;
  estimate_approved: boolean | null;
  estimate_approved_by: UUID | null;
  assigned_lead_id: UUID | null;
  labor_hours_estimate: number | null;
  due_date: string | null;
  intake_checklist: IntakeChecklist | null;
  rework_count: number | null;
  started_at: string | null;
  completed_at: string | null;
  released_at: string | null;
  released_by: UUID | null;
};

export type WorkshopJobWorker = {
  id: UUID;
  workspace_id: UUID;
  job_id: UUID;
  profile_id: UUID;
  role_on_job: string | null;
  created_at: string;
};

export type WorkshopSalary = {
  id: UUID;
  workspace_id: UUID;
  profile_id: UUID;
  period: string;
  basic: number;
  allowances: number;
  deductions: number;
  bonus: number;
  paid: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkshopAdvance = {
  id: UUID;
  workspace_id: UUID;
  profile_id: UUID;
  amount: number;
  reason: string | null;
  status: AdvanceStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: UUID | null;
  created_at: string;
};

// Schema-qualified accessors. We cast at the boundary because the auto-generated
// `Database` type doesn't include `core`/`workshop` in this project.
// Every call site is still typed via the explicit row types above.
type AnySchemaClient = ReturnType<typeof supabase.schema extends (...args: any[]) => infer R ? () => R : never>;

export const sbCore = (): any => (supabase as any).schema("core");
export const sbWorkshop = (): any => (supabase as any).schema("workshop");
// Suppress unused-type warning
export type _AnySchemaClient = AnySchemaClient;
