-- Vehicle Master architecture, Phase 1.
-- Adds vehicle_core + module extension tables (fleet/rental/driver) and a
-- one-time backfill + sync trigger from the existing `vehicles` table.
--
-- IMPORTANT: this file is generated for review only. Do not run
-- `supabase db push` / apply_migration against the live project until this
-- has been explicitly approved separately from plan review.
--
-- The legacy `vehicles`, `drivers`, `rentals`, `payments` tables are NOT
-- altered, renamed, or replaced in this migration. dhx-rental and
-- dhx-driver continue reading/writing them exactly as today.

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
  master_vehicle_status text NOT NULL DEFAULT 'active'
    CHECK (master_vehicle_status IN ('active', 'inactive', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_core TO authenticated;
GRANT ALL ON public.vehicle_core TO service_role;

ALTER TABLE public.vehicle_core ENABLE ROW LEVEL SECURITY;

-- Mirrors the live RLS posture on public.vehicles: open read, any
-- authenticated user may write. No role gating exists on fleet data today.
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
-- Generic shape per the approved design: one row per vehicle per module
-- (enforced via UNIQUE(vehicle_core_id) for now), module-specific fields
-- kept in a flexible JSONB column rather than a fixed column list, so new
-- module fields don't require a schema migration later.
--
-- Only modules with real consuming code today get a table:
--   vehicle_fleet   -- dhx-rental's fleet/admin view + "Ops" maintenance
--                       fields (insurance/road tax/puspakom/mileage/photo)
--   vehicle_rental  -- dhx-rental's rate/booking-facing fields
--   vehicle_driver  -- placeholder for dhx-driver-specific data; created
--                       empty, no backfill source exists yet
--
-- vehicle_body_paint / vehicle_mygarage / vehicle_protect are intentionally
-- NOT created here -- those modules have no repo/app today and remain
-- documented business concepts only (see architecture.md / shared-entities.md).

CREATE TABLE public.vehicle_fleet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_core_id uuid NOT NULL UNIQUE REFERENCES public.vehicle_core(id) ON DELETE CASCADE,
  module_status text NOT NULL DEFAULT 'active',
  module_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_rental (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_core_id uuid NOT NULL UNIQUE REFERENCES public.vehicle_core(id) ON DELETE CASCADE,
  module_status text NOT NULL DEFAULT 'active',
  module_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_driver (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_core_id uuid NOT NULL UNIQUE REFERENCES public.vehicle_core(id) ON DELETE CASCADE,
  module_status text NOT NULL DEFAULT 'unassigned',
  module_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_fleet TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_rental TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_driver TO authenticated;
GRANT ALL ON public.vehicle_fleet TO service_role;
GRANT ALL ON public.vehicle_rental TO service_role;
GRANT ALL ON public.vehicle_driver TO service_role;

ALTER TABLE public.vehicle_fleet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_rental ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_driver ENABLE ROW LEVEL SECURITY;

-- vehicle_fleet mirrors public.vehicles, which allows DELETE.
CREATE POLICY vehicle_fleet_select ON public.vehicle_fleet FOR SELECT USING (true);
CREATE POLICY vehicle_fleet_insert ON public.vehicle_fleet FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY vehicle_fleet_update ON public.vehicle_fleet FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY vehicle_fleet_delete ON public.vehicle_fleet FOR DELETE USING (auth.uid() IS NOT NULL);

-- vehicle_rental / vehicle_driver mirror public.rentals / public.drivers,
-- neither of which has a DELETE policy live today -- no delete policy here either.
CREATE POLICY vehicle_rental_select ON public.vehicle_rental FOR SELECT USING (true);
CREATE POLICY vehicle_rental_insert ON public.vehicle_rental FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY vehicle_rental_update ON public.vehicle_rental FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY vehicle_driver_select ON public.vehicle_driver FOR SELECT USING (true);
CREATE POLICY vehicle_driver_insert ON public.vehicle_driver FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY vehicle_driver_update ON public.vehicle_driver FOR UPDATE USING (auth.uid() IS NOT NULL);

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

CREATE TRIGGER vehicle_driver_set_updated_at
  BEFORE UPDATE ON public.vehicle_driver
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. One-time backfill from the existing public.vehicles table
-- ---------------------------------------------------------------------
-- Additive only: reads public.vehicles, writes into the new tables.
-- Nothing is deleted or modified in public.vehicles.
INSERT INTO public.vehicle_core
  (id, plate_number, brand, model, year, vin, chassis_no, engine_no, master_vehicle_status, created_at, updated_at)
SELECT
  v.id, v.plate_number, v.make, v.model, v.year, NULL, NULL, NULL, 'active', v.created_at, v.updated_at
FROM public.vehicles v
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.vehicle_fleet (vehicle_core_id, module_status, module_data, created_at, updated_at)
SELECT
  v.id,
  CASE WHEN v.status = 'inactive' THEN 'inactive' ELSE 'active' END,
  jsonb_build_object(
    'status', v.status,
    'color', v.color,
    'mileage', v.mileage,
    'insurance_expiry', v.insurance_expiry,
    'road_tax_expiry', v.road_tax_expiry,
    'puspakom_expiry', v.puspakom_expiry,
    'photo_url', v.photo_url,
    'notes', v.notes
  ),
  v.created_at, v.updated_at
FROM public.vehicles v
ON CONFLICT (vehicle_core_id) DO NOTHING;

INSERT INTO public.vehicle_rental (vehicle_core_id, module_status, module_data, created_at, updated_at)
SELECT
  v.id,
  'active',
  jsonb_build_object(
    'daily_rate', v.daily_rate,
    'weekly_rate', v.weekly_rate,
    'monthly_rate', v.monthly_rate
  ),
  v.created_at, v.updated_at
FROM public.vehicles v
ON CONFLICT (vehicle_core_id) DO NOTHING;

-- vehicle_driver intentionally NOT backfilled -- no source data exists yet.

-- ---------------------------------------------------------------------
-- 5. Sync trigger: keep vehicle_core/vehicle_fleet/vehicle_rental current
--    whenever the existing dhx-rental/dhx-driver admin UI writes to
--    public.vehicles, with no code changes required in those repos.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_vehicle_core_from_legacy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vehicle_core
    (id, plate_number, brand, model, year, master_vehicle_status, created_at, updated_at)
  VALUES
    (NEW.id, NEW.plate_number, NEW.make, NEW.model, NEW.year, 'active', NEW.created_at, NEW.updated_at)
  ON CONFLICT (id) DO UPDATE SET
    plate_number = excluded.plate_number,
    brand = excluded.brand,
    model = excluded.model,
    year = excluded.year,
    updated_at = excluded.updated_at;

  INSERT INTO public.vehicle_fleet (vehicle_core_id, module_status, module_data, created_at, updated_at)
  VALUES (
    NEW.id,
    CASE WHEN NEW.status = 'inactive' THEN 'inactive' ELSE 'active' END,
    jsonb_build_object(
      'status', NEW.status,
      'color', NEW.color,
      'mileage', NEW.mileage,
      'insurance_expiry', NEW.insurance_expiry,
      'road_tax_expiry', NEW.road_tax_expiry,
      'puspakom_expiry', NEW.puspakom_expiry,
      'photo_url', NEW.photo_url,
      'notes', NEW.notes
    ),
    NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (vehicle_core_id) DO UPDATE SET
    module_status = excluded.module_status,
    module_data = excluded.module_data,
    updated_at = excluded.updated_at;

  INSERT INTO public.vehicle_rental (vehicle_core_id, module_status, module_data, created_at, updated_at)
  VALUES (
    NEW.id,
    'active',
    jsonb_build_object(
      'daily_rate', NEW.daily_rate,
      'weekly_rate', NEW.weekly_rate,
      'monthly_rate', NEW.monthly_rate
    ),
    NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (vehicle_core_id) DO UPDATE SET
    module_data = excluded.module_data,
    updated_at = excluded.updated_at;

  RETURN NEW;
END;
$$;

CREATE TRIGGER vehicles_sync_vehicle_core
  AFTER INSERT OR UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_core_from_legacy();
