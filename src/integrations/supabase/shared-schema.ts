// Hand-written types for shared `core.*` and `workshop.*` schemas.
// The auto-generated types.ts only covers the `public` schema in this project's
// types pipeline, so we declare cross-schema shapes here and cast at the boundary.

import { supabase } from "./client";

export type UUID = string;

export type AppRole = "owner" | "manager" | "worker" | "crew";
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

export type WorkshopJob = {
  id: UUID;
  workspace_id: UUID;
  vehicle_id: UUID;
  description: string | null;
  status: JobStatus;
  created_at: string;
  updated_at: string;
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
