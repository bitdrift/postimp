import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PostsList from "./posts-list";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();

  // Check onboarding
  const { data: profile } = await admin
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  // Fetch all posts for the user
  const { data: posts } = await admin
    .from("posts")
    .select("*")
    .eq("profile_id", user.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  return <PostsList posts={posts || []} />;
}
