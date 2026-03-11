import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  return <InsightsView />;
}
