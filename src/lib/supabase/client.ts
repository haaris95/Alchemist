"use client";

import { createBrowserClient } from "@supabase/ssr";
import { hasSupabaseConfig, supabasePublicConfig } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function isSupabaseConfigured() {
  return hasSupabaseConfig();
}

export function createSupabaseBrowserClient() {
  if (!browserClient) {
    const { url, key } = supabasePublicConfig();
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}
