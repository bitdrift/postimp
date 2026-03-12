export interface Profile {
  id: string;
  phone: string | null;
  brand_name: string | null;
  brand_description: string | null;
  tone: string | null;
  caption_style: "polished" | "casual" | "minimal";
  target_audience: string | null;
  onboarding_completed: boolean;
  publish_platforms: string[];
  created_at: string;
  updated_at: string;
}

export interface InstagramConnection {
  id: string;
  organization_id: string;
  user_id: string | null;
  instagram_user_id: string;
  access_token: string;
  token_expires_at: string | null;
  instagram_username: string | null;
  granted_scopes: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface FacebookConnection {
  id: string;
  organization_id: string;
  user_id: string | null;
  facebook_user_id: string;
  facebook_page_id: string;
  page_name: string | null;
  page_access_token: string;
  granted_scopes: string[] | null;
  created_at: string;
  updated_at: string;
}

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

export type MessageDirection = "inbound" | "outbound";
export type MessageChannel = "sms" | "web";

export interface Message {
  id: string;
  profile_id: string | null;
  phone: string | null;
  direction: MessageDirection;
  body: string | null;
  media_url: string | null;
  twilio_sid: string | null;
  channel: MessageChannel;
  post_id: string | null;
  created_at: string;
}

export interface PostStats {
  id: string;
  post_id: string;
  data: {
    likes?: number;
    comments?: number;
    [key: string]: unknown;
  };
  fetched_at: string;
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

export type OrgRole = "owner" | "manager" | "member";

export interface Organization {
  id: string;
  name: string;
  creator_user_id: string | null;
  brand_name: string | null;
  brand_description: string | null;
  tone: string | null;
  target_audience: string | null;
  caption_style: string;
  publish_platforms: string[];
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
}
