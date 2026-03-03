import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Query auth.users table directly via admin client
  const { data, error } = await supabase
    .from("auth.users")
    .select("email_confirmed_at")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  // If direct table query fails (permissions), fall back to listUsers
  if (error) {
    const { data: listData } = await supabase.auth.admin.listUsers();
    const user = listData?.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      return NextResponse.json({ status: "new" });
    }
    if (!user.email_confirmed_at) {
      return NextResponse.json({ status: "unconfirmed" });
    }
    return NextResponse.json({ status: "confirmed" });
  }

  if (!data) {
    return NextResponse.json({ status: "new" });
  }

  if (!data.email_confirmed_at) {
    return NextResponse.json({ status: "unconfirmed" });
  }

  return NextResponse.json({ status: "confirmed" });
}
