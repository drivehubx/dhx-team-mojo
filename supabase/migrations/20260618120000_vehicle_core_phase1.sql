-- Vehicle Master architecture, Phase 1 (approved with minor revision).
-- Adds vehicle_core + two module extension tables (fleet/rental) and a
-- one-time backfill + sync trigger from the existing `vehicles` table.
--
-- IMPORTANT: this file is generated for review only. Do not run
-- `supabase db push` / apply_migration against the live project until this
-- has been explicitly approved separately from plan review.
--
-- The legacy `vehicles`, `drivers`, `rentals`, `payments` tables are NOT
-- altered, renamed, or replaced in this migration. dhx-rental and
-- dhx-driver continue reading/writing them exactly as today.
--
-- Revision history:
--   - vehicle_driver removed. drivers<->rentals<->vehicles already covers
--     that relationship live; an empty extension table added unnecessary
--     schema surface. Only vehicle_fleet and vehicle_rental are created.
--   - vehicle_fleet / vehicle_rental now own real typed columns (mirroring
--     the live `vehicles` column types, confirmed via Supabase list_tables)
--     instead of a jsonb blob -- this is the explicit field-ownership split
--     approved: vehicle_fleet = operational data (mileage, expiries, notes,
--     photo), vehicle_rental = commercial data (rates). module_status is
--     kept alongside on each table to track per-module assignment state,
--     independent from the data fields themselves.
--   - vehicle_core carries lineage columns (source_system,
--     source_record_id, migration_batch) so every row is traceable to its
--     origin and the backfill/sync pass that created it.
--   - Sync direction is one-way only: vehicles -> vehicle_core/extensions.
--     Nothing ever writes back from the new tables to `vehicles`. Per the
--     approved framing, vehicle_core is intended to become the future
--     source of truth; `vehicles` is the (untouched) compatibility layer
--     feeding it during this phase.

