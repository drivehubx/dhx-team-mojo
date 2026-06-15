-- Add initials to existing profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS initials TEXT NOT NULL DEFAULT '??';

-- Roles enum (drop guard for re-run)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'worker');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','manager'));
$$;

DROP POLICY IF EXISTS "User can read own roles" ON public.user_roles;
CREATE POLICY "User can read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Owner manages roles" ON public.user_roles;
CREATE POLICY "Owner manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Profile read policy (open to authenticated for team views)
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;
CREATE POLICY "Authenticated can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Self can update profile" ON public.profiles;
CREATE POLICY "Self can update profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Owner can update any profile" ON public.profiles;
CREATE POLICY "Owner can update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- New-user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  display_name TEXT;
  initials_val TEXT;
  is_first_user BOOLEAN;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  initials_val := UPPER(LEFT(REGEXP_REPLACE(display_name, '[^A-Za-z]', '', 'g'), 2));

  INSERT INTO public.profiles (id, full_name, initials, role)
  VALUES (NEW.id, display_name, COALESCE(NULLIF(initials_val, ''), '??'), 'Helper')
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first_user;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first_user THEN 'owner'::public.app_role ELSE 'worker'::public.app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- Phase 1: Advances
-- =========================================

DO $$ BEGIN CREATE TYPE public.advance_type AS ENUM ('borrow','repayment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.advance_status AS ENUM ('pending','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type public.advance_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason TEXT,
  status public.advance_status NOT NULL DEFAULT 'pending',
  requested_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advances TO authenticated;
GRANT ALL ON public.advances TO service_role;

ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS advances_employee_idx ON public.advances(employee_id);
CREATE INDEX IF NOT EXISTS advances_status_idx ON public.advances(status);

DROP POLICY IF EXISTS "Read advances scoped" ON public.advances;
CREATE POLICY "Read advances scoped" ON public.advances FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Worker creates own borrow request" ON public.advances;
CREATE POLICY "Worker creates own borrow request" ON public.advances FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = auth.uid() AND type = 'borrow'
    AND status = 'pending' AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS "Staff insert any advance" ON public.advances;
CREATE POLICY "Staff insert any advance" ON public.advances FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update advances" ON public.advances;
CREATE POLICY "Staff update advances" ON public.advances FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff delete advances" ON public.advances;
CREATE POLICY "Staff delete advances" ON public.advances FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_advances_updated_at BEFORE UPDATE ON public.advances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
