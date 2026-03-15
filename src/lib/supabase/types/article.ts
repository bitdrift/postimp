export interface MarketingArticle {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  author: string;
  tags: string[];
  published: boolean;
  published_at: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  created_at: string;
  updated_at: string;
}
