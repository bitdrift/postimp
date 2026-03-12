import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFacebookAuthorizationUrl } from "@/lib/facebook/auth";
import { getBaseUrl } from "@/lib/core/url";
import { randomBytes } from "crypto";
import { log } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/account";
  const state = `${user.id}:${randomBytes(16).toString("hex")}:${returnTo}`;

  log.info({ operation: "api.facebook.auth", message: "Redirecting to Facebook OAuth" });

  const authUrl = getFacebookAuthorizationUrl(state, baseUrl);
  return NextResponse.redirect(authUrl);
}
