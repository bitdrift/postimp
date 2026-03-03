import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ChatView from "./chat-view";

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

  // Fetch recent web messages
  const { data: messages } = await admin
    .from("messages")
    .select("*")
    .eq("profile_id", user.id)
    .eq("channel", "web")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <ChatView
      initialMessages={(messages || []).reverse()}
      profileId={user.id}
    />
  );
}
