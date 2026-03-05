import { sendSms } from "@/lib/twilio/client";
import { insertMessage } from "@/lib/db/messages";
import type { DbClient } from "@/lib/db/client";
import type { DeliverFn } from "./types";

export function makeWebDeliver(db: DbClient, profileId: string): DeliverFn {
  return async (reply: string, postId?: string) => {
    await insertMessage(db, {
      profile_id: profileId,
      direction: "outbound",
      body: reply,
      channel: "web",
      ...(postId && { post_id: postId }),
    });
  };
}

export function makeSmsDeliver(db: DbClient, profileId: string, phone: string): DeliverFn {
  return async (reply: string, postId?: string) => {
    await sendSms(phone, reply);
    await insertMessage(db, {
      profile_id: profileId,
      phone,
      direction: "outbound",
      body: reply,
      channel: "sms",
      ...(postId && { post_id: postId }),
    });
  };
}
