import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getPostById } from "@/lib/db/posts";
import { getMessages } from "@/lib/db/messages";
import ThreadView from "./thread-view";

export default async function ThreadPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const db = createDbClient();

  // Fetch post
  const post = await getPostById(db, postId, user.id);

  if (!post) {
    notFound();
  }

  // Fetch messages for this post
  const messages = await getMessages(db, user.id, {
    channel: "web",
    postId,
    ascending: true,
  });

  return <ThreadView post={post} initialMessages={messages} profileId={user.id} />;
}
