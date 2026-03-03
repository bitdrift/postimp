import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { token } = await request.json();

  // Get the current authenticated user
  const serverSupabase = await createClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createAdminClient();

  let phone: string | null = null;

  if (token) {
    // SMS signup: get phone from pending registration
    const { data: registration } = await supabase
      .from("pending_registrations")
      .select("phone")
      .eq("token", token)
      .eq("used", false)
      .single();

    if (!registration) {
      return NextResponse.json(
        { error: "Invalid or used token" },
        { status: 400 }
      );
    }

    phone = registration.phone;

    // Mark registration as used
    await supabase
      .from("pending_registrations")
      .update({ used: true })
      .eq("token", token);
  }

  // Create profile
  const { error: profileError } = await supabase.from("profiles").insert({
    id: user.id,
    phone,
  });

  if (profileError) {
    // Profile might already exist if there was a race condition
    if (!profileError.message.includes("duplicate")) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
