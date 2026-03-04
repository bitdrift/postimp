import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewPostView from "./new-post-view";

export default async function NewPostPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <NewPostView />;
}
