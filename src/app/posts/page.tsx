import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getProfile } from "@/lib/db/profiles";
import { getPostsByProfile } from "@/lib/db/posts";
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

  // Check onboarding
  const profile = await getProfile(db, user.id);

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  // Fetch all posts for the user
  const posts = await getPostsByProfile(db, user.id);

  return <PostsList posts={posts} />;
}
