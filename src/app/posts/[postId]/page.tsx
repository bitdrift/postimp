import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getPostById } from "@/lib/db/posts";
import { getMessages } from "@/lib/db/messages";
import { getInstagramConnection } from "@/lib/db/instagram";
import ThreadView from "./thread-view";

async function fetchInstagramProfile(
  userId: string,
  accessToken: string,
): Promise<{ profilePicUrl: string | null; followersCount: number | null } | null> {
  try {
    const res = await fetch(
      `https://graph.instagram.com/v21.0/${userId}?fields=profile_picture_url,followers_count&access_token=${accessToken}`,
      { next: { revalidate: 3600 } },
    );
    const data = await res.json();
    if (data.error) return null;
    return {
      profilePicUrl: data.profile_picture_url ?? null,
      followersCount: data.followers_count ?? null,
    };
  } catch {
    return null;
  }
}

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

  // Fetch post and Instagram connection in parallel
  const [post, igConnection] = await Promise.all([
    getPostById(db, postId, user.id),
    getInstagramConnection(db, user.id),
  ]);

  if (!post) {
    notFound();
  }

  // Fetch messages and Instagram profile in parallel
  const [messages, igProfile] = await Promise.all([
    getMessages(db, user.id, { channel: "web", postId, ascending: true }),
    igConnection
      ? fetchInstagramProfile(igConnection.instagram_user_id, igConnection.access_token)
      : null,
  ]);

  return (
    <ThreadView
      post={post}
      initialMessages={messages}
      profileId={user.id}
      instagramUsername={igConnection?.instagram_username ?? null}
      instagramProfilePic={igProfile?.profilePicUrl ?? null}
      instagramFollowers={igProfile?.followersCount ?? null}
    />
  );
}
