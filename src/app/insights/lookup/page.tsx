import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getFacebookConnection, getPendingFacebookToken } from "@/lib/db/facebook";
import { getActiveOrganization } from "@/lib/db/organizations";
import LookupView from "./lookup-view";

export const dynamic = "force-dynamic";

export default async function LookupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const db = createDbClient();
  const org = await getActiveOrganization(db, user.id);

  if (!org) {
    redirect("/posts");
  }

  const [fb, pendingFb] = await Promise.all([
    getFacebookConnection(db, org.id),
    getPendingFacebookToken(db, org.id),
  ]);

  return <LookupView hasFacebook={!!fb || !!pendingFb} />;
}
