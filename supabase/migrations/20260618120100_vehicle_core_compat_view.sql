-- Vehicle Master architecture, Phase 1 -- compatibility / convenience view.
--
-- This is purely additive: a read-only view for any future consumer that
-- wants the full joined picture of a vehicle across modules. It does NOT
-- replace, rename, or alter public.vehicles in any way -- dhx-rental and
-- dhx-driver are unaffected and require no code changes.
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
  vf.module_status   AS fleet_status,
  vf.module_data      AS fleet_data,
  vr.module_status   AS rental_status,
  vr.module_data      AS rental_data,
  vd.module_status   AS driver_status,
  vd.module_data      AS driver_data,
  vc.created_at,
  vc.updated_at
FROM public.vehicle_core vc
LEFT JOIN public.vehicle_fleet  vf ON vf.vehicle_core_id = vc.id
LEFT JOIN public.vehicle_rental vr ON vr.vehicle_core_id = vc.id
LEFT JOIN public.vehicle_driver vd ON vd.vehicle_core_id = vc.id;

GRANT SELECT ON public.vehicle_master_view TO authenticated;
GRANT SELECT ON public.vehicle_master_view TO service_role;
