export interface MarketingArticleThread {
  id: string;
  article_id: string;
  slack_channel_id: string;
  slack_thread_ts: string;
  openai_response_id: string | null;
  created_by_slack_user: string | null;
  created_at: string;
  updated_at: string;
}
