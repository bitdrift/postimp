export interface Profile {
  id: string;
  phone: string;
  brand_name: string | null;
  brand_description: string | null;
  tone: string | null;
  target_audience: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface InstagramConnection {
  id: string;
  profile_id: string;
  instagram_user_id: string;
  access_token: string;
  token_expires_at: string | null;
  instagram_username: string | null;
  created_at: string;
  updated_at: string;
}

export type PostStatus = "draft" | "published" | "cancelled";

export interface Post {
  id: string;
  profile_id: string;
  image_url: string;
  caption: string | null;
  status: PostStatus;
  preview_token: string;
  instagram_post_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageDirection = "inbound" | "outbound";

export interface Message {
  id: string;
  profile_id: string | null;
  phone: string;
  direction: MessageDirection;
  body: string | null;
  media_url: string | null;
  twilio_sid: string | null;
  created_at: string;
}

export interface PendingRegistration {
  id: string;
  phone: string;
  token: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}
