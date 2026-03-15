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
