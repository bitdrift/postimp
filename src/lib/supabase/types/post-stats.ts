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
