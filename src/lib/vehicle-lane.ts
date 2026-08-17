/**
 * DHX vehicle lane separation (temporary safe lane — Sprint "stop the bleeding").
 *
 * Locked DHX Vehicle & Asset ID Standard: B&P walk-in / insurance / partner
 * customer vehicles must NEVER become DHX assets, i.e. must never be inserted
 * into `core.vehicles` (which auto-issues DHX-xxx asset IDs via
 * core.assign_asset_id()).
 *
 * Until the dedicated `workshop.customer_vehicles` backend exists, external jobs
 * use the nullable `workshop.jobs.vehicle_id` (left NULL) plus the existing
 * denormalized columns: plate_number, car_make, car_model, customer_name,
 * customer_phone.
 *
 * This module is frontend-only policy — no DB objects are created or changed.
 */
import type { WorkRequestSource } from "@/lib/work-source";

/** Sources whose vehicle belongs to an EXTERNAL party — never a DHX asset. */
export const EXTERNAL_WORK_SOURCES = [
  "walk_in",
  "insurance",
  "partner_workshop",
] as const;

export function isExternalWorkSource(
  source: WorkRequestSource | string | null | undefined,
): boolean {
  return (EXTERNAL_WORK_SOURCES as readonly string[]).includes(source ?? "");
}

export const CUSTOMER_VEHICLE_NOTE =
  "Customer vehicle — not a DHX asset. No DHX asset ID is issued.";

export type VehicleLane = "dhx_asset" | "customer";

export type JobVehicleFacts = {
  vehicle_id?: string | null;
  customer_vehicle_id?: string | null;
  plate_number?: string | null;
  car_make?: string | null;
  car_model?: string | null;
  work_request_source?: string | null;
  vehicle?: {
    plate_number?: string | null;
    make?: string | null;
    model?: string | null;
  } | null;
  /** Current record from workshop.customer_vehicles, when linked. */
  customer_vehicle?: {
    plate_number?: string | null;
    make?: string | null;
    model?: string | null;
  } | null;
};

/**
 * Single source of truth for showing a job's vehicle in the UI, whichever lane
 * it lives in. DHX assets read from the linked core.vehicles row; customer
 * vehicles prefer the linked workshop.customer_vehicles record and fall back to
 * the job's own denormalized snapshot.
 */
export function jobVehicleDisplay(job: JobVehicleFacts): {
  lane: VehicleLane;
  plate: string | null;
  makeModel: string | null;
} {
  const linked = job.vehicle ?? null;
  const isCustomer = !job.vehicle_id || !linked;
  if (!isCustomer) {
    return {
      lane: "dhx_asset",
      plate: linked?.plate_number ?? null,
      makeModel:
        [linked?.make, linked?.model].filter(Boolean).join(" ") || null,
    };
  }
  const cv = job.customer_vehicle ?? null;
  return {
    lane: "customer",
    plate: cv?.plate_number ?? job.plate_number ?? null,
    makeModel:
      [cv?.make ?? job.car_make, cv?.model ?? job.car_model]
        .filter(Boolean)
        .join(" ") || null,
  };
}

