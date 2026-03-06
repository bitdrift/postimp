import { createDbClient } from "@/lib/db/client";
import { makeSmsDeliver } from "@/lib/core/deliver";
import { routeMessage as coreRouteMessage } from "@/lib/core/router";

export async function routeMessage(
  profileId: string,
  phone: string,
  body: string,
  mediaUrl: string | null,
) {
  const db = createDbClient();
  const deliver = makeSmsDeliver(db, profileId, phone);

  await coreRouteMessage({ profileId, body, mediaUrl, channel: "sms" }, deliver);
}
