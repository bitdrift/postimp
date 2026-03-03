import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/twilio/client";
import type { DeliverFn } from "./types";

export function makeWebDeliver(
  supabase: ReturnType<typeof createAdminClient>,
  profileId: string
): DeliverFn {
  return async (reply: string) => {
    await supabase.from("messages").insert({
      profile_id: profileId,
      direction: "outbound",
      body: reply,
      channel: "web",
    });
  };
}

export function makeSmsDeliver(
  supabase: ReturnType<typeof createAdminClient>,
  profileId: string,
  phone: string
): DeliverFn {
  return async (reply: string) => {
    await sendSms(phone, reply);
    await supabase.from("messages").insert({
      profile_id: profileId,
      phone,
      direction: "outbound",
      body: reply,
      channel: "sms",
    });
  };
}
