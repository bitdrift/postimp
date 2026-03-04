import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ThreadView from "./thread-view";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();

  // Fetch post
  const { data: post } = await admin
    .from("posts")
    .select("*")
    .eq("id", postId)
    .eq("profile_id", user.id)
    .single();

  if (!post) {
    notFound();
  }

  // Fetch messages for this post
  const { data: messages } = await admin
    .from("messages")
    .select("*")
    .eq("profile_id", user.id)
    .eq("channel", "web")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  return (
    <ThreadView
      post={post}
      initialMessages={messages || []}
      profileId={user.id}
    />
  );
}
