export type PostStatus = "draft" | "published" | "cancelled";

export interface Post {
  id: string;
  profile_id: string;
  organization_id: string | null;
  image_url: string;
  caption: string | null;
  status: PostStatus;
  preview_token: string;
  openai_conversation_id: string | null;
  instagram_post_id: string | null;
  instagram_permalink: string | null;
  facebook_post_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
