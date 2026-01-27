import { defineMiddleware } from "astro:middleware";

import { createSupabaseAdminClient } from "../db/supabase.admin.ts";
import { supabaseClient } from "../db/supabase.client.ts";

export const onRequest = defineMiddleware((context, next) => {
  context.locals.supabase = supabaseClient;
  context.locals.supabaseAdmin = createSupabaseAdminClient();
  return next();
});
