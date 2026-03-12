import { NextRequest, NextResponse } from "next/server";
import { createDbClient } from "@/lib/db/client";
import { createClient } from "@/lib/supabase/server";
import { insertProfile } from "@/lib/db/profiles";
import { createOrganization } from "@/lib/db/organizations";
import { getUnusedRegistrationByToken, markRegistrationUsed } from "@/lib/db/registrations";
import { log, serializeError } from "@/lib/logger";

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

  const db = createDbClient();

  let phone: string | null = null;

  if (token) {
    // SMS signup: get phone from pending registration
    const registration = await getUnusedRegistrationByToken(db, token);

    if (!registration) {
      return NextResponse.json({ error: "Invalid or used token" }, { status: 400 });
    }

    phone = registration.phone;

    // Mark registration as used
    await markRegistrationUsed(db, token);
  }

  // Create profile
  try {
    await insertProfile(db, { id: user.id, phone });

    // Create a default organization for the user
    await createOrganization(db, user.id, "My Organization");

    log.info({
      operation: "api.auth.createProfile",
      message: "Profile and default organization created",
      profileId: user.id,
      hasPhone: !!phone,
    });
  } catch (error: unknown) {
    // Profile might already exist if there was a race condition
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code: string }).code
        : null;
    if (code !== "23505") {
      log.error({
        operation: "api.auth.createProfile",
        message: "Failed to create profile",
        error: serializeError(error),
      });
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
