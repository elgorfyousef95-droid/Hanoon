
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

(() => {
  "use strict";

  const HANOON = window.HANOON = window.HANOON || {};

  const SUPABASE_URL =
    "https://gjtgvczvclfwvlvcquxh.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_4DVTUZ-xTlqU2GpFvpb7lw_g-Kxomd4";

  if (HANOON.supabase) {
    window.dispatchEvent(
      new CustomEvent("hanoon:supabase-ready")
    );
    return;
  }

  try {
    HANOON.supabase = createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storageKey: "hanoon-auth-v1"
        },

        global: {
          headers: {
            "X-Client-Info": "hanoon-web"
          }
        }
      }
    );

    window.dispatchEvent(
      new CustomEvent("hanoon:supabase-ready")
    );

    console.info("HANOON: Supabase client is ready.");

  } catch (error) {
    console.error(
      "HANOON: Supabase initialization failed:",
      error
    );

    window.dispatchEvent(
      new CustomEvent("hanoon:supabase-error", {
        detail: {
          message: error.message
        }
      })
    );
  }
})();
