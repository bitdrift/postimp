import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getProfile } from "@/lib/db/profiles";
import { getPostsByOrganization } from "@/lib/db/posts";
import { getActiveOrganization } from "@/lib/db/organizations";
import PostsList from "./posts-list";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const db = createDbClient();

  const [profile, org] = await Promise.all([
    getProfile(db, user.id),
    getActiveOrganization(db, user.id),
  ]);

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  if (!org) {
    redirect("/onboarding");
  }

  // Fetch both views in parallel: my posts and all org posts
  const [myPosts, allPosts] = await Promise.all([
    getPostsByOrganization(db, org.id, user.id),
    getPostsByOrganization(db, org.id),
  ]);

  return (
    <PostsList
      myPosts={myPosts}
      allPosts={allPosts}
      activeOrgId={org.id}
      activeOrgName={org.name}
    />
  );
}
