import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getSiteUrl } from "@/utils/site-url";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  const redirectTo = `${getSiteUrl()}${next.startsWith("/") ? next : "/" + next}`;

  if (!code) {
    return NextResponse.redirect(`${getSiteUrl()}/auth/login`);
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL(`${getSiteUrl()}/auth/login`);
    url.searchParams.set("error", "Link expired or already used. Request a new one.");
    return NextResponse.redirect(url.toString());
  }

  return NextResponse.redirect(redirectTo);
}
