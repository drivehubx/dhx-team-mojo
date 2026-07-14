-- Vehicle Master architecture, Phase 1 (approved with minor revision) --
-- compatibility / convenience view.
--
-- This is purely additive: a read-only view for any future consumer that
-- wants the full joined picture of a vehicle across modules. It does NOT
-- replace, rename, or alter public.vehicles in any way -- dhx-rental and
-- dhx-driver are unaffected and require no code changes.
--
-- vehicle_fleet/vehicle_rental now own their operational/commercial fields
-- as real typed columns (synced one-way from `vehicles`), so this view
-- reads them directly rather than rejoining `vehicles` for that data.
-- `vehicles.status` is still surfaced as legacy_status for reference,
-- since the live availability states (available/rented/maintenance) have
-- no equivalent column on the new tables yet.
--
-- IMPORTANT: generated for review only, not applied to the live project.

CREATE VIEW public.vehicle_master_view AS
SELECT
  vc.id,
  vc.plate_number,
  vc.brand,
  vc.model,
  vc.year,
  vc.vin,
  vc.chassis_no,
  vc.engine_no,
  vc.owner_id,
  vc.master_vehicle_status,
  vc.source_system,
  vc.source_record_id,
  vc.migration_batch,
  vf.module_status     AS fleet_status,
  vf.mileage,
  vf.road_tax_expiry,
  vf.insurance_expiry,
  vf.puspakom_expiry,
  vf.notes,
  vf.photo_url,
  vr.module_status     AS rental_status,
  vr.daily_rate,
  vr.weekly_rate,
  vr.monthly_rate,
  v.status              AS legacy_status,
  vc.created_at,
  vc.updated_at
FROM public.vehicle_core vc
LEFT JOIN public.vehicle_fleet  vf ON vf.vehicle_core_id = vc.id
LEFT JOIN public.vehicle_rental vr ON vr.vehicle_core_id = vc.id
LEFT JOIN public.vehicles       v  ON v.id = vc.id;

GRANT SELECT ON public.vehicle_master_view TO authenticated;
GRANT SELECT ON public.vehicle_master_view TO service_role;
