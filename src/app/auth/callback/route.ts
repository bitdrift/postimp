import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Create profile if it doesn't exist yet (first email confirmation)
      const admin = createAdminClient();
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (!existing) {
        const metadata = data.user.user_metadata;
        const phone = metadata?.phone || null;
        const registrationToken = metadata?.registration_token || null;

        await admin.from("profiles").insert({
          id: data.user.id,
          phone,
        });

        // Mark registration token as used if present
        if (registrationToken) {
          await admin
            .from("pending_registrations")
            .update({ used: true })
            .eq("token", registrationToken);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
