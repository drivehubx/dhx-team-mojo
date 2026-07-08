// Cross-schema helper for the shared DHX backend.
// The auto-generated typed client only covers the `public` schema, so we cast
// the base supabase client to `any` when hopping into `core.*` / `workshop.*`
// or when using storage buckets that aren't in the generated types.
import { supabase } from "@/integrations/supabase/client";

export const dhx = supabase as any;
export const dhxCore = () => (supabase as any).schema("core");
export const dhxWorkshop = () => (supabase as any).schema("workshop");
export const dhxStorage = (supabase as any).storage;

export const DHX_DOCS_BUCKET = "dhx-docs";
