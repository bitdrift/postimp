import { NextRequest, NextResponse } from "next/server";
import { validateTwilioRequest } from "@/lib/twilio/validate";
import { sendSms } from "@/lib/twilio/client";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = value.toString();
  });

  // Validate Twilio signature
  const signature = request.headers.get("x-twilio-signature") || "";
  const url =
    process.env.NEXT_PUBLIC_APP_URL + "/api/webhooks/twilio";

  if (process.env.NODE_ENV === "production") {
    if (!validateTwilioRequest(signature, url, params)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const from = params.From;
  const body = params.Body?.trim() || "";
  const mediaUrl = params.MediaUrl0 || null;
  const messageSid = params.MessageSid || null;

  const supabase = createAdminClient();

  // Log inbound message
  // First, check if this phone has a profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("phone", from)
    .single();

  await supabase.from("messages").insert({
    profile_id: profile?.id || null,
    phone: from,
    direction: "inbound",
    body,
    media_url: mediaUrl,
    twilio_sid: messageSid,
  });

  // Route the message
  if (!profile) {
    // Unregistered user — send signup link
    // Check for existing pending registration
    const { data: existing } = await supabase
      .from("pending_registrations")
      .select("token")
      .eq("phone", from)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    let token: string;
    if (existing) {
      token = existing.token;
    } else {
      const { data: registration } = await supabase
        .from("pending_registrations")
        .insert({ phone: from })
        .select("token")
        .single();
      token = registration!.token;
    }

    const signupUrl = `${process.env.NEXT_PUBLIC_APP_URL}/signup?token=${token}`;
    await sendSms(
      from,
      `Welcome to Post Imp! 🎯 Sign up to get started: ${signupUrl}`
    );

    // Log outbound
    await supabase.from("messages").insert({
      phone: from,
      direction: "outbound",
      body: `Welcome to Post Imp! 🎯 Sign up to get started: ${signupUrl}`,
    });
  } else {
    // Registered user — route to SMS handler (Phase 7)
    // For now, import and call the router
    const { routeMessage } = await import("@/lib/sms/router");
    await routeMessage(profile.id, from, body, mediaUrl);
  }

  // Return empty TwiML response
  return new NextResponse("<Response/>", {
    headers: { "Content-Type": "text/xml" },
  });
}
