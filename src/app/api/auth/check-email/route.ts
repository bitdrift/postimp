import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error("check-email: listUsers failed", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }

  const user = data?.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    return NextResponse.json({ status: "new" });
  }

  console.log("check-email: found user", {
    email: user.email,
    email_confirmed_at: user.email_confirmed_at,
    confirmed_at: user.confirmed_at,
  });

  if (!user.email_confirmed_at) {
    return NextResponse.json({ status: "unconfirmed" });
  }

  return NextResponse.json({ status: "confirmed" });
}
