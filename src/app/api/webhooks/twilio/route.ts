import { NextRequest, NextResponse } from "next/server";
import { validateTwilioRequest } from "@/lib/twilio/validate";
import { sendSms } from "@/lib/twilio/client";
import { createDbClient } from "@/lib/db/client";
import { getProfileByPhone } from "@/lib/db/profiles";
import { getValidRegistration, insertRegistration } from "@/lib/db/registrations";
import { insertMessage } from "@/lib/db/messages";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = value.toString();
  });

  // Validate Twilio signature
  const signature = request.headers.get("x-twilio-signature") || "";
  const url = process.env.NEXT_PUBLIC_APP_URL + "/api/webhooks/twilio";

  if (process.env.NODE_ENV === "production") {
    if (!validateTwilioRequest(signature, url, params)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const from = params.From;
  const body = params.Body?.trim() || "";
  const mediaUrl = params.MediaUrl0 || null;
  const messageSid = params.MessageSid || null;

  const db = createDbClient();

  // Log inbound message
  // First, check if this phone has a profile
  const profile = await getProfileByPhone(db, from);

  await insertMessage(db, {
    profile_id: profile?.id || null,
    phone: from,
    direction: "inbound",
    body,
    media_url: mediaUrl,
    twilio_sid: messageSid,
    channel: "sms",
  });

  // Route the message
  if (!profile) {
    // Unregistered user — send signup link
    // Check for existing pending registration
    const existing = await getValidRegistration(db, from);

    let token: string;
    if (existing) {
      token = existing.token;
    } else {
      const registration = await insertRegistration(db, from);
      token = registration.token;
    }

    const signupUrl = `${process.env.NEXT_PUBLIC_APP_URL}/signup?token=${token}`;
    const welcomeMsg =
      `Post Imp: You're signed up for SMS notifications including draft captions, post confirmations, and account updates. ` +
      `Sign up to get started: ${signupUrl} ` +
      `For help, reply HELP. To opt out, reply STOP.`;
    await sendSms(from, welcomeMsg);

    // Log outbound
    await insertMessage(db, {
      profile_id: null,
      phone: from,
      direction: "outbound",
      body: welcomeMsg,
      channel: "sms",
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
