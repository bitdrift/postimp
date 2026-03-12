import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getFacebookConnection, getPendingFacebookToken } from "@/lib/db/facebook";
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
  const [fb, pendingFb] = await Promise.all([
    getFacebookConnection(db, user.id),
    getPendingFacebookToken(db, user.id),
  ]);

  return <LookupView hasFacebook={!!fb || !!pendingFb} />;
}
