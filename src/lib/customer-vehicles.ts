/**
 * DHX customer lane (workshop.customers + workshop.customer_vehicles).
 *
 * Locked DHX Vehicle & Asset ID Standard: B&P walk-in / insurance / partner
 * workshop vehicles are NEVER DHX assets — they must never be inserted into
 * core.vehicles. They now live in the dedicated backend lane:
 *
 *   workshop.customers        (optional identity — only when provided)
 *   workshop.customer_vehicles (unique on workspace_id + plate_number)
 *   workshop.jobs.customer_vehicle_id  (vehicle_id stays NULL)
 *
 * The denormalized job columns (plate_number, car_make, car_model,
 * customer_name, customer_phone) remain as an immutable snapshot fallback.
 */
import { dhxWorkshop } from "@/lib/dhx";

export type CustomerVehicle = {
  id: string;
  workspace_id: string;
  customer_id: string | null;
  plate_number: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Canonical plate normalization for the (workspace_id, plate_number) key. */
export function normalizePlate(plate: string | null | undefined): string {
  return (plate ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function upsertCustomer(
  workspaceId: string,
  name: string | null,
  phone: string | null,
): Promise<string | null> {
  const n = name?.trim() || null;
  const p = phone?.trim() || null;
  // Only create a customer when identity fields are actually provided.
  if (!n && !p) return null;

  let qb = dhxWorkshop().from("customers").select("id").eq("workspace_id", workspaceId);
  qb = p ? qb.eq("phone", p) : qb.eq("name", n);
  const { data: found } = await qb.limit(1).maybeSingle();
  if (found?.id) return found.id as string;

  const { data, error } = await dhxWorkshop()
    .from("customers")
    .insert({ workspace_id: workspaceId, name: n, phone: p })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Resolve (find-or-create) the customer vehicle for an external intake.
 * Returns nulls when there is no plate to key on — the job then relies purely
 * on its own snapshot fields, exactly as before.
 */
export async function upsertCustomerLane(input: {
  workspaceId: string;
  plate_number?: string | null;
  car_make?: string | null;
  car_model?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
}): Promise<{ customer_vehicle_id: string | null; customer_id: string | null }> {
  const plate = normalizePlate(input.plate_number);
  if (!plate) return { customer_vehicle_id: null, customer_id: null };

  const customerId = await upsertCustomer(
    input.workspaceId,
    input.customer_name ?? null,
    input.customer_phone ?? null,
  );

  const make = input.car_make?.trim() || null;
  const model = input.car_model?.trim() || null;

  const { data: existing } = await dhxWorkshop()
    .from("customer_vehicles")
    .select("id, customer_id, make, model")
    .eq("workspace_id", input.workspaceId)
    .eq("plate_number", plate)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const patch: Record<string, unknown> = {};
    if (make && !existing.make) patch.make = make;
    if (model && !existing.model) patch.model = model;
    if (customerId && !existing.customer_id) patch.customer_id = customerId;
    if (Object.keys(patch).length) {
      await dhxWorkshop().from("customer_vehicles").update(patch).eq("id", existing.id);
    }
    return {
      customer_vehicle_id: existing.id as string,
      customer_id: (existing.customer_id as string | null) ?? customerId,
    };
  }

  const { data, error } = await dhxWorkshop()
    .from("customer_vehicles")
    .insert({
      workspace_id: input.workspaceId,
      customer_id: customerId,
      plate_number: plate,
      make,
      model,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { customer_vehicle_id: data.id as string, customer_id: customerId };
}

/** Load customer vehicles by id (for job hydration). */
export async function fetchCustomerVehicles(
  workspaceId: string,
  ids: string[],
): Promise<Map<string, CustomerVehicle>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return new Map();
  const { data } = await dhxWorkshop()
    .from("customer_vehicles")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("id", unique);
  return new Map(((data ?? []) as CustomerVehicle[]).map((r) => [r.id, r]));
}
