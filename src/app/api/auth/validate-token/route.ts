import { NextRequest, NextResponse } from "next/server";
import { createDbClient } from "@/lib/db/client";
import { getRegistrationByToken } from "@/lib/db/registrations";

export async function POST(request: NextRequest) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const db = createDbClient();

  const registration = await getRegistrationByToken(db, token);

  if (!registration) {
    return NextResponse.json({ error: "Invalid signup link" }, { status: 400 });
  }

  if (registration.used) {
    return NextResponse.json({ error: "This signup link has already been used" }, { status: 400 });
  }

  if (new Date(registration.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "This signup link has expired. Text us to get a new one." },
      { status: 400 },
    );
  }

  return NextResponse.json({ phone: registration.phone });
}
