
CREATE TABLE public.salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period text NOT NULL,
  basic numeric(10,2) NOT NULL DEFAULT 0,
  ot numeric(10,2) NOT NULL DEFAULT 0,
  bonus numeric(10,2) NOT NULL DEFAULT 0,
  deduction numeric(10,2) NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salaries TO authenticated;
GRANT ALL ON public.salaries TO service_role;

ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own or staff views all"
ON public.salaries FOR SELECT TO authenticated
USING (
  employee_id = auth.uid()
  OR public.has_role(auth.uid(), 'owner')
  OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Staff insert"
ON public.salaries FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'owner')
  OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Staff update"
ON public.salaries FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'owner')
  OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'owner')
  OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Owner delete"
ON public.salaries FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Guard column-level edits: only owner may change `basic` or `paid`
CREATE OR REPLACE FUNCTION public.salaries_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.basic <> OLD.basic AND NOT public.has_role(auth.uid(), 'owner') THEN
      RAISE EXCEPTION 'Only owner can change basic salary';
    END IF;
    IF NEW.paid <> OLD.paid AND NOT public.has_role(auth.uid(), 'owner') THEN
      RAISE EXCEPTION 'Only owner can mark salary paid';
    END IF;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  ELSIF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER salaries_guard_trigger
BEFORE INSERT OR UPDATE ON public.salaries
FOR EACH ROW EXECUTE FUNCTION public.salaries_guard();
