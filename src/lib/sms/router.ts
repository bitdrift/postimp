import { createAdminClient } from "@/lib/supabase/admin";
import { makeSmsDeliver } from "@/lib/core/deliver";
import { routeMessage as coreRouteMessage } from "@/lib/core/router";

export async function routeMessage(
  profileId: string,
  phone: string,
  body: string,
  mediaUrl: string | null
) {
  const supabase = createAdminClient();
  const deliver = makeSmsDeliver(supabase, profileId, phone);

  await coreRouteMessage(
    { profileId, body, mediaUrl, channel: "sms" },
    deliver
  );
}
