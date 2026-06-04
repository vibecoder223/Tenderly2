"use client";

import { useEffect } from "react";

/**
 * Password-recovery links from Supabase use the implicit flow and land on the
 * site with the tokens in the URL *fragment*:
 *
 *   https://app.example.com/#access_token=…&type=recovery&refresh_token=…
 *
 * When the redirect URL isn't allow-listed, Supabase falls back to the Site URL
 * ("/"), so the fragment can arrive on any page. A fragment is never sent to the
 * server, which means server-side redirects (root page, middleware) can't route
 * it — only the browser can. This component runs on every page, detects a
 * recovery fragment, and forwards it (intact) to the reset-password page, which
 * establishes the session client-side and shows the new-password form.
 */
export default function RecoveryRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || !hash.includes("type=recovery")) return;
    if (window.location.pathname.startsWith("/auth/reset-password")) return;
    window.location.replace("/auth/reset-password" + hash);
  }, []);

  return null;
}
