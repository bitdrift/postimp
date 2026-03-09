import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizationUrl } from "@/lib/instagram/auth";
import { getBaseUrl } from "@/lib/core/url";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  // Use user ID as state to prevent CSRF and identify user on callback
  const state = `${user.id}:${randomBytes(16).toString("hex")}`;

  const authUrl = getAuthorizationUrl(state, baseUrl);
  return NextResponse.redirect(authUrl);
}
