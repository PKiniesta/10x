import { test as teardown } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import dotenv from "dotenv";

import type { Database } from "../../src/db/database.types";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testUserId = process.env.E2E_USERNAME_ID;

teardown("cleanup test data", async () => {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY - skipping cleanup");
    return;
  }

  if (!testUserId) {
    console.warn("Missing E2E_USERNAME_ID - skipping cleanup");
    return;
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  console.log(`Cleaning up test data for user: ${testUserId}`);

  const { error: proposalLogsError } = await supabase.from("ai_proposal_logs").delete().eq("user_id", testUserId);

  if (proposalLogsError) {
    console.error("Failed to delete ai_proposal_logs:", proposalLogsError.message);
  } else {
    console.log("Deleted ai_proposal_logs for test user");
  }

  const { error: cardsError } = await supabase.from("cards").delete().eq("user_id", testUserId);

  if (cardsError) {
    console.error("Failed to delete cards:", cardsError.message);
  } else {
    console.log("Deleted cards for test user");
  }

  const { error: generationsError } = await supabase.from("ai_generation_requests").delete().eq("user_id", testUserId);

  if (generationsError) {
    console.error("Failed to delete ai_generation_requests:", generationsError.message);
  } else {
    console.log("Deleted ai_generation_requests for test user");
  }

  console.log("Cleanup completed");
});
