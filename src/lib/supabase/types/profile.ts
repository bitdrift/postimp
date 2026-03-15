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