-- ---------------------------------------------------------------------
-- 1. vehicle_core (the master record)
-- ---------------------------------------------------------------------
-- vehicle_core.id intentionally reuses the legacy public.vehicles.id for
-- every backfilled/synced row, so the two tables share one identity space
-- in Phase 1 (no separate id-mapping table needed). A future phase may
-- introduce vehicle_core rows with their own ids for vehicles created
-- outside the legacy `vehicles` table.
CREATE TABLE public.vehicle_core (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number text NOT NULL UNIQUE,
  brand text,
  model text,
  year integer,
  vin text,
  chassis_no text,
  engine_no text,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Master record lifecycle status (active/inactive/archived). Distinct
  -- from the operational availability status on legacy `vehicles`
  -- (available/rented/maintenance/inactive), which stays module-level.
  master_vehicle_status text NOT NULL DEFAULT 'active'
    CHECK (master_vehicle_status IN ('active', 'inactive', 'archived')),
  -- Lineage: where this row came from and which pass created it.
  -- source_record_id intentionally mirrors id in Phase 1 (1:1 reuse), but
  -- is kept as its own column so future phases can attach vehicle_core
  -- rows whose id no longer matches their originating row.
  source_system text NOT NULL DEFAULT 'vehicles',
  source_record_id uuid,
  migration_batch text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_core TO authenticated;
GRANT ALL ON public.vehicle_core TO service_role;

ALTER TABLE public.vehicle_core ENABLE ROW LEVEL SECURITY;

-- Mirrors the live RLS posture on public.vehicles: open read, any
-- authenticated user may write. No role gating introduced in Phase 1.
CREATE POLICY vehicle_core_select ON public.vehicle_core
  FOR SELECT USING (true);
CREATE POLICY vehicle_core_insert ON public.vehicle_core
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY vehicle_core_update ON public.vehicle_core
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY vehicle_core_delete ON public.vehicle_core
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------
-- 2. Module extension tables
-- ---------------------------------------------------------------------
-- Only modules with real consuming code today get a table:
--   vehicle_fleet   -- operational/compliance data (mileage, expiries,
--                       notes, photo) -- dhx-rental's fleet/admin view
--   vehicle_rental  -- commercial data (rates) -- dhx-rental's
--                       rate/booking-facing module
--
-- vehicle_driver / vehicle_body_paint / vehicle_mygarage / vehicle_protect
-- are intentionally NOT created here -- no consuming app/repo exists for
-- them today; they remain documented business concepts / deferred phases
-- (see architecture.md / shared-entities.md).

CREATE TABLE public.vehicle_fleet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_core_id uuid NOT NULL UNIQUE REFERENCES public.vehicle_core(id) ON DELETE CASCADE,
  module_status text NOT NULL DEFAULT 'active',
  mileage integer DEFAULT 0,
  road_tax_expiry date,
  insurance_expiry date,
  puspakom_expiry date,
  notes text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_rental (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_core_id uuid NOT NULL UNIQUE REFERENCES public.vehicle_core(id) ON DELETE CASCADE,
  module_status text NOT NULL DEFAULT 'active',
  daily_rate numeric,
  weekly_rate numeric,
  monthly_rate numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_fleet TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_rental TO authenticated;
GRANT ALL ON public.vehicle_fleet TO service_role;
GRANT ALL ON public.vehicle_rental TO service_role;

ALTER TABLE public.vehicle_fleet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_rental ENABLE ROW LEVEL SECURITY;

-- vehicle_fleet mirrors public.vehicles, which allows DELETE.
CREATE POLICY vehicle_fleet_select ON public.vehicle_fleet FOR SELECT USING (true);
CREATE POLICY vehicle_fleet_insert ON public.vehicle_fleet FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY vehicle_fleet_update ON public.vehicle_fleet FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY vehicle_fleet_delete ON public.vehicle_fleet FOR DELETE USING (auth.uid() IS NOT NULL);

-- vehicle_rental mirrors public.rentals, which has no DELETE policy live
-- today -- no delete policy here either.
CREATE POLICY vehicle_rental_select ON public.vehicle_rental FOR SELECT USING (true);
CREATE POLICY vehicle_rental_insert ON public.vehicle_rental FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY vehicle_rental_update ON public.vehicle_rental FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------
-- 3. updated_at maintenance
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER vehicle_core_set_updated_at
  BEFORE UPDATE ON public.vehicle_core
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER vehicle_fleet_set_updated_at
  BEFORE UPDATE ON public.vehicle_fleet
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER vehicle_rental_set_updated_at
  BEFORE UPDATE ON public.vehicle_rental
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. One-time backfill from the existing public.vehicles table
-- ---------------------------------------------------------------------
-- Additive only: reads public.vehicles, writes into the new tables.
-- Nothing is deleted or modified in public.vehicles. migration_batch tags
-- every row from this pass as 'phase1_backfill' so it stays distinguishable
-- from rows the sync trigger creates afterward.
INSERT INTO public.vehicle_core
  (id, plate_number, brand, model, year, vin, chassis_no, engine_no, master_vehicle_status,
   source_system, source_record_id, migration_batch, created_at, updated_at)
SELECT
  v.id, v.plate_number, v.make, v.model, v.year, NULL, NULL, NULL, 'active',
  'vehicles', v.id, 'phase1_backfill', v.created_at, v.updated_at
FROM public.vehicles v
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.vehicle_fleet
  (vehicle_core_id, module_status, mileage, road_tax_expiry, insurance_expiry, puspakom_expiry, notes, photo_url, created_at, updated_at)
SELECT
  v.id,
  CASE WHEN v.status = 'inactive' THEN 'inactive' ELSE 'active' END,
  v.mileage, v.road_tax_expiry, v.insurance_expiry, v.puspakom_expiry, v.notes, v.photo_url,
  v.created_at, v.updated_at
FROM public.vehicles v
ON CONFLICT (vehicle_core_id) DO NOTHING;

INSERT INTO public.vehicle_rental
  (vehicle_core_id, module_status, daily_rate, weekly_rate, monthly_rate, created_at, updated_at)
SELECT
  v.id,
  'active',
  v.daily_rate, v.weekly_rate, v.monthly_rate,
  v.created_at, v.updated_at
FROM public.vehicles v
ON CONFLICT (vehicle_core_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. Sync trigger: keep vehicle_core/vehicle_fleet/vehicle_rental current
--    whenever the existing dhx-rental/dhx-driver admin UI writes to
--    public.vehicles, with no code changes required in those repos.
--
--    ONE-WAY ONLY: vehicles -> vehicle_core/extensions. Nothing here ever
--    writes back to public.vehicles.
-- ---------------------------------------------------------------------
-- migration_batch is tagged 'sync_trigger' on first insert via this path
-- (distinguishing newly-created vehicles from the initial backfill) and is
-- intentionally left out of the ON CONFLICT UPDATE so an existing row's
-- original lineage tag is preserved across later edits.
CREATE OR REPLACE FUNCTION public.sync_vehicle_core_from_legacy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vehicle_core
    (id, plate_number, brand, model, year, master_vehicle_status,
     source_system, source_record_id, migration_batch, created_at, updated_at)
  VALUES
    (NEW.id, NEW.plate_number, NEW.make, NEW.model, NEW.year, 'active',
     'vehicles', NEW.id, 'sync_trigger', NEW.created_at, NEW.updated_at)
  ON CONFLICT (id) DO UPDATE SET
    plate_number = excluded.plate_number,
    brand = excluded.brand,
    model = excluded.model,
    year = excluded.year,
    updated_at = excluded.updated_at;

  INSERT INTO public.vehicle_fleet
    (vehicle_core_id, module_status, mileage, road_tax_expiry, insurance_expiry, puspakom_expiry, notes, photo_url, created_at, updated_at)
  VALUES (
    NEW.id,
    CASE WHEN NEW.status = 'inactive' THEN 'inactive' ELSE 'active' END,
    NEW.mileage, NEW.road_tax_expiry, NEW.insurance_expiry, NEW.puspakom_expiry, NEW.notes, NEW.photo_url,
    NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (vehicle_core_id) DO UPDATE SET
    module_status = excluded.module_status,
    mileage = excluded.mileage,
    road_tax_expiry = excluded.road_tax_expiry,
    insurance_expiry = excluded.insurance_expiry,
    puspakom_expiry = excluded.puspakom_expiry,
    notes = excluded.notes,
    photo_url = excluded.photo_url,
    updated_at = excluded.updated_at;

  INSERT INTO public.vehicle_rental
    (vehicle_core_id, module_status, daily_rate, weekly_rate, monthly_rate, created_at, updated_at)
  VALUES (
    NEW.id,
    'active',
    NEW.daily_rate, NEW.weekly_rate, NEW.monthly_rate,
    NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (vehicle_core_id) DO UPDATE SET
    daily_rate = excluded.daily_rate,
    weekly_rate = excluded.weekly_rate,
    monthly_rate = excluded.monthly_rate,
    updated_at = excluded.updated_at;

  RETURN NEW;
END;
$$;

CREATE TRIGGER vehicles_sync_vehicle_core
  AFTER INSERT OR UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_core_from_legacy();
