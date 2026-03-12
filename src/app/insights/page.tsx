import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getActiveOrganization } from "@/lib/db/organizations";
import InsightsView from "./insights-view";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const db = createDbClient();
  const org = await getActiveOrganization(db, user.id);

  return <InsightsView activeOrgId={org?.id ?? null} />;
}
