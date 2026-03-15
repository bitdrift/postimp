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
