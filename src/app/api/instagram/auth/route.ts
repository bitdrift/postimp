import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizationUrl } from "@/lib/instagram/auth";
import { randomBytes } from "crypto";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
  }

  // Use user ID as state to prevent CSRF and identify user on callback
  const state = `${user.id}:${randomBytes(16).toString("hex")}`;

  const authUrl = getAuthorizationUrl(state);
  return NextResponse.redirect(authUrl);
}
