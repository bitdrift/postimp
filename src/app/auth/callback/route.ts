import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getProfile, insertProfile } from "@/lib/db/profiles";
import { markRegistrationUsed } from "@/lib/db/registrations";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Create profile if it doesn't exist yet (first email confirmation)
      const db = createDbClient();
      const existing = await getProfile(db, data.user.id);

      if (!existing) {
        const metadata = data.user.user_metadata;
        const phone = metadata?.phone || null;
        const registrationToken = metadata?.registration_token || null;

        await insertProfile(db, { id: data.user.id, phone });

        // Mark registration token as used if present
        if (registrationToken) {
          await markRegistrationUsed(db, registrationToken);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
