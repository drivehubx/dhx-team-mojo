-- Vehicle Master architecture, Phase 1 -- ROLLBACK.
--
-- This file is intentionally kept at the repo root, NOT in
-- supabase/migrations/, because the Supabase CLI would otherwise try to
-- apply it forward like any other numbered migration. Run it manually
-- (e.g. via execute_sql / psql) only if Phase 1 has been applied and needs
-- to be reverted.
--
-- Safe by construction: nothing pre-existing (public.vehicles, drivers,
-- rentals, payments) is touched by this rollback, because Phase 1 never
-- touched them either.

DROP TRIGGER IF EXISTS vehicles_sync_vehicle_core ON public.vehicles;
DROP FUNCTION IF EXISTS public.sync_vehicle_core_from_legacy();

DROP VIEW IF EXISTS public.vehicle_master_view;

DROP TRIGGER IF EXISTS vehicle_rental_set_updated_at ON public.vehicle_rental;
DROP TRIGGER IF EXISTS vehicle_fleet_set_updated_at ON public.vehicle_fleet;
DROP TRIGGER IF EXISTS vehicle_core_set_updated_at ON public.vehicle_core;
DROP FUNCTION IF EXISTS public.set_updated_at();

DROP TABLE IF EXISTS public.vehicle_rental;
DROP TABLE IF EXISTS public.vehicle_fleet;
DROP TABLE IF EXISTS public.vehicle_core;
